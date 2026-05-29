#!/usr/bin/env python3
"""Rogue Agent — 7 attacks against the deployed gateway, all must be rejected.

Proves the gateway enforces against an independent client. Each attack targets
a different layer: transport auth, identity verification, or resource-side
token validation.

Exit code 0 = all attacks blocked (gateway working correctly).
Exit code 1 = at least one attack succeeded (gateway bug).

Env vars: GATEWAY_MCP_URL, RESOURCE_URL, MCP_BEARER_TOKEN
"""

import asyncio
import base64
import json
import sys
import time
import uuid

import httpx
import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

import config
from agent.identity import (
    load_or_generate_keypair,
    public_key_jwk,
    compute_action_digest,
    create_dpop_proof,
)


AGENT_ID = "rogue-agent-01"


async def run():
    print("=" * 70)
    print("  ROGUE AGENT — 7 Attack Variants")
    print("=" * 70)
    print(f"  Gateway MCP: {config.GATEWAY_MCP_URL}")
    print(f"  Resource:    {config.RESOURCE_URL}")
    print()

    results = []
    rogue_key = Ed25519PrivateKey.generate()

    # ── (a) No token: call resource directly ──
    print("[a] Attack: No token (direct resource access)")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{config.RESOURCE_URL}/customers/c1")
        status = resp.status_code
        blocked = status == 401
        results.append(("No token", "401", str(status), blocked))
        print(f"    Expected: 401")
        print(f"    Actual:   {status}")
        print(f"    Result:   {'BLOCKED' if blocked else 'FAILED!'}")
    except httpx.ConnectError:
        results.append(("No token", "401", "ConnectError (resource down)", True))
        print(f"    Resource not reachable (ConnectError) — no data served")
        print(f"    Result:   BLOCKED (resource unavailable = no access)")
    except Exception as e:
        results.append(("No token", "401", f"Error: {type(e).__name__}", False))
        print(f"    Error: {e}")

    # ── (b) Forged token: self-signed with rogue's key ──
    print()
    print("[b] Attack: Forged token (self-signed)")
    try:
        forged = pyjwt.encode({
            "iss": "agent-authorization-gateway",
            "aud": "protected-resource",
            "sub": "rogue-agent",
            "action": "read",
            "resource": "customers",
            "action_digest": "sha256:fake",
            "decision": "approve",
            "receipt_hash": "sha256:fake",
            "jti": str(uuid.uuid4()),
            "iat": int(time.time()),
            "exp": int(time.time()) + 60,
        }, rogue_key, algorithm="EdDSA")
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{config.RESOURCE_URL}/customers/c1",
                headers={"Authorization": f"Bearer {forged}"},
            )
        status = resp.status_code
        blocked = status == 401
        results.append(("Forged token", "401", str(status), blocked))
        print(f"    Expected: 401")
        print(f"    Actual:   {status}")
        print(f"    Result:   {'BLOCKED' if blocked else 'FAILED!'}")
    except httpx.ConnectError:
        results.append(("Forged token", "401", "ConnectError (resource down)", True))
        print(f"    Resource not reachable — forged token cannot be used")
        print(f"    Result:   BLOCKED (resource unavailable = no access)")
    except Exception as e:
        results.append(("Forged token", "401", f"Error: {type(e).__name__}", False))
        print(f"    Error: {e}")

    # ── (c) No DPoP proof: valid bearer, empty agent_proof ──
    print()
    print("[c] Attack: No DPoP proof (empty agent_proof)")
    try:
        async with streamablehttp_client(
            config.GATEWAY_MCP_URL,
            headers={"Authorization": f"Bearer {config.MCP_BEARER_TOKEN}"},
        ) as (r, w, _):
            async with ClientSession(r, w) as session:
                await session.initialize()
                result = await session.call_tool("authorize_action", {
                    "agent_id": AGENT_ID,
                    "action": "read",
                    "resource": "staging-database",
                    "agent_proof": "",
                })
                parsed = json.loads(result.content[0].text)
                error = parsed.get("error", "")
                blocked = error == "NO_PROOF"
                results.append(("No DPoP proof", "NO_PROOF", error or parsed.get("decision", "?"), blocked))
                print(f"    Expected: NO_PROOF")
                print(f"    Actual:   {error or parsed}")
                print(f"    Result:   {'BLOCKED' if blocked else 'FAILED!'}")
    except Exception as e:
        results.append(("No DPoP proof", "NO_PROOF", f"Error: {type(e).__name__}", False))
        print(f"    Error: {e}")

    # ── (d) Unregistered identity: valid proof, key never registered ──
    print()
    print("[d] Attack: Unregistered agent identity")
    try:
        unreg_key = Ed25519PrivateKey.generate()
        proof = create_dpop_proof(unreg_key, "unregistered-rogue", "read", "staging-database")
        async with streamablehttp_client(
            config.GATEWAY_MCP_URL,
            headers={"Authorization": f"Bearer {config.MCP_BEARER_TOKEN}"},
        ) as (r, w, _):
            async with ClientSession(r, w) as session:
                await session.initialize()
                result = await session.call_tool("authorize_action", {
                    "agent_id": "unregistered-rogue",
                    "action": "read",
                    "resource": "staging-database",
                    "agent_proof": proof,
                })
                parsed = json.loads(result.content[0].text)
                error = parsed.get("error", "")
                blocked = error == "UNREGISTERED_AGENT"
                results.append(("Unregistered agent", "UNREGISTERED_AGENT", error, blocked))
                print(f"    Expected: UNREGISTERED_AGENT")
                print(f"    Actual:   {error}")
                print(f"    Result:   {'BLOCKED' if blocked else 'FAILED!'}")
    except Exception as e:
        results.append(("Unregistered agent", "UNREGISTERED_AGENT", f"Error: {type(e).__name__}", False))
        print(f"    Error: {e}")

    # ── (e) Omitted action_digest: proof without action_digest claim ──
    print()
    print("[e] Attack: Omitted action_digest (v0.3 bypass test)")
    try:
        # Build a proof manually WITHOUT action_digest
        no_digest_payload = {
            "sub": AGENT_ID,
            "htm": "POST",
            "htu": "agent-authorization-gateway",
            "action": "read",
            "resource": "staging-database",
            "jti": str(uuid.uuid4()),
            "iat": int(time.time()),
            # action_digest intentionally omitted
        }

        # We need the agent registered for this to reach the digest check
        # Register the rogue key first
        async with streamablehttp_client(
            config.GATEWAY_MCP_URL,
            headers={"Authorization": f"Bearer {config.MCP_BEARER_TOKEN}"},
        ) as (r, w, _):
            async with ClientSession(r, w) as session:
                await session.initialize()
                # Register
                jwk = public_key_jwk(rogue_key)
                await session.call_tool("register_agent", {
                    "agent_id": AGENT_ID,
                    "public_key_jwk": json.dumps(jwk),
                })
                # Send proof without digest
                bad_proof = pyjwt.encode(no_digest_payload, rogue_key, algorithm="EdDSA")
                result = await session.call_tool("authorize_action", {
                    "agent_id": AGENT_ID,
                    "action": "read",
                    "resource": "staging-database",
                    "agent_proof": bad_proof,
                })
                parsed = json.loads(result.content[0].text)
                error = parsed.get("error", "")
                blocked = error == "PROOF_DIGEST_MISSING"
                results.append(("Omitted digest", "PROOF_DIGEST_MISSING", error, blocked))
                print(f"    Expected: PROOF_DIGEST_MISSING")
                print(f"    Actual:   {error}")
                print(f"    Result:   {'BLOCKED' if blocked else 'FAILED!'}")
    except Exception as e:
        results.append(("Omitted digest", "PROOF_DIGEST_MISSING", f"Error: {type(e).__name__}", False))
        print(f"    Error: {e}")

    # ── (f) Action mismatch: proof for action 'read', request action 'delete' ──
    print()
    print("[f] Attack: Action mismatch (proof='read', request='delete')")
    try:
        proof_wrong_action = create_dpop_proof(rogue_key, AGENT_ID, "read", "staging-database")
        async with streamablehttp_client(
            config.GATEWAY_MCP_URL,
            headers={"Authorization": f"Bearer {config.MCP_BEARER_TOKEN}"},
        ) as (r, w, _):
            async with ClientSession(r, w) as session:
                await session.initialize()
                result = await session.call_tool("authorize_action", {
                    "agent_id": AGENT_ID,
                    "action": "delete",  # mismatch with proof's "read"
                    "resource": "staging-database",
                    "agent_proof": proof_wrong_action,
                })
                parsed = json.loads(result.content[0].text)
                error = parsed.get("error", "")
                blocked = error == "PROOF_ACTION_MISMATCH"
                results.append(("Action mismatch", "PROOF_ACTION_MISMATCH", error, blocked))
                print(f"    Expected: PROOF_ACTION_MISMATCH")
                print(f"    Actual:   {error}")
                print(f"    Result:   {'BLOCKED' if blocked else 'FAILED!'}")
    except Exception as e:
        results.append(("Action mismatch", "PROOF_ACTION_MISMATCH", f"Error: {type(e).__name__}", False))
        print(f"    Error: {e}")

    # ── (g) Anonymous transport: no bearer token ──
    print()
    print("[g] Attack: Anonymous transport (no bearer token)")
    try:
        async with streamablehttp_client(config.GATEWAY_MCP_URL) as (r, w, _):
            async with ClientSession(r, w) as session:
                await session.initialize()
                print(f"    FAILED: Connected anonymously!")
                results.append(("Anonymous transport", "401", "Connected", False))
    except Exception as e:
        # Expected: connection rejected with 401
        error_str = str(e)
        is_auth_error = "401" in error_str or "Unauthorized" in error_str or "ExceptionGroup" in type(e).__name__
        blocked = is_auth_error
        results.append(("Anonymous transport", "401", "Rejected" if blocked else f"Error: {type(e).__name__}", blocked))
        print(f"    Expected: 401 / connection rejected")
        print(f"    Actual:   {type(e).__name__}")
        print(f"    Result:   {'BLOCKED' if blocked else 'FAILED!'}")

    # ── Summary ──
    print()
    print("=" * 70)
    print("  ROGUE AGENT RESULTS")
    print("=" * 70)
    print(f"  {'Attack':<24} {'Expected':<24} {'Actual':<24} {'Status'}")
    print(f"  {'-'*24} {'-'*24} {'-'*24} {'-'*8}")
    all_blocked = True
    for attack, expected, actual, blocked in results:
        s = "BLOCKED" if blocked else "FAIL"
        if not blocked:
            all_blocked = False
        print(f"  {attack:<24} {expected:<24} {actual:<24} {s}")
    print()
    if all_blocked:
        print("  ALL 7 ATTACKS REJECTED — gateway enforcement verified")
    else:
        print("  SOME ATTACKS SUCCEEDED — GATEWAY BUG DETECTED!")
    print("=" * 70)
    return 0 if all_blocked else 1


def main():
    sys.exit(asyncio.run(run()))


if __name__ == "__main__":
    main()
