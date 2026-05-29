"""Agent identity — Ed25519 keypair, action_digest, and DPoP proof.

Implemented independently from the Receipt Chain Verification Protocol v0.3
(docs/protocol.md). Zero imports from the gateway codebase.

Key decisions documented inline with spec section references.
"""

from __future__ import annotations

import base64
import hashlib
import json
import math
import os
import time
import uuid
from pathlib import Path

import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)

KEY_FILE = "agent_key.pem"


# =============================================================================
# Ed25519 keypair management
# =============================================================================

def load_or_generate_keypair(key_path: str = KEY_FILE) -> Ed25519PrivateKey:
    """Load an existing Ed25519 private key from PEM, or generate and persist one."""
    p = Path(key_path)
    if p.exists():
        from cryptography.hazmat.primitives.serialization import load_pem_private_key
        key_data = p.read_bytes()
        return load_pem_private_key(key_data, password=None)

    private_key = Ed25519PrivateKey.generate()
    pem = private_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
    p.write_bytes(pem)
    return private_key


def public_key_jwk(private_key: Ed25519PrivateKey) -> dict:
    """Export the public key as a JWK per spec §Agent Registration / JWK Format.

    Returns {"kty": "OKP", "crv": "Ed25519", "x": "<base64url, no padding>"}.
    """
    pub_bytes = private_key.public_key().public_bytes_raw()
    x = base64.urlsafe_b64encode(pub_bytes).rstrip(b"=").decode("ascii")
    return {"kty": "OKP", "crv": "Ed25519", "x": x}


# =============================================================================
# RFC 8785 JCS canonicalization (independent implementation from spec §3)
# =============================================================================

def _jcs_compare_keys(a: str, b: str) -> int:
    """Compare keys by UTF-16 code unit values per RFC 8785 §3.2.3."""
    a_units = _to_utf16_units(a)
    b_units = _to_utf16_units(b)
    for au, bu in zip(a_units, b_units):
        if au < bu:
            return -1
        if au > bu:
            return 1
    if len(a_units) < len(b_units):
        return -1
    if len(a_units) > len(b_units):
        return 1
    return 0


def _to_utf16_units(s: str) -> list[int]:
    """Convert a string to a list of UTF-16 code units (for JCS key sorting)."""
    units = []
    for ch in s:
        cp = ord(ch)
        if cp <= 0xFFFF:
            units.append(cp)
        else:
            cp -= 0x10000
            units.append(0xD800 + (cp >> 10))
            units.append(0xDC00 + (cp & 0x3FF))
    return units


def _jcs_serialize(obj: object) -> str:
    """Serialize a Python object to JCS canonical form (RFC 8785 subset)."""
    if obj is None:
        return "null"
    if isinstance(obj, bool):
        return "true" if obj else "false"
    if isinstance(obj, int) and not isinstance(obj, bool):
        return str(obj)
    if isinstance(obj, float):
        raise ValueError("Floating-point values are forbidden in v0.1 canonicalization")
    if isinstance(obj, str):
        return _jcs_serialize_string(obj)
    if isinstance(obj, list):
        return "[" + ",".join(_jcs_serialize(item) for item in obj) + "]"
    if isinstance(obj, dict):
        import functools
        sorted_keys = sorted(obj.keys(), key=functools.cmp_to_key(_jcs_compare_keys))
        pairs = [_jcs_serialize_string(k) + ":" + _jcs_serialize(obj[k]) for k in sorted_keys]
        return "{" + ",".join(pairs) + "}"
    raise ValueError(f"Unsupported type for JCS: {type(obj)}")


def _jcs_serialize_string(s: str) -> str:
    """Serialize a string with minimal JSON escaping per RFC 8785."""
    out = ['"']
    for ch in s:
        cp = ord(ch)
        if ch == '"':
            out.append('\\"')
        elif ch == '\\':
            out.append('\\\\')
        elif ch == '\b':
            out.append('\\b')
        elif ch == '\f':
            out.append('\\f')
        elif ch == '\n':
            out.append('\\n')
        elif ch == '\r':
            out.append('\\r')
        elif ch == '\t':
            out.append('\\t')
        elif cp < 0x20:
            out.append(f'\\u{cp:04x}')
        else:
            out.append(ch)
    out.append('"')
    return ''.join(out)


