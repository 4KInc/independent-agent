"""FastAPI backend — streams real agent<>gateway<>resource interactions via SSE.

Every event emitted is caused by a real network call that just completed.
No mocks, no fixtures, no canned responses. The gateway is the source of truth.
"""

from __future__ import annotations

import asyncio
import base64
import collections
import json
import os
import sys
import time
import uuid
from typing import AsyncGenerator

import httpx
import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# Reuse the independent agent's identity + client modules (same repo, NOT from gateway)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.identity import (
    compute_action_digest,
    create_dpop_proof,
    load_or_generate_keypair,
    public_key_jwk,
)
import agent.gateway_client as gw
import agent.resource_client as rc

# --- Config from env ---
GATEWAY_MCP_URL = os.environ.get("GATEWAY_MCP_URL", "http://localhost:8090/mcp")
GATEWAY_REST_URL = os.environ.get("GATEWAY_REST_URL", "http://localhost:8080")
RESOURCE_URL = os.environ.get("RESOURCE_URL", "http://localhost:8081")
MCP_BEARER_TOKEN = os.environ.get("MCP_BEARER_TOKEN", "")
AGENT_ID = "demo-ui-agent-01"

# Multi-agent service URLs
AUDITOR_URL = os.environ.get("AUDITOR_URL", "https://agent-auth-gateway-auditor-lwmxdereeq-uc.a.run.app")
RECOMMENDER_URL = os.environ.get("RECOMMENDER_URL", "https://agent-auth-gateway-recommender-lwmxdereeq-uc.a.run.app")
INVESTIGATOR_URL = os.environ.get("INVESTIGATOR_URL", "https://agent-auth-investigator-lwmxdereeq-uc.a.run.app")
COORDINATOR_URL = os.environ.get("COORDINATOR_URL", "https://agent-auth-gateway-coordinator-lwmxdereeq-uc.a.run.app")
DEMO_AGENT_URL = os.environ.get("DEMO_AGENT_URL", "https://demo-agent-1031148889398.us-central1.run.app")
ISOLATOR_URL = os.environ.get("ISOLATOR_URL", "https://agent-auth-isolator-1031148889398.us-central1.run.app")

# --- Rate limiting (in-memory, per IP) ---
_rate_buckets: dict[str, collections.deque] = {}
RATE_LIMIT = 60  # requests per minute
RATE_WINDOW = 60  # seconds

# --- Action allowlist ---
ALLOWED_ACTIONS = {"read", "query", "list", "search", "analyze", "delete"}
ALLOWED_RESOURCES = {"staging-database", "staging-analytics-api", "dev-database"}
MAX_PARAMS_SIZE = 2048

