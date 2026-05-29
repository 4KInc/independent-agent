"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Server, Network, Database, Shield, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronRight, Copy, ExternalLink, RefreshCw, Sun, Moon, Monitor,
  Lock, KeyRound, AlertTriangle
} from "lucide-react";

// --- Config ---
const BASE = process.env.NEXT_PUBLIC_API_URL || "";
const ACTIONS = ["read", "query", "list", "search", "analyze", "delete"];
const RESOURCES = ["staging-database", "staging-analytics-api", "dev-database"];
const ATTACKS = [
  { id: "no_token", label: "No Token", desc: "Call resource with no Authorization header" },
  { id: "forged_token", label: "Forged Token", desc: "Self-sign a token with a rogue Ed25519 key" },
  { id: "no_dpop", label: "No DPoP Proof", desc: "Valid bearer transport, empty agent_proof" },
  { id: "unregistered", label: "Unregistered Agent", desc: "Valid proof from unregistered key" },
  { id: "omit_digest", label: "Omit Digest", desc: "Proof missing action_digest claim (v0.3)" },
  { id: "action_mismatch", label: "Action Mismatch", desc: "Proof for read, request delete" },
  { id: "anonymous_transport", label: "Anonymous MCP", desc: "Connect with no bearer token" },
];

// --- Types ---
type SSEEvent = { step: string; data: Record<string, any>; ts: number };

// --- API helpers ---
async function streamSSE(path: string, body: Record<string, any>, onEvent: (ev: SSEEvent) => void, signal?: AbortSignal) {
  const resp = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const chunks = buf.split("\n\n");
    buf = chunks.pop()!;
    for (const c of chunks) { const l = c.replace(/^data: /, ""); if (l) try { onEvent(JSON.parse(l)); } catch {} }
  }
}
async function fetchHealth() { return (await fetch(`${BASE}/api/health`)).json(); }
async function fetchChain() { return (await fetch(`${BASE}/api/chain`)).json(); }
async function verifyReceipt(receipt: Record<string, any>) {
  return (await fetch(`${BASE}/api/verify-receipt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(receipt) })).json();
}

// --- Small components ---
function StatusDot({ ok }: { ok?: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${ok ? "bg-emerald-500" : ok === false ? "bg-rose-500" : "bg-zinc-400"}`} />;
}

function copyText(t: string) { navigator.clipboard.writeText(t); }

function timeAgo(ts: string) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  return `${Math.round(d / 3600)}h ago`;
}

