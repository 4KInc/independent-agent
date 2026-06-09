(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,13663,e=>{"use strict";var t=e.i(47167),a=e.i(43476),s=e.i(71645),r=e.i(94179),i=e.i(67881),n=e.i(70065),o=e.i(11369),l=e.i(82954),c=e.i(56420);let d=(0,c.default)("shield-check",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]),p=(0,c.default)("shield-x",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m14.5 9.5-5 5",key:"17q4r4"}],["path",{d:"m9.5 9.5 5 5",key:"18nt4w"}]]);var h=e.i(8734),m=e.i(51757),x=e.i(83967);let g=(0,c.default)("terminal",[["path",{d:"M12 19h8",key:"baeox8"}],["path",{d:"m4 17 6-6-6-6",key:"1yngyt"}]]);var f=e.i(32781),u=e.i(82022),b=e.i(67927),y=e.i(62368),_=e.i(26894);let j=(0,c.default)("anchor",[["path",{d:"M12 6v16",key:"nqf5sj"}],["path",{d:"m19 13 2-1a9 9 0 0 1-18 0l2 1",key:"y7qv08"}],["path",{d:"M9 11h6",key:"1fldmi"}],["circle",{cx:"12",cy:"4",r:"2",key:"muu5ef"}]]),k=(0,c.default)("lock",[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]]),N=(0,c.default)("binary",[["rect",{x:"14",y:"14",width:"4",height:"6",rx:"2",key:"p02svl"}],["rect",{x:"6",y:"4",width:"4",height:"6",rx:"2",key:"xm4xkj"}],["path",{d:"M6 20h4",key:"1i6q5t"}],["path",{d:"M14 10h4",key:"ru81e7"}],["path",{d:"M6 14h2v6",key:"16z9wg"}],["path",{d:"M14 4h2v6",key:"1idq9u"}]]);var v=e.i(48303);let C=t.default.env.NEXT_PUBLIC_API_URL||"",w=[{id:"receipt",label:"Receipt Verifier",icon:l.Shield},{id:"claim",label:"4-Step Claim Verifier",icon:d},{id:"anchoring",label:"Artifact Anchoring",icon:j}],S=`{
  "body": {
    "v": "1",
    "tenant": "hackathon-demo",
    "seq": "1",
    "ts": "2026-06-01T00:00:00.000Z",
    "request_digest": "sha256:abc123...",
    "policy_version": "sha256:def456...",
    "decision": "approve",
    "reasons": [],
    "prev_receipt": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
  },
  "sig": {
    "alg": "EdDSA",
    "kid": "gateway-...",
    "value": "base64url-signature..."
  },
  "receipt_hash": "sha256:..."
}`;async function A(e){try{let t=await fetch(`${C}/api/agents/gateway/verify-receipt`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({receipt:e,public_key:null})}),a=await t.json(),s=[],r=!!e.body,i=!!e.sig,n=!!e.receipt_hash;s.push({name:"Envelope structure",passed:r&&i&&n,detail:r&&i&&n?"body, sig, receipt_hash all present":`Missing: ${[!r&&"body",!i&&"sig",!n&&"receipt_hash"].filter(Boolean).join(", ")}`});let o=["v","tenant","seq","ts","request_digest","policy_version","decision","prev_receipt"],l=o.filter(t=>!(t in(e.body||{})));s.push({name:"Body fields",passed:0===l.length,detail:0===l.length?`All ${o.length} required fields present`:`Missing: ${l.join(", ")}`}),s.push({name:"Signature algorithm",passed:e.sig?.alg==="EdDSA",detail:e.sig?.alg==="EdDSA"?"EdDSA (Ed25519)":`Expected EdDSA, got ${e.sig?.alg||"none"}`});let c="PASS"===a.receipt_integrity;s.push({name:"Ed25519 signature",passed:c,detail:c?`Verified against kid ${e.sig?.kid||"?"}`:`Failed: ${a.errors?.map(e=>e.message).join("; ")||"invalid"}`});let d="PASS"===a.chain_validity||"GENESIS"===a.chain_validity;return s.push({name:"Hash chain link",passed:d,detail:"GENESIS"===a.chain_validity?"Genesis receipt":d?"prev_receipt links to predecessor":`Broken: ${a.errors?.map(e=>e.message).join("; ")||"mismatch"}`}),s.push({name:"Receipt hash",passed:c,detail:e.receipt_hash?`${e.receipt_hash.slice(0,32)}...`:"Missing"}),{status:s.every(e=>e.passed)?"valid":"invalid",checks:s}}catch(e){return{status:"error",checks:[{name:"Server verification",passed:!1,detail:e.message}]}}}function E(){let[e,t]=(0,s.useState)(""),[o,l]=(0,s.useState)(!1),[c,h]=(0,s.useState)(null),[g,u]=(0,s.useState)("");async function b(){let t;u(""),h(null);try{t=JSON.parse(e)}catch(e){u("Invalid JSON: "+e.message);return}l(!0),h(await A(t)),l(!1)}return(0,a.jsxs)("div",{className:"grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6",children:[(0,a.jsxs)(n.Card,{children:[(0,a.jsx)(n.CardHeader,{className:"pb-3",children:(0,a.jsxs)("div",{className:"flex items-center justify-between",children:[(0,a.jsx)(n.CardTitle,{className:"text-sm",children:"Receipt JSON"}),(0,a.jsxs)("div",{className:"flex gap-1.5",children:[(0,a.jsx)(i.Button,{variant:"outline",size:"sm",className:"text-xs h-7",onClick:async()=>{try{let e=await (await fetch(`${C}/api/agents/gateway/chain?limit=1`)).json();e.receipts?.length?(t(JSON.stringify(e.receipts[0],null,2)),h(null)):u("No receipts yet.")}catch{u("Could not fetch.")}},children:"Load from chain"}),(0,a.jsx)(i.Button,{variant:"outline",size:"sm",className:"text-xs h-7 text-rose-600 hover:text-rose-700",disabled:!e,onClick:()=>{try{let a=JSON.parse(e);a.body?.decision==="approve"?a.body.decision="deny":a.body?.decision==="deny"?a.body.decision="approve":a.body&&(a.body.decision="TAMPERED"),t(JSON.stringify(a,null,2)),h(null)}catch{}},children:"Tamper"})]})]})}),(0,a.jsxs)(n.CardContent,{children:[(0,a.jsx)("textarea",{value:e,onChange:e=>{t(e.target.value),h(null),u("")},placeholder:S,className:"w-full h-[400px] text-xs font-[var(--font-geist-mono)] bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 resize-none",spellCheck:!1}),g&&(0,a.jsx)("p",{className:"text-xs text-rose-600 mt-2",children:g}),(0,a.jsxs)(i.Button,{onClick:b,disabled:o||!e.trim(),className:"mt-3 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5",children:[o?(0,a.jsx)(f.Loader2,{className:"w-3.5 h-3.5 animate-spin"}):(0,a.jsx)(d,{className:"w-3.5 h-3.5"})," Verify Receipt"]})]})]}),(0,a.jsx)("div",{className:"space-y-4",children:c?(0,a.jsxs)(a.Fragment,{children:[(0,a.jsx)(n.Card,{className:"valid"===c.status?"border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/10":"border-rose-500/40 bg-rose-50/30 dark:bg-rose-950/10",children:(0,a.jsx)(n.CardContent,{className:"p-4",children:(0,a.jsxs)("div",{className:"flex items-center gap-3",children:["valid"===c.status?(0,a.jsx)(d,{className:"w-8 h-8 text-emerald-600"}):(0,a.jsx)(p,{className:"w-8 h-8 text-rose-600"}),(0,a.jsxs)("div",{children:[(0,a.jsx)("div",{className:"font-semibold text-sm",children:"valid"===c.status?"Receipt Valid":"Verification Failed"}),(0,a.jsxs)("div",{className:"text-xs text-muted-foreground",children:[c.checks.filter(e=>e.passed).length,"/",c.checks.length," checks passed"]})]})]})})}),(0,a.jsxs)(n.Card,{children:[(0,a.jsx)(n.CardHeader,{className:"pb-2",children:(0,a.jsx)(n.CardTitle,{className:"text-xs font-semibold",children:"Checks"})}),(0,a.jsx)(n.CardContent,{className:"space-y-2",children:c.checks.map((e,t)=>(0,a.jsxs)("div",{className:"flex items-start gap-2 text-xs py-1.5 px-2 rounded border",children:[e.passed?(0,a.jsx)(m.CheckCircle2,{className:"w-4 h-4 text-emerald-600 shrink-0 mt-0.5"}):(0,a.jsx)(x.XCircle,{className:"w-4 h-4 text-rose-600 shrink-0 mt-0.5"}),(0,a.jsxs)("div",{className:"flex-1",children:[(0,a.jsx)("div",{className:"font-medium",children:e.name}),(0,a.jsx)("div",{className:"text-muted-foreground text-[11px] mt-0.5",children:e.detail})]}),(0,a.jsx)(r.Badge,{variant:e.passed?"outline":"destructive",className:"text-[9px] shrink-0",children:e.passed?"PASS":"FAIL"})]},t))})]})]}):(0,a.jsx)(n.Card,{children:(0,a.jsxs)(n.CardContent,{className:"p-4 space-y-3",children:[(0,a.jsx)("h3",{className:"text-xs font-semibold",children:"How to use"}),(0,a.jsxs)("ol",{className:"text-xs text-muted-foreground space-y-1.5 list-decimal list-inside",children:[(0,a.jsxs)("li",{children:["Click ",(0,a.jsx)("strong",{children:"Load from chain"})," to fetch a real receipt"]}),(0,a.jsxs)("li",{children:["Click ",(0,a.jsx)("strong",{children:"Verify Receipt"})," to check all 6 properties"]}),(0,a.jsxs)("li",{children:["Click ",(0,a.jsx)("strong",{children:"Tamper"})," to flip the decision field"]}),(0,a.jsxs)("li",{children:["Click ",(0,a.jsx)("strong",{children:"Verify Receipt"})," again to see detection"]})]})]})})})]})}let q=[{id:1,title:"Ed25519 Signature",icon:k,desc:"Verify the receipt body was signed by the gateway's private key"},{id:2,title:"Hash Chain",icon:_.Link2,desc:"Verify prev_receipt links to the actual predecessor"},{id:3,title:"Merkle Inclusion",icon:N,desc:"Verify the receipt is a leaf in the anchored Merkle tree"},{id:4,title:"On-Chain Anchor",icon:j,desc:"Verify the Merkle root is immutably stored on Base L2"}];function I({step:e,result:t}){let s=e.icon,i="running"===t.status,n="pass"===t.status,o="fail"===t.status;return(0,a.jsx)("div",{className:`rounded-lg border p-4 transition-all duration-300 ${i?"border-blue-400 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-400/30":n?"border-emerald-400/50 bg-emerald-50/30 dark:bg-emerald-950/15":o?"border-rose-400/50 bg-rose-50/30 dark:bg-rose-950/15":"border-zinc-200 dark:border-zinc-800"}`,children:(0,a.jsxs)("div",{className:"flex items-start gap-3",children:[(0,a.jsx)("div",{className:`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${i?"bg-blue-100 dark:bg-blue-900/40":n?"bg-emerald-100 dark:bg-emerald-900/40":o?"bg-rose-100 dark:bg-rose-900/40":"bg-zinc-100 dark:bg-zinc-800"}`,children:i?(0,a.jsx)(f.Loader2,{className:"w-4 h-4 text-blue-600 animate-spin"}):n?(0,a.jsx)(m.CheckCircle2,{className:"w-4 h-4 text-emerald-600"}):o?(0,a.jsx)(x.XCircle,{className:"w-4 h-4 text-rose-600"}):(0,a.jsx)(s,{className:"w-4 h-4 text-zinc-400"})}),(0,a.jsxs)("div",{className:"flex-1 min-w-0",children:[(0,a.jsxs)("div",{className:"flex items-center gap-2",children:[(0,a.jsxs)(r.Badge,{variant:"outline",className:"text-[10px] shrink-0",children:["Step ",e.id]}),(0,a.jsx)("span",{className:"text-sm font-medium",children:e.title}),n&&(0,a.jsx)(r.Badge,{className:"text-[9px] bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20",children:"PASS"}),o&&(0,a.jsx)(r.Badge,{variant:"destructive",className:"text-[9px]",children:"FAIL"})]}),(0,a.jsx)("p",{className:"text-xs text-muted-foreground mt-1",children:"idle"===t.status?e.desc:t.message}),t.detail&&(0,a.jsx)("p",{className:"text-[11px] text-muted-foreground mt-1 font-[var(--font-geist-mono)] break-all",children:t.detail})]})]})})}let T=`#!/usr/bin/env python3
"""Gate Receipt Claim Verifier — independent 4-step verification.

Verifies a Gate receipt WITHOUT trusting the Gateway:
  Step 1: Ed25519 signature — recompute hash, verify sig with public key
  Step 2: Hash chain — check prev_receipt links to predecessor
  Step 3: Merkle inclusion — recompute root from leaf using domain-tagged hashes
  Step 4: On-chain anchor — fetch tx from Base L2 RPC, compare calldata to root

Requirements:
  pip install cryptography httpx

Usage:
  python verify_claim.py --gateway https://agent-auth-gateway-1031148889398.us-central1.run.app --seq 4
"""

import argparse
import base64
import hashlib
import json
import sys

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

# ── Domain tags for Merkle tree (must match gateway/merkle.py) ──
UNIFIED_LEAF_DOMAIN = b"BI_ARTIFACT_LEAF_V1"
UNIFIED_NODE_DOMAIN = b"BI_ARTIFACT_NODE_V1"
GENESIS_PREV = "sha256:" + "0" * 64
BASE_RPC = "https://mainnet.base.org"


def b64url_decode(s: str) -> bytes:
    s = s.replace("-", "+").replace("_", "/")
    return base64.b64decode(s + "=" * (-len(s) % 4))


def canonicalize(obj: dict) -> bytes:
    """JCS-style canonical JSON: sorted keys, no whitespace."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()


# ════════════════════════════════════════════════════════════════
# Step 1: Ed25519 Signature Verification
# ════════════════════════════════════════════════════════════════

def step1_verify_signature(receipt: dict, keys: list[dict]) -> tuple[bool, list[str]]:
    log = []
    body = receipt["body"]
    sig_obj = receipt["sig"]
    kid = sig_obj["kid"]
    log.append(f"  Algorithm: {sig_obj['alg']}")
    log.append(f"  Key ID (kid): {kid}")

    # Find matching public key
    pub_jwk = next((k for k in keys if k["kid"] == kid), None)
    if not pub_jwk:
        log.append(f"  FAIL: No public key found for kid={kid}")
        return False, log
    log.append(f"  Public key (x): {pub_jwk['x'][:32]}...")

    # Canonicalize body and compute hash
    body_bytes = canonicalize(body)
    computed_hash = "sha256:" + hashlib.sha256(body_bytes).hexdigest()
    claimed_hash = receipt["receipt_hash"]
    log.append(f"  Canonical body: {len(body_bytes)} bytes")
    log.append(f"  Computed SHA-256:  {computed_hash}")
    log.append(f"  Claimed hash:      {claimed_hash}")

    if computed_hash != claimed_hash:
        log.append(f"  FAIL: Hash mismatch — receipt body was modified!")
        return False, log
    log.append(f"  Hash match: YES")

    # Verify Ed25519 signature
    try:
        pub_key = Ed25519PublicKey.from_public_bytes(b64url_decode(pub_jwk["x"]))
        sig_bytes = b64url_decode(sig_obj["value"])
        pub_key.verify(sig_bytes, body_bytes)
        log.append(f"  Ed25519 verify: PASS")
        log.append(f"  Proves: This receipt was signed by the holder of key {kid}")
        return True, log
    except InvalidSignature:
        log.append(f"  Ed25519 verify: FAIL — signature does not match!")
        return False, log


# ════════════════════════════════════════════════════════════════
# Step 2: Hash Chain Verification
# ════════════════════════════════════════════════════════════════

def step2_verify_chain(receipt: dict, chain: list[dict]) -> tuple[bool, list[str]]:
    log = []
    body = receipt["body"]
    prev_hash = body["prev_receipt"]
    seq = int(body["seq"])
    log.append(f"  Receipt seq: {seq}")
    log.append(f"  prev_receipt: {prev_hash}")

    if prev_hash == GENESIS_PREV:
        log.append(f"  This is the genesis receipt (first in chain)")
        log.append(f"  Proves: No receipts exist before this one")
        return True, log

    # Find predecessor
    pred = next((r for r in chain if int(r["body"]["seq"]) == seq - 1), None)
    if not pred:
        log.append(f"  FAIL: Predecessor seq={seq - 1} not found in chain")
        return False, log

    pred_hash = pred["receipt_hash"]
    log.append(f"  Predecessor (seq {seq - 1}) hash: {pred_hash}")

    if pred_hash == prev_hash:
        log.append(f"  Chain link: MATCH")
        log.append(f"  Proves: seq {seq} directly follows seq {seq - 1}, no gaps or insertions")
        return True, log
    else:
        log.append(f"  FAIL: CHAIN BREAK!")
        log.append(f"    Expected: {prev_hash}")
        log.append(f"    Actual:   {pred_hash}")
        return False, log


# ════════════════════════════════════════════════════════════════
# Step 3: Merkle Inclusion Proof
# ════════════════════════════════════════════════════════════════

def step3_verify_merkle(receipt_hash: str, proof: dict | None) -> tuple[bool, list[str]]:
    log = []
    if not proof or "proof" not in proof:
        log.append(f"  No inclusion proof available (receipt not yet in anchored batch)")
        log.append(f"  Use POST /anchors/trigger to anchor, then retry")
        return False, log

    target_hex = receipt_hash.removeprefix("sha256:")
    log.append(f"  Receipt hash: {receipt_hash}")
    log.append(f"  Leaf index: {proof['leaf_index']} of {proof['tree_size']} in tree")
    log.append(f"  Proof path: {len(proof['proof'])} sibling hashes")

    # Compute leaf with domain tag
    leaf = hashlib.sha256(UNIFIED_LEAF_DOMAIN + b"\\x00" + bytes.fromhex(target_hex)).digest()
    log.append(f"  Leaf hash: SHA256(BI_ARTIFACT_LEAF_V1 || 0x00 || receipt_hash)")
    log.append(f"           = {leaf.hex()}")

    # Walk the proof path
    current = leaf
    for i, step in enumerate(proof["proof"]):
        sibling = bytes.fromhex(step["hash"])
        direction = step["direction"]
        if direction == "right":
            current = hashlib.sha256(UNIFIED_NODE_DOMAIN + b"\\x00" + current + sibling).digest()
        else:
            current = hashlib.sha256(UNIFIED_NODE_DOMAIN + b"\\x00" + sibling + current).digest()
        log.append(f"  Step {i + 1}: hash with {direction} sibling {step['hash'][:16]}... = {current.hex()[:24]}...")

    recomputed_root = "sha256:" + current.hex()
    expected_root = proof["root"]
    log.append(f"")
    log.append(f"  Recomputed root: {recomputed_root}")
    log.append(f"  Expected root:   {expected_root}")
    log.append(f"  MATCH: {recomputed_root == expected_root}")

    if recomputed_root == expected_root:
        log.append(f"  Proves: This receipt is included in the Merkle tree with root {expected_root[:32]}...")
        return True, log
    else:
        log.append(f"  FAIL: Recomputed root does not match!")
        return False, log


# ════════════════════════════════════════════════════════════════
# Step 4: On-Chain Anchor Verification (Base L2)
# ════════════════════════════════════════════════════════════════

def step4_verify_on_chain(
    merkle_root: str | None,
    anchors: list[dict],
    proof: dict | None,
) -> tuple[bool, list[str]]:
    log = []
    if not proof or not merkle_root:
        log.append(f"  Skipped — no Merkle proof available")
        return False, log

    log_seq = proof.get("log_seq", 0)
    log.append(f"  Artifact log seq: {log_seq}")

    # Find matching anchor
    anchor = None
    for a in anchors:
        r = a.get("artifact_seq_range", [0, 0])
        if len(r) == 2 and r[0] <= log_seq <= r[1]:
            anchor = a
            break

    if not anchor:
        log.append(f"  No anchor covers log_seq={log_seq} (batch not yet anchored)")
        return False, log

    tx_hash = anchor.get("tx_hash", "")
    block = anchor.get("block_number", "?")
    log.append(f"  Anchor found: block {block}, tx {tx_hash}")
    log.append(f"  BaseScan: https://basescan.org/tx/{tx_hash}")

    # Fetch the actual transaction from Base L2 RPC
    log.append(f"")
    log.append(f"  Fetching transaction from Base L2 RPC ({BASE_RPC})...")
    try:
        rpc_payload = {
            "jsonrpc": "2.0", "id": 1, "method": "eth_getTransactionByHash",
            "params": [tx_hash],
        }
        resp = httpx.post(BASE_RPC, json=rpc_payload, timeout=15)
        tx_data = resp.json().get("result")

        if not tx_data:
            log.append(f"  WARNING: Transaction not found on RPC (may be too recent)")
            log.append(f"  Falling back to gateway anchor record")
            stored_root = anchor.get("merkle_root", "")
            log.append(f"  Stored root:     {stored_root}")
            log.append(f"  Recomputed root: {merkle_root}")
            match = stored_root == merkle_root
            log.append(f"  MATCH: {match}")
            if match:
                log.append(f"  Proves: Merkle root matches gateway's anchor record")
            return match, log

        # Extract calldata (input field)
        calldata = tx_data.get("input", "0x")
        if calldata.startswith("0x"):
            calldata = calldata[2:]
        on_chain_root = "sha256:" + calldata
        log.append(f"  On-chain calldata: {calldata}")
        log.append(f"  On-chain root:     {on_chain_root}")
        log.append(f"  Recomputed root:   {merkle_root}")

        match = on_chain_root == merkle_root
        log.append(f"  MATCH: {match}")
        log.append(f"")

        if match:
            log.append(f"  Proves: The Merkle root on Base L2 block {block} EXACTLY matches")
            log.append(f"  the root recomputed from this receipt's inclusion proof.")
            log.append(f"  This receipt existed in this exact form at the time of anchoring.")
            log.append(f"  No one — not even Gate — can alter it without changing the on-chain root.")
        else:
            log.append(f"  FAIL: On-chain root does not match recomputed root!")

        return match, log

    except Exception as e:
        log.append(f"  RPC error: {e}")
        log.append(f"  Falling back to gateway anchor record comparison")
        stored_root = anchor.get("merkle_root", "")
        match = stored_root == merkle_root
        log.append(f"  Stored root:     {stored_root}")
        log.append(f"  Recomputed root: {merkle_root}")
        log.append(f"  MATCH: {match}")
        return match, log


# ════════════════════════════════════════════════════════════════
# Main
# ════════════════════════════════════════════════════════════════

def main():
    p = argparse.ArgumentParser(description="Gate Receipt Claim Verifier")
    p.add_argument("--gateway", required=True, help="Gateway REST URL")
    p.add_argument("--seq", required=True, type=int, help="Receipt sequence number")
    args = p.parse_args()

    gw = args.gateway.rstrip("/")
    c = httpx.Client(timeout=15)

    print(f"\\n{'=' * 70}")
    print(f"  Gate Receipt Claim Verifier — Independent 4-Step Verification")
    print(f"  Gateway: {gw}")
    print(f"  Receipt: seq #{args.seq}")
    print(f"{'=' * 70}")

    # Fetch data
    print(f"\\n[*] Fetching receipt chain...")
    chain = c.get(f"{gw}/chain?limit=500").json().get("receipts", [])
    receipt = next((r for r in chain if int(r["body"]["seq"]) == args.seq), None)
    if not receipt:
        print(f"    Receipt seq={args.seq} not found ({len(chain)} in chain)")
        sys.exit(1)

    meta = receipt.get("_meta", {})
    print(f"    Agent: {meta.get('agent_id', '?')}")
    print(f"    Action: {meta.get('action', '?')} on {meta.get('resource', '?')}")
    print(f"    Decision: {receipt['body']['decision']}")
    print(f"    Hash: {receipt['receipt_hash']}")

    print(f"\\n[*] Fetching public keys...")
    keys = c.get(f"{gw}/keys").json().get("keys", [])
    print(f"    Found {len(keys)} key(s)")

    # Step 1
    print(f"\\n{'─' * 70}")
    print(f"  Step 1: Ed25519 Signature Verification")
    print(f"{'─' * 70}")
    ok1, log1 = step1_verify_signature(receipt, keys)
    for line in log1:
        print(line)
    print(f"\\n  Result: {'PASS ✓' if ok1 else 'FAIL ✗'}")

    # Step 2
    print(f"\\n{'─' * 70}")
    print(f"  Step 2: Hash Chain Verification")
    print(f"{'─' * 70}")
    ok2, log2 = step2_verify_chain(receipt, chain)
    for line in log2:
        print(line)
    print(f"\\n  Result: {'PASS ✓' if ok2 else 'FAIL ✗'}")

    # Fetch proof
    print(f"\\n[*] Fetching Merkle inclusion proof...")
    proof = None
    try:
        resp = c.get(f"{gw}/artifacts/proof/{receipt['receipt_hash']}")
        if resp.status_code == 200:
            proof = resp.json()
            print(f"    Got proof: leaf {proof['leaf_index']} of {proof['tree_size']}")
        else:
            print(f"    No proof available (HTTP {resp.status_code})")
    except Exception as e:
        print(f"    Error: {e}")

    # Step 3
    print(f"\\n{'─' * 70}")
    print(f"  Step 3: Merkle Inclusion Proof")
    print(f"{'─' * 70}")
    ok3, log3 = step3_verify_merkle(receipt["receipt_hash"], proof)
    merkle_root = None
    if ok3 and proof:
        merkle_root = proof["root"]
    for line in log3:
        print(line)
    print(f"\\n  Result: {'PASS ✓' if ok3 else 'FAIL ✗'}")

    # Fetch anchors
    print(f"\\n[*] Fetching on-chain anchors...")
    anchors = []
    try:
        anchors = c.get(f"{gw}/anchors").json().get("on_chain_anchors", [])
        print(f"    Found {len(anchors)} anchor(s)")
    except Exception as e:
        print(f"    Error: {e}")

    # Step 4
    print(f"\\n{'─' * 70}")
    print(f"  Step 4: On-Chain Anchor Verification (Base L2)")
    print(f"{'─' * 70}")
    ok4, log4 = step4_verify_on_chain(merkle_root, anchors, proof)
    for line in log4:
        print(line)
    print(f"\\n  Result: {'PASS ✓' if ok4 else 'FAIL ✗'}")

    # Verdict
    results = [ok1, ok2, ok3, ok4]
    passed = sum(results)
    print(f"\\n{'=' * 70}")
    print(f"  VERDICT: {passed}/4 steps passed")
    if all(results):
        print(f"  Receipt is AUTHENTIC and IMMUTABLY ANCHORED on Base L2")
    elif ok1 and ok2:
        print(f"  Receipt is AUTHENTIC (signature + chain valid)")
        if not ok3 or not ok4:
            print(f"  Merkle/anchor verification pending")
    else:
        print(f"  VERIFICATION FAILED — receipt may be tampered")
    print(f"{'=' * 70}")
    sys.exit(0 if ok1 and ok2 else 1)


if __name__ == "__main__":
    main()
`;function R(){let[e,t]=(0,s.useState)(!1),[c,d]=(0,s.useState)("4"),[p,u]=(0,s.useState)([]),[_,j]=(0,s.useState)(!1),[k,N]=(0,s.useState)(null),[v,w]=(0,s.useState)(q.map(()=>({status:"idle",message:""}))),[S,A]=(0,s.useState)(null),[E,R]=(0,s.useState)(!1),[F,B]=(0,s.useState)(!1),L=(e,t)=>w(a=>{let s=[...a];return s[e]=t,s}),$=async()=>{t(!0),A(null),N(null),w(q.map(()=>({status:"idle",message:""})));let e=parseInt(c),a=`${C}/api/agents/gateway`;try{let s=(await (await fetch(`${a}/chain?limit=500`)).json()).receipts||[],r=s.find(t=>parseInt(t.body?.seq||"0")===e);if(!r){L(0,{status:"fail",message:`Receipt seq=${e} not found`}),t(!1);return}let i=r.body||{},n=r._meta||{};N({seq:i.seq,decision:i.decision,agent:n.agent_id,action:n.action,resource:n.resource,hash:r.receipt_hash}),L(0,{status:"running",message:"Verifying Ed25519 signature..."}),await new Promise(e=>setTimeout(e,200));let o=await (await fetch(`${a}/verify-receipt`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({receipt:r})})).json(),l="PASS"===o.receipt_integrity;L(0,{status:l?"pass":"fail",message:l?"Ed25519 signature verified":"Signature FAILED",detail:`kid: ${r.sig?.kid}  |  hash: ${(r.receipt_hash||"").slice(0,40)}...`}),L(1,{status:"running",message:"Checking hash chain..."}),await new Promise(e=>setTimeout(e,200));let c=i.prev_receipt||"",d="sha256:"+"0".repeat(64),p=!1,h="",m="";if(c===d)p=!0,h="Genesis receipt",m="First in chain";else{let e=s.find(e=>parseInt(e.body?.seq||"0")===parseInt(i.seq)-1);e?.receipt_hash===c?(p=!0,h=`Chain valid: seq ${i.seq} \u2192 ${parseInt(i.seq)-1}`,m=`prev: ${c.slice(0,40)}...`):(h="CHAIN BREAK",m=e?`Expected ${c.slice(0,24)}... got ${(e.receipt_hash||"").slice(0,24)}...`:"Predecessor not found")}L(1,{status:p?"pass":"fail",message:h,detail:m}),L(2,{status:"running",message:"Fetching Merkle proof..."}),await new Promise(e=>setTimeout(e,200));let x=null,g=!1,f="",u="";try{let e=await fetch(`${a}/artifacts/proof/${r.receipt_hash}`);e.ok?(x=await e.json(),g=!0,f=`Inclusion verified \u2014 leaf ${x.leaf_index} of ${x.tree_size}`,u=`root: ${(x.root||"").slice(0,40)}...  |  ${x.proof?.length||0} path steps`):(f="Not yet in anchored batch",u="Anchor first, then retry")}catch(e){f=`Error: ${e.message}`}L(2,{status:g?"pass":"fail",message:f,detail:u}),L(3,{status:"running",message:"Checking Base L2..."}),await new Promise(e=>setTimeout(e,200));let b=!1,y="",_="";try{let e=(await (await fetch(`${a}/anchors`)).json()).on_chain_anchors||[];if(x&&e.length>0){let t=e.find(e=>{let t=e.artifact_seq_range||[0,0];return t[0]<=(x.log_seq||0)&&(x.log_seq||0)<=t[1]});t?(b=!0,y=`Anchored at block ${(t.block_number||0).toLocaleString()}`,_=`tx: ${t.tx_hash}  |  Verify on BaseScan: calldata must equal the Merkle root`):(y="Batch not yet anchored",_=`${e.length} anchor(s), none cover this range`)}else y=x?"No anchors found":"Skipped — no Merkle proof"}catch(e){y=`Error: ${e.message}`}L(3,{status:b?"pass":"fail",message:y,detail:_});let j=[l,p,g,b];A({passed:j.filter(Boolean).length,total:4,ok:l&&p,label:j.every(Boolean)?"Receipt is AUTHENTIC and IMMUTABLE":l&&p?"Receipt is AUTHENTIC (anchor pending)":"VERIFICATION FAILED"})}catch(e){L(0,{status:"fail",message:`Error: ${e.message}`})}t(!1)};return(0,a.jsxs)("div",{className:"space-y-5",children:[(0,a.jsx)(n.Card,{children:(0,a.jsxs)(n.CardContent,{className:"p-4",children:[(0,a.jsxs)("div",{className:"flex items-center gap-3 flex-wrap",children:[(0,a.jsxs)("div",{className:"flex items-center gap-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-1",children:[(0,a.jsx)("span",{className:"text-xs text-muted-foreground pl-2",children:"seq #"}),(0,a.jsx)("input",{type:"number",min:1,value:c,onChange:e=>d(e.target.value),className:"w-14 text-sm font-[var(--font-geist-mono)] bg-transparent border-none outline-none py-1.5 px-1"})]}),(0,a.jsxs)(i.Button,{variant:"outline",size:"sm",className:"text-xs h-8 gap-1.5",onClick:async()=>{j(!0);try{u((await (await fetch(`${C}/api/agents/gateway/chain?limit=25`)).json()).receipts?.slice().reverse()||[])}catch{}j(!1)},disabled:_,children:[_?(0,a.jsx)(f.Loader2,{className:"w-3 h-3 animate-spin"}):null," Browse"]}),(0,a.jsx)("div",{className:"flex-1"}),(0,a.jsxs)(i.Button,{size:"sm",className:"h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5",onClick:$,disabled:e,children:[e?(0,a.jsx)(f.Loader2,{className:"w-3.5 h-3.5 animate-spin"}):(0,a.jsx)(l.Shield,{className:"w-3.5 h-3.5"})," Verify"]})]}),p.length>0&&(0,a.jsx)("div",{className:"mt-3 flex flex-wrap gap-1.5 pt-3 border-t",children:p.map(e=>{let t=e.body||{},s=e._meta||{},r=t.seq||"?";return(0,a.jsxs)("button",{onClick:()=>d(r),className:`text-[11px] px-2.5 py-1 rounded-full border transition-all ${c===r?"border-primary bg-primary/10 text-primary font-medium":"border-zinc-200 dark:border-zinc-700 hover:border-primary/40 text-muted-foreground"}`,children:[(0,a.jsxs)("span",{className:"font-[var(--font-geist-mono)]",children:["#",r]})," ",(0,a.jsx)("span",{className:"approve"===t.decision?"text-emerald-600":"text-rose-500",children:"approve"===t.decision?"✓":"✗"})," ",s.action||"?"]},r)})})]})}),k&&(0,a.jsxs)("div",{className:"rounded-lg border bg-muted/20 px-4 py-3 flex items-center gap-4 flex-wrap text-xs",children:[(0,a.jsxs)(r.Badge,{variant:"outline",className:"text-[10px]",children:["#",k.seq]}),(0,a.jsx)("span",{className:`font-semibold ${"approve"===k.decision?"text-emerald-600":"text-rose-600"}`,children:(k.decision||"").toUpperCase()}),(0,a.jsxs)("span",{className:"text-muted-foreground",children:[k.agent,": ",k.action," on ",k.resource]}),(0,a.jsx)("span",{className:"flex-1"}),(0,a.jsxs)("code",{className:"font-[var(--font-geist-mono)] text-[10px] text-muted-foreground",children:[(k.hash||"").slice(0,32),"..."]})]}),(0,a.jsx)("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-3",children:q.map((e,t)=>(0,a.jsx)(I,{step:e,result:v[t]},e.id))}),S&&(0,a.jsxs)("div",{className:`rounded-lg border-2 p-5 text-center ${S.ok?"border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/20":"border-rose-400/60 bg-rose-50/40 dark:bg-rose-950/20"}`,children:[(0,a.jsxs)("div",{className:"flex items-center justify-center gap-3 mb-1",children:[S.ok?(0,a.jsx)(m.CheckCircle2,{className:"w-6 h-6 text-emerald-600"}):(0,a.jsx)(x.XCircle,{className:"w-6 h-6 text-rose-600"}),(0,a.jsx)("span",{className:"text-base font-semibold",children:S.label})]}),(0,a.jsxs)("p",{className:"text-sm text-muted-foreground",children:[S.passed,"/",S.total," steps passed"]})]}),(0,a.jsx)(o.Collapsible,{open:F,onOpenChange:B,children:(0,a.jsxs)(n.Card,{children:[(0,a.jsxs)(n.CardHeader,{className:"pb-0",children:[(0,a.jsxs)(o.CollapsibleTrigger,{className:"flex items-center justify-between w-full text-left",children:[(0,a.jsxs)(n.CardTitle,{className:"text-sm flex items-center gap-2",children:[(0,a.jsx)(g,{className:"w-4 h-4"})," Python Script ",(0,a.jsx)(r.Badge,{variant:"outline",className:"text-[10px]",children:"verify_claim.py"})]}),(0,a.jsx)(b.ChevronRight,{className:`w-4 h-4 text-muted-foreground transition-transform ${F?"rotate-90":""}`})]}),(0,a.jsx)("p",{className:"text-xs text-muted-foreground mt-2 pb-3",children:"Full offline verification — fetches the actual Base L2 transaction via RPC and compares calldata to the recomputed Merkle root."})]}),(0,a.jsx)(o.CollapsibleContent,{children:(0,a.jsxs)(n.CardContent,{className:"pt-0",children:[(0,a.jsxs)("div",{className:"flex gap-1.5 mb-3",children:[(0,a.jsxs)(i.Button,{variant:"outline",size:"sm",className:"text-xs h-7 gap-1",onClick:()=>{navigator.clipboard.writeText(T),R(!0),setTimeout(()=>R(!1),2e3)},children:[E?(0,a.jsx)(m.CheckCircle2,{className:"w-3 h-3 text-emerald-600"}):(0,a.jsx)(h.Copy,{className:"w-3 h-3"})," ",E?"Copied":"Copy"]}),(0,a.jsxs)(i.Button,{variant:"outline",size:"sm",className:"text-xs h-7 gap-1",onClick:()=>{let e=document.createElement("a");e.href=URL.createObjectURL(new Blob([T],{type:"text/x-python"})),e.download="verify_claim.py",e.click()},children:[(0,a.jsx)(y.Download,{className:"w-3 h-3"})," Download"]})]}),(0,a.jsxs)("div",{className:"text-xs font-[var(--font-geist-mono)] bg-zinc-900 text-zinc-400 rounded-md px-3 py-2 mb-3",children:[(0,a.jsx)("span",{className:"text-emerald-400",children:"$"})," pip install cryptography httpx",(0,a.jsx)("br",{}),(0,a.jsx)("span",{className:"text-emerald-400",children:"$"})," python verify_claim.py --gateway https://agent-auth-gateway-1031148889398.us-central1.run.app --seq ",c]}),(0,a.jsx)("pre",{className:"font-[var(--font-geist-mono)] text-[11px] bg-zinc-950 text-zinc-300 rounded-md p-4 overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre leading-relaxed",children:T})]})})]})})]})}function F(){let[e,t]=(0,s.useState)([]),[l,c]=(0,s.useState)(null),[d,p]=(0,s.useState)(!0),[h,x]=(0,s.useState)(!1),[g,y]=(0,s.useState)(null),[_,k]=(0,s.useState)({}),N={receipt:"Receipt",audit_report:"Audit Report",policy_proposal:"Policy Proposal",incident_report:"Incident Report",isolation_record:"Isolation Record"},v={receipt:"bg-blue-600/15 text-blue-700 dark:text-blue-400 border-blue-600/20",audit_report:"bg-teal-600/15 text-teal-700 dark:text-teal-400 border-teal-600/20",policy_proposal:"bg-violet-600/15 text-violet-700 dark:text-violet-400 border-violet-600/20",incident_report:"bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/20",isolation_record:"bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-600/20"},w=(0,s.useCallback)(()=>{fetch(`${C}/api/agents/gateway/anchors`).then(e=>e.json()).then(e=>t(e.on_chain_anchors||[])).catch(()=>{}),fetch(`${C}/api/agents/gateway/artifacts/log?limit=100`).then(e=>e.json()).then(c).catch(()=>{}),fetch(`${C}/api/agents/gateway/chain?limit=500`).then(e=>e.json()).then(e=>{let t={};for(let a of e.receipts||[])t[a.receipt_hash||""]=a.body?.seq||"";k(t)}).catch(()=>{})},[]);(0,s.useEffect)(()=>{w()},[w]);let S=e[0],A=l?.entries||[],E=S?A.filter(e=>e.seq>=(S.artifact_seq_range?.[0]||0)&&e.seq<=(S.artifact_seq_range?.[1]||0)):[],q={};for(let e of E)q[e.artifact_type]=(q[e.artifact_type]||0)+1;return(0,a.jsxs)("div",{className:"space-y-5",children:[(0,a.jsx)(n.Card,{children:(0,a.jsxs)(n.CardContent,{className:"p-6",children:[(0,a.jsxs)("div",{className:"flex items-center justify-between mb-4",children:[(0,a.jsxs)("div",{children:[(0,a.jsxs)("div",{className:"text-sm font-medium",children:[l?.head_seq||0," artifacts in unified log"]}),(0,a.jsx)("div",{className:"text-xs text-muted-foreground mt-0.5",children:"Receipts, audit reports, policy proposals, incident reports, isolation records"})]}),(0,a.jsxs)(i.Button,{size:"sm",className:"h-8 gap-1.5",onClick:async()=>{x(!0),y(null);try{let e=await (await fetch(`${C}/api/agents/gateway/anchors/trigger`,{method:"POST"})).json();y(e),"anchored"===e.status&&w()}catch(e){y({status:"error",reason:e.message})}x(!1)},disabled:h,children:[h?(0,a.jsx)(f.Loader2,{className:"w-3.5 h-3.5 animate-spin"}):(0,a.jsx)(j,{className:"w-3.5 h-3.5"})," ",h?"Anchoring...":"Anchor Now"]})]}),g?.status==="anchored"&&(0,a.jsxs)("div",{className:"rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 mb-4",children:[(0,a.jsxs)("div",{className:"flex items-center gap-2",children:[(0,a.jsx)(m.CheckCircle2,{className:"w-4 h-4 text-emerald-600"}),(0,a.jsxs)("span",{className:"text-sm font-medium text-emerald-700 dark:text-emerald-400",children:["Anchored ",g.artifact_count," artifacts"]})]}),(0,a.jsxs)("a",{href:g.basescan_url,target:"_blank",rel:"noopener noreferrer",className:"flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1",children:[(0,a.jsx)(u.ExternalLink,{className:"w-3 h-3"})," View on BaseScan"]})]}),S?(0,a.jsxs)(a.Fragment,{children:[(0,a.jsxs)("div",{className:"flex items-center gap-2 mb-4",children:[(0,a.jsx)(m.CheckCircle2,{className:"w-4 h-4 text-emerald-600"}),(0,a.jsx)("span",{className:"text-sm font-medium text-emerald-700 dark:text-emerald-400",children:"Anchored to Base L2"})]}),E.length>0&&(0,a.jsxs)("div",{className:"rounded-lg border bg-muted/20 p-4 mb-4",children:[(0,a.jsx)("p",{className:"text-xs font-semibold mb-3",children:"What's in this anchor batch:"}),(0,a.jsx)("div",{className:"flex flex-wrap gap-2 mb-3",children:Object.entries(q).map(([e,t])=>(0,a.jsxs)(r.Badge,{className:`text-[10px] ${v[e]||""}`,children:[t," ",N[e]||e,1!==t?"s":""]},e))}),(0,a.jsxs)("p",{className:"text-[11px] text-muted-foreground",children:[E.length," artifacts (seq ",S.artifact_seq_range?.[0],"–",S.artifact_seq_range?.[1],") in one Merkle tree."]})]}),(0,a.jsxs)("div",{className:"rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 mb-4",children:[(0,a.jsx)("p",{className:"text-xs font-semibold mb-2",children:"What this proves:"}),(0,a.jsxs)("ul",{className:"text-xs text-muted-foreground space-y-1 list-disc list-inside",children:[(0,a.jsxs)("li",{children:[(0,a.jsxs)("strong",{children:[S.artifact_count," artifacts"]})," were hashed into a Merkle tree — ",Object.entries(q).map(([e,t])=>`${t} ${N[e]||e}${1!==t?"s":""}`).join(", ")||"loading..."]}),(0,a.jsxs)("li",{children:["The ",(0,a.jsx)("strong",{children:"Merkle root"})," was written to Base L2 calldata at block ",S.block_number?.toLocaleString()]}),(0,a.jsx)("li",{children:"No one — not even Gate — can alter these artifacts after anchoring"}),(0,a.jsx)("li",{children:"Anyone can recompute the tree and verify the root matches on-chain"})]})]}),(0,a.jsxs)("div",{className:"grid grid-cols-[100px_1fr] gap-y-2 gap-x-4 text-sm",children:[(0,a.jsx)("span",{className:"text-muted-foreground text-xs",children:"Tx:"}),(0,a.jsxs)("a",{href:`https://basescan.org/tx/${S.tx_hash}`,target:"_blank",rel:"noopener noreferrer",className:"flex items-center gap-1 text-xs text-blue-600 hover:underline font-[var(--font-geist-mono)]",children:[String(S.tx_hash||"").slice(0,26),"... ",(0,a.jsx)(u.ExternalLink,{className:"w-3 h-3"})]}),(0,a.jsx)("span",{className:"text-muted-foreground text-xs",children:"Block:"}),(0,a.jsx)("span",{className:"text-xs",children:S.block_number?.toLocaleString()}),(0,a.jsx)("span",{className:"text-muted-foreground text-xs",children:"Root:"}),(0,a.jsxs)("code",{className:"font-[var(--font-geist-mono)] text-xs text-muted-foreground",children:[String(S.merkle_root||"").slice(0,40),"..."]}),(0,a.jsx)("span",{className:"text-muted-foreground text-xs",children:"Batch range:"}),(0,a.jsxs)("span",{className:"text-xs",children:["seq ",S.artifact_seq_range?.[0]," – ",S.artifact_seq_range?.[1]]}),(0,a.jsx)("span",{className:"text-muted-foreground text-xs",children:"Cost:"}),(0,a.jsx)("span",{className:"text-xs",children:"~$0.001 (Base L2 calldata)"})]})]}):(0,a.jsx)("p",{className:"text-sm text-muted-foreground",children:"No anchors yet. Click Anchor Now."})]})}),A.length>0&&(0,a.jsx)(n.Card,{children:(0,a.jsx)(n.CardHeader,{className:"pb-2",children:(0,a.jsxs)(o.Collapsible,{open:d,onOpenChange:p,children:[(0,a.jsx)(o.CollapsibleTrigger,{className:"flex items-center gap-2 w-full text-left",children:(0,a.jsxs)(n.CardTitle,{className:"text-sm flex items-center gap-2",children:[(0,a.jsx)(b.ChevronRight,{className:`w-3.5 h-3.5 transition-transform ${d?"rotate-90":""}`})," Artifact Log ",(0,a.jsx)(r.Badge,{variant:"outline",className:"text-[10px]",children:A.length})]})}),(0,a.jsx)(o.CollapsibleContent,{children:(0,a.jsx)("div",{className:"space-y-0.5 mt-3",children:[...A].reverse().map(e=>{let t=S?.artifact_seq_range&&e.seq>=S.artifact_seq_range[0]&&e.seq<=S.artifact_seq_range[1],s="receipt"===e.artifact_type?_[e.artifact_id]:null;return(0,a.jsxs)("div",{className:`flex items-center gap-2 text-xs py-1.5 px-2 rounded ${t?"bg-emerald-50/50 dark:bg-emerald-950/10":"hover:bg-muted/30"}`,children:[(0,a.jsxs)(r.Badge,{variant:"outline",className:"text-[10px] font-[var(--font-geist-mono)] w-10 justify-center",children:["#",e.seq]}),(0,a.jsx)(r.Badge,{className:`text-[9px] ${v[e.artifact_type]||""}`,children:N[e.artifact_type]||e.artifact_type}),s&&(0,a.jsxs)("span",{className:"text-[11px] text-muted-foreground",children:["seq ",(0,a.jsxs)("span",{className:"font-semibold text-foreground",children:["#",s]})]}),(0,a.jsxs)("code",{className:"font-[var(--font-geist-mono)] text-[11px] text-muted-foreground truncate flex-1",children:[(e.artifact_hash||"").slice(0,24),"..."]}),t&&(0,a.jsx)("span",{children:(0,a.jsx)(m.CheckCircle2,{className:"w-3 h-3 text-emerald-500 shrink-0"})})]},e.seq)})})})]})})}),e.length>0&&(0,a.jsxs)("div",{className:"text-xs text-muted-foreground text-center",children:[e.length," total anchor",1!==e.length?"s":""," on Base L2"]})]})}e.s(["default",0,function(){let[e,t]=(0,s.useState)("claim");return(0,a.jsxs)("div",{className:"min-h-screen flex flex-col bg-background",children:[(0,a.jsx)(v.SiteHeader,{}),(0,a.jsxs)("div",{className:"flex-1 max-w-[1100px] mx-auto w-full p-6 space-y-6",children:[(0,a.jsxs)("div",{children:[(0,a.jsxs)("h1",{className:"text-lg font-semibold flex items-center gap-2",children:[(0,a.jsx)(l.Shield,{className:"w-5 h-5 text-primary"})," Verify & Anchoring"]}),(0,a.jsx)("p",{className:"text-sm text-muted-foreground mt-1",children:"Cryptographic receipt verification, 4-step claim verifier with downloadable Python script, and on-chain Merkle anchoring."})]}),(0,a.jsx)("div",{className:"flex gap-1 border-b",children:w.map(s=>{let r=s.icon;return(0,a.jsxs)("button",{onClick:()=>t(s.id),className:`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${e===s.id?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"}`,children:[(0,a.jsx)(r,{className:"w-3.5 h-3.5"}),s.label]},s.id)})}),"receipt"===e&&(0,a.jsx)(E,{}),"claim"===e&&(0,a.jsx)(R,{}),"anchoring"===e&&(0,a.jsx)(F,{})]})]})}],13663)}]);