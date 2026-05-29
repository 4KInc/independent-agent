#!/usr/bin/env python3
"""Compliant Agent — full honest authorize-then-execute flow.

Demonstrates end-to-end interoperability with the Agent Authorization Gateway
from an independent client, built from the v0.3 protocol spec alone.

Usage:
    python compliant_agent.py              # deterministic (--no-llm default)
    python compliant_agent.py --llm "get customer data"  # LangChain picks action

Env vars: GATEWAY_MCP_URL, RESOURCE_URL, MCP_BEARER_TOKEN, GATEWAY_KEYS_URL
"""

import argparse
import asyncio
import json
import sys

import jwt as pyjwt

import config
from agent.identity import load_or_generate_keypair, public_key_jwk, compute_action_digest
from agent.agent import pick_action_deterministic, pick_action_llm
import agent.gateway_client as gw
import agent.resource_client as rc


AGENT_ID = "independent-agent-01"


async def run(use_llm: bool = False, user_request: str = ""):
    print("=" * 60)
    print("  COMPLIANT AGENT — Independent Client (v0.3 Protocol)")
    print("=" * 60)
    print(f"  Gateway MCP: {config.GATEWAY_MCP_URL}")
    print(f"  Resource:    {config.RESOURCE_URL}")
    print()

    # Step 1: Generate/load identity
    print("[1] Loading Ed25519 identity...")
    private_key = load_or_generate_keypair()
    jwk = public_key_jwk(private_key)
    print(f"    Public key (x): {jwk['x'][:20]}...")
    print()

    # Step 2: Register with the gateway (MCP — framework-agnostic)
    print("[2] Registering with the gateway (MCP)...")
    reg = await gw.register(
        config.GATEWAY_MCP_URL, config.MCP_BEARER_TOKEN, AGENT_ID, private_key,
    )
    if "error" in reg:
        print(f"    Registration failed: {reg}")
        return 1
    print(f"    Registered: agent_id={reg.get('agent_id')}, kid={reg.get('kid')}")
    print()

    # Step 3: Choose action(s)
    if use_llm:
        print(f"[3] LLM choosing action for: '{user_request}'...")
        action_info = pick_action_llm(user_request)
        actions = [action_info]
    else:
        print("[3] Deterministic action selection (--no-llm)...")
        actions = pick_action_deterministic()

    for i, act in enumerate(actions):
        action = act["action"]
        resource = act["resource"]
        desc = act.get("description", f"{action} on {resource}")
        print(f"\n{'─' * 50}")
        print(f"  Action {i+1}: {desc}")
        print(f"{'─' * 50}")

        # Step 4: Authorize via gateway (MCP — framework-agnostic)
        print(f"[4] Authorizing: {action} on {resource}...")
        auth_result = await gw.authorize(
            config.GATEWAY_MCP_URL, config.MCP_BEARER_TOKEN,
            private_key, AGENT_ID, action, resource,
        )

        if "error" in auth_result:
            print(f"    Authorization error: {auth_result['error']}")
            print(f"    Detail: {auth_result.get('detail', '')}")
            continue

        decision = auth_result.get("decision")
        token = auth_result.get("token")
        receipt_hash = auth_result.get("receipt_hash", "")
        action_digest = auth_result.get("action_digest", "")

        print(f"    Decision:      {decision}")
        print(f"    Receipt hash:  {receipt_hash[:40]}...")
        print(f"    Action digest: {action_digest[:40]}...")

        if decision != "approve" or not token:
            print(f"    Reason codes:  {auth_result.get('reason_codes', [])}")
            print(f"    Token:         NONE (correctly withheld)")
            continue

        print(f"    Token:         {token[:40]}...")

        # Step 5: Use token at the protected resource
        print(f"[5] Calling protected resource with token...")
        try:
            res = await rc.call_resource(config.RESOURCE_URL, "/customers/c1", token)
            print(f"    Status:   {res['status_code']}")
            print(f"    Accepted: {res['accepted']}")
            if res["accepted"]:
                body = res["body"]
                if isinstance(body, dict):
                    print(f"    Data:     {json.dumps(body)[:80]}...")
        except Exception as e:
            print(f"    Resource unavailable: {type(e).__name__} (token was issued successfully)")
            print(f"    Token can be verified independently using the gateway's public key.")

        # Step 6: Verify token.jti == receipt.token_jti
        print(f"[6] Verifying token.jti == receipt.token_jti...")
        try:
            token_claims = pyjwt.decode(token, options={"verify_signature": False})
            token_jti = token_claims.get("jti", "")
            print(f"    Token JTI: {token_jti}")

            # Fetch the receipt chain to find the matching receipt
            chain = await gw.get_receipt_chain(
                config.GATEWAY_MCP_URL, config.MCP_BEARER_TOKEN,
            )
            receipt_list = chain if isinstance(chain, list) else []
            matching = [r for r in receipt_list if r.get("receipt_hash") == receipt_hash]

            if matching:
                receipt_token_jti = matching[0].get("body", {}).get("token_jti", "")
                print(f"    Receipt token_jti: {receipt_token_jti}")
                if token_jti == receipt_token_jti:
                    print(f"    MATCH: token.jti == receipt.token_jti  [PASS]")
                else:
                    print(f"    MISMATCH: {token_jti} != {receipt_token_jti}  [FAIL]")
            else:
                print(f"    Could not find receipt with hash {receipt_hash[:30]}... in chain ({len(receipt_list)} receipts)")
                print(f"    JTI comparison: INCONCLUSIVE")
        except Exception as e:
            print(f"    JTI comparison error: {e}")

    print()
    print("=" * 60)
    print("  COMPLIANT AGENT: COMPLETE")
    print("=" * 60)
    return 0


def main():
    parser = argparse.ArgumentParser(description="Independent compliant agent")
    parser.add_argument("--llm", type=str, default="", help="User request for LLM action selection")
    parser.add_argument("--no-llm", action="store_true", default=True, help="Deterministic mode (default)")
    args = parser.parse_args()

    use_llm = bool(args.llm)
    sys.exit(asyncio.run(run(use_llm=use_llm, user_request=args.llm)))


if __name__ == "__main__":
    main()
