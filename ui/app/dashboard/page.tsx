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
  AlertTriangle, Clock, Activity,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

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
  { id: "recommender", name: "Recommender", icon: Brain, type: "AI · Gemini 2.5 Pro", role: "Policy change proposals", badgeColor: "bg-teal-600/15 text-teal-700 dark:text-teal-400 border-teal-600/20" },
  { id: "investigator", name: "Investigator", icon: AlertTriangle, type: "AI · Gemini 2.5 Pro", role: "Incident synthesis", badgeColor: "bg-teal-600/15 text-teal-700 dark:text-teal-400 border-teal-600/20" },
  { id: "coordinator", name: "Coordinator", icon: Compass, type: "Deterministic + AI", role: "A2A agent directory", badgeColor: "bg-indigo-600/15 text-indigo-700 dark:text-indigo-400 border-indigo-600/20" },
  { id: "isolator", name: "Isolator", icon: ShieldOff, type: "AI · Gemini 2.5 Pro", role: "Rogue agent quarantine", badgeColor: "bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-600/20" },
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
  useEffect(() => { fetch(`${BASE}/api/chain`).then(r => r.json()).then(setChain).catch(() => {}); }, []);
  const receipts = (chain?.receipts || []).slice().reverse().slice(0, 25);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Recent Receipts</h3>
      {receipts.length === 0 && <p className="text-sm text-muted-foreground">No receipts yet. Try the Compliant Agent tab to generate some.</p>}
      <div className="space-y-1">
        {receipts.map((r: any, i: number) => {
          const b = r.body || {}; const m = r._meta || {};
          return (
            <div key={i} className="flex items-center gap-3 text-xs py-1.5 px-2 rounded hover:bg-muted/30">
              <Badge variant="outline" className="text-[10px]">#{b.seq}</Badge>
              <span className="text-muted-foreground w-20 truncate">{String(b.ts || "").slice(11, 19)}</span>
              <span className="truncate flex-1">{m.agent_id || "?"}: {m.action || "?"} on {m.resource || "?"}</span>
              <Badge className={b.decision === "approve" ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20 text-[10px]" : "text-[10px]"} variant={b.decision === "deny" ? "destructive" : "default"}>{b.decision}</Badge>
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
  useEffect(() => { fetch(`${BASE}/api/agents/auditor/audit-reports?tenant=hackathon-demo&limit=200`).then(r => r.json()).then(d => setReports(d.reports || [])).catch(() => {}); }, []);

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
                    <div key={j} className="bg-muted/30 rounded p-2 text-xs">
                      <span className="font-medium">Source: {c.source}</span>{c.page ? `, page ${c.page}` : ""}
                      <p className="text-muted-foreground mt-1 italic">"{c.passage?.slice(0, 200)}..."</p>
                    </div>
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
                {(diff.current || diff.proposed) && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Policy Diff</p>
                    <div className="grid grid-cols-2 gap-2">
                      <pre className="font-[var(--font-geist-mono)] text-[10px] bg-zinc-50 dark:bg-zinc-900 border-l-2 border-rose-400 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all text-zinc-700 dark:text-zinc-300">{typeof diff.current === "string" ? diff.current : JSON.stringify(diff.current, null, 2)}</pre>
                      <pre className="font-[var(--font-geist-mono)] text-[10px] bg-zinc-50 dark:bg-zinc-900 border-l-2 border-emerald-400 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all text-zinc-700 dark:text-zinc-300">{typeof diff.proposed === "string" ? diff.proposed : JSON.stringify(diff.proposed, null, 2)}</pre>
                    </div>
                  </div>
                )}
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
                      <div key={j} className="bg-muted/30 rounded p-2 text-xs mb-1">
                        <span className="font-medium">Source: {c.source}</span>{c.page ? `, page ${c.page}` : ""}
                        <p className="text-muted-foreground mt-1 italic">"{c.passage?.slice(0, 200)}..."</p>
                        <span className="text-[10px] text-muted-foreground">Audit: {c.audit_report_id && onNavigateToAudit ? (
                          <button onClick={() => onNavigateToAudit(c.audit_report_id)} className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded font-[var(--font-geist-mono)] hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-foreground cursor-pointer transition-colors">{c.audit_report_id.slice(0, 12)}</button>
                        ) : (
                          <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">{c.audit_report_id?.slice(0, 12)}</code>
                        )}</span>
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
                    <div className="flex flex-wrap gap-1">
                      {evidence.audit_report_ids?.map((id: string, j: number) => (
                        <code key={`a${j}`} className="text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{id.slice(0, 12)}</code>
                      ))}
                      {evidence.receipt_seqs?.map((seq: number, j: number) => (
                        <code key={`r${j}`} className="text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded">seq:{seq}</code>
                      ))}
                    </div>
                  </div>
                )}
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
  useEffect(() => { fetch(`${BASE}/api/agents/isolator/isolation-records?tenant=hackathon-demo&limit=25`).then(r => r.json()).then(d => setRecords(d.isolation_records || [])).catch(() => {}); }, []);
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
                        <span className="text-muted-foreground flex-1">{a.rationale?.slice(0, 100)}</span>
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

// --- Main Dashboard ---
export default function DashboardPage() {
  const [agentsHealth, setAgentsHealth] = useState<any>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [selectedAgent, setSelectedAgent] = useState("auditor");
  const [pendingAuditId, setPendingAuditId] = useState<string | undefined>();
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("demoMode");
    if (stored === "true") setDemoMode(true);
  }, []);

  const fetchHealth = useCallback(() => {
    fetch(`${BASE}/api/agents-health`).then(r => r.json()).then(d => {
      setAgentsHealth(d.agents || {});
      setKeys(d.keys || {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = demoMode ? 10000 : 30000;
    const t = setInterval(fetchHealth, interval);
    return () => clearInterval(t);
  }, [fetchHealth, demoMode]);

  const toggleDemo = () => {
    const next = !demoMode;
    setDemoMode(next);
    localStorage.setItem("demoMode", String(next));
  };

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
            <button onClick={toggleDemo} className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${demoMode ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20" : "text-muted-foreground border-zinc-200 dark:border-zinc-700"}`}>
              Demo Mode: {demoMode ? "ON" : "OFF"}
            </button>
          </div>
          <p className="text-sm text-muted-foreground">Five agents collaborating on AI agent authorization</p>
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
