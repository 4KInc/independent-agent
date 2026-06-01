"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  KeyRound, UserPlus, Copy, CheckCircle2, AlertTriangle, Loader2,
  Download, Shield, Clock,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function copyText(t: string) { navigator.clipboard.writeText(t); }

function timeAgo(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function b64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ─── Agent Registration Form ─────────────────────────────────────────────────

type FormMode = "generate" | "paste";

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<FormMode>("generate");
  const [agentName, setAgentName] = useState("");
  const [pastedKey, setPastedKey] = useState("");
  const [generatedJwk, setGeneratedJwk] = useState<any>(null);
  const [privateKeyObj, setPrivateKeyObj] = useState<CryptoKey | null>(null);
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [agentCardUrl, setAgentCardUrl] = useState("");
  const [liveChallengeUrl, setLiveChallengeUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);

  // Auto-generate agent_id from name
  const agentId = agentName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
  const nameValid = agentName.trim().length >= 3;
  const idValid = agentId.length >= 3;

  // Parse pasted key
  function parsePastedKey(): { jwk: any; error: string } {
    const trimmed = pastedKey.trim();
    if (!trimmed) return { jwk: null, error: "" };

    // Try JSON parse (full JWK)
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.kty === "OKP" && parsed.crv === "Ed25519" && parsed.x) {
        // Validate x length (32 bytes → 43-44 base64url chars)
        const xClean = parsed.x.replace(/[^A-Za-z0-9_-]/g, "");
        if (xClean.length >= 42 && xClean.length <= 44) {
          return { jwk: { kty: "OKP", crv: "Ed25519", x: parsed.x }, error: "" };
        }
        return { jwk: null, error: "JWK x value has invalid length for Ed25519" };
      }
      return { jwk: null, error: "Expected JWK with kty: OKP, crv: Ed25519, x: <base64url>" };
    } catch {
      // Not JSON — try as raw base64url x value
      const cleaned = trimmed.replace(/\s/g, "");
      if (/^[A-Za-z0-9_-]{42,44}$/.test(cleaned)) {
        return { jwk: { kty: "OKP", crv: "Ed25519", x: cleaned }, error: "" };
      }
      return { jwk: null, error: "Expected Ed25519 JWK JSON or base64url public key (43 chars)" };
    }
  }

  const pasteResult = parsePastedKey();

  // Generate keypair using Web Crypto
  async function generateKeypair() {
    setError("");
    try {
      const keyPair = await crypto.subtle.generateKey(
        { name: "Ed25519" } as any, true, ["sign", "verify"]
      );
      const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
      const x = b64url(new Uint8Array(pubRaw));
      const jwk = { kty: "OKP", crv: "Ed25519", x };
      setGeneratedJwk(jwk);
      setPrivateKeyObj(keyPair.privateKey);

      // Export private key as PKCS8 PEM
      const privRaw = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
      const privB64 = btoa(String.fromCharCode(...new Uint8Array(privRaw)));
      const pem = `-----BEGIN PRIVATE KEY-----\n${privB64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
      setPrivateKeyPem(pem);
      setKeySaved(false);
    } catch (e: any) {
      setError("Browser does not support Ed25519 key generation. Please paste a public key instead.");
      setMode("paste");
    }
  }

  // Download private key
  function downloadPrivateKey() {
    const blob = new Blob([privateKeyPem], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${agentId || "agent"}-private-key.pem`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // JCS-subset canonicalization (matches gateway/canonical.py)
  function canonicalize(obj: any): string {
    if (obj === null) return "null";
    if (typeof obj === "boolean") return obj ? "true" : "false";
    if (typeof obj === "number") return String(obj);
    if (typeof obj === "string") return JSON.stringify(obj);
    if (Array.isArray(obj)) return "[" + obj.map(canonicalize).join(",") + "]";
    if (typeof obj === "object") {
      const keys = Object.keys(obj).sort();
      return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
    }
    throw new Error("Unsupported type");
  }

  // Submit registration with Proof of Possession
  async function handleSubmit() {
    setError("");
    setLoading(true);

    const jwk = mode === "generate" ? generatedJwk : pasteResult.jwk;
    if (!jwk) {
      setError("No valid public key available");
      setLoading(false);
      return;
    }

    if (mode === "generate" && !privateKeyObj) {
      setError("Private key not available. Please regenerate the keypair.");
      setLoading(false);
      return;
    }

    try {
      // Step 1: Get challenge
      const chResp = await fetch(`${BASE}/api/agents/gateway/agents/register-challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId }),
      });
      if (!chResp.ok) {
        setError("Failed to get registration challenge. Please try again.");
        setLoading(false);
        return;
      }
      const challenge = await chResp.json();

      // Step 2: Sign the canonical message
      const iat = Math.floor(Date.now() / 1000);
      const message = canonicalize({
        v: "1",
        tenant_id: "hackathon-demo",
        agent_id: agentId,
        public_key: jwk,
        nonce: challenge.nonce,
        challenge_id: challenge.challenge_id,
        iat: iat,
      });
      const msgBytes = new TextEncoder().encode(message);

      let sigB64: string;
      if (mode === "generate" && privateKeyObj) {
        // Sign with Web Crypto
        const sigBuf = await crypto.subtle.sign("Ed25519" as any, privateKeyObj, msgBytes);
        sigB64 = b64url(new Uint8Array(sigBuf));
      } else {
        setError("Paste mode requires signing externally. Use 'Generate for me' mode for browser-based PoP.");
        setLoading(false);
        return;
      }

      // Step 3: Register with proof
      const payload: any = {
        agent_id: agentId,
        public_key: jwk,
        proof: {
          nonce: challenge.nonce,
          challenge_id: challenge.challenge_id,
          signature: sigB64,
          iat: iat,
        },
      };
      if (agentCardUrl.trim()) {
        payload.agent_card_url = agentCardUrl.trim();
      }
      if (liveChallengeUrl.trim()) {
        payload.live_challenge_url = liveChallengeUrl.trim();
      }
      const resp = await fetch(`${BASE}/api/agents/gateway/agents/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (resp.ok && data.status === "registered") {
        setSuccess(data);
        onSuccess();
      } else if (data.detail) {
        setError(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
      } else if (data.error) {
        setError(data.error);
      } else {
        setError("Registration failed. Please check your inputs and try again.");
      }
    } catch (e: any) {
      setError("Could not reach the Gateway. Please try again.");
    }
    setLoading(false);
  }

  // Can submit?
  // Paste mode cannot do browser-side PoP (no private key); only generate mode works
  const canSubmit =
    nameValid && idValid &&
    !loading &&
    mode === "generate" && generatedJwk && keySaved && privateKeyObj !== null;

  // Reset form
  function reset() {
    setAgentName("");
    setPastedKey("");
    setAgentCardUrl("");
    setLiveChallengeUrl("");
    setGeneratedJwk(null);
    setPrivateKeyObj(null);
    setPrivateKeyPem("");
    setKeySaved(false);
    setSuccess(null);
    setError("");
  }

  if (success) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-medium text-emerald-700 dark:text-emerald-400">Agent registered successfully</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-20">Agent ID:</span>
              <code className="font-[var(--font-geist-mono)] bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{success.agent_id}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-20">Key ID:</span>
              <code className="font-[var(--font-geist-mono)] bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{success.kid}</code>
              <button onClick={() => copyText(success.kid)} className="text-muted-foreground hover:text-foreground cursor-pointer"><Copy className="w-3 h-3" /></button>
            </div>
          </div>
          {success.proof_of_possession_at_registration && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="w-3 h-3" />
              Registered with cryptographic proof of possession
            </div>
          )}
          {success.agent_card_verification === "verified" && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="w-3 h-3" />
              A2A card verified — registered key matches the card
            </div>
          )}
          {success.agent_card_verification === "failed" && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                A2A card verification failed: {success.agent_card_verification_reason}
              </div>
              <p className="text-xs text-muted-foreground ml-5">
                Registration succeeded (PoP verified). The card verification can be retried later.
              </p>
            </div>
          )}
          {success.agent_card_verification === "skipped" && agentCardUrl === "" && (
            <div className="text-xs text-muted-foreground">
              A2A card verification skipped — no card URL provided.
            </div>
          )}
          {success.live_challenge_verification === "verified" && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="w-3 h-3" />
              Live challenge passed — agent is reachable and controls the key
            </div>
          )}
          {success.live_challenge_verification === "failed" && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                Live challenge failed: {success.live_challenge_verification_reason}
              </div>
              <p className="text-xs text-muted-foreground ml-5">
                Registration succeeded. The live challenge can be retried after deployment.
              </p>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={reset}>Register another agent</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">Register New Agent</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Agent Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Agent Name <span className="text-rose-500">*</span></label>
          <input
            className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2"
            placeholder="e.g., Claude Analytics Prod"
            value={agentName}
            onChange={e => setAgentName(e.target.value)}
          />
          {agentName.trim().length > 0 && agentName.trim().length < 3 && <p className="text-xs text-rose-500">Must be at least 3 characters</p>}
          {agentId && (
            <p className="text-xs text-muted-foreground">Agent ID: <code className="font-[var(--font-geist-mono)] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{agentId}</code> (auto-generated)</p>
          )}
        </div>

        {/* Key mode toggle */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Public Key</label>
          <div className="flex gap-2">
            <Button
              variant={mode === "generate" ? "default" : "outline"} size="sm"
              onClick={() => setMode("generate")} type="button"
            >Generate for me</Button>
            <Button
              variant={mode === "paste" ? "default" : "outline"} size="sm"
              onClick={() => setMode("paste")} type="button"
            >Paste my own</Button>
          </div>
        </div>

        {/* Generate mode */}
        {mode === "generate" && (
          <div className="space-y-3">
            {!generatedJwk ? (
              <Button variant="outline" onClick={generateKeypair} disabled={!idValid} type="button">
                <KeyRound className="w-3.5 h-3.5 mr-2" />
                Generate Ed25519 Keypair
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-2">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Keypair generated</p>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Public key (x):</span>{" "}
                    <code className="font-[var(--font-geist-mono)]">{generatedJwk.x.slice(0, 24)}...</code>
                  </div>
                </div>
                <div className="rounded-md border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Save your private key now</p>
                      <p className="text-xs text-muted-foreground">This key will not be shown again. You need it to sign DPoP proofs for authorization requests.</p>
                      <Button variant="outline" size="sm" onClick={downloadPrivateKey} type="button">
                        <Download className="w-3.5 h-3.5 mr-2" />
                        Download Private Key (.pem)
                      </Button>
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keySaved}
                    onChange={e => setKeySaved(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  I have saved my private key securely
                </label>
              </div>
            )}
          </div>
        )}

        {/* Paste mode */}
        {mode === "paste" && (
          <div className="space-y-2">
            <textarea
              className="w-full font-[var(--font-geist-mono)] text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 min-h-20 resize-y"
              placeholder={'Paste Ed25519 JWK JSON:\n{"kty":"OKP","crv":"Ed25519","x":"..."}\n\nOr paste the raw base64url public key (x value)'}
              value={pastedKey}
              onChange={e => setPastedKey(e.target.value)}
            />
            {pasteResult.error && <p className="text-xs text-rose-500">{pasteResult.error}</p>}
            {pasteResult.jwk && <p className="text-xs text-emerald-600">Valid Ed25519 public key detected</p>}
            <p className="text-xs text-amber-600">Note: Browser registration requires proof of possession. Use "Generate for me" to register via the browser, or use the CLI for externally-generated keys.</p>
          </div>
        )}

        {/* Agent Card URL (optional) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Agent Card URL <span className="text-xs text-muted-foreground">(optional)</span>
          </label>
          <input
            type="url"
            className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 font-[var(--font-geist-mono)]"
            placeholder="https://your-agent.example.com/.well-known/agent-card.json"
            value={agentCardUrl}
            onChange={e => setAgentCardUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            If your agent publishes an A2A card, paste its URL here. The Gateway will verify the
            public key matches. Leave blank if the agent is not yet deployed.
          </p>
        </div>

        {/* Live Challenge URL (optional) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Live Challenge URL <span className="text-xs text-muted-foreground">(optional)</span>
          </label>
          <input
            type="url"
            className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 font-[var(--font-geist-mono)]"
            placeholder="https://your-agent.example.com/live-challenge"
            value={liveChallengeUrl}
            onChange={e => setLiveChallengeUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            If your agent accepts signed challenges, the Gateway will POST a fresh nonce and verify
            the response. Proves the agent is reachable AND controls the private key right now.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 p-3">
            <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {loading && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
            Register Agent
          </Button>
          <Button variant="ghost" onClick={reset} type="button">Reset</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Registered Agents List ──────────────────────────────────────────────────

function AgentsList({ agents, loading }: { agents: any[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 justify-center py-8 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading agents...
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No agents registered yet. Use the form above to register your first agent.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Agent ID</th>
            <th className="py-2 pr-4 font-medium">Key ID</th>
            <th className="py-2 pr-4 font-medium">Card</th>
            <th className="py-2 pr-4 font-medium">Live</th>
            <th className="py-2 font-medium">Registered</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent: any) => (
            <tr key={agent.agent_id} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="py-2.5 pr-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  <code className="font-[var(--font-geist-mono)] text-xs">{agent.agent_id}</code>
                </div>
              </td>
              <td className="py-2.5 pr-4">
                <div className="flex items-center gap-1.5">
                  <code className="font-[var(--font-geist-mono)] text-xs text-muted-foreground">
                    {agent.kid}
                  </code>
                  <button onClick={() => copyText(agent.kid)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </td>
              <td className="py-2.5 pr-4">
                {agent.agent_card_verification === "verified" && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600" title={`Card: ${agent.agent_card_url || ""}`}>
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                )}
                {agent.agent_card_verification === "failed" && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600" title={agent.agent_card_verification_reason || ""}>
                    <AlertTriangle className="w-3 h-3" /> Unverified
                  </span>
                )}
                {(!agent.agent_card_verification || agent.agent_card_verification === "skipped") && (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2.5 pr-4">
                {agent.live_challenge_verification === "verified" && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600" title="Agent is reachable and controls the key">
                    <CheckCircle2 className="w-3 h-3" /> Live
                  </span>
                )}
                {agent.live_challenge_verification === "failed" && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600" title={agent.live_challenge_verification_reason || ""}>
                    <AlertTriangle className="w-3 h-3" /> Failed
                  </span>
                )}
                {(!agent.live_challenge_verification || agent.live_challenge_verification === "skipped") && (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {agent.registered_at ? timeAgo(agent.registered_at) : "—"}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const resp = await fetch(`${BASE}/api/agents/gateway/agents`);
      const data = await resp.json();
      setAgents(data.agents || []);
    } catch {
      // silently fail
    }
    setAgentsLoading(false);
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <div className="flex-1 max-w-[900px] mx-auto w-full p-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Registered Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register AI agents with the Gateway. Each agent receives a unique key ID (kid) used to verify its DPoP identity proofs during authorization.
          </p>
        </div>

        <RegisterForm onSuccess={fetchAgents} />

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">All Registered Agents</CardTitle>
              <Badge variant="outline" className="text-xs">{agents.length} agents</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <AgentsList agents={agents} loading={agentsLoading} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
