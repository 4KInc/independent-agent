"""HTTP client for the protected resource.

Calls the resource with a gateway-issued token as Bearer auth.
Zero gateway imports.
"""

from __future__ import annotations

import httpx


async def call_resource(
    resource_url: str,
    path: str,
    token: str,
    method: str = "GET",
) -> dict:
    """Call the protected resource with a gateway-issued token.

    Returns {"status_code": int, "body": dict|str, "accepted": bool}.
    """
    url = f"{resource_url.rstrip('/')}/{path.lstrip('/')}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(timeout=15) as client:
        if method.upper() == "GET":
            resp = await client.get(url, headers=headers)
        elif method.upper() == "DELETE":
            resp = await client.delete(url, headers=headers)
        else:
            resp = await client.request(method, url, headers=headers)

    try:
        body = resp.json()
    except Exception:
        body = resp.text

    return {
        "status_code": resp.status_code,
        "body": body,
        "accepted": 200 <= resp.status_code < 300,
    }
