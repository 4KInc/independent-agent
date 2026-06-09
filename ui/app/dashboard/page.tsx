"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Shield, ShieldOff, Server, Network, Database, Eye, Brain, Compass, Loader2, RefreshCw,
  ChevronRight, Copy, ExternalLink, CheckCircle2, XCircle,
  AlertTriangle, Clock, Activity, Anchor, Link, FileText,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Map compliance document names to their canonical public URLs
function getDocUrl(source: string): string | null {
  const s = (source || "").toLowerCase();
  if (s.includes("owasp") && s.includes("nhi"))
    return "https://owasp.org/www-project-non-human-identities-top-10/";
  if (s.includes("nist") && s.includes("rmf"))
    return "https://www.nist.gov/artificial-intelligence/executive-order-safe-secure-and-trustworthy-artificial-intelligence";
  if (s.includes("800-53") || s.includes("80053"))
    return "https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final";
  if (s.includes("nist") && s.includes("ai"))
    return "https://www.nist.gov/artificial-intelligence";
  return null;
}

function CitationBlock({ citation }: { citation: any }) {
  const c = citation;
  const url = getDocUrl(c.source);
  return (
    <div className="bg-muted/30 rounded p-3 text-xs space-y-1.5 border-l-2 border-violet-400">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{c.source}</span>
        {c.page && <Badge variant="outline" className="text-[9px]">p. {c.page}</Badge>}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 underline underline-offset-2 flex items-center gap-0.5">
            View source doc
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        )}
      </div>
      <blockquote className="text-muted-foreground italic border-l-2 border-zinc-300 dark:border-zinc-600 pl-2 whitespace-pre-wrap">
        "{c.passage}"
      </blockquote>
    </div>
  );
}

function copyText(t: string) { navigator.clipboard.writeText(t); }

