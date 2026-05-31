"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Database, Plus, Copy, CheckCircle2, Loader2, Clock, ChevronRight,
  Shield, Trash2, RefreshCw, FileText,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

function copyText(t: string) { navigator.clipboard.writeText(t); }

function timeAgo(ts: string | number): string {
  const seconds = typeof ts === "number"
    ? Math.floor(Date.now() / 1000 - ts)
    : Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ─── Register Resource Form ─────────────────────────────────────────────────

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [resourceId, setResourceId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [owner, setOwner] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);

  const idPattern = /^[a-zA-Z0-9._\/-]{1,256}$/;
  const idValid = idPattern.test(resourceId);
  const idError = resourceId.length > 0 && !idValid ? "Letters, numbers, dots, slashes, hyphens, underscores" : "";
  const nameValid = displayName.trim().length > 0;

  async function handleSubmit() {
    setError(""); setLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/agents/gateway/resources/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_id: resourceId,
          display_name: displayName,
          ...(description && { description }),
          ...(resourceType && { resource_type: resourceType }),
          ...(owner && { owner }),
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.status === "registered") {
        setSuccess(data);
        onSuccess();
      } else {
        setError(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data.error || "Registration failed"));
      }
    } catch { setError("Could not reach the Gateway."); }
    setLoading(false);
  }

  function reset() {
    setResourceId(""); setDisplayName(""); setDescription("");
    setResourceType(""); setOwner(""); setSuccess(null); setError("");
  }

  if (success) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-medium text-emerald-700 dark:text-emerald-400">Resource registered</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Resource ID:</span>
              <code className="font-[var(--font-geist-mono)] bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{success.resource_id}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Version:</span>
              <span>{success.version}</span>
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
          <CardTitle className="text-base">Register New Resource</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Resource ID <span className="text-rose-500">*</span></label>
            <input
              className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 font-[var(--font-geist-mono)]"
              placeholder="e.g., staging-analytics-db"
              value={resourceId} onChange={e => setResourceId(e.target.value)}
            />
            {idError && <p className="text-xs text-rose-500">{idError}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Display Name <span className="text-rose-500">*</span></label>
            <input
              className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2"
              placeholder="e.g., Staging Analytics Database"
              value={displayName} onChange={e => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <input
              className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2"
              placeholder="e.g., database, api, storage"
              value={resourceType} onChange={e => setResourceType(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Owner</label>
            <input
              className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2"
              placeholder="e.g., data-team"
              value={owner} onChange={e => setOwner(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 min-h-16 resize-y"
            placeholder="What this resource is and how it's used"
            value={description} onChange={e => setDescription(e.target.value)}
          />
        </div>
        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 p-3">
            <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={!idValid || !nameValid || loading}>
            {loading && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
            Register Resource
          </Button>
          <Button variant="ghost" onClick={reset}>Reset</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Resource Detail (expandable row) ───────────────────────────────────────

function ResourceDetail({ resource, receipts }: { resource: any; receipts: any[] }) {
  const matching = receipts.filter(r => {
    const meta = r._meta || {};
    const rrid = r.body?.resource_registration_id;
    return meta.resource === resource.resource_id || rrid === resource.resource_id;
  });

  return (
    <div className="px-3 pb-3 space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {resource.description && <><span className="text-muted-foreground">Description</span><span>{resource.description}</span></>}
        {resource.resource_type && <><span className="text-muted-foreground">Type</span><span>{resource.resource_type}</span></>}
        {resource.owner && <><span className="text-muted-foreground">Owner</span><span>{resource.owner}</span></>}
        <span className="text-muted-foreground">Version</span><span>{resource.version || 1}</span>
        <span className="text-muted-foreground">Provenance</span>
        <Badge variant="outline" className="text-[10px] w-fit">{resource.provenance || "manual"}</Badge>
        <span className="text-muted-foreground">Registered</span><span>{resource.registered_at ? new Date(resource.registered_at).toISOString().slice(0, 19) : "—"}</span>
      </div>
      {matching.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Recent receipts referencing this resource</p>
          <div className="space-y-0.5">
            {matching.slice(0, 8).map((r: any, i: number) => {
              const b = r.body || {};
              const m = r._meta || {};
              return (
                <div key={i} className="flex items-center gap-2 text-[11px] py-1 px-2 rounded hover:bg-muted/30">
                  <Badge variant="outline" className="text-[10px]">#{b.seq}</Badge>
                  <span className="text-muted-foreground w-14">{String(b.ts || "").slice(11, 19)}</span>
                  <span className="truncate flex-1">{m.agent_id || "?"}: {m.action || "?"}</span>
                  <Badge className={b.decision === "approve"
                    ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20 text-[10px]"
                    : "text-[10px]"} variant={b.decision === "deny" ? "destructive" : "default"}>{b.decision}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {matching.length === 0 && (
        <p className="text-xs text-muted-foreground">No receipts reference this resource yet.</p>
      )}
    </div>
  );
}

// ─── Resources List ─────────────────────────────────────────────────────────

function ResourcesList({ resources, loading, receipts, onRevoke }: {
  resources: any[]; loading: boolean; receipts: any[]; onRevoke: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  // Compute receipt counts per resource
  const receiptCounts: Record<string, number> = {};
  for (const r of receipts) {
    const res = r._meta?.resource || r.body?.resource_registration_id;
    if (res) receiptCounts[res] = (receiptCounts[res] || 0) + 1;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 justify-center py-8 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading resources...
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No resources registered yet. Use the form above to register your first resource.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {resources.map((res: any) => {
        const count = receiptCounts[res.resource_id] || 0;
        const isOpen = expanded === res.resource_id;
        return (
          <div key={res.resource_id} className={`border rounded-lg ${isOpen ? "border-primary/30 bg-muted/20" : "border-border hover:bg-muted/10"}`}>
            <button
              onClick={() => setExpanded(isOpen ? null : res.resource_id)}
              className="w-full flex items-center gap-3 text-xs py-2.5 px-3 text-left cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <code className="font-[var(--font-geist-mono)] font-medium truncate w-48">{res.resource_id}</code>
              <span className="text-muted-foreground truncate flex-1">{res.display_name}</span>
              {res.resource_type && <Badge variant="outline" className="text-[10px] shrink-0">{res.resource_type}</Badge>}
              {count > 0 ? (
                <Badge className={`text-[10px] shrink-0 ${
                  count >= 50 ? "bg-indigo-600/20 text-indigo-700 dark:text-indigo-400 border-indigo-600/20"
                  : count >= 10 ? "bg-blue-600/15 text-blue-700 dark:text-blue-400 border-blue-600/20"
                  : "bg-zinc-600/10 text-zinc-600 dark:text-zinc-400 border-zinc-600/20"
                }`}>
                  <FileText className="w-2.5 h-2.5 mr-0.5" />{count}
                </Badge>
              ) : (
                <span className="text-[10px] text-muted-foreground shrink-0">—</span>
              )}
              <span className="text-[10px] text-muted-foreground shrink-0 w-14">{res.registered_at ? timeAgo(res.registered_at) : ""}</span>
              <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`} />
            </button>
            {isOpen && (
              <div>
                <ResourceDetail resource={res} receipts={receipts} />
                <div className="px-3 pb-3">
                  {confirmRevoke === res.resource_id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-rose-600">Revoke this resource?</span>
                      <Button size="sm" variant="destructive" onClick={() => { onRevoke(res.resource_id); setConfirmRevoke(null); }}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setConfirmRevoke(res.resource_id)}>
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

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const [resources, setResources] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/agents/gateway/resources?limit=100&include_revoked=false`);
      const data = await resp.json();
      setResources(data.resources || []);
    } catch {}
    setLoading(false);
  }, []);

  const fetchReceipts = useCallback(async () => {
    try {
      const resp = await fetch(`${BASE}/api/chain`);
      const data = await resp.json();
      setReceipts(data.receipts || []);
    } catch {}
  }, []);

  useEffect(() => { fetchResources(); fetchReceipts(); }, [fetchResources, fetchReceipts]);

  const handleRevoke = async (resourceId: string) => {
    try {
      await fetch(`${BASE}/api/agents/gateway/resources/${encodeURIComponent(resourceId)}`, { method: "DELETE" });
      fetchResources();
    } catch {}
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <div className="flex-1 max-w-[1100px] mx-auto w-full p-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Registered Resources</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the resource registry. Registered resources appear in authorization receipts, creating a verifiable trace from policy decisions to specific protected assets.
          </p>
        </div>
        <RegisterForm onSuccess={fetchResources} />
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">All Registered Resources</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{resources.length} resources</Badge>
                <Button variant="ghost" size="sm" onClick={() => { fetchResources(); fetchReceipts(); }} className="h-7 w-7 p-0">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResourcesList resources={resources} loading={loading} receipts={receipts} onRevoke={handleRevoke} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
