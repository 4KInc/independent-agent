"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield, Plus, Loader2, RefreshCw, Trash2, CheckCircle2, Link2,
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
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600"
                    onClick={() => onDeleteBinding(r.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
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

// ─── Main Page ──────────────────────────────────────────────────────

export default function PoliciesPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [aResp, rResp, actResp, pResp] = await Promise.all([
        fetch(`${BASE}/api/agents/gateway/agents`).then(r => r.json()),
        fetch(`${BASE}/api/agents/gateway/resources?limit=100`).then(r => r.json()),
        fetch(`${BASE}/api/agents/gateway/actions?limit=100`).then(r => r.json()),
        fetch(`${BASE}/api/agents/gateway/policy`).then(r => r.json()),
      ]);
      setAgents(aResp.agents || []);
      setResources(rResp.resources || []);
      setActions(actResp.actions || []);
      setPolicy(pResp);
    } catch {}
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
            <PolicyView policy={policy} onRefresh={fetchAll} onDeleteBinding={handleDeleteBinding} />
          </>
        )}
      </div>
    </div>
  );
}