app = FastAPI(title="Independent Agent Demo UI Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _check_rate_limit(ip: str):
    now = time.time()
    if ip not in _rate_buckets:
        _rate_buckets[ip] = collections.deque()
    bucket = _rate_buckets[ip]
    while bucket and bucket[0] < now - RATE_WINDOW:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT:
        raise HTTPException(429, "Rate limit exceeded (10/minute)")
    bucket.append(now)


def _get_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")


# --- Identity (stable across container restarts) ---
#
# The private key is loaded from AGENT_PRIVATE_KEY_B64 env var (base64-encoded PEM).
# This ensures the same Ed25519 identity survives Cloud Run cold starts.
# If the env var is not set, falls back to generating a key on disk (local dev).
#
# The gateway's agent registry is IN-MEMORY (not Firestore-backed), so it may be
# wiped on gateway cold starts. Therefore we register before every authorize call,
# not just once. Registration is idempotent (re-registering the same agent_id
# with the same key is a no-op on the gateway side).
_private_key: Ed25519PrivateKey | None = None


def _get_key() -> Ed25519PrivateKey:
    global _private_key
    if _private_key is not None:
        return _private_key

    # Prefer env-stored key (survives Cloud Run container restarts)
    key_b64 = os.environ.get("AGENT_PRIVATE_KEY_B64", "")
    if key_b64:
        from cryptography.hazmat.primitives.serialization import load_pem_private_key
        pem = base64.b64decode(key_b64)
        _private_key = load_pem_private_key(pem, password=None)
    else:
        # Local dev fallback: generate and persist to disk
        _private_key = load_or_generate_keypair("server_agent_key.pem")
    return _private_key


async def _register_with_gateway():
    """Register the agent's public key with the gateway. Called before every
    authorize because the gateway's agent registry is in-memory and may be
    wiped on gateway cold starts. Registration is idempotent."""
    key = _get_key()
    result = await gw.register(GATEWAY_MCP_URL, MCP_BEARER_TOKEN, AGENT_ID, key)
    if result.get("error"):
        raise RuntimeError(f"Registration failed: {result}")


# --- SSE helper ---
def _sse_event(step: str, data: dict) -> str:
    payload = {"step": step, "data": data, "ts": time.time()}
    return f"data: {json.dumps(payload)}\n\n"


# --- Models ---
class CompliantFlowRequest(BaseModel):
    action: str = Field(..., min_length=1, max_length=64)
    resource: str = Field(..., min_length=1, max_length=128)
    parameters: dict | None = None


class RogueAttackRequest(BaseModel):
    attack: str = Field(...)


# --- Compliant flow (SSE) ---
@app.post("/api/compliant-flow")
async def compliant_flow(req: CompliantFlowRequest, request: Request):
    _check_rate_limit(_get_ip(request))
    if req.action not in ALLOWED_ACTIONS:
        raise HTTPException(400, f"Action '{req.action}' not in allowlist: {ALLOWED_ACTIONS}")
    if req.resource not in ALLOWED_RESOURCES:
        raise HTTPException(400, f"Resource '{req.resource}' not in allowlist: {ALLOWED_RESOURCES}")
    if req.parameters and len(json.dumps(req.parameters)) > MAX_PARAMS_SIZE:
        raise HTTPException(400, f"Parameters too large (max {MAX_PARAMS_SIZE} bytes)")

    async def stream() -> AsyncGenerator[str, None]:
        key = _get_key()
        try:
            await _register_with_gateway()
        except Exception as e:
            yield _sse_event("error", {"message": f"Registration failed: {e}"})
            return

        # Build proof
        t0 = time.time()
        digest = compute_action_digest(AGENT_ID, req.action, req.resource, req.parameters)
        proof = create_dpop_proof(key, AGENT_ID, req.action, req.resource, req.parameters)
        proof_claims = pyjwt.decode(proof, options={"verify_signature": False})
        yield _sse_event("build_proof", {
            "decoded_proof_jwt": proof_claims,
            "action_digest": digest,
            "duration_ms": round((time.time() - t0) * 1000),
        })

        # Call gateway (MCP authorize)
        yield _sse_event("call_gateway", {"url": GATEWAY_MCP_URL, "method": "MCP tool: authorize_action"})
        t1 = time.time()
        try:
            auth_result = await gw.authorize(
                GATEWAY_MCP_URL, MCP_BEARER_TOKEN, key, AGENT_ID,
                req.action, req.resource, req.parameters,
            )
        except Exception as e:
            yield _sse_event("gateway_response", {"error": type(e).__name__, "message": str(e)[:500], "status": None})
            yield _sse_event("error", {"message": f"Gateway call failed: {e}"})
            return
        gw_duration = round((time.time() - t1) * 1000)
        yield _sse_event("gateway_response", {**auth_result, "duration_ms": gw_duration})

        if auth_result.get("error"):
            yield _sse_event("error", {"message": f"Gateway error: {auth_result.get('error')}"})
            return

        decision = auth_result.get("decision")
        token = auth_result.get("token")
        receipt_hash = auth_result.get("receipt_hash", "")

        if decision != "approve" or not token:
            yield _sse_event("done", {"decision": decision, "reason_codes": auth_result.get("reason_codes", [])})
            return

        # Verify receipt
        t2 = time.time()
        try:
            chain = await gw.get_receipt_chain(GATEWAY_MCP_URL, MCP_BEARER_TOKEN)
            receipt_list = chain if isinstance(chain, list) else []
            matching = [r for r in receipt_list if r.get("receipt_hash") == receipt_hash]
            receipt = matching[0] if matching else None
            verify_duration = round((time.time() - t2) * 1000)

            if receipt:
                # Verify via gateway
                async with httpx.AsyncClient(timeout=15) as client:
                    vresp = await client.post(
                        f"{GATEWAY_REST_URL}/verify-receipt",
                        json={"receipt": receipt},
                    )
                    verify_result = vresp.json()
                yield _sse_event("verify_receipt", {
                    **verify_result,
                    "receipt": receipt,
                    "duration_ms": round((time.time() - t2) * 1000),
                })
            else:
                yield _sse_event("verify_receipt", {
                    "receipt_integrity": "INCONCLUSIVE",
                    "note": f"Receipt {receipt_hash[:20]}... not found in chain ({len(receipt_list)} receipts)",
                    "duration_ms": verify_duration,
                })
        except Exception as e:
            yield _sse_event("verify_receipt", {"error": str(e), "duration_ms": round((time.time() - t2) * 1000)})

        # Call resource
        yield _sse_event("call_resource", {"url": f"{RESOURCE_URL}/customers/c1", "method": "GET"})
        t3 = time.time()
        try:
            res = await rc.call_resource(RESOURCE_URL, "/customers/c1", token)
            res_duration = round((time.time() - t3) * 1000)
            yield _sse_event("resource_response", {
                "status": res["status_code"],
                "body": res["body"],
                "accepted": res["accepted"],
                "duration_ms": res_duration,
            })
        except Exception as e:
            yield _sse_event("resource_response", {
                "status": None,
                "error": type(e).__name__,
                "message": str(e)[:300],
                "duration_ms": round((time.time() - t3) * 1000),
            })

        # JTI check
        try:
            token_claims = pyjwt.decode(token, options={"verify_signature": False})
            token_jti = token_claims.get("jti", "")
            receipt_jti = receipt.get("body", {}).get("token_jti", "") if receipt else ""
            yield _sse_event("jti_check", {
                "token_jti": token_jti,
                "receipt_token_jti": receipt_jti,
                "match": token_jti == receipt_jti and bool(token_jti),
            })
        except Exception as e:
            yield _sse_event("jti_check", {"error": str(e), "match": False})

        yield _sse_event("done", {"decision": decision})

    return StreamingResponse(stream(), media_type="text/event-stream")


# --- Rogue attacks (SSE) ---
@app.post("/api/rogue-attack")
async def rogue_attack(req: RogueAttackRequest, request: Request):
    _check_rate_limit(_get_ip(request))

    valid_attacks = {
        "no_token", "forged_token", "no_dpop", "unregistered",
        "omit_digest", "action_mismatch", "anonymous_transport",
    }
    if req.attack not in valid_attacks:
        raise HTTPException(400, f"Unknown attack: {req.attack}. Valid: {valid_attacks}")

    async def stream() -> AsyncGenerator[str, None]:
        yield _sse_event("attack_start", {"attack": req.attack})

        if req.attack == "no_token":
            yield _sse_event("call_resource", {"url": f"{RESOURCE_URL}/customers/c1", "method": "GET", "note": "No Authorization header"})
            t0 = time.time()
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.get(f"{RESOURCE_URL}/customers/c1")
                d = round((time.time() - t0) * 1000)
                body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text
                blocked = resp.status_code == 401
                yield _sse_event("resource_response", {"status": resp.status_code, "body": body, "duration_ms": d})
                if blocked:
                    yield _sse_event("done", {"blocked": True, "code": "NO_TOKEN"})
                else:
                    yield _sse_event("anomaly", {"message": "Attack succeeded — resource accepted request without token!", "status": resp.status_code})
            except Exception as e:
                yield _sse_event("error", {"message": str(e)[:300], "duration_ms": round((time.time() - t0) * 1000)})

        elif req.attack == "forged_token":
            rogue_key = Ed25519PrivateKey.generate()
            forged = pyjwt.encode({
                "iss": "agent-authorization-gateway", "aud": "protected-resource",
                "sub": "rogue", "action": "read", "resource": "staging-database",
                "action_digest": "sha256:fake", "decision": "approve",
                "receipt_hash": "sha256:fake", "jti": str(uuid.uuid4()),
                "iat": int(time.time()), "exp": int(time.time()) + 60,
            }, rogue_key, algorithm="EdDSA")
            yield _sse_event("call_resource", {"url": f"{RESOURCE_URL}/customers/c1", "method": "GET", "note": "Self-signed token (rogue key)"})
            t0 = time.time()
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.get(f"{RESOURCE_URL}/customers/c1", headers={"Authorization": f"Bearer {forged}"})
                d = round((time.time() - t0) * 1000)
                body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text
                blocked = resp.status_code == 401
                yield _sse_event("resource_response", {"status": resp.status_code, "body": body, "duration_ms": d})
                if blocked:
                    yield _sse_event("done", {"blocked": True, "code": "INVALID_SIGNATURE"})
                else:
                    yield _sse_event("anomaly", {"message": "Forged token accepted!", "status": resp.status_code})
            except Exception as e:
                yield _sse_event("error", {"message": str(e)[:300]})

        elif req.attack == "no_dpop":
            yield _sse_event("call_gateway", {"url": GATEWAY_MCP_URL, "method": "MCP: authorize_action", "note": "Empty agent_proof"})
            t0 = time.time()
            try:
                from mcp.client.streamable_http import streamablehttp_client
                from mcp import ClientSession
                async with streamablehttp_client(GATEWAY_MCP_URL, headers={"Authorization": f"Bearer {MCP_BEARER_TOKEN}"}) as (r, w, _):
                    async with ClientSession(r, w) as session:
                        await session.initialize()
                        result = await session.call_tool("authorize_action", {
                            "agent_id": "rogue", "action": "read", "resource": "staging-database", "agent_proof": "",
                        })
                        parsed = json.loads(result.content[0].text)
                        d = round((time.time() - t0) * 1000)
                        yield _sse_event("gateway_response", {**parsed, "duration_ms": d})
                        blocked = parsed.get("error") == "NO_PROOF"
                        if blocked:
                            yield _sse_event("done", {"blocked": True, "code": "NO_PROOF"})
                        else:
                            yield _sse_event("anomaly", {"message": f"No-DPoP accepted: {parsed}"})
            except Exception as e:
                yield _sse_event("error", {"message": str(e)[:300]})

        elif req.attack == "unregistered":
            unreg_key = Ed25519PrivateKey.generate()
            proof = create_dpop_proof(unreg_key, "unregistered-rogue", "read", "staging-database")
            yield _sse_event("call_gateway", {"url": GATEWAY_MCP_URL, "method": "MCP: authorize_action", "note": "Proof from unregistered key"})
            t0 = time.time()
            try:
                from mcp.client.streamable_http import streamablehttp_client
                from mcp import ClientSession
                async with streamablehttp_client(GATEWAY_MCP_URL, headers={"Authorization": f"Bearer {MCP_BEARER_TOKEN}"}) as (r, w, _):
                    async with ClientSession(r, w) as session:
                        await session.initialize()
                        result = await session.call_tool("authorize_action", {
                            "agent_id": "unregistered-rogue", "action": "read", "resource": "staging-database", "agent_proof": proof,
                        })
                        parsed = json.loads(result.content[0].text)
                        d = round((time.time() - t0) * 1000)
                        yield _sse_event("gateway_response", {**parsed, "duration_ms": d})
                        blocked = parsed.get("error") == "UNREGISTERED_AGENT"
                        if blocked:
                            yield _sse_event("done", {"blocked": True, "code": "UNREGISTERED_AGENT"})
                        else:
                            yield _sse_event("anomaly", {"message": f"Unregistered agent accepted: {parsed}"})
            except Exception as e:
                yield _sse_event("error", {"message": str(e)[:300]})

        elif req.attack == "omit_digest":
            key = _get_key()
            try:
                await _register_with_gateway()
            except Exception:
                pass
            no_digest_payload = {
                "sub": AGENT_ID, "htm": "POST", "htu": "agent-authorization-gateway",
                "action": "read", "resource": "staging-database",
                "jti": str(uuid.uuid4()), "iat": int(time.time()),
            }
            bad_proof = pyjwt.encode(no_digest_payload, key, algorithm="EdDSA")
            yield _sse_event("call_gateway", {"url": GATEWAY_MCP_URL, "method": "MCP: authorize_action", "note": "Proof missing action_digest claim"})
            t0 = time.time()
            try:
                from mcp.client.streamable_http import streamablehttp_client
                from mcp import ClientSession
                async with streamablehttp_client(GATEWAY_MCP_URL, headers={"Authorization": f"Bearer {MCP_BEARER_TOKEN}"}) as (r, w, _):
                    async with ClientSession(r, w) as session:
                        await session.initialize()
                        result = await session.call_tool("authorize_action", {
                            "agent_id": AGENT_ID, "action": "read", "resource": "staging-database", "agent_proof": bad_proof,
                        })
                        parsed = json.loads(result.content[0].text)
                        d = round((time.time() - t0) * 1000)
                        yield _sse_event("gateway_response", {**parsed, "duration_ms": d})
                        blocked = parsed.get("error") == "PROOF_DIGEST_MISSING"
                        if blocked:
                            yield _sse_event("done", {"blocked": True, "code": "PROOF_DIGEST_MISSING"})
                        else:
                            yield _sse_event("anomaly", {"message": f"Omitted digest accepted: {parsed}"})
            except Exception as e:
                yield _sse_event("error", {"message": str(e)[:300]})

        elif req.attack == "action_mismatch":
            key = _get_key()
            try:
                await _register_with_gateway()
            except Exception:
                pass
            proof_for_read = create_dpop_proof(key, AGENT_ID, "read", "staging-database")
            yield _sse_event("call_gateway", {"url": GATEWAY_MCP_URL, "method": "MCP: authorize_action", "note": "Proof for 'read' but requesting 'delete'"})
            t0 = time.time()
            try:
                from mcp.client.streamable_http import streamablehttp_client
                from mcp import ClientSession
                async with streamablehttp_client(GATEWAY_MCP_URL, headers={"Authorization": f"Bearer {MCP_BEARER_TOKEN}"}) as (r, w, _):
                    async with ClientSession(r, w) as session:
                        await session.initialize()
                        result = await session.call_tool("authorize_action", {
                            "agent_id": AGENT_ID, "action": "delete", "resource": "staging-database", "agent_proof": proof_for_read,
                        })
                        parsed = json.loads(result.content[0].text)
                        d = round((time.time() - t0) * 1000)
                        yield _sse_event("gateway_response", {**parsed, "duration_ms": d})
                        blocked = "MISMATCH" in parsed.get("error", "")
                        if blocked:
                            yield _sse_event("done", {"blocked": True, "code": parsed.get("error")})
                        else:
                            yield _sse_event("anomaly", {"message": f"Mismatch accepted: {parsed}"})
            except Exception as e:
                yield _sse_event("error", {"message": str(e)[:300]})

        elif req.attack == "anonymous_transport":
            yield _sse_event("call_gateway", {"url": GATEWAY_MCP_URL, "method": "MCP: initialize", "note": "No Authorization header"})
            t0 = time.time()
            try:
                from mcp.client.streamable_http import streamablehttp_client
                from mcp import ClientSession
                async with streamablehttp_client(GATEWAY_MCP_URL) as (r, w, _):
                    async with ClientSession(r, w) as session:
                        await session.initialize()
                        yield _sse_event("anomaly", {"message": "Anonymous transport accepted!"})
            except Exception as e:
                d = round((time.time() - t0) * 1000)
                yield _sse_event("gateway_response", {"error": "UNAUTHORIZED", "detail": str(e)[:200], "duration_ms": d})
                yield _sse_event("done", {"blocked": True, "code": "401_TRANSPORT"})

    return StreamingResponse(stream(), media_type="text/event-stream")


# --- Proxied endpoints ---
@app.post("/api/verify-receipt")
async def verify_receipt(receipt: dict, request: Request):
    _check_rate_limit(_get_ip(request))
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{GATEWAY_REST_URL}/verify-receipt", json={"receipt": receipt})
        return resp.json()


@app.get("/api/chain")
async def get_chain(request: Request):
    _check_rate_limit(_get_ip(request))
    # Fetch from the MCP server (which has in-memory receipts from this session)
    # AND from the REST API (which has Firestore receipts from prior sessions).
    # Merge by receipt_hash, newest first.
    mcp_receipts = []
    rest_receipts = []
    try:
        mcp_chain = await gw.get_receipt_chain(GATEWAY_MCP_URL, MCP_BEARER_TOKEN)
        mcp_receipts = mcp_chain if isinstance(mcp_chain, list) else []
    except Exception:
        pass
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{GATEWAY_REST_URL}/chain")
            data = resp.json()
            rest_receipts = data.get("receipts", [])
    except Exception:
        pass
    # Merge: deduplicate by receipt_hash, prefer MCP (fresher)
    seen = set()
    merged = []
    for r in mcp_receipts + rest_receipts:
        h = r.get("receipt_hash", "")
        if h and h not in seen:
            seen.add(h)
            merged.append(r)
    # Sort by seq (ascending)
    merged.sort(key=lambda r: int(r.get("body", {}).get("seq", 0)))
    return {"tenant": "hackathon-demo", "receipts": merged, "count": len(merged)}


@app.post("/api/verify-chain")
async def verify_chain(request: Request):
    """Proxy to gateway /verify-chain — verify full receipt chain integrity."""
    _check_rate_limit(_get_ip(request))
    async with httpx.AsyncClient(timeout=30) as client:
        # Fetch the chain first
        chain_resp = await client.get(f"{GATEWAY_REST_URL}/chain")
        chain_data = chain_resp.json()
        receipts = chain_data.get("receipts", [])
        # Verify it
        verify_resp = await client.post(
            f"{GATEWAY_REST_URL}/verify-chain",
            json={"receipts": receipts},
        )
        verify_data = verify_resp.json()
        # Also get stats for the Merkle root
        stats_resp = await client.get(f"{GATEWAY_REST_URL}/stats")
        stats_data = stats_resp.json()
        # Get latest anchor for on-chain reference
        latest_anchor = None
        try:
            anchors_resp = await client.get(f"{GATEWAY_REST_URL}/anchors")
            anchors_data = anchors_resp.json()
            on_chain = anchors_data.get("on_chain_anchors", [])
            if on_chain:
                latest_anchor = on_chain[0]
        except Exception:
            pass

        return {
            **verify_data,
            "chain_length": len(receipts),
            "merkle_root": stats_data.get("merkle_root"),
            "policy_version": stats_data.get("policy_version"),
            "latest_anchor": latest_anchor,
        }


@app.get("/api/anchors")
async def get_anchors(request: Request):
    """Proxy to gateway /anchors — list on-chain anchor records."""
    _check_rate_limit(_get_ip(request))
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{GATEWAY_REST_URL}/anchors")
        return resp.json()


@app.get("/api/anchors/verify/{tx_hash}")
async def verify_anchor(tx_hash: str, request: Request):
    """Proxy to gateway /anchors/verify/{tx_hash} — verify on-chain anchor."""
    _check_rate_limit(_get_ip(request))
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{GATEWAY_REST_URL}/anchors/verify/{tx_hash}")
        return resp.json()


@app.get("/api/public-key")
async def get_public_key(request: Request):
    """Proxy to gateway /keys — return signing public keys with fingerprints."""
    _check_rate_limit(_get_ip(request))
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{GATEWAY_REST_URL}/keys")
        return resp.json()


# Tamper test rate limit: 1/min per IP
_tamper_buckets: dict[str, float] = {}


@app.post("/api/tamper-test")
async def tamper_test(body: dict, request: Request):
    """Proxy to gateway /tamper-test (dev mode only), then verify chain."""
    _check_rate_limit(_get_ip(request))
    ip = _get_ip(request)
    now = time.time()
    if ip in _tamper_buckets and now - _tamper_buckets[ip] < 60:
        raise HTTPException(429, "Tamper test rate limited (1/minute)")
    _tamper_buckets[ip] = now

    receipt_index = body.get("receipt_index", 0)
    field = body.get("field", "decision")

    async with httpx.AsyncClient(timeout=15) as client:
        # Tamper
        tamper_resp = await client.post(
            f"{GATEWAY_REST_URL}/tamper-test",
            params={"receipt_index": receipt_index, "field": field},
        )
        if tamper_resp.status_code == 403:
            return {"error": "TAMPER_UNAVAILABLE", "detail": "Tamper demo is disabled in production mode (GATEWAY_DEV_MODE != true)."}
        tamper_data = tamper_resp.json()

        # Re-verify chain to show the detection
        chain_resp = await client.get(f"{GATEWAY_REST_URL}/chain")
        chain_data = chain_resp.json()
        verify_resp = await client.post(
            f"{GATEWAY_REST_URL}/verify-chain",
            json={"receipts": chain_data.get("receipts", [])},
        )
        verify_data = verify_resp.json()

        return {
            "tamper": tamper_data,
            "verification": verify_data,
        }


@app.get("/api/dev-mode")
async def check_dev_mode():
    """Check if gateway is in dev mode (tamper test available)."""
    async with httpx.AsyncClient(timeout=5) as client:
        try:
            resp = await client.post(
                f"{GATEWAY_REST_URL}/tamper-test",
                params={"receipt_index": 99999, "field": "decision"},
            )
            # 403 = dev mode off; 400 = dev mode on but bad index; 200 = dev mode on
            return {"dev_mode": resp.status_code != 403}
        except Exception:
            return {"dev_mode": False}


# --- MCP introspection + call endpoints ---
_mcp_tools_cache: dict | None = None
_mcp_tools_cache_ts: float = 0
_MCP_TOOLS_CACHE_TTL = 60


@app.get("/api/mcp-tools")
async def mcp_tools(request: Request, refresh: bool = False):
    """Introspect tools from the live MCP server via list_tools."""
    global _mcp_tools_cache, _mcp_tools_cache_ts
    _check_rate_limit(_get_ip(request))

    now = time.time()
    if _mcp_tools_cache and not refresh and (now - _mcp_tools_cache_ts) < _MCP_TOOLS_CACHE_TTL:
        return _mcp_tools_cache

    try:
        from mcp.client.streamable_http import streamablehttp_client
        from mcp import ClientSession
        headers = {"Authorization": f"Bearer {MCP_BEARER_TOKEN}"} if MCP_BEARER_TOKEN else {}
        async with streamablehttp_client(GATEWAY_MCP_URL, headers=headers) as (r, w, _):
            async with ClientSession(r, w) as session:
                await session.initialize()
                result = await session.list_tools()
                tools = []
                for t in result.tools:
                    tool_data = {
                        "name": t.name,
                        "description": t.description or "",
                        "inputSchema": t.inputSchema if hasattr(t, "inputSchema") else {},
                    }
                    tools.append(tool_data)
                response = {"tools": tools, "count": len(tools), "source": GATEWAY_MCP_URL, "fetched_at": now}
                _mcp_tools_cache = response
                _mcp_tools_cache_ts = now
                return response
    except Exception as e:
        return {"error": type(e).__name__, "detail": str(e)[:300], "source": GATEWAY_MCP_URL}


_BLOCKED_TOOLS = {"authorize_action"}


@app.post("/api/mcp-call")
async def mcp_call(body: dict, request: Request):
    """Call a named MCP tool on the deployed gateway. authorize_action is blocked."""
    _check_rate_limit(_get_ip(request))

    tool_name = body.get("tool_name", "")
    arguments = body.get("arguments", {})

    if tool_name in _BLOCKED_TOOLS:
        raise HTTPException(400, (
            f"'{tool_name}' requires a registered agent identity and a DPoP proof "
            "bound to the action's digest. Use the Compliant Agent tab to exercise "
            "the full flow, or the Rogue Agent tab to see rejection variants."
        ))

    if not tool_name:
        raise HTTPException(400, "tool_name is required")

    try:
        from mcp.client.streamable_http import streamablehttp_client
        from mcp import ClientSession
        headers = {"Authorization": f"Bearer {MCP_BEARER_TOKEN}"} if MCP_BEARER_TOKEN else {}
        async with streamablehttp_client(GATEWAY_MCP_URL, headers=headers) as (r, w, _):
            async with ClientSession(r, w) as session:
                await session.initialize()
                t0 = time.time()
                result = await session.call_tool(tool_name, arguments)
                duration_ms = round((time.time() - t0) * 1000)
                text = result.content[0].text if result.content else ""
                try:
                    parsed = json.loads(text)
                except Exception:
                    parsed = text
                return {"tool": tool_name, "result": parsed, "duration_ms": duration_ms}
    except Exception as e:
        return {"tool": tool_name, "error": type(e).__name__, "detail": str(e)[:300]}


# --- Multi-agent dashboard proxy endpoints ---
_AGENT_URLS = {
    "auditor": AUDITOR_URL,
    "recommender": RECOMMENDER_URL,
    "investigator": INVESTIGATOR_URL,
    "coordinator": COORDINATOR_URL,
    "isolator": ISOLATOR_URL,
    "gateway": GATEWAY_REST_URL,
    "demo-agent": DEMO_AGENT_URL,
}


@app.get("/api/agents/{agent_name}/{path:path}")
async def proxy_agent(agent_name: str, path: str, request: Request):
    """Proxy requests to the multi-agent services."""
    _check_rate_limit(_get_ip(request))
    base = _AGENT_URLS.get(agent_name)
    if not base:
        raise HTTPException(404, f"Unknown agent: {agent_name}")
    url = f"{base}/{path}"
    params = dict(request.query_params)
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url, params=params)
            try:
                return resp.json()
            except Exception:
                return {"raw": resp.text[:500], "status": resp.status_code}
        except Exception as e:
            return {"error": type(e).__name__, "detail": str(e)[:200]}


