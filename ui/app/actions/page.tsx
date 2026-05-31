"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Zap, Plus, CheckCircle2, Loader2, Clock, ChevronRight,
  Shield, Trash2, RefreshCw, AlertTriangle,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

function timeAgo(ts: string | number): string {
  const seconds = typeof ts === "number"
    ? Math.floor(Date.now() / 1000 - ts)
    : Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const RISK_STYLES: Record<string, string> = {
  low: "bg-zinc-600/10 text-zinc-600 dark:text-zinc-400 border-zinc-600/20",
  medium: "bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/20",
  high: "bg-orange-600/15 text-orange-700 dark:text-orange-400 border-orange-600/20",
  critical: "bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-600/20",
};

// ─── Register Form ──────────────────────────────────────────────────

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [actionId, setActionId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [humanApproval, setHumanApproval] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);

  const idPattern = /^[a-zA-Z0-9._\/-]{1,256}$/;
  const idValid = idPattern.test(actionId);
  const nameValid = displayName.trim().length > 0;

  async function handleSubmit() {
    setError(""); setLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/agents/gateway/actions/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_id: actionId, display_name: displayName,
          description, risk_level: riskLevel,
          requires_human_approval: humanApproval,
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.status === "registered") {
        setSuccess(data); onSuccess();
      } else {
        setError(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data.error || "Failed"));
      }
    } catch { setError("Could not reach the Gateway."); }
    setLoading(false);
  }

  function reset() {
    setActionId(""); setDisplayName(""); setDescription("");
    setRiskLevel(""); setHumanApproval(false); setSuccess(null); setError("");
  }

  if (success) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-medium text-emerald-700 dark:text-emerald-400">Action registered</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Action ID:</span>
              <code className="font-[var(--font-geist-mono)] bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{success.action_id}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Risk Level:</span>
              <Badge className={`text-[10px] ${RISK_STYLES[success.risk_level] || ""}`}>{success.risk_level}</Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>Register another</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">Register New Action</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Action ID <span className="text-rose-500">*</span></label>
            <input className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 font-[var(--font-geist-mono)]"
              placeholder="e.g., read, delete, execute"
              value={actionId} onChange={e => setActionId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Display Name <span className="text-rose-500">*</span></label>
            <input className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2"
              placeholder="e.g., Read, Delete All"
              value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Risk Level <span className="text-rose-500">*</span></label>
            <select className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2"
              value={riskLevel} onChange={e => setRiskLevel(e.target.value)}>
              <option value="">Select risk level</option>
              <option value="low">Low - read-only, non-destructive</option>
              <option value="medium">Medium - modifications, recoverable</option>
              <option value="high">High - destructive or external effects</option>
              <option value="critical">Critical - administrative or irreversible</option>
            </select>
          </div>
          <div className="space-y-1.5 flex items-end">
            <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
              <input type="checkbox" checked={humanApproval} onChange={e => setHumanApproval(e.target.checked)}
                className="rounded border-zinc-300" />
              Requires human approval
            </label>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <textarea className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 min-h-16 resize-y"
            placeholder="What this action does and its risk implications"
            value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        {error && <div className="rounded-md border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 p-3"><p className="text-sm text-rose-700 dark:text-rose-400">{error}</p></div>}
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={!idValid || !nameValid || !riskLevel || loading}>
            {loading && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
            Register Action
          </Button>
          <Button variant="ghost" onClick={reset}>Reset</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Actions List ───────────────────────────────────────────────────

function ActionsList({ actions, loading, onRevoke }: { actions: any[]; loading: boolean; onRevoke: (id: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  if (loading) return <div className="flex items-center gap-2 justify-center py-8 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading actions...</div>;
  if (actions.length === 0) return <div className="text-center py-8 text-muted-foreground text-sm">No actions registered yet.</div>;

  return (
    <div className="space-y-1">
      {actions.map((a: any) => {
        const isOpen = expanded === a.action_id;
        return (
          <div key={a.action_id} className={`border rounded-lg ${isOpen ? "border-primary/30 bg-muted/20" : "border-border hover:bg-muted/10"}`}>
            <button onClick={() => setExpanded(isOpen ? null : a.action_id)}
              className="w-full flex items-center gap-3 text-xs py-2.5 px-3 text-left cursor-pointer">
              <Zap className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <code className="font-[var(--font-geist-mono)] font-medium w-28 shrink-0">{a.action_id}</code>
              <span className="text-muted-foreground truncate flex-1">{a.display_name}</span>
              <Badge className={`text-[10px] shrink-0 ${RISK_STYLES[a.risk_level] || ""}`}>{a.risk_level}</Badge>
              {a.requires_human_approval && (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  <Shield className="w-2.5 h-2.5 mr-0.5" />approval
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground shrink-0 w-14">{a.registered_at ? timeAgo(a.registered_at) : ""}</span>
              <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`} />
            </button>
            {isOpen && (
              <div className="px-3 pb-3 space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {a.description && <><span className="text-muted-foreground">Description</span><span>{a.description}</span></>}
                  <span className="text-muted-foreground">Risk Level</span><Badge className={`text-[10px] w-fit ${RISK_STYLES[a.risk_level] || ""}`}>{a.risk_level}</Badge>
                  <span className="text-muted-foreground">Human Approval</span><span>{a.requires_human_approval ? "Required" : "Not required"}</span>
                  <span className="text-muted-foreground">Version</span><span>{a.version || 1}</span>
                  <span className="text-muted-foreground">Registered</span><span>{a.registered_at ? new Date(a.registered_at).toISOString().slice(0, 19) : "-"}</span>
                </div>
                <div>
                  {confirmRevoke === a.action_id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-rose-600">Revoke this action?</span>
                      <Button size="sm" variant="destructive" onClick={() => { onRevoke(a.action_id); setConfirmRevoke(null); }}>Confirm</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setConfirmRevoke(a.action_id)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Revoke
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function ActionsPage() {
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActions = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/agents/gateway/actions?limit=100&include_revoked=false`);
      const data = await resp.json();
      setActions(data.actions || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchActions(); }, [fetchActions]);

  const handleRevoke = async (actionId: string) => {
    try {
      await fetch(`${BASE}/api/agents/gateway/actions/${encodeURIComponent(actionId)}`, { method: "DELETE" });
      fetchActions();
    } catch {}
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <div className="flex-1 max-w-[1100px] mx-auto w-full p-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Registered Actions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the action registry. Each action has a risk level and optional human-approval requirement. Registered actions appear in authorization receipts with their risk classification.
          </p>
        </div>
        <RegisterForm onSuccess={fetchActions} />
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">All Registered Actions</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{actions.length} actions</Badge>
                <Button variant="ghost" size="sm" onClick={fetchActions} className="h-7 w-7 p-0">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ActionsList actions={actions} loading={loading} onRevoke={handleRevoke} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