function JsonView({ data }: { data: unknown }) {
  return (
    <pre className="font-[var(--font-geist-mono)] text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all text-zinc-700 dark:text-zinc-300">
      {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}

type AgentInfo = { id: string; name: string; icon: any; type: string; role: string; badgeColor: string };

const AGENTS: AgentInfo[] = [
  { id: "gateway", name: "Gateway", icon: Shield, type: "Deterministic", role: "Authorization chokepoint", badgeColor: "bg-zinc-600/15 text-zinc-700 dark:text-zinc-300 border-zinc-600/20" },
  { id: "auditor", name: "Auditor", icon: Eye, type: "AI · Gemini 2.5 Pro", role: "Compliance audit pipeline", badgeColor: "bg-teal-600/15 text-teal-700 dark:text-teal-400 border-teal-600/20" },
  { id: "investigator", name: "Investigator", icon: AlertTriangle, type: "AI · Gemini 2.5 Pro", role: "Incident synthesis", badgeColor: "bg-teal-600/15 text-teal-700 dark:text-teal-400 border-teal-600/20" },
  { id: "isolator", name: "Isolator", icon: ShieldOff, type: "AI · Gemini 2.5 Pro", role: "Rogue agent quarantine", badgeColor: "bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-600/20" },
  { id: "recommender", name: "Recommender", icon: Brain, type: "AI · Gemini 2.5 Pro", role: "Policy change proposals", badgeColor: "bg-teal-600/15 text-teal-700 dark:text-teal-400 border-teal-600/20" },
  { id: "coordinator", name: "Coordinator", icon: Compass, type: "Deterministic + AI", role: "A2A agent directory", badgeColor: "bg-indigo-600/15 text-indigo-700 dark:text-indigo-400 border-indigo-600/20" },
];

function StatusDot({ ok }: { ok?: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${ok ? "bg-emerald-500" : ok === false ? "bg-rose-500" : "bg-zinc-400"}`} />;
}

// --- Agent Status Card ---
function AgentCard({ agent, health, kid, selected, onClick }: { agent: AgentInfo; health: any; kid: string; selected: boolean; onClick: () => void }) {
  const Icon = agent.icon;
  return (
    <Card className={`cursor-pointer transition-all ${selected ? "ring-2 ring-primary/50 border-primary/30" : "hover:border-primary/20"}`} onClick={onClick}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{agent.name}</span>
          <Badge className={`text-[10px] ${agent.badgeColor}`}>{agent.type}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{agent.role}</p>
        <div className="flex items-center gap-2">
          <StatusDot ok={health?.ok} />
          <span className="text-[10px] text-muted-foreground">{health?.ok ? "Healthy" : "Unreachable"}</span>
        </div>
        {kid && <code className="text-[10px] font-[var(--font-geist-mono)] text-muted-foreground block truncate">{kid}</code>}
      </CardContent>
    </Card>
  );
}

// --- Agent Output Views ---
function GatewayView() {
  const [chain, setChain] = useState<any>(null);
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [explanation, setExplanation] = useState<any>(null);
  const [explaining, setExplaining] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [copiedSeq, setCopiedSeq] = useState<number | null>(null);

  useEffect(() => { fetch(`${BASE}/api/chain`).then(r => r.json()).then(setChain).catch(() => {}); }, []);
  const receipts = (chain?.receipts || []).slice().reverse().slice(0, 25);

  const handleExplain = async (seq: number) => {
    setSelectedSeq(seq);
    setExplaining(true);
    setExplanation(null);
    try {
      const resp = await fetch(`${BASE}/api/agents/gateway/chain/${seq}/explain`);
      setExplanation(await resp.json());
    } catch { setExplanation({ explanation: "Could not reach Gemini." }); }
    setExplaining(false);
  };

  const handleVerifyChain = async () => {
    if (!chain?.receipts?.length) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const resp = await fetch(`${BASE}/api/agents/gateway/verify-chain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipts: chain.receipts }),
      });
      setVerifyResult(await resp.json());
    } catch { setVerifyResult({ receipt_integrity: "ERROR", chain_validity: "ERROR" }); }
    setVerifying(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Receipts</h3>
        <Button variant="outline" size="sm" onClick={handleVerifyChain} disabled={verifying} className="gap-1.5 text-xs h-7">
          {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
          Verify Chain
        </Button>
      </div>

      {verifyResult && (
        <div className={`rounded border p-2.5 ${verifyResult.receipt_integrity === "PASS" ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : "border-rose-300 bg-rose-50 dark:bg-rose-950/30"}`}>
          <div className="flex items-center gap-2">
            {verifyResult.receipt_integrity === "PASS" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
            <span className="text-xs font-medium">
              Integrity: {verifyResult.receipt_integrity} | Chain: {verifyResult.chain_validity} | Errors: {verifyResult.errors?.length || 0}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Every receipt is Ed25519-signed and hash-chained. Independently verifiable with the public key.
          </p>
        </div>
      )}

      {receipts.length === 0 && <p className="text-sm text-muted-foreground">No receipts yet. Run the pipeline to generate receipts.</p>}
      <div className="space-y-1">
        {receipts.map((r: any, i: number) => {
          const b = r.body || {}; const m = r._meta || {};
          const seq = parseInt(b.seq || "0");
          return (
            <div key={i}>
              <div className="w-full flex items-center gap-3 text-xs py-1.5 px-2 rounded hover:bg-muted/30 text-left">
                <button onClick={() => handleExplain(seq)} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                  <Badge variant="outline" className="text-[10px]">#{b.seq}</Badge>
                  <span className="text-muted-foreground w-20 truncate">{String(b.ts || "").slice(11, 19)}</span>
                  <span className="truncate flex-1">{m.agent_id || "?"}: {m.action || "?"} on {m.resource || "?"}</span>
                  <Badge className={b.decision === "approve" ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20 text-[10px]" : "text-[10px]"} variant={b.decision === "deny" ? "destructive" : "default"}>{b.decision}</Badge>
                  <Brain className="w-3 h-3 text-muted-foreground shrink-0" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); copyText(JSON.stringify(r, null, 2)); setCopiedSeq(seq); setTimeout(() => setCopiedSeq(null), 1500); }}
                  className="shrink-0 p-1 rounded hover:bg-muted/50 transition-colors flex items-center gap-1"
                  title="Copy receipt JSON"
                >
                  {copiedSeq === seq ? <><CheckCircle2 className="w-3 h-3 text-emerald-600" /><span className="text-[10px] text-emerald-600">Copied</span></> : <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />}
                </button>
                <a
                  href={`${BASE}/api/agents/gateway/chain/${seq}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Download claim packet PDF"
                  className="shrink-0 p-1 rounded hover:bg-muted/50 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileText className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </a>
              </div>
              {selectedSeq === seq && (
                <div className="ml-8 mt-1 mb-2 rounded border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 p-3">
                  {explaining ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Gemini is analyzing this receipt...
                    </div>
                  ) : explanation ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Brain className="w-3 h-3 text-blue-600" />
                        <span className="text-[10px] font-medium text-blue-700 dark:text-blue-400">Gemini 2.5 Flash via Vertex AI</span>
                      </div>
                      <p className="text-xs leading-relaxed">{explanation.explanation}</p>
                      <div className="text-[10px] text-muted-foreground">
                        Hash: <code className="font-[var(--font-geist-mono)]">{String(r.receipt_hash || "").slice(0, 24)}...</code> |
                        Prev: <code className="font-[var(--font-geist-mono)]">{String(b.prev_receipt || "").slice(0, 24)}...</code>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuditorView({ pendingAuditId, onAuditIdConsumed }: { pendingAuditId?: string; onAuditIdConsumed?: () => void }) {
  const [reports, setReports] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fetch(`${BASE}/api/agents/auditor/audit-reports?tenant=hackathon-demo&limit=200`)
      .then(r => r.json())
      .then(d => {
        const all = d.reports || [];
        // Deduplicate by receipt_seq — keep only the latest audit per seq
        const bySeq = new Map<number, any>();
        for (const r of all) {
          const seq = r.body?.receipt_seq;
          const existing = bySeq.get(seq);
          if (!existing || (r.body?.audited_at || "") > (existing.body?.audited_at || "")) {
            bySeq.set(seq, r);
          }
        }
        setReports(Array.from(bySeq.values()));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!pendingAuditId || reports.length === 0) return;
    const idx = reports.findIndex(r => r.body?.audit_id === pendingAuditId);
    if (idx >= 0) {
      setExpanded(idx);
      onAuditIdConsumed?.();
      setTimeout(() => {
        scrollRef.current?.querySelector(`[data-audit-idx="${idx}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } else {
      onAuditIdConsumed?.();
    }
  }, [pendingAuditId, reports]);

  return (
    <div className="space-y-3" ref={scrollRef}>
      <h3 className="text-sm font-semibold">Audit Reports</h3>
      {reports.length === 0 && <p className="text-sm text-muted-foreground">Auditor runs every 5 minutes. Generate receipts and wait for the next tick.</p>}
      <div className="space-y-1">
        {reports.map((r: any, i: number) => {
          const b = r.body || {};
          return (
            <div key={i} data-audit-idx={i} className="border border-border rounded-lg">
              <button onClick={() => setExpanded(expanded === i ? null : i)} className="w-full flex items-center gap-3 text-xs py-2 px-3 text-left cursor-pointer">
                <span className="text-muted-foreground">seq {b.receipt_seq}</span>
                <Badge className={b.verdict === "ALIGNED" ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20 text-[10px]" : b.verdict === "CONFLICT" ? "bg-rose-600/15 text-rose-600 border-rose-600/20 text-[10px]" : "text-[10px]"} variant="outline">{b.verdict}</Badge>
                <span className="truncate flex-1 text-muted-foreground">{b.rationale?.slice(0, 80)}...</span>
                <Badge variant="secondary" className="text-[10px]">{b.citations?.length || 0} citations</Badge>
                <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${expanded === i ? "rotate-90" : ""}`} />
              </button>
              {expanded === i && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-xs">{b.rationale}</p>
                  {b.citations?.map((c: any, j: number) => (
                    <CitationBlock key={j} citation={c} />
                  ))}
                  <div className="text-[10px] text-muted-foreground">Signed by: {b.auditor_kid} | Sig: {r.signature?.slice(0, 30)}...</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecommenderView({ onNavigateToAudit }: { onNavigateToAudit?: (auditId: string) => void }) {
  const [proposals, setProposals] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  useEffect(() => { fetch(`${BASE}/api/agents/recommender/proposals?tenant=hackathon-demo&limit=25`).then(r => r.json()).then(d => setProposals(d.proposals || [])).catch(() => {}); }, []);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Policy Proposals</h3>
      {proposals.length === 0 && <p className="text-sm text-muted-foreground">Recommender analyzes audit patterns hourly. Proposals appear when CONFLICT patterns warrant human review.</p>}
      {proposals.map((p: any, i: number) => {
        const b = p.body || {};
        const trigger = b.trigger || {};
        const change = b.proposed_change || {};
        const diff = change.diff || {};
        const citations = change.supporting_citations || [];
        return (
          <div key={i} className="border border-border rounded-lg">
            <button onClick={() => setExpanded(expanded === i ? null : i)} className="w-full flex items-center gap-3 text-xs py-2 px-3 text-left cursor-pointer">
              <Badge className={b.confidence === "HIGH" ? "bg-rose-600/15 text-rose-600 text-[10px]" : b.confidence === "MEDIUM" ? "bg-amber-600/15 text-amber-600 text-[10px]" : "text-[10px]"} variant="outline">{b.confidence}</Badge>
              <span className="text-xs font-medium">{change.change_type || trigger.type}</span>
              <span className="truncate flex-1 text-muted-foreground">{trigger.pattern_summary?.slice(0, 80) || change.rationale?.slice(0, 80)}...</span>
              <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${expanded === i ? "rotate-90" : ""}`} />
            </button>
            {expanded === i && (
              <div className="px-3 pb-3 space-y-3">
                {trigger.pattern_summary && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Pattern</p>
                    <p className="text-xs">{trigger.pattern_summary}</p>
                  </div>
                )}
                {(diff.current || diff.proposed) && (() => {
                  const currentStr = typeof diff.current === "string" ? diff.current : JSON.stringify(diff.current, null, 2);
                  const proposedStr = typeof diff.proposed === "string" ? diff.proposed : JSON.stringify(diff.proposed, null, 2);
                  const isNew = !currentStr || currentStr === "..." || currentStr === '""' || currentStr === "null";
                  return (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Policy Diff</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="font-[var(--font-geist-mono)] text-[10px] bg-zinc-50 dark:bg-zinc-900 border-l-2 border-rose-400 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all text-zinc-700 dark:text-zinc-300">
                          {isNew ? <span className="text-muted-foreground italic">No existing rule</span> : currentStr}
                        </div>
                        <pre className="font-[var(--font-geist-mono)] text-[10px] bg-zinc-50 dark:bg-zinc-900 border-l-2 border-emerald-400 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all text-zinc-700 dark:text-zinc-300">{proposedStr}</pre>
                      </div>
                    </div>
                  );
                })()}
                {change.rationale && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Rationale</p>
                    <p className="text-xs">{change.rationale}</p>
                  </div>
                )}
                {citations.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Supporting Citations</p>
                    {citations.map((c: any, j: number) => (
                      <div key={j} className="mb-1">
                        <CitationBlock citation={c} />
                        {c.audit_report_id && (
                          <div className="text-[10px] text-muted-foreground mt-1 ml-3">
                            Audit: {onNavigateToAudit ? (
                              <button onClick={() => onNavigateToAudit(c.audit_report_id)} className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded font-[var(--font-geist-mono)] hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-foreground cursor-pointer transition-colors">{c.audit_report_id.slice(0, 12)}</button>
                            ) : (
                              <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">{c.audit_report_id?.slice(0, 12)}</code>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {trigger.audit_report_ids?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Trigger Reports</p>
                    <div className="flex flex-wrap gap-1">
                      {trigger.audit_report_ids.map((id: string, j: number) => (
                        onNavigateToAudit ? (
                          <button key={j} onClick={() => onNavigateToAudit(id)} className="text-[10px] font-[var(--font-geist-mono)] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-foreground cursor-pointer transition-colors">{id.slice(0, 12)}</button>
                        ) : (
                          <code key={j} className="text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{id.slice(0, 12)}</code>
                        )
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground">Signed by: {b.recommender_kid} | Sig: {p.signature?.slice(0, 30)}...</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IncidentCitations({ auditReportIds }: { auditReportIds: string[] }) {
  const [citations, setCitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function loadCitations() {
    if (fetched || auditReportIds.length === 0) return;
    setLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/agents/auditor/audit-reports?tenant=hackathon-demo&limit=500`);
      const data = await resp.json();
      const reports = data.reports || [];
      const matched = reports.filter((r: any) =>
        auditReportIds.some((id: string) => r.body?.audit_id?.includes(id) || id.includes(r.body?.audit_id))
      );
      const allCitations = matched.flatMap((r: any) =>
        (r.body?.citations || []).map((c: any) => ({ ...c, verdict: r.body?.verdict, receipt_seq: r.body?.receipt_seq }))
      );
      setCitations(allCitations);
    } catch {}
    setLoading(false);
    setFetched(true);
  }

  if (auditReportIds.length === 0) return null;

  return (
    <div>
      {!fetched ? (
        <button onClick={loadCitations} disabled={loading}
          className="text-[10px] text-violet-600 hover:text-violet-800 dark:text-violet-400 underline underline-offset-2">
          {loading ? "Loading citations..." : "Show compliance citations from referenced audits"}
        </button>
      ) : citations.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Compliance Citations</p>
          {citations.map((c: any, j: number) => (
            <CitationBlock key={j} citation={c} />
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">No citations found in referenced audit reports.</p>
      )}
    </div>
  );
}

function InvestigatorView() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  useEffect(() => { fetch(`${BASE}/api/agents/investigator/incidents?tenant=hackathon-demo&limit=25`).then(r => r.json()).then(d => setIncidents(d.incidents || [])).catch(() => {}); }, []);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Incident Reports</h3>
      {incidents.length === 0 && <p className="text-sm text-muted-foreground">Investigations trigger on CONFLICT verdicts via Pub/Sub.</p>}
      {incidents.map((inc: any, i: number) => {
        const b = inc.body || {};
        const narrative = b.narrative || {};
        const trigger = b.trigger || {};
        const timeline = narrative.timeline || [];
        const agents = narrative.agents_involved || [];
        const actions = narrative.recommended_actions || [];
        const evidence = b.evidence_references || {};
        return (
          <div key={i} className="border border-border rounded-lg">
            <button onClick={() => setExpanded(expanded === i ? null : i)} className="w-full flex items-center gap-3 text-xs py-2 px-3 text-left cursor-pointer">
              <Badge variant={b.severity === "CRITICAL" || b.severity === "HIGH" ? "destructive" : "outline"} className="text-[10px]">{b.severity}</Badge>
              <span className="truncate flex-1">{narrative.summary?.slice(0, 100) || b.executive_summary?.slice(0, 100) || "Incident"}...</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{trigger.type}</span>
              <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${expanded === i ? "rotate-90" : ""}`} />
            </button>
            {expanded === i && (
              <div className="px-3 pb-3 space-y-3">
                {(narrative.summary || b.executive_summary) && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Executive Summary</p>
                    <p className="text-xs">{narrative.summary || b.executive_summary}</p>
                  </div>
                )}
                {trigger.trigger_id && (
                  <div className="text-[10px] text-muted-foreground">Trigger: {trigger.type} | ID: <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">{trigger.trigger_id?.slice(0, 12)}</code></div>
                )}
                {timeline.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Timeline</p>
                    <div className="space-y-1">
                      {timeline.map((ev: any, j: number) => (
                        <div key={j} className="flex items-start gap-2 text-[11px] py-1 border-l-2 border-zinc-200 dark:border-zinc-700 pl-2">
                          <span className="text-muted-foreground shrink-0 w-16">{String(ev.timestamp || "").slice(11, 19)}</span>
                          <span className="flex-1">{ev.description || ev.event}</span>
                          {ev.evidence_id && <code className="text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1 rounded shrink-0">{ev.evidence_id?.slice(0, 10)}</code>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {agents.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Agents Involved</p>
                    <div className="flex flex-wrap gap-2">
                      {agents.map((a: any, j: number) => (
                        <div key={j} className="bg-muted/30 rounded px-2 py-1 text-[11px]">
                          <span className="font-medium">{a.agent_id}</span>
                          {a.role && <span className="text-muted-foreground"> · {a.role}</span>}
                          {a.registration_status && <Badge variant="outline" className="text-[9px] ml-1">{a.registration_status}</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {narrative.compliance_impact && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Compliance Impact</p>
                    <p className="text-xs">{narrative.compliance_impact}</p>
                  </div>
                )}
                {narrative.root_cause_hypothesis && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Root Cause</p>
                    <p className="text-xs">{narrative.root_cause_hypothesis}</p>
                  </div>
                )}
                {actions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Recommended Actions</p>
                    <div className="space-y-1">
                      {actions.map((a: any, j: number) => (
                        <div key={j} className="flex items-start gap-2 text-xs">
                          <Badge variant="outline" className={`text-[9px] shrink-0 ${a.priority === "IMMEDIATE" ? "bg-rose-600/15 text-rose-600 border-rose-600/20" : a.priority === "SHORT_TERM" ? "bg-amber-600/15 text-amber-600 border-amber-600/20" : ""}`}>{a.priority}</Badge>
                          <span>{a.action || a.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(evidence.audit_report_ids?.length > 0 || evidence.receipt_seqs?.length > 0) && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Evidence References</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {evidence.audit_report_ids?.map((id: string, j: number) => (
                        <code key={`a${j}`} className="text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{id.slice(0, 12)}</code>
                      ))}
                      {evidence.receipt_seqs?.map((seq: number, j: number) => (
                        <code key={`r${j}`} className="text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded">seq:{seq}</code>
                      ))}
                    </div>
                  </div>
                )}
                <IncidentCitations auditReportIds={evidence.audit_report_ids || []} />
                <div className="text-[10px] text-muted-foreground">Signed by: {b.investigator_kid} | Sig: {inc.signature?.slice(0, 30)}...</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CoordinatorView() {
  const [directory, setDirectory] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [routeResult, setRouteResult] = useState<any>(null);
  const [routing, setRouting] = useState(false);

  useEffect(() => { fetch(`${BASE}/api/agents/coordinator/directory`).then(r => r.json()).then(d => setDirectory(d.agents || [])).catch(() => {}); }, []);

  const handleRoute = async () => {
    if (!query.trim()) return;
    setRouting(true); setRouteResult(null);
    try {
      const resp = await fetch(`${BASE}/api/agents/coordinator/route-question`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: query }) });
      setRouteResult(await resp.json());
    } catch (e: any) { setRouteResult({ error: e.message }); }
    setRouting(false);
  };

  const examples = ["Authorize a database write for an AI agent", "Verify a receipt's signature", "Get the current chain statistics", "Get tomorrow's weather forecast"];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-2">Agent Directory ({directory.length} agents)</h3>
        <div className="space-y-1">
          {directory.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/30">
              <StatusDot ok={true} />
              <span className="font-medium">{a.agent_card?.name || a.name || a.agent_name}</span>
              <Badge variant="outline" className="text-[10px]">{a.trust_level || "TRUSTED"}</Badge>
              <span className="text-muted-foreground truncate flex-1">{a.self_described_skills?.length || a.skills_count || a.skills?.length || "?"} skills</span>
            </div>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <h3 className="text-sm font-semibold mb-1">Ask the Coordinator</h3>
        <p className="text-xs text-muted-foreground mb-3">Gemini identifies which agent(s) can handle your request.</p>
        <div className="flex gap-2 mb-2">
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleRoute()} placeholder="What do you need done?" className="flex-1 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5" />
          <Button onClick={handleRoute} disabled={routing} size="sm" className="gap-1">
            {routing && <Loader2 className="w-3 h-3 animate-spin" />} Route
          </Button>
        </div>
        <div className="flex gap-1.5 flex-wrap mb-3">
          {examples.map(ex => <button key={ex} onClick={() => { setQuery(ex); }} className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-muted-foreground hover:text-foreground hover:border-primary/30 cursor-pointer transition-colors">{ex}</button>)}
        </div>
        {routeResult && (() => {
          const agents = routeResult.matches || routeResult.matched_agents || [];
          return (
            <Card className={agents.length ? "border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10"}>
              <CardContent className="p-3">
                {agents.length ? (
                  <div className="space-y-2">
                    {agents.map((m: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium">{m.agent_name}</span>
                        <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20 text-[10px]">{m.confidence}</Badge>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">{routeResult.rationale || agents[0]?.rationale}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm">{routeResult.no_match_explanation || routeResult.error || "No matching agent found"}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}

// --- Activity Timeline ---
function ActivityTimeline() {
  const [activities, setActivities] = useState<any[]>([]);
  const refresh = useCallback(() => { fetch(`${BASE}/api/activity-stream?limit=15`).then(r => r.json()).then(d => setActivities(d.activities || [])).catch(() => {}); }, []);
  useEffect(() => { refresh(); const t = setInterval(refresh, 30000); return () => clearInterval(t); }, [refresh]);

  const agentColors: Record<string, string> = { Gateway: "text-zinc-600", Auditor: "text-teal-600", Recommender: "text-indigo-600", Investigator: "text-amber-600", Coordinator: "text-purple-600", Isolator: "text-rose-600" };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Recent Activity</h3>
        <Button variant="ghost" size="sm" onClick={refresh} className="h-6 w-6 p-0"><RefreshCw className="w-3 h-3" /></Button>
      </div>
      {activities.length === 0 && <p className="text-xs text-muted-foreground">No activity yet. Run a flow to see agents collaborating.</p>}
      <div className="space-y-1">
        {activities.map((a, i) => (
          <div key={i} className="flex items-start gap-2 text-xs py-1 animate-in fade-in">
            <span className={`font-medium shrink-0 w-24 ${agentColors[a.agent] || "text-muted-foreground"}`}>{a.agent}</span>
            <span className="text-[10px] text-muted-foreground shrink-0 w-16">{String(a.ts || "").slice(11, 19)}</span>
            <span className="flex-1">{a.summary}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Isolator View ---
function IsolatorView() {
  const [records, setRecords] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/api/agents/isolator/isolation-records?tenant=hackathon-demo&limit=25`).then(r => r.json()).catch(() => ({ isolation_records: [] })),
      fetch(`${BASE}/api/agents/isolator/isolation-records?tenant=default&limit=25`).then(r => r.json()).catch(() => ({ isolation_records: [] })),
    ]).then(([a, b]) => {
      const all = [...(a.isolation_records || []), ...(b.isolation_records || [])];
      all.sort((x: any, y: any) => (y.body?.isolated_at || "").localeCompare(x.body?.isolated_at || ""));
      setRecords(all.slice(0, 25));
    });
  }, []);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Isolation Records</h3>
      {records.length === 0 && <p className="text-sm text-muted-foreground">No isolation records yet. The Isolator triggers on HIGH/CRITICAL incident reports.</p>}
      {records.map((rec: any, i: number) => {
        const b = rec.body || {};
        const actions = b.actions_taken || [];
        return (
          <div key={i} className="border border-border rounded-lg">
            <button onClick={() => setExpanded(expanded === i ? null : i)} className="w-full flex items-center gap-3 text-xs py-2 px-3 text-left cursor-pointer">
              <Badge variant={b.severity === "CRITICAL" ? "destructive" : "outline"} className="text-[10px]">{b.severity}</Badge>
              <span className="font-medium">{b.agent_id}</span>
              <span className="truncate flex-1 text-muted-foreground">{b.reason?.slice(0, 80)}</span>
              <Badge variant="outline" className="text-[10px]">{actions.length} actions</Badge>
              <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${expanded === i ? "rotate-90" : ""}`} />
            </button>
            {expanded === i && (
              <div className="px-3 pb-3 space-y-3">
                {b.reason && <p className="text-xs">{b.reason}</p>}
                {actions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Containment Actions</p>
                    {actions.map((a: any, j: number) => (
                      <div key={j} className="flex items-start gap-2 text-xs py-1 border-l-2 border-rose-300 dark:border-rose-700 pl-2 mb-1">
                        <Badge className={a.action === "REVOKE_REGISTRATION" ? "bg-rose-600/15 text-rose-600 text-[9px]" : a.action === "RATE_LIMIT_ZERO" ? "bg-amber-600/15 text-amber-600 text-[9px]" : "text-[9px]"} variant="outline">{a.action}</Badge>
                        <span className="font-medium">{a.agent_id}</span>
                        <span className="text-muted-foreground flex-1">{a.rationale}</span>
                        <Badge variant="outline" className="text-[9px]">{a.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground">Signed by: {b.isolator_kid} | ID: {b.isolation_id?.slice(0, 12)}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Signing Keys Sidebar ---
function SigningKeysSidebar({ keys }: { keys: Record<string, string> }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold">Independent Signing Keys</CardTitle></CardHeader>
      <CardContent className="space-y-1.5">
        {Object.entries(keys).map(([agent, kid]) => (
          <div key={agent} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-20 capitalize">{agent}</span>
            <code className="text-[10px] font-[var(--font-geist-mono)] text-muted-foreground truncate flex-1">{kid}</code>
            <button onClick={() => copyText(kid)} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Copy className="w-2.5 h-2.5 text-muted-foreground" /></button>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground pt-1 border-t border-border mt-2">Each AI agent has an independent Ed25519 key. AI does not sit on the authorization trust path.</p>
      </CardContent>
    </Card>
  );
}

// --- Liveness Summary (Continuous Attestation) ---
function LivenessSummary() {
  const [data, setData] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/agents/gateway/agents/liveness`).then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return null;

  const summary = data.summary || {};
  const agents = data.agents || [];
  const total = agents.length;

  const stateColors: Record<string, string> = {
    LIVE: "text-emerald-600",
    WARNING: "text-amber-600",
    STALE: "text-orange-600",
    SUSPENDED: "text-rose-600",
    UNKNOWN: "text-zinc-500",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
          <Activity className="w-3 h-3" /> Continuous Attestation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {total === 0 ? (
          <p className="text-[10px] text-muted-foreground">No agents with liveness tracking.</p>
        ) : (
          <>
            <div className="flex gap-3 text-xs">
              {(["LIVE", "WARNING", "STALE", "SUSPENDED"] as const).map(s => (
                (summary[s] || 0) > 0 && (
                  <span key={s} className={`font-medium ${stateColors[s]}`}>{summary[s]} {s.toLowerCase()}</span>
                )
              ))}
            </div>
            <Collapsible open={expanded} onOpenChange={setExpanded}>
              <CollapsibleTrigger className="text-[10px] text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground">
                <ChevronRight className={`w-2.5 h-2.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
                {total} agents tracked (interval: {data.attestation_interval}s)
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 mt-1.5">
                  {agents.map((a: any) => (
                    <div key={a.agent_id} className="flex items-center gap-2 text-[10px]">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        a.state === "LIVE" ? "bg-emerald-500" :
                        a.state === "WARNING" ? "bg-amber-500" :
                        a.state === "STALE" ? "bg-orange-500" :
                        a.state === "SUSPENDED" ? "bg-rose-500" : "bg-zinc-400"
                      }`} />
                      <code className="font-[var(--font-geist-mono)] truncate flex-1">{a.agent_id}</code>
                      <span className={`shrink-0 ${stateColors[a.state] || ""}`}>{a.state}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Artifact Anchoring (Unified Merkle Tree) ---
function ArtifactAnchoring() {
  const [anchors, setAnchors] = useState<any[]>([]);
  const [logData, setLogData] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  const [anchoring, setAnchoring] = useState(false);
  const [anchorResult, setAnchorResult] = useState<any>(null);

  const refresh = useCallback(() => {
    fetch(`${BASE}/api/agents/gateway/anchors`).then(r => r.json()).then(d => {
      setAnchors(d.on_chain_anchors || []);
    }).catch(() => {});
    fetch(`${BASE}/api/agents/gateway/artifacts/log?limit=10`).then(r => r.json()).then(setLogData).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function triggerAnchor() {
    setAnchoring(true); setAnchorResult(null);
    try {
      const resp = await fetch(`${BASE}/api/agents/gateway/anchors/trigger`, { method: "POST" });
      const data = await resp.json();
      setAnchorResult(data);
      if (data.status === "anchored") refresh();
    } catch (e: any) {
      setAnchorResult({ status: "error", reason: e.message });
    }
    setAnchoring(false);
  }

  const latest = anchors[0];
  const artifactCount = logData?.head_seq || 0;

  const TYPE_LABELS: Record<string, string> = {
    receipt: "Receipt",
    audit_report: "Audit Report",
    policy_proposal: "Policy Proposal",
    incident_report: "Incident Report",
    isolation_record: "Isolation Record",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <Anchor className="w-3 h-3" /> Artifact Anchoring
          </CardTitle>
          <Button
            variant="ghost" size="sm"
            className="h-6 text-[10px] px-2 gap-1"
            onClick={triggerAnchor}
            disabled={anchoring}
          >
            {anchoring ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Anchor className="w-2.5 h-2.5" />}
            {anchoring ? "Anchoring..." : "Anchor Now"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-xs text-muted-foreground">
          {artifactCount} artifacts in unified log
        </div>

        {anchorResult && anchorResult.status === "anchored" && (
          <div className="rounded border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Anchored {anchorResult.artifact_count} artifacts to Base L2</span>
            </div>
            <a href={anchorResult.basescan_url} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
              <ExternalLink className="w-2.5 h-2.5" />
              View on BaseScan
            </a>
          </div>
        )}
        {anchorResult && anchorResult.status === "skipped" && (
          <p className="text-[10px] text-amber-600">{anchorResult.reason}</p>
        )}
        {anchorResult && anchorResult.status === "error" && (
          <p className="text-[10px] text-rose-600">{anchorResult.reason}</p>
        )}

        {latest ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Anchored to Base L2</span>
            </div>

            {/* What this proves */}
            <div className="rounded border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 space-y-1.5">
              <p className="text-[10px] font-medium text-blue-800 dark:text-blue-300">What this proves:</p>
              <ul className="text-[10px] text-blue-700 dark:text-blue-400 space-y-0.5 list-disc list-inside">
                <li><strong>{latest.artifact_count || "—"} artifacts</strong> (receipts, audits, incidents) were hashed into a Merkle tree</li>
                <li>The <strong>Merkle root</strong> was written to Base L2 calldata at block {latest.block_number?.toLocaleString()}</li>
                <li>No one — not even Gate — can alter these artifacts after anchoring</li>
                <li>Anyone can recompute the tree from the artifacts and verify the root matches</li>
              </ul>
            </div>

            {/* Anchor details */}
            <div className="text-[10px] space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16">Tx:</span>
                <a href={latest.basescan_url || `https://basescan.org/tx/${latest.tx_hash}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline font-[var(--font-geist-mono)]">
                  {String(latest.tx_hash || "").slice(0, 22)}...
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16">Block:</span>
                <span>{latest.block_number?.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16">Root:</span>
                <code className="font-[var(--font-geist-mono)] text-muted-foreground">{String(latest.merkle_root || "").slice(0, 32)}...</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16">Artifacts:</span>
                <span>{latest.artifact_count || "—"} in this batch</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16">Cost:</span>
                <span>~$0.001 (Base L2 calldata)</span>
              </div>
            </div>

            <p className="text-[9px] text-muted-foreground italic border-t pt-1.5">
              The BaseScan transaction contains the Merkle root in its calldata (click "+ Click to show more" → Input Data on BaseScan to see the raw hex).
              This root is a cryptographic fingerprint of all {latest.artifact_count || ""} artifacts — changing any single receipt would produce a different root.
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">No on-chain anchors yet. Click "Anchor Now" or wait for the scheduled threshold (10 artifacts or 1 hour).</p>
        )}

        {logData?.entries?.length > 0 && (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger className="text-[10px] text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground">
              <ChevronRight className={`w-2.5 h-2.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
              Recent artifacts in log
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0.5 mt-1.5">
                {logData.entries.map((e: any) => (
                  <div key={e.seq} className="flex items-center gap-1.5 text-[10px]">
                    <Badge variant="outline" className="text-[8px] px-1 py-0">#{e.seq}</Badge>
                    <span className="text-muted-foreground w-20 truncate">{TYPE_LABELS[e.artifact_type] || e.artifact_type}</span>
                    <code className="font-[var(--font-geist-mono)] text-muted-foreground truncate flex-1">{e.artifact_hash?.slice(0, 16)}...</code>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {anchors.length > 1 && (
          <p className="text-[10px] text-muted-foreground pt-1 border-t">{anchors.length} total anchors on Base L2</p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Agent Risk Heatmap ---
function AgentRiskHeatmap() {
  const [agents, setAgents] = useState<any[]>([]);
  const [auditData, setAuditData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/api/agents/gateway/agents`).then(r => r.json()).catch(() => ({ agents: [] })),
      fetch(`${BASE}/api/agents/auditor/audit-reports?tenant=hackathon-demo&limit=500`).then(r => r.json()).catch(() => ({ reports: [] })),
      fetch(`${BASE}/api/agents/gateway/chain?limit=500`).then(r => r.json()).catch(() => ({ receipts: [] })),
      fetch(`${BASE}/api/agents/gateway/agents/liveness`).then(r => r.json()).catch(() => ({ agents: [] })),
    ]).then(([agentResp, auditResp, chainResp, livenessResp]) => {
      const receipts = chainResp.receipts || [];
      const reports = auditResp.reports || [];
      const livenessMap: Record<string, any> = {};
      (livenessResp.agents || []).forEach((a: any) => { livenessMap[a.agent_id] = a; });

      const agentList = (agentResp.agents || []).map((a: any) => {
        const id = a.agent_id;
        const agentReceipts = receipts.filter((r: any) => r._meta?.agent_id === id);
        const total = agentReceipts.length;
        const denials = agentReceipts.filter((r: any) => r.body?.decision === "deny").length;
        const denialRate = total > 0 ? denials / total : 0;

        // Count audit conflicts for this agent's receipts
        const agentSeqs = new Set(agentReceipts.map((r: any) => parseInt(r.body?.seq || "0")));
        const conflicts = reports.filter((r: any) => r.body?.verdict === "CONFLICT" && agentSeqs.has(r.body?.receipt_seq)).length;

        const liveness = livenessMap[id];
        const livenessState = liveness?.state || a.liveness_state || "UNKNOWN";

        // Compute risk score 0-100
        let risk = 0;
        risk += Math.min(denialRate * 60, 60); // up to 60 from denial rate
        risk += Math.min(conflicts * 10, 25); // up to 25 from conflicts
        if (livenessState === "SUSPENDED") risk += 15;
        else if (livenessState === "STALE") risk += 10;
        else if (livenessState === "WARNING") risk += 5;
        risk = Math.min(Math.round(risk), 100);

        return {
          agent_id: id,
          total,
          denials,
          denialRate,
          conflicts,
          livenessState,
          risk,
        };
      });

      agentList.sort((a: any, b: any) => b.risk - a.risk);
      setAgents(agentList);
      setLoading(false);
    });
  }, []);

  function riskColor(risk: number) {
    if (risk >= 60) return "bg-rose-500";
    if (risk >= 40) return "bg-orange-500";
    if (risk >= 20) return "bg-amber-500";
    if (risk > 0) return "bg-yellow-400";
    return "bg-emerald-500";
  }

  function riskLabel(risk: number) {
    if (risk >= 60) return "HIGH";
    if (risk >= 40) return "MEDIUM";
    if (risk >= 20) return "LOW";
    return "CLEAR";
  }

  function riskBadgeClass(risk: number) {
    if (risk >= 60) return "bg-rose-600/15 text-rose-600 border-rose-600/20";
    if (risk >= 40) return "bg-orange-600/15 text-orange-600 border-orange-600/20";
    if (risk >= 20) return "bg-amber-600/15 text-amber-600 border-amber-600/20";
    return "bg-emerald-600/15 text-emerald-600 border-emerald-600/20";
  }

  if (loading) return null;
  if (agents.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" /> Agent Risk Assessment
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">Computed from receipt chain: denial rate, audit conflicts, liveness state</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {agents.map((a: any) => (
            <div key={a.agent_id} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded border hover:bg-muted/10">
              {/* Risk bar */}
              <div className="w-16 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden shrink-0">
                <div className={`h-full rounded-full transition-all ${riskColor(a.risk)}`} style={{ width: `${a.risk}%` }} />
              </div>
              <Badge variant="outline" className={`text-[9px] w-14 justify-center shrink-0 ${riskBadgeClass(a.risk)}`}>
                {riskLabel(a.risk)}
              </Badge>
              <code className="font-[var(--font-geist-mono)] text-[11px] truncate flex-1">{a.agent_id}</code>
              <span className="text-[10px] text-muted-foreground shrink-0">{a.total} reqs</span>
              {a.denials > 0 && <Badge variant="outline" className="text-[9px] bg-rose-600/10 text-rose-600">{a.denials} denied</Badge>}
              {a.conflicts > 0 && <Badge variant="outline" className="text-[9px] bg-amber-600/10 text-amber-600">{a.conflicts} conflicts</Badge>}
              <span className={`text-[9px] shrink-0 ${
                a.livenessState === "LIVE" ? "text-emerald-600" :
                a.livenessState === "SUSPENDED" ? "text-rose-600" :
                a.livenessState === "STALE" ? "text-orange-600" : "text-zinc-400"
              }`}>{a.livenessState}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Pipeline Simulation ---
function PipelineSimulator({ onAgentSelect }: { onAgentSelect: (id: string) => void }) {
  // Restore state from sessionStorage on mount (survives refresh)
  const [step, _setStep] = useState(() => {
    if (typeof window !== "undefined") return parseInt(sessionStorage.getItem("pipeline_step") || "0");
    return 0;
  });
  const [results, setResults] = useState<Record<string, any>>(() => {
    if (typeof window !== "undefined") try { return JSON.parse(sessionStorage.getItem("pipeline_results") || "{}"); } catch { return {}; }
    return {};
  });
  const [error, setError] = useState("");
  const [rogueAgent, _setRogueAgent] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("pipeline_rogue") || "";
    return "";
  });
  const [mode, setMode] = useState<"auto" | "manual">(() => {
    if (typeof window !== "undefined") return (sessionStorage.getItem("pipeline_mode") as "auto" | "manual") || "auto";
    return "auto";
  });
  const [stepRunning, setStepRunning] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [stepProgress, setStepProgress] = useState<string>("");

  // Wrap setters to persist to sessionStorage
  const setStep = (v: number) => { _setStep(v); if (typeof window !== "undefined") sessionStorage.setItem("pipeline_step", String(v)); };
  const setRogueAgent = (v: string) => { _setRogueAgent(v); if (typeof window !== "undefined") sessionStorage.setItem("pipeline_rogue", v); };

  // Persist results and mode on change
  useEffect(() => { if (typeof window !== "undefined") sessionStorage.setItem("pipeline_results", JSON.stringify(results)); }, [results]);
  useEffect(() => { if (typeof window !== "undefined") sessionStorage.setItem("pipeline_mode", mode); }, [mode]);

  const GW = `${BASE}/api/agents/gateway`;

  async function postJson(url: string, body: any) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json();
  }

  // Individual step runners (shared by both modes)
  async function runStep1_Resources() {
    const resources = [
      { resource_id: "staging-analytics-db", display_name: "Staging Analytics Database", resource_type: "db",
        metadata: { engine: "firestore", provider: "firestore", project_id: "quick-catcher-470218-b0" } },
      { resource_id: "compliance-docs-bucket", display_name: "Compliance Documents", resource_type: "storage",
        metadata: { bucket: "quick-catcher-470218-b0-auditor-compliance-docs", provider: "gcs" } },
      { resource_id: "audit-events-topic", display_name: "Audit Events Stream", resource_type: "queue",
        metadata: { topic: "auditor-conflicts", provider: "pubsub", project_id: "quick-catcher-470218-b0" } },
      { resource_id: "gateway-health-api", display_name: "Gateway Health API", resource_type: "api",
        reachability_url: "https://agent-auth-gateway-1031148889398.us-central1.run.app/health" },
    ];
    const rr: any[] = [];
    for (let i = 0; i < resources.length; i++) {
      const r = resources[i];
      setStepProgress(`Verifying ${r.display_name} (${i + 1}/${resources.length})...`);
      const resp = await fetch(`${GW}/resources/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
      const data = await resp.json();
      if (resp.status === 409) { rr.push({ ...data, status: "registered", verification: "exists" }); }
      else { rr.push(data); }
    }
    setStepProgress("");
    setResults(prev => ({ ...prev, resources: { registered: rr.filter(r => r.status === "registered").length, verified: rr.filter(r => r.verification === "verified" || r.verification === "exists").length, total: resources.length, details: rr } }));
  }

  async function runStep2_Actions() {
    setStepProgress("Registering actions with risk levels...");
    const actions = [
      { action_id: "read", display_name: "Read", risk_level: "low", resource_type: "db", description: "Read-only data access" },
      { action_id: "query", display_name: "Query", risk_level: "low", resource_type: "db", description: "Database query" },
      { action_id: "delete", display_name: "Delete", risk_level: "high", resource_type: "db", requires_human_approval: true, description: "Destructive: removes data" },
      { action_id: "admin", display_name: "Admin", risk_level: "critical", resource_type: "db", requires_human_approval: true, description: "Administrative access" },
      { action_id: "execute", display_name: "Execute", risk_level: "high", resource_type: "function", requires_human_approval: true, description: "Run code or trigger operation" },
    ];
    const ar: any[] = [];
    for (const a of actions) {
      const resp = await fetch(`${GW}/actions/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) });
      const data = await resp.json();
      if (resp.status === 409) { ar.push({ ...data, status: "registered" }); }
      else { ar.push(data); }
    }
    setStepProgress("");
    setResults(prev => ({ ...prev, actions: { registered: ar.filter(r => r.status === "registered").length, total: actions.length } }));
  }

  async function runStep3_Policy() {
    setStepProgress("Loading current policy...");
    const pol = await fetch(`${GW}/policy`).then(r => r.json());
    const rules = pol.rules || [];
    const defaults = [
      { id: "default-allowlist", type: "allowlist", config: { allowed_actions: ["read", "query", "list", "get", "search", "analyze"] } },
      { id: "default-resource-scope", type: "resource_scope", config: { allowed_resources: ["staging", "dev", "sandbox", "test"], denied_resources: ["production", "prod", "master-key", "admin"] } },
      { id: "default-rate-limit", type: "rate_limit", config: { max_actions: 10, window_seconds: 60 } },
    ];
    const missing = defaults.filter(d => !rules.some((r: any) => r.type === d.type));
    if (missing.length > 0) {
      setStepProgress(`Applying ${missing.length} missing system rule${missing.length > 1 ? "s" : ""}...`);
      const merged = [...rules, ...missing];
      await fetch(`${GW}/policy`, { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: pol.version || "1", rules: merged, require_resource_registration: pol.require_resource_registration }) });
      const updated = await fetch(`${GW}/policy`).then(r => r.json());
      setStepProgress("");
      setResults(prev => ({ ...prev, policy: { rules: (updated.rules || []).length, hash: updated.policy_hash?.slice(0, 24), applied: missing.map((m: any) => m.type) } }));
    } else {
      setStepProgress("");
      setResults(prev => ({ ...prev, policy: { rules: rules.length, hash: pol.policy_hash?.slice(0, 24), applied: [] } }));
    }
  }

  async function runStep4_Spawn() {
    setStepProgress("Generating Ed25519 keypair + PoP registration + A2A card + live challenge...");
    const resp = await fetch(`${BASE}/api/agents/demo-agent/spawn`, { method: "POST" });
    if (!resp.ok) throw new Error("Failed to spawn agent");
    const spawned = await resp.json();
    // Re-register via register-by-url so card + liveness verification is recorded
    if (spawned.card_url && spawned.live_challenge_url) {
      setStepProgress("Verifying agent card + liveness challenge...");
      try {
        await fetch(`${GW}/agents/register-by-url`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: spawned.agent_id, agent_card_url: spawned.card_url, live_challenge_url: spawned.live_challenge_url }),
        });
      } catch {}
    }
    setRogueAgent(spawned.agent_id);
    setStepProgress("");
    setResults(prev => ({ ...prev, spawn: spawned }));
    return spawned.agent_id;
  }

  async function runStep5_Bind(agentId: string) {
    // Create a binding: this agent CAN read staging-analytics-db
    const pol = await fetch(`${GW}/policy`).then(r => r.json());
    const rules = pol.rules || [];
    const bindingRule = {
      id: `bind-${agentId}-read-staging-analytics-db`.slice(0, 64),
      type: "agent_binding",
      config: { agent_id: agentId, action_id: "read", resource_id: "staging-analytics-db" },
    };
    rules.push(bindingRule);
    await fetch(`${GW}/policy`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: pol.version || "1", rules, require_resource_registration: pol.require_resource_registration }),
    });
    setResults(prev => ({ ...prev, binding: { agent_id: agentId, action: "read", resource: "staging-analytics-db" } }));
  }

  async function runStep6_Burst(agentId: string) {
    const acts = ["delete", "admin", "execute", "drop"];
    const br: any[] = [];
    for (let i = 0; i < acts.length; i++) {
      setStepProgress(`Attempting ${acts[i]} (${i + 1}/${acts.length})...`);
      br.push(await postJson(`${BASE}/api/agents/demo-agent/attack-resource`, { agent_id: agentId, action: acts[i], resource: "staging-analytics-db" }));
    }
    setStepProgress("");
    setResults(prev => ({ ...prev, rogue: { actions: acts, denials: br.filter(r => r.decision === "deny" || r.gateway_status === 401).length, total: br.length } }));
  }

  async function runStep7_Audit() {
    setStepProgress("Gemini 2.5 Pro analyzing receipts against OWASP + NIST...");
    const d = await postJson(`${BASE}/api/agents/auditor/audit-tick`, {});
    setStepProgress("");
    setResults(prev => ({ ...prev, auditor: d }));
  }

  async function runStep8_Investigate(agentId: string) {
    setStepProgress("Gemini 2.5 Pro assembling incident timeline + evidence + containment...");
    const d = await postJson(`${BASE}/api/agents/investigator/investigate`, { tenant: "hackathon-demo", trigger: { type: "MANUAL", trigger_id: agentId } });
    if (d.error) throw new Error(`Investigator: ${d.error}`);
    setStepProgress("Fetching containment result...");
    const existing = await fetch(`${BASE}/api/agents/isolator/isolation-records?tenant=hackathon-demo&limit=5`).then(r => r.json()).catch(() => ({ isolation_records: [] }));
    const records = existing.isolation_records || [];
    const isolated = records[0];
    setStepProgress("");
    setResults(prev => ({
      ...prev,
      investigator: d,
      isolator: isolated?.body || isolated || null,
    }));
  }

  async function runStep9_Recommend() {
    setStepProgress("Gemini 2.5 Pro detecting patterns + proposing policy changes...");
    const d = await postJson(`${BASE}/api/agents/recommender/recommend-tick`, {});
    setStepProgress("");
    setResults(prev => ({ ...prev, recommender: d }));
  }

  // Autopilot: run everything
  async function runPipeline() {
    setStep(1); setResults({}); setError(""); setRogueAgent(""); setAutoRunning(true);
    try {
      await runStep1_Resources();
      setStep(2); await runStep2_Actions();
      setStep(3); await runStep3_Policy();
      setStep(4); const agentId = await runStep4_Spawn();
      setStep(5); await runStep5_Bind(agentId);
      setStep(6); await runStep6_Burst(agentId);
      setStep(7); await runStep7_Audit();
      setStep(8); await runStep8_Investigate(agentId);
      setStep(9); await runStep9_Recommend();
      setStep(10);
    } catch (e: any) { setError(e.message || "Pipeline failed"); setStep(0); }
    setAutoRunning(false);
  }

  // Manual: run one step at a time
  async function runNextStep() {
    setStepRunning(true); setError("");
    const nextStep = step + 1;
    setStep(nextStep);
    try {
      if (nextStep === 1) { setResults({}); setRogueAgent(""); await runStep1_Resources(); }
      else if (nextStep === 2) await runStep2_Actions();
      else if (nextStep === 3) await runStep3_Policy();
      else if (nextStep === 4) await runStep4_Spawn();
      else if (nextStep === 5) await runStep5_Bind(rogueAgent);
      else if (nextStep === 6) await runStep6_Burst(rogueAgent);
      else if (nextStep === 7) await runStep7_Audit();
      else if (nextStep === 8) await runStep8_Investigate(rogueAgent);
      else if (nextStep === 9) { await runStep9_Recommend(); setStep(10); }
    } catch (e: any) { setError(e.message || "Step failed"); setStep(nextStep - 1); }
    setStepRunning(false);
  }

  function resetPipeline() {
    setStep(0); setResults({}); setError(""); setRogueAgent(""); setStepProgress("");
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pipeline_step");
      sessionStorage.removeItem("pipeline_results");
      sessionStorage.removeItem("pipeline_rogue");
      sessionStorage.removeItem("pipeline_mode");
    }
  }

  const STEPS = [
    { id: "resources", label: "Resources", icon: Database, idx: 1 },
    { id: "actions", label: "Actions", icon: Shield, idx: 2 },
    { id: "policy", label: "Policy", icon: Shield, idx: 3 },
    { id: "spawn", label: "Spawn Rogue", icon: Server, idx: 4 },
    { id: "binding", label: "Bind Policy", icon: Link, idx: 5 },
    { id: "rogue", label: "Rogue Burst", icon: ShieldOff, idx: 6 },
    { id: "auditor", label: "Auditor", icon: Eye, idx: 7 },
    { id: "investigator", label: "Investigate + Isolate", icon: AlertTriangle, idx: 8 },
    { id: "recommender", label: "Recommender", icon: Brain, idx: 9 },
  ];

  const running = autoRunning;
  const manualDone = step >= 10;
  const nextStepInfo = STEPS[step] || null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Pipeline Simulator</h3>
            <p className="text-[11px] text-muted-foreground">Registers resources, actions, and policy, then spawns a rogue agent, fires unauthorized actions, and runs all 6 agents.</p>
          </div>
          <div className="flex items-center gap-2">
            {step === 0 && (
              <div className="flex border rounded-md overflow-hidden text-[10px]">
                <button onClick={() => setMode("auto")} className={`px-2.5 py-1 ${mode === "auto" ? "bg-purple-600 text-white" : "text-muted-foreground hover:bg-muted"}`}>Autopilot</button>
                <button onClick={() => setMode("manual")} className={`px-2.5 py-1 ${mode === "manual" ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted"}`}>Step-by-Step</button>
              </div>
            )}
            {mode === "auto" ? (
              <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2 text-xs" onClick={runPipeline} disabled={running || manualDone}>
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                {running ? "Running..." : manualDone ? "Done" : "Run Pipeline"}
              </Button>
            ) : (
              <div className="flex gap-1.5">
                {!manualDone && (
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 text-xs" onClick={runNextStep} disabled={stepRunning}>
                    {stepRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    {stepRunning ? "Running..." : nextStepInfo ? `Run: ${nextStepInfo.label}` : "Start"}
                  </Button>
                )}
                {step > 0 && (
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={resetPipeline}>Reset</Button>
                )}
              </div>
            )}
            {mode === "auto" && step > 0 && !running && (
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={resetPipeline}>Reset</Button>
            )}
          </div>
        </div>
        {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
        {step > 0 && (
          <div className="flex items-center gap-1 flex-wrap text-xs mb-3">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${step > s.idx || (step === s.idx && !running && !stepRunning) ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400" : step === s.idx ? "border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400" : "border-border text-muted-foreground"}`}>
                  {step === s.idx && (running || stepRunning) && <Loader2 className="w-3 h-3 animate-spin" />}
                  {(step > s.idx || (step === s.idx && !running && !stepRunning)) && <CheckCircle2 className="w-3 h-3" />}
                  {step < s.idx && <s.icon className="w-3 h-3" />}
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
        {stepProgress && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            {stepProgress}
          </div>
        )}
        {rogueAgent && step >= 5 && (
          <p className="text-[11px] text-muted-foreground mb-2">Rogue agent: <code className="font-[var(--font-geist-mono)] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{rogueAgent}</code></p>
        )}
        {step === 11 && (
          <div className="space-y-2">
            {/* Setup results */}
            {results.resources && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border text-xs">
                <Database className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-medium">Resources:</span>
                <Badge className="text-[10px] bg-blue-600/15 text-blue-700 border-blue-600/20">{results.resources.registered} registered</Badge>
                <Badge className="text-[10px] bg-emerald-600/15 text-emerald-700 border-emerald-600/20">{results.resources.verified} verified</Badge>
              </div>
            )}
            {results.actions && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border text-xs">
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-medium">Actions:</span>
                <Badge className="text-[10px]" variant="outline">{results.actions.registered} registered</Badge>
              </div>
            )}
            {results.policy && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border text-xs">
                <Shield className="w-3.5 h-3.5 text-purple-600" />
                <span className="font-medium">Policy:</span>
                <Badge className="text-[10px]" variant="outline">{results.policy.rules} rules active</Badge>
                <span className="text-muted-foreground font-[var(--font-geist-mono)] text-[10px]">{results.policy.hash}...</span>
              </div>
            )}
            {results.binding && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border text-xs">
                <Link className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-medium">Binding:</span>
                <Badge className="text-[10px] bg-blue-600/15 text-blue-700 border-blue-600/20">{results.binding.agent_id}</Badge>
                <span className="text-muted-foreground">can <strong>{results.binding.action}</strong> on <strong>{results.binding.resource}</strong></span>
              </div>
            )}
            {/* Attack results */}
            {results.rogue && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border text-xs">
                <ShieldOff className="w-3.5 h-3.5 text-rose-600" />
                <span className="font-medium">Rogue Burst:</span>
                <Badge variant="destructive" className="text-[10px]">{results.rogue.denials}/{results.rogue.total} denied</Badge>
                <span className="text-muted-foreground">({results.rogue.actions.join(", ")})</span>
              </div>
            )}
            {results.auditor && (
              <button onClick={() => onAgentSelect("auditor")} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-muted/30 transition-colors cursor-pointer">
                <Eye className="w-3.5 h-3.5 text-teal-600" />
                <span className="text-xs font-medium">Auditor:</span>
                <Badge className="text-[10px]" variant="outline">{results.auditor.audited || 0} audited</Badge>
                {results.auditor.by_verdict?.CONFLICT > 0 && <Badge variant="destructive" className="text-[10px]">{results.auditor.by_verdict.CONFLICT} CONFLICT</Badge>}
                <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto" />
              </button>
            )}
            {results.investigator && (
              <button onClick={() => onAgentSelect("investigator")} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-muted/30 transition-colors cursor-pointer">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-medium">Investigation:</span>
                <Badge className={`text-[10px] ${["HIGH","CRITICAL"].includes(results.investigator.incident?.severity || results.investigator.severity || "") ? "bg-rose-600/15 text-rose-600 border-rose-600/20" : "bg-amber-600/15 text-amber-600 border-amber-600/20"}`} variant="outline">
                  {results.investigator.incident?.severity || results.investigator.severity || "—"}
                </Badge>
                <span className="text-[11px] text-muted-foreground truncate flex-1">{(results.investigator.incident?.incident_id || "").slice(0, 12)}...</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
            {results.isolator && (() => {
              const isoAction = results.isolator.actions_taken?.[0]?.action || results.isolator.action || results.isolator.containment_action || "SKIPPED";
              const isoReason = results.isolator.summary || results.isolator.actions_taken?.[0]?.rationale || results.isolator.reason || "";
              const isContained = isoAction !== "SKIPPED";
              return (
                <button onClick={() => onAgentSelect("isolator")} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-muted/30 transition-colors cursor-pointer">
                  <ShieldOff className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-xs font-medium">Isolation:</span>
                  <Badge className={`text-[10px] ${isContained ? "bg-rose-600/15 text-rose-600 border-rose-600/20" : ""}`} variant="outline">{isoAction}</Badge>
                  <span className="text-[11px] text-muted-foreground truncate flex-1">{isoReason.slice(0, 60)}</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                </button>
              );
            })()}
            {results.recommender && (
              <button onClick={() => onAgentSelect("recommender")} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-muted/30 transition-colors cursor-pointer">
                <Brain className="w-3.5 h-3.5 text-teal-600" />
                <span className="text-xs font-medium">Recommender:</span>
                <Badge className="text-[10px]" variant="outline">{results.recommender.proposals_created || 0} proposals</Badge>
                <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto" />
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Main Dashboard ---
function TriggerAuditButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string>("");

  async function trigger() {
    setRunning(true); setResult("");
    try {
      const r = await fetch(`${BASE}/api/agents/auditor/audit-tick`, { method: "POST" });
      const d = await r.json();
      const audited = d.audited || 0;
      const conflicts = d.by_verdict?.CONFLICT || 0;
      setResult(`${audited} audited${conflicts > 0 ? `, ${conflicts} CONFLICT` : ""}`);
      setTimeout(() => setResult(""), 5000);
    } catch {
      setResult("failed");
      setTimeout(() => setResult(""), 3000);
    }
    setRunning(false);
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-emerald-600">{result}</span>}
      <Button variant="outline" size="sm" onClick={trigger} disabled={running} className="gap-1.5 text-xs h-7">
        {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
        {running ? "Auditing..." : "Trigger Audit"}
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const [agentsHealth, setAgentsHealth] = useState<any>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [selectedAgent, setSelectedAgent] = useState("auditor");
  const [pendingAuditId, setPendingAuditId] = useState<string | undefined>();

  const fetchHealth = useCallback(() => {
    fetch(`${BASE}/api/agents-health`).then(r => r.json()).then(d => {
      setAgentsHealth(d.agents || {});
      setKeys(d.keys || {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchHealth();
    const t = setInterval(fetchHealth, 15000);
    return () => clearInterval(t);
  }, [fetchHealth]);

  const navigateToAudit = useCallback((auditId: string) => {
    setPendingAuditId(auditId);
    setSelectedAgent("auditor");
  }, []);

  const renderView = () => {
    switch (selectedAgent) {
      case "auditor": return <AuditorView pendingAuditId={pendingAuditId} onAuditIdConsumed={() => setPendingAuditId(undefined)} />;
      case "recommender": return <RecommenderView onNavigateToAudit={navigateToAudit} />;
      case "gateway": return <GatewayView />;
      case "investigator": return <InvestigatorView />;
      case "coordinator": return <CoordinatorView />;
      case "isolator": return <IsolatorView />;
      default: return <AuditorView />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <div className="max-w-[1440px] mx-auto w-full p-6 space-y-6">
        {/* System Header */}
        <div>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Multi-Agent Operations</h1>
            <TriggerAuditButton />
          </div>
          <p className="text-sm text-muted-foreground">Six agents collaborating on AI agent authorization</p>
          <div className="flex items-center gap-4 mt-2">
            {AGENTS.map(a => (
              <div key={a.id} className="flex items-center gap-1.5">
                <StatusDot ok={agentsHealth[a.id]?.ok} />
                <span className="text-xs">{a.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {AGENTS.map(a => (
            <AgentCard key={a.id} agent={a} health={agentsHealth[a.id]} kid={keys[a.id] || ""} selected={selectedAgent === a.id} onClick={() => setSelectedAgent(a.id)} />
          ))}
        </div>

        {/* Agent Risk Assessment */}
        <AgentRiskHeatmap />

        {/* Pipeline Simulator */}
        <PipelineSimulator onAgentSelect={setSelectedAgent} />

        {/* Main Content + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium capitalize">{selectedAgent} Output</CardTitle>
            </CardHeader>
            <CardContent>
              {renderView()}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <SigningKeysSidebar keys={keys} />
            <LivenessSummary />
          </div>
        </div>

        {/* Activity Timeline */}
        <Card>
          <CardContent className="p-4">
            <ActivityTimeline />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