@app.post("/api/agents/{agent_name}/{path:path}")
async def proxy_agent_post(agent_name: str, path: str, request: Request):
    """Proxy POST requests to the multi-agent services."""
    _check_rate_limit(_get_ip(request))
    base = _AGENT_URLS.get(agent_name)
    if not base:
        raise HTTPException(404, f"Unknown agent: {agent_name}")
    url = f"{base}/{path}"
    body = await request.json()
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(url, json=body)
            try:
                return resp.json()
            except Exception:
                return {"raw": resp.text[:500], "status": resp.status_code}
        except Exception as e:
            return {"error": type(e).__name__, "detail": str(e)[:200]}


@app.put("/api/agents/{agent_name}/{path:path}")
async def proxy_agent_put(agent_name: str, path: str, request: Request):
    """Proxy PUT requests to the multi-agent services."""
    _check_rate_limit(_get_ip(request))
    base = _AGENT_URLS.get(agent_name)
    if not base:
        raise HTTPException(404, f"Unknown agent: {agent_name}")
    url = f"{base}/{path}"
    body = await request.json()
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.put(url, json=body)
            try:
                return resp.json()
            except Exception:
                return {"raw": resp.text[:500], "status": resp.status_code}
        except Exception as e:
            return {"error": type(e).__name__, "detail": str(e)[:200]}


