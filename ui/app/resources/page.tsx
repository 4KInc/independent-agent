"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Database, Plus, Copy, CheckCircle2, Loader2, Clock, ChevronRight,
  Shield, Trash2, RefreshCw, FileText, AlertTriangle, Info,
  Globe, HardDrive, MessageSquare, Zap, ExternalLink,
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

// ─── Resource type icons ────────────────────────────────────────────────────

const RESOURCE_TYPE_ICONS: Record<string, typeof Database> = {
  db: Database,
  api: Globe,
  storage: HardDrive,
  queue: MessageSquare,
  function: Zap,
};

function ResourceTypeIcon({ type }: { type: string }) {
  const Icon = RESOURCE_TYPE_ICONS[type] || Database;
  return <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
}

// ─── Verification badge ────────────────────────────────────────────────────

const VERIFICATION_STYLES: Record<string, { color: string; label: string; Icon: typeof CheckCircle2 }> = {
  verified:      { color: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20", label: "Verified", Icon: CheckCircle2 },
  metadata_only: { color: "bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/20", label: "Metadata Only", Icon: Info },
  failed:        { color: "bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-600/20", label: "Failed", Icon: AlertTriangle },
  skipped:       { color: "bg-zinc-600/10 text-zinc-600 dark:text-zinc-400 border-zinc-600/20", label: "Skipped", Icon: Info },
};

function VerificationBadge({ status, reason }: { status: string; reason?: string }) {
  const s = VERIFICATION_STYLES[status] || VERIFICATION_STYLES.skipped;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${s.color}`} title={reason || ""}>
      <s.Icon className="w-2.5 h-2.5" />
      {s.label}
    </span>
  );
}

// ─── Register Resource Form ─────────────────────────────────────────────────

const INPUT_CLS = "w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2";
const MONO_INPUT_CLS = `${INPUT_CLS} font-[var(--font-geist-mono)] text-xs`;

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [owner, setOwner] = useState("");
  const [reachabilityUrl, setReachabilityUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);

  // Type-specific metadata fields
  const [engine, setEngine] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [provider, setProvider] = useState("");
  const [projectId, setProjectId] = useState("");
  const [instance, setInstance] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState("");
  const [bucket, setBucket] = useState("");
  const [prefix, setPrefix] = useState("");
  const [contentClassification, setContentClassification] = useState("");
  const [topic, setTopic] = useState("");
  const [functionName, setFunctionName] = useState("");
  const [region, setRegion] = useState("");

  // Auto-generate resource_id from display name
  const resourceId = displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 256);
  const nameValid = displayName.trim().length > 0;
  const idValid = resourceId.length > 0;

  function buildMetadata(): Record<string, string> | undefined {
    const m: Record<string, string> = {};
    if (resourceType === "db") {
      if (engine) m.engine = engine;
      if (connectionString) m.connection_string = connectionString;
      if (provider) m.provider = provider;
      if (projectId) m.project_id = projectId;
      if (instance) m.instance = instance;
    } else if (resourceType === "api") {
      if (baseUrl) m.base_url = baseUrl;
      if (authType) m.auth_type = authType;
    } else if (resourceType === "storage") {
      if (bucket) m.bucket = bucket;
      if (provider) m.provider = provider;
      if (prefix) m.prefix = prefix;
      if (projectId) m.project_id = projectId;
      if (contentClassification) m.content_classification = contentClassification;
    } else if (resourceType === "queue") {
      if (topic) m.topic = topic;
      if (provider) m.provider = provider;
      if (projectId) m.project_id = projectId;
    } else if (resourceType === "function") {
      if (functionName) m.function_name = functionName;
      if (provider) m.provider = provider;
      if (projectId) m.project_id = projectId;
      if (region) m.region = region;
    }
    return Object.keys(m).length > 0 ? m : undefined;
  }

  async function handleSubmit() {
    setError(""); setLoading(true);
    try {
      const metadata = buildMetadata();
      const resp = await fetch(`${BASE}/api/agents/gateway/resources/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_id: resourceId,
          display_name: displayName,
          ...(description && { description }),
          ...(resourceType && { resource_type: resourceType }),
          ...(owner && { owner }),
          ...(reachabilityUrl && { reachability_url: reachabilityUrl }),
          ...(metadata && { metadata }),
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
    setDisplayName(""); setDescription(""); setResourceType(""); setOwner("");
    setReachabilityUrl(""); setSuccess(null); setError("");
    setEngine(""); setConnectionString(""); setProvider(""); setProjectId("");
    setInstance(""); setBaseUrl(""); setAuthType(""); setBucket(""); setPrefix("");
    setContentClassification(""); setTopic(""); setFunctionName(""); setRegion("");
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
            {success.resource_type && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-24">Type:</span>
                <span>{success.resource_type}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Verification:</span>
              <VerificationBadge status={success.verification || "skipped"} reason={success.verification_reason} />
            </div>
          </div>
          {success.verification === "metadata_only" && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Resource metadata was recorded but no live probe was performed. Provide a reachability_url or GCP-native metadata for live verification.
            </p>
          )}
          {success.verification === "failed" && (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              Live verification failed: {success.verification_reason}. The resource is registered but its existence could not be confirmed.
            </p>
          )}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Resource Name <span className="text-rose-500">*</span></label>
            <input
              className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2"
              placeholder="e.g., Staging Analytics Database"
              value={displayName} onChange={e => setDisplayName(e.target.value)}
            />
            {resourceId && (
              <p className="text-xs text-muted-foreground">ID: <code className="font-[var(--font-geist-mono)] bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[10px]">{resourceId}</code></p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type <span className="text-rose-500">*</span></label>
            <select
              className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2"
              value={resourceType} onChange={e => setResourceType(e.target.value)}
            >
              <option value="">Select a type</option>
              <option value="db">Database</option>
              <option value="api">API Endpoint</option>
              <option value="storage">File Storage / Object Store</option>
              <option value="queue">Message Queue / Event Stream</option>
              <option value="function">Function / Compute</option>
            </select>
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

        {/* Type-specific metadata fields */}
        {resourceType === "db" && (
          <div className="space-y-3 rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Database Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Engine</label>
                <select className={INPUT_CLS} value={engine} onChange={e => setEngine(e.target.value)}>
                  <option value="">Select engine</option>
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="firestore">Firestore</option>
                  <option value="bigquery">BigQuery</option>
                  <option value="cloudsql">Cloud SQL</option>
                  <option value="alloydb">AlloyDB</option>
                  <option value="mongodb">MongoDB</option>
                  <option value="redis">Redis</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Provider</label>
                <select className={INPUT_CLS} value={provider} onChange={e => setProvider(e.target.value)}>
                  <option value="">Select provider</option>
                  <option value="firestore">GCP Firestore (live verification)</option>
                  <option value="cloudsql">GCP Cloud SQL (live verification)</option>
                  <option value="self-hosted">Self-hosted</option>
                  <option value="aws_rds">AWS RDS</option>
                  <option value="azure_sql">Azure SQL</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Connection String</label>
                <input className={MONO_INPUT_CLS} type="password" placeholder="postgresql://user:pass@host:5432/dbname" value={connectionString} onChange={e => setConnectionString(e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Recorded as metadata. Not used for live connections.</p>
              </div>
              {(provider === "firestore" || provider === "cloudsql") && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">GCP Project ID</label>
                  <input className={MONO_INPUT_CLS} placeholder="my-project-id" value={projectId} onChange={e => setProjectId(e.target.value)} />
                  <p className="text-[10px] text-emerald-600">Enables live verification via GCP API</p>
                </div>
              )}
              {provider === "cloudsql" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Instance Name</label>
                  <input className={MONO_INPUT_CLS} placeholder="my-instance" value={instance} onChange={e => setInstance(e.target.value)} />
                </div>
              )}
            </div>
          </div>
        )}

        {resourceType === "api" && (
          <div className="space-y-3 rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">API Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Base URL</label>
                <input className={MONO_INPUT_CLS} placeholder="https://api.example.com/v1" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Auth Type</label>
                <select className={INPUT_CLS} value={authType} onChange={e => setAuthType(e.target.value)}>
                  <option value="">Select auth type</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="api_key">API Key</option>
                  <option value="oauth2">OAuth 2.0</option>
                  <option value="iam">GCP IAM</option>
                  <option value="none">None (public)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {resourceType === "storage" && (
          <div className="space-y-3 rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Storage Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Provider</label>
                <select className={INPUT_CLS} value={provider} onChange={e => setProvider(e.target.value)}>
                  <option value="">Select provider</option>
                  <option value="gcs">Google Cloud Storage (live verification)</option>
                  <option value="s3">AWS S3</option>
                  <option value="azure_blob">Azure Blob Storage</option>
                  <option value="sharepoint">SharePoint</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Bucket / Container</label>
                <input className={MONO_INPUT_CLS} placeholder="my-bucket-name" value={bucket} onChange={e => setBucket(e.target.value)} />
                {provider === "gcs" && bucket && <p className="text-[10px] text-emerald-600">GCS bucket will be verified via Google APIs</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Path Prefix</label>
                <input className={MONO_INPUT_CLS} placeholder="data/customer/" value={prefix} onChange={e => setPrefix(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Content Classification</label>
                <select className={INPUT_CLS} value={contentClassification} onChange={e => setContentClassification(e.target.value)}>
                  <option value="">Select classification</option>
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="confidential">Confidential</option>
                  <option value="pii">PII (Personally Identifiable Information)</option>
                  <option value="phi">PHI (Protected Health Information)</option>
                  <option value="regulated">Regulated (SOX/SEC/HIPAA)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {resourceType === "queue" && (
          <div className="space-y-3 rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Queue / Event Stream Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Provider</label>
                <select className={INPUT_CLS} value={provider} onChange={e => setProvider(e.target.value)}>
                  <option value="">Select provider</option>
                  <option value="pubsub">Google Pub/Sub (live verification)</option>
                  <option value="kafka">Apache Kafka</option>
                  <option value="sqs">AWS SQS</option>
                  <option value="rabbitmq">RabbitMQ</option>
                  <option value="eventbridge">AWS EventBridge</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Topic / Queue Name</label>
                <input className={MONO_INPUT_CLS} placeholder="my-topic-name" value={topic} onChange={e => setTopic(e.target.value)} />
              </div>
              {provider === "pubsub" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">GCP Project ID</label>
                  <input className={MONO_INPUT_CLS} placeholder="my-project-id" value={projectId} onChange={e => setProjectId(e.target.value)} />
                  {topic && projectId && <p className="text-[10px] text-emerald-600">Pub/Sub topic will be verified via Google APIs</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {resourceType === "function" && (
          <div className="space-y-3 rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Function / Compute Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Provider</label>
                <select className={INPUT_CLS} value={provider} onChange={e => setProvider(e.target.value)}>
                  <option value="">Select provider</option>
                  <option value="cloud_functions">GCP Cloud Functions (live verification)</option>
                  <option value="cloud_run_jobs">GCP Cloud Run Jobs (live verification)</option>
                  <option value="lambda">AWS Lambda</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Function / Job Name</label>
                <input className={MONO_INPUT_CLS} placeholder="process-invoice" value={functionName} onChange={e => setFunctionName(e.target.value)} />
              </div>
              {(provider === "cloud_functions" || provider === "cloud_run_jobs") && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">GCP Project ID</label>
                    <input className={MONO_INPUT_CLS} placeholder="my-project-id" value={projectId} onChange={e => setProjectId(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Region</label>
                    <input className={MONO_INPUT_CLS} placeholder="us-central1" value={region} onChange={e => setRegion(e.target.value)} />
                    {functionName && projectId && region && <p className="text-[10px] text-emerald-600">Function will be verified via GCP API</p>}
                  </div>
                </>
              )}
              {provider === "lambda" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">AWS Region</label>
                  <input className={MONO_INPUT_CLS} placeholder="us-east-1" value={region} onChange={e => setRegion(e.target.value)} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reachability URL -shown for all types */}
        {resourceType && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reachability URL <span className="text-xs text-muted-foreground">(optional)</span></label>
            <input className={MONO_INPUT_CLS} type="url" placeholder="https://my-resource.example.com/health" value={reachabilityUrl} onChange={e => setReachabilityUrl(e.target.value)} />
            <p className="text-[10px] text-muted-foreground">If provided, the Gateway probes this URL to confirm the resource is reachable. Overrides metadata-based verification.</p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 p-3">
            <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
          </div>
        )}
        <div className="flex gap-2">
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSubmit} disabled={!idValid || !nameValid || !resourceType || loading}>
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

function getGcpConsoleUrl(resource: any): { url: string; label: string } | null {
  const meta = resource.metadata || {};
  const project = meta.project_id || "quick-catcher-470218-b0";
  const type = resource.resource_type;

  if (type === "db" && (meta.provider === "firestore" || meta.engine === "firestore")) {
    return { url: `https://console.cloud.google.com/firestore/databases?project=${project}`, label: "View in Firestore Console" };
  }
  if (type === "storage" && meta.provider === "gcs" && meta.bucket) {
    return { url: `https://console.cloud.google.com/storage/browser/${meta.bucket}?project=${project}`, label: "View in Cloud Storage" };
  }
  if (type === "queue" && meta.provider === "pubsub" && meta.topic) {
    return { url: `https://console.cloud.google.com/cloudpubsub/topic/detail/${meta.topic}?project=${project}`, label: "View in Pub/Sub Console" };
  }
  if (type === "api" && resource.reachability_url) {
    return { url: resource.reachability_url, label: "Open API endpoint" };
  }
  if (type === "function" && meta.provider === "cloud_functions" && meta.function_name) {
    return { url: `https://console.cloud.google.com/functions/details/${meta.region || "us-central1"}/${meta.function_name}?project=${project}`, label: "View in Cloud Functions" };
  }
  return null;
}

function ResourceDetail({ resource, receipts }: { resource: any; receipts: any[] }) {
  const matching = receipts.filter(r => {
    const meta = r._meta || {};
    const rrid = r.body?.resource_registration_id;
    return meta.resource === resource.resource_id || rrid === resource.resource_id;
  });

  const gcpLink = getGcpConsoleUrl(resource);

  return (
    <div className="px-3 pb-3 space-y-3">
      {gcpLink && (
        <a
          href={gcpLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          {gcpLink.label}
        </a>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {resource.description && <><span className="text-muted-foreground">Description</span><span>{resource.description}</span></>}
        {resource.resource_type && <><span className="text-muted-foreground">Type</span><span>{resource.resource_type}</span></>}
        {resource.owner && <><span className="text-muted-foreground">Owner</span><span>{resource.owner}</span></>}
        <span className="text-muted-foreground">Version</span><span>{resource.version || 1}</span>
        <span className="text-muted-foreground">Verification</span>
        <VerificationBadge status={resource.verification || resource.verification_status || "skipped"} reason={resource.verification_reason} />
        <span className="text-muted-foreground">Registered</span><span>{resource.registered_at ? new Date(resource.registered_at).toISOString().slice(0, 19) : "-"}</span>
        {resource.metadata && Object.keys(resource.metadata).length > 0 && (
          <>
            <span className="text-muted-foreground">Metadata</span>
            <code className="font-[var(--font-geist-mono)] text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded break-all">
              {Object.entries(resource.metadata).map(([k, v]) => `${k}: ${v}`).join(", ")}
            </code>
          </>
        )}
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
              <ResourceTypeIcon type={res.resource_type || "db"} />
              <code className="font-[var(--font-geist-mono)] font-medium truncate w-48">{res.resource_id}</code>
              <span className="text-muted-foreground truncate flex-1">{res.display_name}</span>
              {res.resource_type && <Badge className="text-[10px] shrink-0 bg-blue-600/15 text-blue-700 dark:text-blue-400 border-blue-600/20">{res.resource_type}</Badge>}
              {count > 0 ? (
                <Badge className={`text-[10px] shrink-0 ${
                  count >= 50 ? "bg-indigo-600/20 text-indigo-700 dark:text-indigo-400 border-indigo-600/20"
                  : count >= 10 ? "bg-blue-600/15 text-blue-700 dark:text-blue-400 border-blue-600/20"
                  : "bg-zinc-600/10 text-zinc-600 dark:text-zinc-400 border-zinc-600/20"
                }`}>
                  <FileText className="w-2.5 h-2.5 mr-0.5" />{count}
                </Badge>
              ) : (
                <span className="text-[10px] text-muted-foreground shrink-0">-</span>
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
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const resp = await fetch(`${BASE}/api/agents/gateway/resources?limit=100&include_revoked=false`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      const data = await resp.json();
      setResources(data.resources || []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setFetchError(message);
      console.error("Failed to fetch resources:", e);
    }
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
            {fetchError && (
              <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 mb-4">
                <p className="text-sm text-amber-900 dark:text-amber-300">Could not load resources: {fetchError}</p>
                <button onClick={() => { fetchResources(); fetchReceipts(); }} className="mt-2 text-sm underline text-amber-900 dark:text-amber-300">Retry</button>
              </div>
            )}
            <ResourcesList resources={resources} loading={loading} receipts={receipts} onRevoke={handleRevoke} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
