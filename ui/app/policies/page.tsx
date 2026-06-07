"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield, Plus, Loader2, RefreshCw, Trash2, CheckCircle2, Link2, FlaskConical, ArrowRight, Sparkles,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ─── Policy Binding Form ────────────────────────────────────────────

function BindingForm({ agents, resources, actions, onSuccess }: {
  agents: any[]; resources: any[]; actions: any[]; onSuccess: () => void;
}) {
  const [agentId, setAgentId] = useState("");
  const [actionId, setActionId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setError(""); setLoading(true); setSuccess(false);
    try {
      // Fetch current policy
      const pResp = await fetch(`${BASE}/api/agents/gateway/policy`);
      const policy = await pResp.json();
      const rules = policy.rules || [];

      // Check if binding already exists
      const existing = rules.find((r: any) =>
        r.type === "agent_binding" &&
        r.config?.agent_id === agentId &&
        r.config?.action_id === actionId &&
        r.config?.resource_id === resourceId
      );
      if (existing) {
        setError("This binding already exists.");
        setLoading(false);
        return;
      }

      // Add new binding rule
      const newRule = {
        id: `bind-${agentId}-${actionId}-${resourceId}`.slice(0, 64),
        type: "agent_binding",
        config: {
          agent_id: agentId,
          action_id: actionId,
          resource_id: resourceId,
        },
      };
      rules.push(newRule);

      // Update policy
      const uResp = await fetch(`${BASE}/api/agents/gateway/policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: policy.version || "1", rules, require_resource_registration: policy.require_resource_registration }),
      });
      if (uResp.ok) {
        setSuccess(true);
        setAgentId(""); setActionId(""); setResourceId("");
        onSuccess();
      } else {
        const d = await uResp.json();
        setError(typeof d.detail === "string" ? d.detail : JSON.stringify(d));
      }
    } catch { setError("Could not reach the Gateway."); }
    setLoading(false);
  }

  const canSubmit = agentId && actionId && resourceId && !loading;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">Create Policy Binding</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Link an agent to an action and a resource. This binding authorizes the agent to perform the specified action on the specified resource.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Agent <span className="text-rose-500">*</span></label>
            <select className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2"
              value={agentId} onChange={e => setAgentId(e.target.value)}>
              <option value="">Select agent</option>
              {agents.map(a => (
                <option key={a.agent_id} value={a.agent_id}>{a.agent_id}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Action <span className="text-rose-500">*</span></label>
            <select className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2"
              value={actionId} onChange={e => setActionId(e.target.value)}>
              <option value="">Select action</option>
              {actions.map(a => (
                <option key={a.action_id} value={a.action_id}>{a.action_id} ({a.risk_level})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Resource <span className="text-rose-500">*</span></label>
            <select className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2"
              value={resourceId} onChange={e => setResourceId(e.target.value)}>
              <option value="">Select resource</option>
              {resources.map(r => (
                <option key={r.resource_id} value={r.resource_id}>{r.resource_id}</option>
              ))}
            </select>
          </div>
        </div>
        {agentId && actionId && resourceId && (
          <div className="flex items-center gap-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span><strong>{agentId}</strong> can <strong>{actionId}</strong> on <strong>{resourceId}</strong></span>
          </div>
        )}
        {error && <div className="rounded-md border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 p-3"><p className="text-sm text-rose-700 dark:text-rose-400">{error}</p></div>}
        {success && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <p className="text-sm text-emerald-700 dark:text-emerald-400">Binding created successfully</p>
          </div>
        )}
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSubmit} disabled={!canSubmit}>
          {loading && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
          Create Binding
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Current Policy View ────────────────────────────────────────────

function PolicyView({ policy, onRefresh, onDeleteBinding }: {
  policy: any; onRefresh: () => void; onDeleteBinding: (ruleId: string) => void;
}) {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const rules = policy?.rules || [];
  const bindings = rules.filter((r: any) => r.type === "agent_binding");
  const otherRules = rules.filter((r: any) => r.type !== "agent_binding");

  return (
    <div className="space-y-6">
      {/* Bindings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Agent-Action-Resource Bindings</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{bindings.length} bindings</Badge>
              <Button variant="ghost" size="sm" onClick={onRefresh} className="h-7 w-7 p-0">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {bindings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No bindings yet. Use the form above to link an agent to an action and resource.</p>
          ) : (
            <div className="space-y-2">
              {bindings.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 text-sm py-2 px-3 border rounded-lg hover:bg-muted/10">
                  <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                  <Badge variant="outline" className="text-xs font-[var(--font-geist-mono)]">{r.config?.agent_id}</Badge>
                  <span className="text-muted-foreground">can</span>
                  <Badge className="text-xs bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/20">{r.config?.action_id}</Badge>
                  <span className="text-muted-foreground">on</span>
                  <Badge className="text-xs bg-blue-600/15 text-blue-700 dark:text-blue-400 border-blue-600/20">{r.config?.resource_id}</Badge>
                  <div className="flex-1" />
                  {confirmingDeleteId === r.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-rose-600">Delete this binding?</span>
                      <Button size="sm" variant="destructive" onClick={() => { onDeleteBinding(r.id); setConfirmingDeleteId(null); }}>Confirm</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmingDeleteId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600"
                      onClick={() => setConfirmingDeleteId(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other rules — human readable */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">System Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {otherRules.map((r: any) => {
            const c = r.config || {};
            let description = "";
            if (r.type === "allowlist") {
              description = `Allowed actions: ${(c.allowed_actions || []).join(", ")}`;
            } else if (r.type === "resource_scope") {
              description = `Allowed: ${(c.allowed_resources || []).join(", ")} | Denied: ${(c.denied_resources || []).join(", ")}`;
            } else if (r.type === "rate_limit") {
              description = `Max ${c.max_actions} actions per ${c.window_seconds}s window`;
            } else {
              description = JSON.stringify(c).slice(0, 80);
            }
            return (
              <div key={r.id} className="flex items-start gap-3 text-sm py-2 px-3 border rounded-lg">
                <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{r.type}</Badge>
                <span className="text-muted-foreground">{description}</span>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Policy hash: <code className="font-[var(--font-geist-mono)]">{policy?.policy_hash?.slice(0, 24)}...</code>
            {policy?.require_resource_registration && <span className="ml-2">| Resource registration required</span>}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Counterfactual Policy Simulator ─────────────────────────────────

function PolicySimulator({ currentPolicy }: { currentPolicy: any }) {
  const [rules, setRules] = useState<any[]>([]);
  const [lookback, setLookback] = useState(500);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [nlInput, setNlInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genExplanation, setGenExplanation] = useState("");

  // Seed with current policy rules on mount
  useEffect(() => {
    if (currentPolicy?.rules) {
      setRules(currentPolicy.rules.map((r: any) => ({ ...r })));
    }
  }, [currentPolicy]);

  async function generateFromNL() {
    if (!nlInput.trim()) return;
    setGenerating(true); setError(""); setGenExplanation("");
    try {
      const resp = await fetch(`${BASE}/api/agents/gateway/policy/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: nlInput }),
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        setError(typeof d.detail === "string" ? d.detail : `HTTP ${resp.status}`);
      } else {
        const data = await resp.json();
        if (data.rules?.length) {
          setRules(data.rules);
          setGenExplanation(data.explanation || "");
          setResult(null);
        } else {
          setError("Gemini returned no rules. Try a more specific description.");
        }
      }
    } catch { setError("Could not reach the Gateway."); }
    setGenerating(false);
  }

  function updateRule(idx: number, field: string, value: any) {
    setRules(prev => {
      const copy = [...prev];
      if (field === "config") {
        try { copy[idx] = { ...copy[idx], config: JSON.parse(value) }; } catch {}
      } else {
        copy[idx] = { ...copy[idx], [field]: value };
      }
      return copy;
    });
  }

  function removeRule(idx: number) {
    setRules(prev => prev.filter((_, i) => i !== idx));
  }

  function addRule() {
    setRules(prev => [...prev, { id: `rule-${Date.now()}`, type: "allowlist", config: { allowed_actions: [] } }]);
  }

  async function runSimulation() {
    setError(""); setLoading(true); setResult(null);
    try {
      const resp = await fetch(`${BASE}/api/agents/gateway/policy/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules, lookback_receipts: lookback }),
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        setError(typeof d.detail === "string" ? d.detail : `HTTP ${resp.status}`);
      } else {
        setResult(await resp.json());
      }
    } catch { setError("Could not reach the Gateway."); }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-violet-600" />
          <CardTitle className="text-base">Policy Simulator</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Test a proposed policy against historical receipts. See which decisions would change before applying.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Natural language policy generation */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-medium">Describe your policy in plain English</span>
          </div>
          <div className="flex gap-2">
            <input value={nlInput} onChange={e => setNlInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && generateFromNL()}
              placeholder="e.g., Restrict all agents to read-only on production, keep staging open, max 20 requests per minute"
              className="flex-1 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2" />
            <Button onClick={generateFromNL} disabled={generating || !nlInput.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0">
              {generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
              Generate
            </Button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {["Only allow read and query actions on staging databases",
              "Block all access to production and admin resources",
              "Allow read, query, list, get, search, analyze with 50 requests per minute limit",
              "Restrict to dev and sandbox environments only, deny production"].map(ex => (
              <button key={ex} onClick={() => setNlInput(ex)}
                className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-muted-foreground hover:text-foreground hover:border-amber-500/30 cursor-pointer transition-colors">
                {ex}
              </button>
            ))}
          </div>
          {genExplanation && (
            <div className="flex items-start gap-2 text-xs bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/20 rounded-md p-2">
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
              <span className="flex-1">{genExplanation}</span>
              <span className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground bg-white dark:bg-zinc-800 border rounded-full px-2 py-0.5">
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none"><path d="M12 2L8.5 8.5L2 12l6.5 3.5L12 22l3.5-6.5L22 12l-6.5-3.5L12 2z" fill="#4285F4"/></svg>
                Gemini 2.5 Flash
              </span>
            </div>
          )}
        </div>

        <div className="border-t pt-4" />

        {/* Editable rules */}
        <div className="space-y-2">
          {rules.filter((r: any) => r.type !== "agent_binding").map((r: any, idx: number) => (
            <div key={idx} className="flex items-start gap-2 text-sm border rounded-lg p-3">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <input className="text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border rounded px-2 py-1 w-40"
                    value={r.id} onChange={e => updateRule(idx, "id", e.target.value)} placeholder="Rule ID" />
                  <select className="text-xs bg-zinc-50 dark:bg-zinc-900 border rounded px-2 py-1"
                    value={r.type} onChange={e => updateRule(idx, "type", e.target.value)}>
                    <option value="allowlist">allowlist</option>
                    <option value="resource_scope">resource_scope</option>
                    <option value="rate_limit">rate_limit</option>
                  </select>
                </div>
                <textarea className="w-full text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border rounded px-2 py-1 h-16"
                  value={JSON.stringify(r.config, null, 2)}
                  onChange={e => updateRule(idx, "config", e.target.value)} />
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 shrink-0"
                onClick={() => removeRule(idx)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRule} className="text-xs">
            <Plus className="w-3 h-3 mr-1" /> Add Rule
          </Button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Lookback:</label>
            <input type="number" min={1} max={5000} className="text-xs bg-zinc-50 dark:bg-zinc-900 border rounded px-2 py-1 w-20"
              value={lookback} onChange={e => setLookback(Number(e.target.value))} />
            <span className="text-xs text-muted-foreground">receipts</span>
          </div>
          <Button onClick={runSimulation} disabled={loading || rules.length === 0}
            className="bg-violet-600 hover:bg-violet-700 text-white text-xs">
            {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FlaskConical className="w-3 h-3 mr-1" />}
            Run Simulation
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 p-3">
            <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 pt-2 border-t">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{result.total_replayed}</div>
                <div className="text-xs text-muted-foreground">Receipts Replayed</div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-600">{result.unchanged}</div>
                <div className="text-xs text-muted-foreground">Unchanged</div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold ${result.summary.approvals_that_become_denials > 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                  {result.summary.approvals_that_become_denials}
                </div>
                <div className="text-xs text-muted-foreground">Approve to Deny</div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold ${result.summary.denials_that_become_approvals > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {result.summary.denials_that_become_approvals}
                </div>
                <div className="text-xs text-muted-foreground">Deny to Approve</div>
              </div>
            </div>

            {/* Approval rate comparison */}
            <div className="flex items-center gap-4 text-sm bg-zinc-50 dark:bg-zinc-900 border rounded-lg p-3">
              <span className="text-muted-foreground">Approval rate:</span>
              <span className="font-mono">{result.summary.original_approval_rate}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono font-semibold">{result.summary.simulated_approval_rate}</span>
              {result.summary.affected_agents.length > 0 && (
                <>
                  <span className="text-muted-foreground ml-4">Affected agents:</span>
                  {result.summary.affected_agents.map((a: string) => (
                    <Badge key={a} variant="outline" className="text-xs font-mono">{a}</Badge>
                  ))}
                </>
              )}
            </div>

            {/* Flip table */}
            {result.would_flip.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Seq</th>
                      <th className="text-left px-3 py-2 font-medium">Agent</th>
                      <th className="text-left px-3 py-2 font-medium">Action</th>
                      <th className="text-left px-3 py-2 font-medium">Resource</th>
                      <th className="text-left px-3 py-2 font-medium">Was</th>
                      <th className="text-left px-3 py-2 font-medium">Would Be</th>
                      <th className="text-left px-3 py-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.would_flip.map((flip: any, i: number) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="px-3 py-2 font-mono">{flip.seq}</td>
                        <td className="px-3 py-2 font-mono">{flip.agent_id}</td>
                        <td className="px-3 py-2">{flip.action}</td>
                        <td className="px-3 py-2">{flip.resource}</td>
                        <td className="px-3 py-2">
                          <Badge className={flip.original_decision === "approve"
                            ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20 text-[10px]"
                            : "bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-600/20 text-[10px]"}>
                            {flip.original_decision}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={flip.simulated_decision === "approve"
                            ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20 text-[10px]"
                            : "bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-600/20 text-[10px]"}>
                            {flip.simulated_decision}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                          {(flip.new_reasons || []).join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.has_more_flips && (
                  <div className="text-xs text-muted-foreground text-center py-2 bg-zinc-50 dark:bg-zinc-900 border-t">
                    Showing first 100 of {result.flipped} flipped decisions
                  </div>
                )}
              </div>
            )}

            {result.would_flip.length === 0 && result.total_replayed > 0 && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4" />
                No decisions would change. This policy produces identical results to the current one.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


// ─── Main Page ──────────────────────────────────────────────────────

export default function PoliciesPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [aResp, rResp, actResp, pResp] = await Promise.all([
        fetch(`${BASE}/api/agents/gateway/agents`).then(r => { if (!r.ok) throw new Error(`Agents: HTTP ${r.status}`); return r.json(); }),
        fetch(`${BASE}/api/agents/gateway/resources?limit=100`).then(r => { if (!r.ok) throw new Error(`Resources: HTTP ${r.status}`); return r.json(); }),
        fetch(`${BASE}/api/agents/gateway/actions?limit=100`).then(r => { if (!r.ok) throw new Error(`Actions: HTTP ${r.status}`); return r.json(); }),
        fetch(`${BASE}/api/agents/gateway/policy`).then(r => { if (!r.ok) throw new Error(`Policy: HTTP ${r.status}`); return r.json(); }),
      ]);
      setAgents(aResp.agents || []);
      setResources(rResp.resources || []);
      setActions(actResp.actions || []);
      setPolicy(pResp);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setFetchError(message);
      console.error("Failed to fetch policy data:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDeleteBinding = async (ruleId: string) => {
    if (!policy) return;
    const rules = (policy.rules || []).filter((r: any) => r.id !== ruleId);
    try {
      await fetch(`${BASE}/api/agents/gateway/policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: policy.version || "1", rules, require_resource_registration: policy.require_resource_registration }),
      });
      fetchAll();
    } catch {}
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <div className="flex-1 max-w-[1100px] mx-auto w-full p-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Policy Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define which agents can perform which actions on which resources. Each binding creates an authorization rule evaluated by the Gateway on every request.
          </p>
        </div>

        {fetchError && (
          <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 mb-4">
            <p className="text-sm text-amber-900 dark:text-amber-300">Could not load policy data: {fetchError}</p>
            <button onClick={fetchAll} className="mt-2 text-sm underline text-amber-900 dark:text-amber-300">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 justify-center py-12 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading policy...
          </div>
        ) : (
          <>
            {/* Stats summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">{agents.length}</div>
                <div className="text-xs text-muted-foreground">Agents</div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-600">{actions.length}</div>
                <div className="text-xs text-muted-foreground">Actions</div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{resources.length}</div>
                <div className="text-xs text-muted-foreground">Resources</div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-600">{(policy?.rules || []).filter((r: any) => r.type === "agent_binding").length}</div>
                <div className="text-xs text-muted-foreground">Bindings</div>
              </div>
            </div>

            <BindingForm agents={agents} resources={resources} actions={actions} onSuccess={fetchAll} />
            <PolicySimulator currentPolicy={policy} />
            <PolicyView policy={policy} onRefresh={fetchAll} onDeleteBinding={handleDeleteBinding} />
          </>
        )}
      </div>
    </div>
  );
}