@app.delete("/api/agents/{agent_name}/{path:path}")
async def proxy_agent_delete(agent_name: str, path: str, request: Request):
    """Proxy DELETE requests to the multi-agent services."""
    _check_rate_limit(_get_ip(request))
    base = _AGENT_URLS.get(agent_name)
    if not base:
        raise HTTPException(404, f"Unknown agent: {agent_name}")
    url = f"{base}/{path}"
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.delete(url)
            try:
                return resp.json()
            except Exception:
                return {"raw": resp.text[:500], "status": resp.status_code}
        except Exception as e:
            return {"error": type(e).__name__, "detail": str(e)[:200]}


@app.patch("/api/agents/{agent_name}/{path:path}")
async def proxy_agent_patch(agent_name: str, path: str, request: Request):
    """Proxy PATCH requests to the multi-agent services."""
    _check_rate_limit(_get_ip(request))
    base = _AGENT_URLS.get(agent_name)
    if not base:
        raise HTTPException(404, f"Unknown agent: {agent_name}")
    url = f"{base}/{path}"
    body = await request.json()
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.patch(url, json=body)
            try:
                return resp.json()
            except Exception:
                return {"raw": resp.text[:500], "status": resp.status_code}
        except Exception as e:
            return {"error": type(e).__name__, "detail": str(e)[:200]}


