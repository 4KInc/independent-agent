"""MCP client for the Agent Authorization Gateway.

Connects over the wire via streamablehttp_client. Zero gateway imports.
Implements register, authorize, and key fetch per protocol v0.3.
"""

from __future__ import annotations

import json
from typing import Any

from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

from agent.identity import (
    Ed25519PrivateKey,
    create_dpop_proof,
    public_key_jwk,
)


async def _call_tool(
    mcp_url: str,
    bearer_token: str,
    tool_name: str,
    arguments: dict[str, Any],
) -> dict:
    """Connect to the MCP gateway, call one tool, return parsed JSON result."""
    headers = {}
    if bearer_token:
        headers["Authorization"] = f"Bearer {bearer_token}"

    async with streamablehttp_client(mcp_url, headers=headers) as (r, w, _):
        async with ClientSession(r, w) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            text = result.content[0].text if result.content else "{}"
            return json.loads(text)


async def register(
    mcp_url: str,
    bearer_token: str,
    agent_id: str,
    private_key: Ed25519PrivateKey,
) -> dict:
    """Register the agent's public key with the gateway.

    Calls register_agent MCP tool per spec §Agent Registration.
    public_key_jwk is passed as a JSON string (double-encoded per spec).
    """
    jwk = public_key_jwk(private_key)
    jwk_json_string = json.dumps(jwk)

    return await _call_tool(mcp_url, bearer_token, "register_agent", {
        "agent_id": agent_id,
        "public_key_jwk": jwk_json_string,
    })


async def authorize(
    mcp_url: str,
    bearer_token: str,
    private_key: Ed25519PrivateKey,
    agent_id: str,
    action: str,
    resource: str,
    parameters: dict | None = None,
) -> dict:
    """Authorize an action via the gateway.

    Computes action_digest, builds a DPoP proof, calls authorize_action.
    Returns the parsed response dict (decision, token, receipt_hash, etc.).
    """
    proof = create_dpop_proof(private_key, agent_id, action, resource, parameters)

    params_json = json.dumps(parameters) if parameters else "{}"

    return await _call_tool(mcp_url, bearer_token, "authorize_action", {
        "agent_id": agent_id,
        "action": action,
        "resource": resource,
        "agent_proof": proof,
        "parameters": params_json,
    })


async def get_public_key(mcp_url: str, bearer_token: str) -> dict:
    """Fetch the gateway's Ed25519 signing public key (JWK)."""
    return await _call_tool(mcp_url, bearer_token, "get_public_key", {})


async def get_receipt_chain(mcp_url: str, bearer_token: str) -> list[dict]:
    """Fetch the full receipt chain from the gateway."""
    result = await _call_tool(mcp_url, bearer_token, "get_receipt_chain", {})
    if isinstance(result, list):
        return result
    return result


async def register_rest(
    gateway_rest_url: str,
    agent_id: str,
    private_key: Ed25519PrivateKey,
) -> dict:
    """Register via REST API (POST /agents/register). No MCP needed."""
    import httpx
    jwk = public_key_jwk(private_key)
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{gateway_rest_url.rstrip('/')}/agents/register",
            json={"agent_id": agent_id, "public_key": jwk},
        )
        return resp.json()


async def authorize_rest(
    gateway_rest_url: str,
    private_key: Ed25519PrivateKey,
    agent_id: str,
    action: str,
    resource: str,
    parameters: dict | None = None,
) -> dict:
    """Authorize via REST API (POST /authorize). Returns same shape as MCP."""
    import httpx
    proof = create_dpop_proof(private_key, agent_id, action, resource, parameters)
    params_dict = parameters if parameters else None
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{gateway_rest_url.rstrip('/')}/authorize",
            json={
                "agent_id": agent_id,
                "action": action,
                "resource": resource,
                "agent_proof": proof,
                "parameters": params_dict,
            },
        )
        if resp.status_code == 401:
            return {"error": resp.json().get("detail", ""), "detail": str(resp.json())}
        return resp.json()


async def get_chain_rest(gateway_rest_url: str) -> list[dict]:
    """Fetch receipt chain via REST API (GET /chain)."""
    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{gateway_rest_url.rstrip('/')}/chain")
        data = resp.json()
        return data.get("receipts", [])
