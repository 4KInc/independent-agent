# Independent Agent — Framework-Agnostic Gateway Client

An independent AI agent that connects to the [Agent Authorization Gateway](https://github.com/4KInc/agent-authorization-gateway) over the wire, built from the published [Receipt Chain Verification Protocol v0.3](../agent-authorization-gateway/docs/protocol.md).

**If this works, the gateway's protocol is real and framework-agnostic, not an implementation artifact.**

## Independence Claim

This repository:
- Imports **nothing** from the gateway codebase (machine-verified by `check_independence.py`)
- Uses the **MCP SDK** (not Google ADK) — different framework, proving interoperability
- Implements DPoP proofs, action_digest, and JCS canonicalization **from the published spec alone**
- Communicates with the gateway **only over the wire**: MCP for authorization, HTTP for the protected resource

## Quick Start

```bash
cd independent-agent
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# Copy and edit env vars
cp .env.example .env
# Set GATEWAY_MCP_URL, RESOURCE_URL, MCP_BEARER_TOKEN, GATEWAY_KEYS_URL
```

## Run the Compliant Agent

```bash
# Deterministic mode (no LLM needed)
python compliant_agent.py

# With LangChain (requires OPENAI_API_KEY)
pip install -e ".[langchain]"
python compliant_agent.py --llm "get customer data from staging"
```

The compliant agent:
1. Generates an Ed25519 identity (persisted to `agent_key.pem`)
2. Registers its public key with the gateway via MCP
3. Computes an action_digest and signs a DPoP proof
4. Calls `authorize_action` — receives a 60-second token + signed receipt
5. Uses the token against the protected resource
6. Verifies `token.jti == receipt.token_jti` by fetching the receipt chain

## Run the Rogue Agent

```bash
python rogue_agent.py
```

7 attacks, all rejected:

| Attack | Expected Rejection | Layer |
|--------|-------------------|-------|
| (a) No token | 401 | Resource |
| (b) Forged token | 401 | Resource |
| (c) No DPoP proof | NO_PROOF | Gateway identity |
| (d) Unregistered agent | UNREGISTERED_AGENT | Gateway identity |
| (e) Omitted action_digest | PROOF_DIGEST_MISSING | Gateway identity (v0.3) |
| (f) Digest mismatch | PROOF_DIGEST_MISMATCH | Gateway identity |
| (g) Anonymous transport | 401 | Gateway transport |

Exit code 0 = all blocked. Exit code 1 = a gateway bug was found.

## Verify Independence

```bash
python check_independence.py
# → "INDEPENDENCE CHECK PASSED — zero imports from the gateway package"
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GATEWAY_MCP_URL` | Gateway MCP endpoint (e.g. `http://localhost:8090/mcp`) |
| `RESOURCE_URL` | Protected resource (e.g. `http://localhost:8081`) |
| `MCP_BEARER_TOKEN` | Shared bearer token for MCP transport auth |
| `GATEWAY_KEYS_URL` | Gateway REST `/keys` endpoint for public key |