@app.get("/api/agents-health")
async def agents_health():
    """Health check all five agents."""
    results = {}
    async with httpx.AsyncClient(timeout=8) as client:
        # Gateway
        try:
            resp = await client.get(f"{GATEWAY_REST_URL}/health")
            results["gateway"] = {"ok": resp.status_code == 200, "status": resp.status_code}
        except Exception as e:
            results["gateway"] = {"ok": False, "error": str(e)[:100]}
        # Agent services
        for name, url in _AGENT_URLS.items():
            try:
                resp = await client.get(f"{url}/health")
                results[name] = {"ok": resp.status_code == 200, "status": resp.status_code}
            except Exception as e:
                results[name] = {"ok": False, "error": str(e)[:100]}
    # Also fetch signing keys
    keys = {}
    async with httpx.AsyncClient(timeout=8) as client:
        try:
            resp = await client.get(f"{GATEWAY_REST_URL}/keys")
            gw_keys = resp.json().get("keys", [])
            if gw_keys:
                keys["gateway"] = gw_keys[0].get("kid", "?")
        except Exception:
            pass
        for name, url in _AGENT_URLS.items():
            key_path = f"{name}-keys" if name != "auditor" else "audit-keys"
            try:
                resp = await client.get(f"{url}/{key_path}")
                agent_keys = resp.json().get("keys", [])
                if agent_keys:
                    keys[name] = agent_keys[0].get("kid", "?")
            except Exception:
                pass
    return {"agents": results, "keys": keys}


