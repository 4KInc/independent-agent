"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  KeyRound, UserPlus, Copy, CheckCircle2, AlertTriangle, Loader2,
  Download, Shield, Clock, Activity, RefreshCw, ShieldAlert, ShieldOff,
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

type FormMode = "generate" | "paste" | "url";

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<FormMode>("generate");
  const [agentName, setAgentName] = useState("");
  const [pastedKey, setPastedKey] = useState("");
  const [generatedJwk, setGeneratedJwk] = useState<any>(null);
  const [privateKeyObj, setPrivateKeyObj] = useState<CryptoKey | null>(null);
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [urlFetchedKey, setUrlFetchedKey] = useState<any>(null);
  const [urlFetching, setUrlFetching] = useState(false);
  const [urlFetchError, setUrlFetchError] = useState("");
  const [pastedPrivateKeyPem, setPastedPrivateKeyPem] = useState("");
  const [pastedPrivateKeyObj, setPastedPrivateKeyObj] = useState<CryptoKey | null>(null);
  const [pastedPrivateKeyError, setPastedPrivateKeyError] = useState("");
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
      // Not JSON -try as raw base64url x value
      const cleaned = trimmed.replace(/\s/g, "");
      if (/^[A-Za-z0-9_-]{42,44}$/.test(cleaned)) {
        return { jwk: { kty: "OKP", crv: "Ed25519", x: cleaned }, error: "" };
      }
      return { jwk: null, error: "Expected Ed25519 JWK JSON or base64url public key (43 chars)" };
    }
  }

  const pasteResult = parsePastedKey();

  // Import pasted PEM into CryptoKey when it changes
  useEffect(() => {
    if (!pastedPrivateKeyPem.trim()) { setPastedPrivateKeyObj(null); setPastedPrivateKeyError(""); return; }
    (async () => {
      try {
        const pem = pastedPrivateKeyPem.trim();
        const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
        const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" } as any, false, ["sign"]);
        setPastedPrivateKeyObj(key);
        setPastedPrivateKeyError("");
      } catch (e: any) {
        setPastedPrivateKeyObj(null);
        setPastedPrivateKeyError("Could not import private key. Ensure it's a valid Ed25519 PKCS8 PEM.");
      }
    })();
  }, [pastedPrivateKeyPem]);

  // Fetch public key from agent card URL
  async function fetchKeyFromCard() {
    setUrlFetching(true); setUrlFetchError(""); setUrlFetchedKey(null);
    try {
      // Proxy through our backend to avoid CORS
      const cardUrl = agentCardUrl.trim();
      const resp = await fetch(`${BASE}/api/agents/gateway/agents/fetch-card?url=${encodeURIComponent(cardUrl)}`);
      if (!resp.ok) {
        // Fallback: try direct fetch (works if CORS is enabled on the agent)
        const directResp = await fetch(cardUrl);
        if (!directResp.ok) throw new Error(`Card URL returned ${directResp.status}`);
        const card = await directResp.json();
        const key = card.signing_key || card.public_key || card.authentication?.signing_key;
        if (!key?.x) throw new Error("Card does not contain a signing_key with x value");
        setUrlFetchedKey(key);
      } else {
        const card = await resp.json();
        const key = card.signing_key || card.public_key || card.authentication?.signing_key;
        if (!key?.x) throw new Error("Card does not contain a signing_key with x value");
        setUrlFetchedKey(key);
      }
    } catch (e: any) {
      setUrlFetchError(e.message || "Could not fetch agent card");
    }
    setUrlFetching(false);
  }

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

    // URL mode: use the dedicated register-by-url gateway endpoint
    if (mode === "url") {
      try {
        const resp = await fetch(`${BASE}/api/agents/gateway/agents/register-by-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: agentId,
            agent_card_url: agentCardUrl.trim(),
            live_challenge_url: liveChallengeUrl.trim(),
          }),
        });
        const data = await resp.json();
        if (resp.ok && data.status === "registered") {
          setSuccess(data);
          onSuccess();
        } else {
          setError(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data));
        }
      } catch (e: any) {
        setError(`Could not reach the Gateway: ${e.message}`);
      }
      setLoading(false);
      return;
    }

    const jwk = mode === "generate" ? generatedJwk : pasteResult.jwk;
    if (!jwk) {
      setError("No valid public key available");
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

      const signingKey = mode === "generate" ? privateKeyObj : pastedPrivateKeyObj;
      if (!signingKey) {
        setError("No private key available for signing. Generate a keypair or paste your private key PEM.");
        setLoading(false);
        return;
      }
      const sigBuf = await crypto.subtle.sign("Ed25519" as any, signingKey, msgBytes);
      const sigB64 = b64url(new Uint8Array(sigBuf));

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
    ((mode === "generate" && generatedJwk && keySaved && privateKeyObj !== null) ||
     (mode === "paste" && pasteResult.jwk !== null && pastedPrivateKeyObj !== null) ||
     (mode === "url" && agentCardUrl.trim() !== "" && liveChallengeUrl.trim() !== ""));

  // Reset form
  function reset() {
    setAgentName("");
    setPastedKey("");
    setPastedPrivateKeyPem("");
    setPastedPrivateKeyObj(null);
    setPastedPrivateKeyError("");
    setUrlFetchedKey(null);
    setUrlFetchError("");
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
              A2A card verified -registered key matches the card
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
              A2A card verification skipped -no card URL provided.
            </div>
          )}
          {success.live_challenge_verification === "verified" && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="w-3 h-3" />
              Live challenge passed -agent is reachable and controls the key
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
          {success.liveness_state && (
            <div className="flex items-center gap-1.5 text-xs">
              <Activity className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Continuous attestation:</span>
              <LivenessBadge state={success.liveness_state} />
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
            <Button
              variant={mode === "url" ? "default" : "outline"} size="sm"
              onClick={() => setMode("url")} type="button"
            >Register by URL</Button>
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
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Public Key (JWK or raw base64url x value)</label>
              <textarea
                className="w-full font-[var(--font-geist-mono)] text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 min-h-16 resize-y"
                placeholder={'{"kty":"OKP","crv":"Ed25519","x":"..."}\n\nOr paste the raw base64url x value (43 chars)'}
                value={pastedKey}
                onChange={e => setPastedKey(e.target.value)}
              />
              {pasteResult.error && <p className="text-xs text-rose-500">{pasteResult.error}</p>}
              {pasteResult.jwk && <p className="text-xs text-emerald-600">Valid Ed25519 public key detected</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Private Key (PEM) -needed to sign proof of possession</label>
              <textarea
                className="w-full font-[var(--font-geist-mono)] text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 min-h-16 resize-y"
                placeholder={"-----BEGIN PRIVATE KEY-----\nMC4CAQ....\n-----END PRIVATE KEY-----"}
                value={pastedPrivateKeyPem}
                onChange={e => setPastedPrivateKeyPem(e.target.value)}
              />
              {pastedPrivateKeyObj && <p className="text-xs text-emerald-600">Private key loaded -ready to sign PoP</p>}
              {pastedPrivateKeyPem.trim() && !pastedPrivateKeyObj && pastedPrivateKeyError && <p className="text-xs text-rose-500">{pastedPrivateKeyError}</p>}
              <p className="text-xs text-muted-foreground">The private key stays in your browser and is never sent to the server. It signs the registration challenge locally.</p>
            </div>
          </div>
        )}

        {/* URL mode -fetch key from card, agent signs PoP */}
        {mode === "url" && (
          <div className="space-y-3">
            <div className="rounded-md border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 p-3">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                Enter your agent&apos;s card URL. Gate will fetch the public key from the card, send a PoP challenge to the agent&apos;s liveness endpoint,
                and the agent signs it with its own private key. No keys leave the agent.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Agent Card URL <span className="text-rose-500">*</span></label>
                <input type="url"
                  className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 font-[var(--font-geist-mono)] text-xs"
                  placeholder="https://my-agent.example.com/.well-known/agent-card.json"
                  value={agentCardUrl} onChange={e => setAgentCardUrl(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Live Challenge URL <span className="text-rose-500">*</span></label>
                <input type="url"
                  className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 font-[var(--font-geist-mono)] text-xs"
                  placeholder="https://my-agent.example.com/live-challenge"
                  value={liveChallengeUrl} onChange={e => setLiveChallengeUrl(e.target.value)} />
              </div>
            </div>
            {urlFetchedKey && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-1">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Public key fetched from agent card</p>
                <code className="text-[11px] font-[var(--font-geist-mono)] text-muted-foreground">x: {urlFetchedKey.x}</code>
              </div>
            )}
            {urlFetchError && <p className="text-xs text-rose-500">{urlFetchError}</p>}
            {!urlFetchedKey && agentCardUrl.trim() && (
              <Button variant="outline" size="sm" onClick={fetchKeyFromCard} disabled={urlFetching} type="button">
                {urlFetching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                Fetch Public Key from Card
              </Button>
            )}
          </div>
        )}

        {/* Verification URLs (optional, side by side) -only show for generate/paste modes */}
        {mode !== "url" && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Agent Card URL <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <input type="url"
              className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 font-[var(--font-geist-mono)] text-xs"
              placeholder="https://agent.example.com/.well-known/agent-card.json"
              value={agentCardUrl} onChange={e => setAgentCardUrl(e.target.value)} />
            <p className="text-xs text-muted-foreground">Gateway verifies the public key matches.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Live Challenge URL <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <input type="url"
              className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 font-[var(--font-geist-mono)] text-xs"
              placeholder="https://agent.example.com/live-challenge"
              value={liveChallengeUrl} onChange={e => setLiveChallengeUrl(e.target.value)} />
            <p className="text-xs text-muted-foreground">Proves the agent is reachable and controls the key.</p>
          </div>
        </div>}

        {/* Error */}
        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 p-3">
            <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-2">
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSubmit} disabled={!canSubmit}>
            {loading && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
            Register Agent
          </Button>
          <Button variant="ghost" onClick={reset} type="button">Reset</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Liveness Badge ─────────────────────────────────────────────────────────

const LIVENESS_STYLES: Record<string, { color: string; label: string }> = {
  LIVE:      { color: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20", label: "Live" },
  WARNING:   { color: "bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/20", label: "Warning" },
  STALE:     { color: "bg-orange-600/15 text-orange-700 dark:text-orange-400 border-orange-600/20", label: "Stale" },
  SUSPENDED: { color: "bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-600/20", label: "Suspended" },
  UNKNOWN:   { color: "bg-zinc-600/10 text-zinc-600 dark:text-zinc-400 border-zinc-600/20", label: "Unknown" },
};

function LivenessBadge({ state }: { state: string | undefined }) {
  const s = LIVENESS_STYLES[state || "UNKNOWN"] || LIVENESS_STYLES.UNKNOWN;
  return <Badge className={`text-[10px] ${s.color}`}>{s.label}</Badge>;
}

// ─── Registered Agents List ──────────────────────────────────────────────────

function AgentsList({ agents, loading, onCheckLiveness }: { agents: any[]; loading: boolean; onCheckLiveness: (agentId: string) => void }) {
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
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Card</th>
            <th className="py-2 pr-4 font-medium">Live</th>
            <th className="py-2 pr-4 font-medium">Attestation</th>
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
                {agent.status === "revoked" ? (
                  <Badge className="text-[10px] bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-600/20">Revoked</Badge>
                ) : (
                  <Badge className="text-[10px] bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20">Active</Badge>
                )}
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
                  <span className="text-xs text-muted-foreground">-</span>
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
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </td>
              <td className="py-2.5 pr-4">
                <div className="flex items-center gap-1.5">
                  <LivenessBadge state={agent.liveness_state} />
                  {agent.live_challenge_url && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onCheckLiveness(agent.agent_id); }}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Re-challenge this agent now"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {agent.liveness_verified_at && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Verified {new Date(agent.liveness_verified_at).toLocaleTimeString()}
                  </p>
                )}
              </td>
              <td className="py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {agent.registered_at ? timeAgo(agent.registered_at) : "-"}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Continuous Attestation Summary ──────────────────────────────────────────

function LivenessSummaryCard({ onSweep }: { onSweep: () => void }) {
  const [summary, setSummary] = useState<any>(null);
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<string>("");

  useEffect(() => {
    fetch(`${BASE}/api/agents/gateway/agents/liveness`)
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {});
  }, []);

  const handleSweep = async () => {
    setSweeping(true);
    setSweepResult("");
    try {
      const resp = await fetch(`${BASE}/api/agents/gateway/agents/liveness/sweep`, { method: "POST" });
      const data = await resp.json();
      setSweepResult(`Checked ${data.checked}: ${data.passed} passed, ${data.failed} failed`);
      // Refresh summary
      const summaryResp = await fetch(`${BASE}/api/agents/gateway/agents/liveness`);
      setSummary(await summaryResp.json());
      onSweep();
      setTimeout(() => setSweepResult(""), 5000);
    } catch {
      setSweepResult("Sweep failed");
      setTimeout(() => setSweepResult(""), 3000);
    }
    setSweeping(false);
  };

  if (!summary || !summary.agents?.length) return null;

  const s = summary.summary || {};
  const total = (s.LIVE || 0) + (s.WARNING || 0) + (s.STALE || 0) + (s.SUSPENDED || 0) + (s.UNKNOWN || 0);
  const healthy = (s.LIVE || 0);
  const degraded = (s.WARNING || 0) + (s.STALE || 0) + (s.SUSPENDED || 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm">Continuous Attestation</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {sweepResult && <span className="text-xs text-emerald-600">{sweepResult}</span>}
            <Button variant="outline" size="sm" onClick={handleSweep} disabled={sweeping} className="gap-1.5 text-xs h-7">
              {sweeping ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Sweep All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>{s.LIVE || 0} Live</span>
          </div>
          {(s.WARNING || 0) > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              <span>{s.WARNING} Warning</span>
            </div>
          )}
          {(s.STALE || 0) > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
              <span>{s.STALE} Stale</span>
            </div>
          )}
          {(s.SUSPENDED || 0) > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
              <span>{s.SUSPENDED} Suspended</span>
            </div>
          )}
          {(s.UNKNOWN || 0) > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-zinc-400" />
              <span>{s.UNKNOWN} No URL</span>
            </div>
          )}
          <span className="text-muted-foreground ml-auto">
            Interval: {Math.round((summary.attestation_interval || 3600) / 60)}m
          </span>
        </div>
        {degraded > 0 && (
          <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-2">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              {degraded} agent{degraded > 1 ? "s" : ""} with degraded liveness -authorization may be restricted.
              {(s.STALE || 0) > 0 && " STALE agents are denied new authorizations."}
              {(s.SUSPENDED || 0) > 0 && " SUSPENDED agents are fully locked out."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [showRevoked, setShowRevoked] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [checkingAgent, setCheckingAgent] = useState<string | null>(null);
  const [livenessKey, setLivenessKey] = useState(0);

  const fetchAgents = useCallback(async () => {
    setFetchError(null);
    try {
      const resp = await fetch(`${BASE}/api/agents/gateway/agents?include_revoked=true`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      const data = await resp.json();
      setAgents(data.agents || []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setFetchError(message);
      console.error("Failed to fetch agents:", e);
    }
    setAgentsLoading(false);
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const filteredAgents = agents.filter(a => showRevoked ? a.status === "revoked" : a.status !== "revoked");

  const handleCheckLiveness = async (agentId: string) => {
    setCheckingAgent(agentId);
    try {
      await fetch(`${BASE}/api/agents/gateway/agents/${agentId}/liveness/check`, { method: "POST" });
      await fetchAgents();
      setLivenessKey(k => k + 1);
    } catch { /* ignore */ }
    setCheckingAgent(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <div className="flex-1 max-w-[1000px] mx-auto w-full p-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Registered Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register AI agents with the Gateway. Each agent receives a unique key ID (kid) used to verify its DPoP identity proofs during authorization.
            Agents with a live challenge URL are continuously re-verified.
          </p>
        </div>

        <RegisterForm onSuccess={fetchAgents} />

        <LivenessSummaryCard key={livenessKey} onSweep={() => { fetchAgents(); setLivenessKey(k => k + 1); }} />

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">All Registered Agents</CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <button onClick={() => setShowRevoked(false)} className={`text-xs px-2.5 py-1 rounded-md transition-colors ${!showRevoked ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Active</button>
                  <button onClick={() => setShowRevoked(true)} className={`text-xs px-2.5 py-1 rounded-md transition-colors ${showRevoked ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Revoked</button>
                </div>
                <Badge variant="outline" className="text-xs">{filteredAgents.length} {showRevoked ? "revoked" : "active"}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {fetchError && (
              <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 mb-4">
                <p className="text-sm text-amber-900 dark:text-amber-300">Could not load agents: {fetchError}</p>
                <button onClick={fetchAgents} className="mt-2 text-sm underline text-amber-900 dark:text-amber-300">Retry</button>
              </div>
            )}
            <AgentsList agents={filteredAgents} loading={agentsLoading} onCheckLiveness={handleCheckLiveness} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