def canonicalize(obj: object) -> bytes:
    """Canonicalize a Python object to JCS bytes (UTF-8)."""
    return _jcs_serialize(obj).encode("utf-8")


# =============================================================================
# Action Digest — per spec §Action Digest Computation
# =============================================================================

def compute_action_digest(
    agent_id: str,
    action: str,
    resource: str,
    parameters: dict | None = None,
) -> str:
    """Compute action_digest per spec §Action Digest Computation.

    Spec algorithm:
    1. Build intent object: {"agent_id", "action", "resource"} + "parameters" if non-empty.
    2. Canonicalize via RFC 8785 JCS (keys sorted by UTF-16 code units).
    3. SHA-256 the canonical bytes.
    4. Return "sha256:" + lowercase hex digest.

    The `parameters` key is OMITTED when parameters is None, not provided,
    or an empty dict (falsy guard — spec §Action Digest, step 2).
    """
    intent = {
        "agent_id": agent_id,
        "action": action,
        "resource": resource,
    }
    if parameters:  # falsy guard: None, {}, absent → omit
        intent["parameters"] = parameters

    canonical_bytes = canonicalize(intent)
    return "sha256:" + hashlib.sha256(canonical_bytes).hexdigest()


# =============================================================================
# Conformance self-test — run at import to catch digest bugs immediately
# =============================================================================

def _conformance_check():
    """Verify compute_action_digest matches the spec's worked examples.

    CASE A: non-empty parameters (spec §Action Digest / Worked Example)
    CASE B: empty parameters (verified against gateway's real output)

    If either fails, raise immediately — every downstream proof will be rejected.
    """
    # CASE A: non-empty params
    digest_a = compute_action_digest(
        agent_id="worker-analytics-01",
        action="read",
        resource="staging-database",
        parameters={"query": "SELECT * FROM users LIMIT 10"},
    )
    expected_a = "sha256:002943d4252274c353a8533f2992027a3b1c0448c1d69ecb0c65481ee27beee5"
    if digest_a != expected_a:
        raise AssertionError(
            f"CONFORMANCE FAILURE (CASE A, non-empty params):\n"
            f"  expected: {expected_a}\n"
            f"  got:      {digest_a}"
        )

    # CASE B: empty params (verified against gateway compute_action_digest output)
    digest_b = compute_action_digest(
        agent_id="worker-analytics-01",
        action="read",
        resource="staging-database",
        parameters={},
    )
    expected_b = "sha256:d6eca099654632577774e95d6de45feddc17dc693dfd03077a6ffdd4f760fb47"
    if digest_b != expected_b:
        raise AssertionError(
            f"CONFORMANCE FAILURE (CASE B, empty params):\n"
            f"  expected: {expected_b}\n"
            f"  got:      {digest_b}"
        )

# Run at import — fail fast if canonicalization is wrong
_conformance_check()


# =============================================================================
# DPoP Proof — per spec §Agent Identity & Proof of Possession
# =============================================================================

def create_dpop_proof(
    private_key: Ed25519PrivateKey,
    agent_id: str,
    action: str,
    resource: str,
    parameters: dict | None = None,
    gateway_url: str = "agent-authorization-gateway",
) -> str:
    """Create a DPoP-style proof JWT per spec v0.3.

    The proof ALWAYS includes action_digest (mandatory in v0.3).
    htm/htu are included by convention per RFC 9449 (not yet enforced by
    the gateway in v0.3, but forward-compatible).
    """
    action_digest = compute_action_digest(agent_id, action, resource, parameters)
    now = time.time()
    payload = {
        "sub": agent_id,
        "htm": "POST",
        "htu": gateway_url,
        "action": action,
        "resource": resource,
        "jti": str(uuid.uuid4()),
        "iat": int(now),
        "action_digest": action_digest,
    }
    return pyjwt.encode(payload, private_key, algorithm="EdDSA")