function JsonView({ data }: { data: unknown }) {
  return (
    <pre className="font-[var(--font-geist-mono)] text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all text-zinc-700 dark:text-zinc-300">
      {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}

function OutcomeBadge({ step, data }: { step: string; data: Record<string, any> }) {
  if (step === "gateway_response" && data.decision === "approve") return <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20">APPROVE</Badge>;
  if (step === "gateway_response" && data.decision === "deny") return <Badge variant="destructive">DENY</Badge>;
  if (step === "gateway_response" && data.error) return <Badge variant="destructive">{data.error}</Badge>;
  if (step === "resource_response" && data.status === 200) return <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20">200 OK</Badge>;
  if (step === "resource_response" && (data.status === 401 || data.error)) return <Badge variant="destructive">{data.status || data.error}</Badge>;
  if (step === "verify_receipt") return <Badge className={data.receipt_integrity === "PASS" ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20" : "bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-600/20"}>{data.receipt_integrity || "?"}</Badge>;
  if (step === "jti_check") return data.match ? <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20">MATCH</Badge> : <Badge variant="destructive">MISMATCH</Badge>;
  if (step === "done" && data.blocked) return <Badge variant="destructive">BLOCKED: {data.code}</Badge>;
  if (step === "done" && data.decision) return <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20">{String(data.decision).toUpperCase()}</Badge>;
  if (step === "error") return <Badge variant="destructive">ERROR</Badge>;
  if (step === "anomaly") return <Badge className="bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/20">ANOMALY</Badge>;
  return null;
}

function StepIcon({ step, data }: { step: string; data: Record<string, any> }) {
  if (step === "error" || step === "anomaly") return <AlertTriangle className="w-4 h-4 text-rose-500" />;
  if (step === "done" && data.blocked) return <XCircle className="w-4 h-4 text-rose-500" />;
  if (step === "gateway_response" && data.error) return <XCircle className="w-4 h-4 text-rose-500" />;
  if (step === "resource_response" && data.status === 401) return <XCircle className="w-4 h-4 text-rose-500" />;
  if (step === "jti_check" && !data.match) return <XCircle className="w-4 h-4 text-rose-500" />;
  return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
}

const LABELS: Record<string, string> = {
  build_proof: "Build DPoP Proof", call_gateway: "Call Gateway (MCP)", gateway_response: "Gateway Response",
  verify_receipt: "Verify Receipt", call_resource: "Call Protected Resource", resource_response: "Resource Response",
  jti_check: "Token JTI Binding", done: "Complete", error: "Error", anomaly: "Anomaly",
};

// --- Timeline ---
function TimelineStep({ event, isLast }: { event: SSEEvent; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const { step, data } = event;
  if (step === "attack_start") return null;
  const duration = typeof data.duration_ms === "number" ? `${data.duration_ms}ms` : "";
  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-150">
      <div className="flex flex-col items-center w-6 shrink-0">
        <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-700">
          <StepIcon step={step} data={data} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 min-h-2" />}
      </div>
      <div className="flex-1 pb-4 min-w-0">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group cursor-pointer">
              <span className="text-sm font-medium flex-1">{LABELS[step] || step}</span>
              {duration && <span className="font-[var(--font-geist-mono)] text-xs text-muted-foreground">{duration}</span>}
              <OutcomeBadge step={step} data={data} />
              <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent><div className="mt-2"><JsonView data={data} /></div></CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

function Timeline({ events }: { events: SSEEvent[] }) {
  const total = events.length > 1 ? Math.round((events[events.length - 1].ts - events[0].ts) * 1000) : null;
  return (
    <div>
      {events.map((ev, i) => <TimelineStep key={i} event={ev} isLast={i === events.length - 1} />)}
      {total !== null && (
        <div className="flex items-center gap-2 pt-1 pl-9">
          <span className="text-xs text-muted-foreground">Total: {total}ms · {events.filter(e => e.step !== "attack_start").length} steps</span>
          {events.find(e => e.step === "done") && <OutcomeBadge step="done" data={events.find(e => e.step === "done")!.data} />}
        </div>
      )}
      {events.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">Run a flow to see the agent &rarr; gateway &rarr; resource interaction in real time.</div>}
    </div>
  );
}

// --- Panels ---
function CompliantPanel({ onFlowComplete }: { onFlowComplete?: () => void }) {
  const [action, setAction] = useState("read");
  const [resource, setResource] = useState("staging-database");
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [running, setRunning] = useState(false);
  const run = useCallback(async () => {
    setEvents([]); setRunning(true);
    try { await streamSSE("/api/compliant-flow", { action, resource }, ev => setEvents(p => [...p, ev])); } catch {}
    setRunning(false);
    onFlowComplete?.();
  }, [action, resource, onFlowComplete]);
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</label>
          <Select value={action} onValueChange={(v) => v && setAction(v)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{ACTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resource</label>
          <Select value={resource} onValueChange={(v) => v && setResource(v)}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent>{RESOURCES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
        </div>
        <Button onClick={run} disabled={running} className="gap-2">{running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{running ? "Running..." : "Run Flow"}</Button>
      </div>
      <Separator />
      <Timeline events={events} />
    </div>
  );
}

function RoguePanel({ onAttackComplete }: { onAttackComplete?: () => void }) {
  const [results, setResults] = useState<Record<string, { events: SSEEvent[]; running: boolean }>>({});
  const [sheet, setSheet] = useState<string | null>(null);
  const runAttack = useCallback(async (id: string) => {
    setResults(p => ({ ...p, [id]: { events: [], running: true } }));
    setSheet(id);
    try { await streamSSE("/api/rogue-attack", { attack: id }, ev => setResults(p => ({ ...p, [id]: { events: [...(p[id]?.events || []), ev], running: p[id]?.running ?? false } }))); } catch {}
    setResults(p => ({ ...p, [id]: { ...p[id], running: false } }));
    onAttackComplete?.();
  }, [onAttackComplete]);
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ATTACKS.map(atk => {
          const r = results[atk.id]; const done = r?.events.find(e => e.step === "done" || e.step === "anomaly");
          return (
            <Card key={atk.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between"><div><h4 className="text-sm font-medium">{atk.label}</h4><p className="text-xs text-muted-foreground mt-0.5">{atk.desc}</p></div>{done && <OutcomeBadge step={done.step} data={done.data} />}</div>
                <Button size="sm" variant="outline" onClick={() => runAttack(atk.id)} disabled={r?.running} className="w-full gap-2">{r?.running && <Loader2 className="w-3 h-3 animate-spin" />}{r?.running ? "Attacking..." : "Run Attack"}</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Sheet open={!!sheet} onOpenChange={o => !o && setSheet(null)}>
        <SheetContent className="w-[480px] sm:w-[540px] overflow-y-auto">
          <SheetHeader><SheetTitle>{ATTACKS.find(a => a.id === sheet)?.label}</SheetTitle></SheetHeader>
          <div className="mt-4">{sheet && results[sheet]?.running && results[sheet].events.length === 0 && <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" />Attacking...</div>}{sheet && <Timeline events={results[sheet]?.events || []} />}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ReceiptChainPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [chain, setChain] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [vr, setVr] = useState<Record<number, any>>({});
  const [prevHashes, setPrevHashes] = useState<Set<string>>(new Set());
  const refresh = useCallback(async () => { setLoading(true); try { setChain(await fetchChain()); } catch (e: any) { setChain({ error: e.message }); } setLoading(false); }, []);
  useEffect(() => { refresh(); }, [refresh, refreshKey]);
  const receipts = (chain?.receipts || []).slice().reverse();
  const currentHashes = new Set<string>(receipts.map((r: any) => String(r.receipt_hash || "")));
  // Track which hashes are "new" (appeared after the first fetch)
  const [newHashes, setNewHashes] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (prevHashes.size > 0) {
      const fresh = new Set<string>();
      currentHashes.forEach(h => { if (!prevHashes.has(h)) fresh.add(h); });
      if (fresh.size > 0) {
        setNewHashes(fresh);
        const timer = setTimeout(() => setNewHashes(new Set()), 2500);
        return () => clearTimeout(timer);
      }
    }
    setPrevHashes(currentHashes);
  }, [chain]);
  return (
    <Card>
      <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Receipt Chain{receipts.length > 0 && <Badge variant="secondary" className="ml-2">{receipts.length}</Badge>}</CardTitle><Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="h-7 w-7 p-0"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></Button></div></CardHeader>
      <CardContent className="space-y-1.5 max-h-[calc(100vh-220px)] overflow-y-auto">
        {chain?.error && <p className="text-sm text-destructive">{chain.error}</p>}
        {receipts.map((r: any, i: number) => {
          const body = r.body || {}; const hash = String(r.receipt_hash || "").slice(0, 20); const isOpen = expanded === i; const isNew = newHashes.has(r.receipt_hash);
          return (
            <div key={i} className={`rounded-lg border transition-all duration-300 ${isNew ? "ring-1 ring-indigo-500/40 border-indigo-500/30" : ""} ${isOpen ? "border-primary/30 bg-muted/30" : "border-border hover:bg-muted/20"}`}>
              <button onClick={() => setExpanded(isOpen ? null : i)} className="w-full flex items-center gap-2 p-2.5 text-left cursor-pointer">
                <Badge variant={body.decision === "approve" ? "default" : "destructive"} className={body.decision === "approve" ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20 text-[10px]" : "text-[10px]"}>#{body.seq}</Badge>
                <span className="font-[var(--font-geist-mono)] text-xs text-muted-foreground truncate flex-1">{hash}...</span>
                <Badge variant="outline" className="text-[10px]">{body.decision}</Badge>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {body.ts && <div className="px-2.5 -mt-1 pb-1.5 text-[10px] text-muted-foreground">{timeAgo(body.ts)}</div>}
              {isOpen && <div className="px-2.5 pb-2.5 space-y-2"><JsonView data={r} /><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => verifyReceipt(r).then(res => setVr(p => ({ ...p, [i]: res })))} className="h-7 text-xs"><Shield className="w-3 h-3 mr-1" />Verify</Button></div>{vr[i] && <Badge className={
                        vr[i].receipt_integrity === "PASS" && vr[i].chain_validity === "PASS" ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20"
                        : vr[i].receipt_integrity === "PASS" && vr[i].chain_validity === "INCONCLUSIVE" ? "bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/20"
                        : "bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-600/20"
                      }>{vr[i].receipt_integrity === "PASS" && vr[i].chain_validity !== "PASS" ? "INCONCLUSIVE" : vr[i].receipt_integrity}</Badge>}</div>}
            </div>
          );
        })}
        {receipts.length === 0 && !chain?.error && <p className="text-sm text-muted-foreground text-center py-6">No receipts yet</p>}
      </CardContent>
    </Card>
  );
}

function StatusPanel() {
  const [health, setHealth] = useState<any>(null);
  useEffect(() => { fetchHealth().then(setHealth).catch(() => setHealth({ error: "unreachable" })); }, []);
  const config = health?.config || {};
  const eps = [{ key: "gateway_rest", icon: Server, label: "Gateway REST" }, { key: "gateway_mcp", icon: Network, label: "Gateway MCP" }, { key: "resource", icon: Database, label: "Protected Resource" }];
  return (
    <div className="space-y-4">
      <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Endpoints</CardTitle></CardHeader><CardContent className="space-y-2">{eps.map(({ key, icon: Icon, label }) => { const ep = health?.[key] || {}; return <div key={key} className="flex items-center gap-2.5"><StatusDot ok={ep.reachable} /><Icon className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-sm flex-1">{label}</span></div>; })}</CardContent></Card>
      <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><KeyRound className="w-3.5 h-3.5" />Signing Keys{Array.isArray(health?.public_keys) && <Badge variant="secondary">{health.public_keys.length}</Badge>}</CardTitle></CardHeader><CardContent><div className="space-y-1">{Array.isArray(health?.public_keys) && health.public_keys.map((k: any, i: number) => <div key={i} className="font-[var(--font-geist-mono)] text-xs text-muted-foreground truncate flex items-center gap-1.5 group"><span className="truncate">{k.kid}</span><button onClick={() => copyText(k.kid)} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Copy className="w-3 h-3" /></button></div>)}</div></CardContent></Card>
      <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><Lock className="w-3.5 h-3.5" />Bearer Token</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">{config.bearer_configured ? "Configured via env" : "Not set"}</p></CardContent></Card>
    </div>
  );
}

// --- Audit & Verify Panel ---
function AuditPanel({ onChainChange }: { onChainChange?: () => void }) {
  const [chain, setChain] = useState<any>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<string>("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [chainResult, setChainResult] = useState<any>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [tamperField, setTamperField] = useState("decision");
  const [tamperIdx, setTamperIdx] = useState("0");
  const [tamperResult, setTamperResult] = useState<any>(null);
  const [tamperLoading, setTamperLoading] = useState(false);
  const [tamperConfirm, setTamperConfirm] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [pubKeys, setPubKeys] = useState<any>(null);

  useEffect(() => {
    fetchChain().then(setChain);
    fetch(`${BASE}/api/dev-mode`).then(r => r.json()).then(d => setDevMode(d.dev_mode)).catch(() => {});
    fetch(`${BASE}/api/public-key`).then(r => r.json()).then(setPubKeys).catch(() => {});
  }, []);

  const receipts = chain?.receipts || [];

  const handleVerifyReceipt = async () => {
    const receipt = receipts.find((r: any) => r.receipt_hash === selectedReceipt);
    if (!receipt) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const resp = await fetch(`${BASE}/api/verify-receipt`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(receipt),
      });
      setVerifyResult(await resp.json());
    } catch (e: any) { setVerifyResult({ error: e.message }); }
    setVerifyLoading(false);
  };

  const handleVerifyChain = async () => {
    setChainLoading(true);
    setChainResult(null);
    try {
      const resp = await fetch(`${BASE}/api/verify-chain`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      setChainResult(await resp.json());
    } catch (e: any) { setChainResult({ error: e.message }); }
    setChainLoading(false);
  };

  const handleTamper = async () => {
    setTamperConfirm(false);
    setTamperLoading(true);
    setTamperResult(null);
    try {
      const resp = await fetch(`${BASE}/api/tamper-test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_index: parseInt(tamperIdx), field: tamperField }),
      });
      setTamperResult(await resp.json());
      onChainChange?.();
    } catch (e: any) { setTamperResult({ error: e.message }); }
    setTamperLoading(false);
  };

  const primaryKey = pubKeys?.keys?.[0];
  const offlineSnippet = `import base64, hashlib, json
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

# 1. The gateway's public key (from /keys)
x_b64url = "${primaryKey?.x || '<paste x from /keys>'}"
x = x_b64url.replace("-","+").replace("_","/")
x += "=" * (4 - len(x) % 4) if len(x) % 4 else ""
pub_key = Ed25519PublicKey.from_public_bytes(base64.b64decode(x))

# 2. Your receipt (from /chain)
receipt = <paste receipt envelope here>

# 3. Canonicalize the body (RFC 8785 — sorted keys, no whitespace)
def canonicalize(obj):
    if isinstance(obj, dict):
        return "{" + ",".join(f'"{k}":{canonicalize(v)}' for k,v in sorted(obj.items())) + "}"
    if isinstance(obj, list): return "[" + ",".join(canonicalize(i) for i in obj) + "]"
    return json.dumps(obj, ensure_ascii=False)

body_bytes = canonicalize(receipt["body"]).encode("utf-8")

# 4. Verify hash
computed_hash = "sha256:" + hashlib.sha256(body_bytes).hexdigest()
assert computed_hash == receipt["receipt_hash"], f"Hash mismatch!"

# 5. Verify Ed25519 signature
sig_b64 = receipt["sig"]["value"]
sig = sig_b64.replace("-","+").replace("_","/")
sig += "=" * (4 - len(sig) % 4) if len(sig) % 4 else ""
sig_bytes = base64.b64decode(sig)
pub_key.verify(sig_bytes, body_bytes)  # raises on failure
print("Receipt verified: signature valid, hash matches")`;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground border-l-2 border-zinc-300 dark:border-zinc-700 pl-3">Section 1 verifies a receipt's signature AND its link to the immediate predecessor (bounded chain check). Section 2 verifies every link from genesis to head. Amber means the verifier could not reach a passing conclusion.</p>
      {/* Section 1: Verify a receipt's signature */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verify a receipt's signature</CardTitle>
          <p className="text-sm text-muted-foreground">Pick any receipt to verify its Ed25519 signature and the link to its immediate predecessor. Full chain integrity is verified separately in Section 2.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receipt</label>
              <Select value={selectedReceipt} onValueChange={(v) => v && setSelectedReceipt(v)}>
                <SelectTrigger><SelectValue placeholder="Select a receipt..." /></SelectTrigger>
                <SelectContent>
                  {receipts.map((r: any, i: number) => (
                    <SelectItem key={i} value={r.receipt_hash || `idx-${i}`}>
                      #{r.body?.seq} · {String(r.receipt_hash || "").slice(0, 24)}... · {r.body?.decision}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleVerifyReceipt} disabled={!selectedReceipt || verifyLoading} className="gap-2">
              {verifyLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Shield className="w-3.5 h-3.5" /> Verify
            </Button>
          </div>
          {verifyResult && (() => {
            // Section 1 checks signature + body hash only. chain_validity is not used here
            // because /verify-receipt structurally returns INCONCLUSIVE for single receipts.
            // Chain integrity is Section 2's job.
            const amberCodes = new Set(["KID_UNRESOLVED", "KID_MISMATCH", "KEY_UNAVAILABLE"]);
            const errors = verifyResult.errors || [];
            const hasAmberError = errors.length > 0 && errors.every((e: any) => amberCodes.has(e.code));
            const isGreen = verifyResult.receipt_integrity === "PASS" && verifyResult.chain_validity === "PASS" && errors.length === 0;
            const isAmber = verifyResult.receipt_integrity === "PASS" && verifyResult.chain_validity === "INCONCLUSIVE";
            const isRed = verifyResult.receipt_integrity === "FAIL" || verifyResult.chain_validity === "FAIL" || (errors.length > 0 && !isAmber);
            const borderClass = isGreen ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20"
              : isAmber ? "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"
              : "border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20";
            return (
              <Card className={borderClass}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    {isGreen && <><CheckCircle2 className="w-5 h-5 text-emerald-600" /><Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20">Verified</Badge></>}
                    {isAmber && <><AlertTriangle className="w-5 h-5 text-amber-600" /><Badge className="bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/20">Could not fully verify</Badge></>}
                    {isRed && <><XCircle className="w-5 h-5 text-rose-600" /><Badge variant="destructive">Verification failed</Badge></>}
                  </div>
                  {isGreen && <p className="text-sm text-emerald-700 dark:text-emerald-400">Ed25519 signature valid. Body hash matches. Linkage to previous receipt verified.</p>}
                  {isAmber && (
                    <div className="space-y-2">
                      <p className="text-sm text-amber-700 dark:text-amber-400">Signature is valid but the linkage to the previous receipt could not be checked.</p>
                      <p className="text-xs text-muted-foreground">This usually means the receipt was signed by a key that is no longer published. Treat as untrusted until the key becomes available or the receipt is re-verified against a different source.</p>
                    </div>
                  )}
                  {isRed && errors.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm text-rose-600 font-[var(--font-geist-mono)]">{verifyResult.errors[0].code}: {verifyResult.errors[0].message || JSON.stringify(verifyResult.errors[0])}</p>
                      {verifyResult.errors.length > 1 && <p className="text-xs text-rose-500">...and {verifyResult.errors.length - 1} more errors (see full response)</p>}
                    </div>
                  )}
                  <Collapsible>
                    <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" /> Full verification response
                    </CollapsibleTrigger>
                    <CollapsibleContent><div className="mt-2"><JsonView data={verifyResult} /></div></CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            );
          })()}
          {/* Verify offline disclosure */}
          <Collapsible open={offlineOpen} onOpenChange={setOfflineOpen}>
            <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${offlineOpen ? "rotate-90" : ""}`} />
              Verify any receipt offline with the public key
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Gateway public key (JWK)</p>
                  <div className="relative">
                    <JsonView data={primaryKey || {}} />
                    {primaryKey && <button onClick={() => copyText(JSON.stringify(primaryKey, null, 2))} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground cursor-pointer"><Copy className="w-3.5 h-3.5" /></button>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Python verification snippet</p>
                  <div className="relative">
                    <pre className="font-[var(--font-geist-mono)] text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 overflow-x-auto whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{offlineSnippet}</pre>
                    <button onClick={() => copyText(offlineSnippet)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground cursor-pointer"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">This works because the gateway publishes its public key. Verification doesn't require access to the gateway — only this key and the receipt.</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Section 2: Chain integrity + Merkle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chain integrity & Merkle commitment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {chainResult?.merkle_root && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Merkle root — commits to {chainResult.chain_length} receipts</p>
              <div className="flex items-center gap-2">
                <code className="font-[var(--font-geist-mono)] text-sm bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded break-all">{chainResult.merkle_root}</code>
                <button onClick={() => copyText(chainResult.merkle_root)} className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"><Copy className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )}
          <Button onClick={handleVerifyChain} disabled={chainLoading} className="gap-2">
            {chainLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <Shield className="w-3.5 h-3.5" /> Verify chain now
          </Button>
          {chainResult && !chainResult.error && (
            <Card className={chainResult.receipt_integrity === "PASS" && chainResult.chain_validity === "PASS" ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20"}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {chainResult.chain_validity === "PASS"
                    ? <><CheckCircle2 className="w-5 h-5 text-emerald-600" /><Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20">Chain valid</Badge></>
                    : <><XCircle className="w-5 h-5 text-rose-600" /><Badge variant="destructive">Chain invalid</Badge></>
                  }
                </div>
                <p className="text-sm text-muted-foreground">
                  {chainResult.chain_length} receipts · signatures {chainResult.receipt_integrity === "PASS" ? "valid" : "FAILED"} · links {chainResult.chain_validity === "PASS" ? "valid" : "BROKEN"}
                </p>
                {chainResult.errors?.length > 0 && (
                  <div className="space-y-1">{chainResult.errors.map((e: any, i: number) => (
                    <p key={i} className="text-sm text-rose-600 font-[var(--font-geist-mono)]">{e.code}: {JSON.stringify(e)}</p>
                  ))}</div>
                )}
                <Collapsible>
                  <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" /> Full verification response
                  </CollapsibleTrigger>
                  <CollapsibleContent><div className="mt-2"><JsonView data={chainResult} /></div></CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Tamper detection (dev mode only) */}
      {!devMode ? (
        <p className="text-sm text-muted-foreground px-1">Tamper demo is disabled in production mode. The chain's tamper-evidence is verified continuously via "Verify chain" above.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tamper detection (dev demo)</CardTitle>
            <p className="text-sm text-muted-foreground">Flip a byte in a stored receipt and watch the chain verification detect it at the exact receipt and field.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receipt index</label>
                <Select value={tamperIdx} onValueChange={(v) => v && setTamperIdx(v)}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {receipts.map((_: any, i: number) => (
                      <SelectItem key={i} value={String(i)}>#{receipts[i]?.body?.seq || i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Field</label>
                <Select value={tamperField} onValueChange={(v) => v && setTamperField(v)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["decision", "request_digest", "prev_receipt", "ts"].map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="destructive" onClick={() => setTamperConfirm(true)} disabled={tamperLoading} className="gap-2">
                {tamperLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <AlertTriangle className="w-3.5 h-3.5" /> Tamper this receipt
              </Button>
            </div>
            {/* Confirmation dialog */}
            {tamperConfirm && (
              <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm">This will flip a byte in receipt #{receipts[parseInt(tamperIdx)]?.body?.seq || tamperIdx}'s <code className="font-[var(--font-geist-mono)] text-xs bg-zinc-200 dark:bg-zinc-800 px-1 rounded">{tamperField}</code>. The next chain verification will fail at this exact receipt. Continue?</p>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={handleTamper}>Confirm tamper</Button>
                    <Button variant="outline" size="sm" onClick={() => setTamperConfirm(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {tamperResult && !tamperResult.error && (
              <div className="space-y-3">
                <Card className="border-amber-500/30">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /><span className="text-sm font-medium">Tampered</span></div>
                    <JsonView data={tamperResult.tamper} />
                  </CardContent>
                </Card>
                <Card className={tamperResult.verification?.chain_validity === "FAIL" ? "border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20" : "border-emerald-500/30"}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      {tamperResult.verification?.chain_validity === "FAIL"
                        ? <><XCircle className="w-4 h-4 text-rose-600" /><span className="text-sm font-medium text-rose-700 dark:text-rose-400">Chain re-verified: TAMPER DETECTED</span></>
                        : <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-sm font-medium">Chain still valid (unexpected)</span></>
                      }
                    </div>
                    {tamperResult.verification?.errors?.length > 0 && (
                      <div className="space-y-1">{tamperResult.verification.errors.map((e: any, i: number) => (
                        <p key={i} className="text-sm text-rose-600 font-[var(--font-geist-mono)]">{e.code || "ERROR"}: {JSON.stringify(e)}</p>
                      ))}</div>
                    )}
                    <Collapsible>
                      <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
                        <ChevronRight className="w-3 h-3" /> Full verification response
                      </CollapsibleTrigger>
                      <CollapsibleContent><div className="mt-2"><JsonView data={tamperResult.verification} /></div></CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              </div>
            )}
            {tamperResult?.error && <p className="text-sm text-muted-foreground">{tamperResult.detail || tamperResult.error}</p>}
            <p className="text-xs text-muted-foreground">Tampering is permanent in the demo dataset; the chain is reset on each gateway redeploy.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Theme ---
function ThemeToggle() {
  const [theme, setTheme] = useState<"light"|"dark"|"system">("system");
  useEffect(() => { const s = localStorage.getItem("theme") as any; if (s) setTheme(s); }, []);
  useEffect(() => {
    const root = document.documentElement; root.classList.remove("light", "dark");
    if (theme === "system") { root.classList.add(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }
    else root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return <Button variant="ghost" size="sm" onClick={() => setTheme(next)} className="h-8 w-8 p-0"><Icon className="w-4 h-4" /></Button>;
}

// --- App ---
export default function Page() {
  const [chainRefreshKey, setChainRefreshKey] = useState(0);
  const triggerChainRefresh = useCallback(() => {
    // Small delay so the gateway has time to persist
    setTimeout(() => setChainRefreshKey(k => k + 1), 500);
  }, []);
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto flex items-center h-14 px-6 gap-4">
          <Shield className="w-5 h-5 text-primary" /><span className="font-semibold text-sm">Agent Authorization Gateway</span><span className="text-xs text-muted-foreground hidden sm:inline">Interactive Demo</span>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <a href="/" className="text-sm font-medium text-foreground">Demo</a>
          <a href="/integrations" className="text-sm text-muted-foreground hover:text-foreground transition-colors">API & Integrations</a>
          <div className="flex-1" /><ThemeToggle />
          <a href="https://github.com/4KInc/agent-authorization-gateway" target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground transition-colors"><ExternalLink className="w-4 h-4" /></a>
        </div>
      </header>
      <div className="flex-1 max-w-[1440px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] min-h-0">
          <aside className="border-r p-4 overflow-y-auto hidden lg:block"><StatusPanel /></aside>
          <main className="p-6 overflow-y-auto">
            <Tabs defaultValue="compliant"><TabsList><TabsTrigger value="compliant">Compliant Agent</TabsTrigger><TabsTrigger value="rogue">Rogue Agent</TabsTrigger><TabsTrigger value="audit">Audit & Verify</TabsTrigger></TabsList>
              <TabsContent value="compliant" className="mt-4"><CompliantPanel onFlowComplete={triggerChainRefresh} /></TabsContent>
              <TabsContent value="rogue" className="mt-4"><RoguePanel onAttackComplete={triggerChainRefresh} /></TabsContent>
              <TabsContent value="audit" className="mt-4"><AuditPanel onChainChange={triggerChainRefresh} /></TabsContent>
            </Tabs>
          </main>
          <aside className="border-l p-4 overflow-y-auto hidden lg:block"><ReceiptChainPanel refreshKey={chainRefreshKey} /></aside>
        </div>
      </div>
    </div>
  );
}
