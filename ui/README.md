# Agent Authorization Gateway — Interactive UI

A Next.js 16 frontend for the [Agent Authorization Gateway](https://github.com/4KInc/agent-authorization-gateway). Every interaction is a real network call to the deployed gateway — no mocks, no fixtures, no canned responses.

## Pages

### `/` — Demo

Interactive demo of the full agent-to-gateway-to-resource flow:

- **Compliant Agent** — Select an action/resource, run the flow, and watch each step stream in via SSE: DPoP proof construction, MCP authorization, receipt verification, resource access, and JTI binding check.
- **Rogue Agent** — Launch 7 distinct attack variants (no token, forged token, no DPoP, unregistered agent, omitted digest, action mismatch, anonymous transport) and see each one rejected at the correct layer.
- **Audit & Verify** — Verify individual receipt signatures (Ed25519), verify full chain integrity with Merkle commitment, inspect on-chain anchors on Base L2, and run the tamper detection demo (dev mode).

Left sidebar shows endpoint health, signing keys, and bearer token status. Right sidebar shows the live receipt chain with real-time highlighting of new receipts.

### `/dashboard` — Multi-Agent Operations

Unified view of all five agents in the system:

| Agent | Type | What it shows |
|-------|------|---------------|
| **Gateway** | Deterministic | Recent receipts with decision, agent, action, resource |
| **Auditor** | AI (Gemini 2.5 Pro) | Audit reports with verdict, rationale, compliance citations |
| **Recommender** | AI (Gemini 2.5 Pro) | Policy proposals with confidence, diff, supporting citations |
| **Investigator** | AI (Gemini 2.5 Pro) | Incident reports with severity, timeline, agents involved, recommended actions |
| **Coordinator** | Deterministic + AI | Agent directory and natural-language question routing |

Each agent card shows health status and its independent Ed25519 signing key (KID). An activity timeline aggregates events across all agents, sorted chronologically.

### `/integrations` — API & Integrations

- **REST API** — Embedded Swagger UI from the gateway's OpenAPI spec.
- **MCP Server** — Live tool introspection from the deployed MCP endpoint. Each tool shows parameters, types, and a "Try this tool" form. `authorize_action` is gated (requires DPoP proof) with a redirect to the Demo page. Includes a Python connection snippet for MCP clients.

## Architecture

```
Browser (Next.js)
    |
    v
FastAPI backend (server/app.py)          <-- /api/* routes
    |
    +-- MCP SDK -----> Gateway MCP        <-- authorize, register, chain
    +-- HTTP --------> Gateway REST       <-- verify, chain, keys, anchors
    +-- HTTP --------> Protected Resource <-- /customers/c1
    +-- HTTP proxy --> Auditor, Recommender, Investigator, Coordinator
```

The FastAPI backend (`server/app.py`) runs the independent agent's identity module — it generates Ed25519 keys, builds DPoP proofs, and communicates with the gateway over the wire. The Next.js frontend is exported as static HTML and served by the same process via `serve_ui.py`.

## Tech Stack

- **Next.js 16** with App Router, React 19, TypeScript
- **Tailwind CSS 4** with `tw-animate-css`
- **shadcn/ui** (Base UI) — Card, Badge, Tabs, Select, Sheet, Collapsible, Separator, Button, Tooltip, Sonner
- **lucide-react** for icons
- **next-themes** for dark mode
- **Geist** font family (sans + mono)

## Development

```bash
npm install
npm run dev
```

The UI expects the FastAPI backend at `NEXT_PUBLIC_API_URL` (defaults to same origin). For local dev, run the backend separately:

```bash
# From the independent-agent root
pip install -e ".[dev]"
python serve_ui.py
```

## Build & Deploy

```bash
# Static export for embedding in the FastAPI server
npm run build
cp -r out/ ../static/

# The Dockerfile builds both the Python backend and the static frontend
docker build -t independent-agent ..
```

## Environment Variables

Set on the FastAPI backend (`server/app.py`), not on the Next.js app:

| Variable | Description |
|----------|-------------|
| `GATEWAY_MCP_URL` | Gateway MCP endpoint |
| `GATEWAY_REST_URL` | Gateway REST endpoint |
| `RESOURCE_URL` | Protected resource endpoint |
| `MCP_BEARER_TOKEN` | Shared bearer token for MCP transport auth |
| `AUDITOR_URL` | Auditor service URL |
| `RECOMMENDER_URL` | Recommender service URL |
| `INVESTIGATOR_URL` | Investigator service URL |
| `COORDINATOR_URL` | Coordinator service URL |
| `AGENT_PRIVATE_KEY_B64` | Base64-encoded PEM for stable agent identity across restarts |
| `NEXT_PUBLIC_API_URL` | API base URL (client-side, defaults to same origin) |