@app.get("/api/activity-stream")
async def activity_stream(limit: int = 20):
    """Unified activity stream across all agents."""
    activities = []
    async with httpx.AsyncClient(timeout=10) as client:
        # Gateway receipts
        try:
            resp = await client.get(f"{GATEWAY_REST_URL}/chain")
            chain = resp.json()
            for r in (chain.get("receipts", []) or [])[-10:]:
                body = r.get("body", {})
                meta = r.get("_meta", {})
                activities.append({
                    "agent": "Gateway",
                    "type": "receipt",
                    "ts": body.get("ts", ""),
                    "summary": f"Receipt #{body.get('seq')} issued. {body.get('decision','?').upper()}. Agent {meta.get('agent_id','?')} {meta.get('action','?')} on {meta.get('resource','?')}.",
                    "data": {"seq": body.get("seq"), "decision": body.get("decision")},
                })
        except Exception:
            pass
        # Auditor reports
        try:
            resp = await client.get(f"{AUDITOR_URL}/audit-reports", params={"tenant": "hackathon-demo", "limit": 10})
            for r in resp.json().get("reports", []):
                b = r.get("body", {})
                activities.append({
                    "agent": "Auditor",
                    "type": "audit",
                    "ts": b.get("audited_at", ""),
                    "summary": f"Audit #{b.get('audit_id','?')[:8]}... Verdict {b.get('verdict','?')}. {len(b.get('citations',[]))} citations.",
                    "data": {"verdict": b.get("verdict"), "receipt_seq": b.get("receipt_seq")},
                })
        except Exception:
            pass
        # Recommender proposals
        try:
            resp = await client.get(f"{RECOMMENDER_URL}/proposals", params={"tenant": "hackathon-demo", "limit": 10})
            for p in resp.json().get("proposals", []):
                b = p.get("body", {})
                activities.append({
                    "agent": "Recommender",
                    "type": "proposal",
                    "ts": b.get("proposed_at", ""),
                    "summary": f"Proposal: {b.get('change_type','?')}. Confidence {b.get('confidence','?')}.",
                    "data": {"confidence": b.get("confidence")},
                })
        except Exception:
            pass
        # Investigator incidents
        try:
            resp = await client.get(f"{INVESTIGATOR_URL}/incidents", params={"tenant": "hackathon-demo", "limit": 10})
            for inc in resp.json().get("incidents", []):
                b = inc.get("body", {})
                activities.append({
                    "agent": "Investigator",
                    "type": "incident",
                    "ts": b.get("created_at", ""),
                    "summary": f"Incident: {b.get('severity','?')} severity. {b.get('executive_summary','')[:80]}...",
                    "data": {"severity": b.get("severity")},
                })
        except Exception:
            pass
    # Sort by timestamp descending
    activities.sort(key=lambda a: a.get("ts", ""), reverse=True)
    return {"activities": activities[:limit]}


