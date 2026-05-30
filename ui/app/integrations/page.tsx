"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Shield, ExternalLink, RefreshCw, Copy, ChevronRight, Loader2,
  Server, Network, Database, Lock, KeyRound, CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

function copyText(t: string) { navigator.clipboard.writeText(t); }

function JsonView({ data }: { data: unknown }) {
  return (
    <pre className="font-[var(--font-geist-mono)] text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap break-all text-zinc-700 dark:text-zinc-300">
      {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}

// --- MCP Tool Card ---
function ToolCard({ tool }: { tool: any }) {
  const [tryOpen, setTryOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const isAuthorize = tool.name === "authorize_action";
  const schema = tool.inputSchema || {};
  const properties = schema.properties || {};
  const required = new Set(schema.required || []);

  const handleCall = async () => {
    setLoading(true);
    setResult(null);
    const args: Record<string, any> = {};
    for (const [k, v] of Object.entries(formData)) {
      if (v) args[k] = v;
    }
    try {
      const resp = await fetch(`${BASE}/api/mcp-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_name: tool.name, arguments: args }),
      });
      setResult(await resp.json());
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  const generateKeypair = async () => {
    try {
      const keyPair = await crypto.subtle.generateKey("Ed25519" as any, true, ["sign", "verify"]);
      const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
      const x = btoa(String.fromCharCode(...new Uint8Array(pubRaw)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const jwk = JSON.stringify({ kty: "OKP", crv: "Ed25519", x });
      setFormData(prev => ({ ...prev, public_key_jwk: jwk }));
    } catch {
      setFormData(prev => ({ ...prev, public_key_jwk: '(browser does not support Ed25519 via WebCrypto — paste a JWK manually)' }));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <code className="font-[var(--font-geist-mono)] text-sm font-bold">{tool.name}</code>
          <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20 text-[10px]">live</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{tool.description}</p>

        {/* Parameter table */}
        {Object.keys(properties).length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Parameter</th>
                  <th className="py-1.5 pr-3 font-medium">Type</th>
                  <th className="py-1.5 pr-3 font-medium">Required</th>
                  <th className="py-1.5 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(properties).map(([name, prop]: [string, any]) => (
                  <tr key={name} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-1.5 pr-3 font-[var(--font-geist-mono)]">{name}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{prop.type || "string"}</td>
                    <td className="py-1.5 pr-3">{required.has(name) ? <Badge variant="outline" className="text-[10px]">required</Badge> : <span className="text-muted-foreground">no</span>}</td>
                    <td className="py-1.5 text-muted-foreground">{prop.description || prop.title || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* authorize_action special case */}
        {isAuthorize ? (
          <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-500/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm">
                  <code className="font-[var(--font-geist-mono)] text-xs">authorize_action</code> requires a registered agent identity and a DPoP proof bound to the action's digest. To exercise this tool with a valid proof, use the <strong>Compliant Agent</strong> tab. To see it reject various attack variants, use the <strong>Rogue Agent</strong> tab.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => window.location.href = "/"}>Open Compliant Agent</Button>
                <Button size="sm" variant="outline" onClick={() => window.location.href = "/"}>Open Rogue Agent</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Try this tool panel */
          <Collapsible open={tryOpen} onOpenChange={setTryOpen}>
            <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${tryOpen ? "rotate-90" : ""}`} />
              Try this tool
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 space-y-3">
                {Object.entries(properties).map(([name, prop]: [string, any]) => (
                  <div key={name} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {name} {required.has(name) && <span className="text-rose-500">*</span>}
                    </label>
                    {(prop.type === "string" && (name.includes("json") || name.includes("receipt"))) ? (
                      <textarea
                        className="w-full font-[var(--font-geist-mono)] text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-2 min-h-16 resize-y"
                        value={formData[name] || prop.default || ""}
                        onChange={e => setFormData(prev => ({ ...prev, [name]: e.target.value }))}
                        placeholder={prop.description || name}
                      />
                    ) : (
                      <input
                        className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1.5"
                        value={formData[name] || prop.default || ""}
                        onChange={e => setFormData(prev => ({ ...prev, [name]: e.target.value }))}
                        placeholder={prop.description || name}
                      />
                    )}
                  </div>
                ))}
                {tool.name === "register_agent" && (
                  <Button size="sm" variant="outline" onClick={generateKeypair} className="text-xs">
                    Generate demo keypair
                  </Button>
                )}
                <Button onClick={handleCall} disabled={loading} className="gap-2">
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Call tool
                </Button>
                {result && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {result.error
                        ? <Badge variant="destructive">{result.error}</Badge>
                        : <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20">OK</Badge>
                      }
                      {result.duration_ms != null && <span className="font-[var(--font-geist-mono)] text-xs text-muted-foreground">{result.duration_ms}ms</span>}
                    </div>
                    <JsonView data={result.result || result} />
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

// --- Main page ---
export default function IntegrationsPage() {
  const [tools, setTools] = useState<any>(null);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [health, setHealth] = useState<any>(null);

  const fetchTools = useCallback(async (refresh = false) => {
    setToolsLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/mcp-tools${refresh ? "?refresh=true" : ""}`);
      setTools(await resp.json());
    } catch (e: any) {
      setTools({ error: e.message });
    }
    setToolsLoading(false);
  }, []);

  useEffect(() => {
    fetchTools();
    fetch(`${BASE}/api/health`).then(r => r.json()).then(setHealth).catch(() => {});
  }, [fetchTools]);

  const config = health?.config || {};
  const mcpUrl = config.gateway_mcp_url || "https://your-gateway-mcp-url/mcp";
  const restUrl = config.gateway_rest_url || "https://your-gateway-rest-url";

  const connectionSnippet = `from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession
import asyncio, json

async def main():
    url = "${mcpUrl}"
    headers = {"Authorization": "Bearer <MCP_BEARER_TOKEN>"}
    async with streamablehttp_client(url, headers=headers) as (r, w, _):
        async with ClientSession(r, w) as session:
            await session.initialize()
            tools = await session.list_tools()
            for t in tools.tools:
                print(f"{t.name}: {t.description[:60]}...")

asyncio.run(main())`;

  const toolList = tools?.tools || [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <div className="flex-1 max-w-[1440px] mx-auto w-full p-6 space-y-8">
        {/* Subsection A: REST API */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">REST API</CardTitle>
            <p className="text-sm text-muted-foreground">Standard HTTP endpoints. OpenAPI 3.0 spec served by the gateway.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border overflow-hidden" style={{ height: 500 }}>
              <iframe
                src={`${restUrl}/docs`}
                className="w-full h-full border-0"
                title="REST API Swagger"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>OpenAPI spec:</span>
              <a href={`${restUrl}/openapi.json`} target="_blank" rel="noopener"
                className="font-[var(--font-geist-mono)] text-xs hover:text-foreground transition-colors">{restUrl}/openapi.json</a>
              <button onClick={() => copyText(`${restUrl}/openapi.json`)} className="cursor-pointer text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3" /></button>
            </div>
          </CardContent>
        </Card>

        {/* Subsection B: MCP Server (live) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">MCP Server</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Tool reference introspected live from the deployed MCP server. If a tool is added to the gateway, it appears here automatically.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => fetchTools(true)} disabled={toolsLoading} className="h-7 w-7 p-0 shrink-0">
                <RefreshCw className={`w-3.5 h-3.5 ${toolsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Connection snippet */}
            <Card className="bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium">Connect from your own MCP client</p>
                <div className="relative">
                  <pre className="font-[var(--font-geist-mono)] text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md p-3 overflow-x-auto whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{connectionSnippet}</pre>
                  <button onClick={() => copyText(connectionSnippet)} className="absolute top-2 right-2 cursor-pointer text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>MCP URL:</span>
                    <code className="font-[var(--font-geist-mono)] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{mcpUrl}</code>
                    <button onClick={() => copyText(mcpUrl)} className="cursor-pointer text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3" /></button>
                  </div>
                  <span>Bearer token: configured via env (visible in the Demo page's left rail)</span>
                </div>
              </CardContent>
            </Card>

            {/* Tool list or error */}
            {tools?.error && (
              <Card className="border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20">
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm text-rose-700 dark:text-rose-400 font-medium">Failed to introspect MCP tools</p>
                  <p className="text-xs text-rose-600 font-[var(--font-geist-mono)]">{tools.error}: {tools.detail}</p>
                  <Button size="sm" variant="outline" onClick={() => fetchTools(true)}>Retry</Button>
                </CardContent>
              </Card>
            )}

            {toolsLoading && !tools && (
              <div className="flex items-center gap-2 justify-center py-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Introspecting MCP tools...
              </div>
            )}

            {toolList.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">{toolList.length} tools introspected from {tools.source}</p>
                {toolList.map((tool: any) => <ToolCard key={tool.name} tool={tool} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
