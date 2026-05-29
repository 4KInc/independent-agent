"""Configuration — all URLs and credentials from environment variables.

The CLIENT reads MCP_BEARER_TOKEN; the GATEWAY reads MCP_AUTH_TOKEN.
These are the same value but different env var names on each side.
"""

import os

GATEWAY_MCP_URL = os.environ.get("GATEWAY_MCP_URL", "http://localhost:8090/mcp")
GATEWAY_REST_URL = os.environ.get("GATEWAY_REST_URL", "http://localhost:8080")
RESOURCE_URL = os.environ.get("RESOURCE_URL", "http://localhost:8081")
GATEWAY_KEYS_URL = os.environ.get("GATEWAY_KEYS_URL", "http://localhost:8080/keys")

# Client-side env var for the MCP bearer token.
# The gateway reads this same value from MCP_AUTH_TOKEN on its side.
MCP_BEARER_TOKEN = os.environ.get("MCP_BEARER_TOKEN", "")