@app.get("/api/health")
async def health():
    checks = {}
    async with httpx.AsyncClient(timeout=5) as client:
        for name, url in [
            ("gateway_rest", f"{GATEWAY_REST_URL}/health"),
            ("gateway_mcp", GATEWAY_MCP_URL),
            ("resource", f"{RESOURCE_URL}/health"),
        ]:
            try:
                resp = await client.get(url)
                checks[name] = {"reachable": True, "status": resp.status_code}
            except Exception as e:
                checks[name] = {"reachable": False, "error": str(e)[:100]}

        # MCP returns 401 when reachable (transport auth), which is correct
        if checks.get("gateway_mcp", {}).get("status") == 401:
            checks["gateway_mcp"]["reachable"] = True
            checks["gateway_mcp"]["note"] = "401 = transport auth active (expected)"

        # Fetch public key fingerprint
        try:
            resp = await client.get(f"{GATEWAY_REST_URL}/keys")
            keys = resp.json().get("keys", [])
            checks["public_keys"] = [{"kid": k.get("kid"), "alg": k.get("alg")} for k in keys[:5]]
        except Exception as e:
            checks["public_keys"] = {"error": str(e)[:100]}

    checks["config"] = {
        "gateway_rest_url": GATEWAY_REST_URL,
        "gateway_mcp_url": GATEWAY_MCP_URL,
        "resource_url": RESOURCE_URL,
        "bearer_configured": bool(MCP_BEARER_TOKEN),
    }
    return checks
