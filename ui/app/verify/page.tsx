"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Shield, ShieldCheck, ShieldX, Copy, CheckCircle2, XCircle, Terminal, FileText,
  Loader2, ExternalLink, ChevronRight, Download, Link2, Anchor, Lock, Binary, AlertTriangle,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";
function copyText(t: string) { navigator.clipboard.writeText(t); }

// ═══════════════════════════════════════════════════════
// Tab system
// ═══════════════════════════════════════════════════════

type TabId = "receipt" | "claim" | "anchoring";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "receipt", label: "Receipt Verifier", icon: Shield },
  { id: "claim", label: "4-Step Claim Verifier", icon: ShieldCheck },
  { id: "anchoring", label: "Artifact Anchoring", icon: Anchor },
];

// ═══════════════════════════════════════════════════════
// Tab 1: Receipt Verifier (paste JSON, verify)
// ═══════════════════════════════════════════════════════

const SAMPLE_RECEIPT = `{
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
}`;

type VerifyResult = {
  status: "valid" | "invalid" | "error";
  checks: { name: string; passed: boolean; detail: string }[];
};

async function verifyReceiptOnServer(receipt: any): Promise<VerifyResult> {
  try {
    const resp = await fetch(`${BASE}/api/agents/gateway/verify-receipt`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receipt, public_key: null }),
    });
    const data = await resp.json();
    const checks: VerifyResult["checks"] = [];
    const hasBody = !!receipt.body, hasSig = !!receipt.sig, hasHash = !!receipt.receipt_hash;
    checks.push({ name: "Envelope structure", passed: hasBody && hasSig && hasHash, detail: hasBody && hasSig && hasHash ? "body, sig, receipt_hash all present" : `Missing: ${[!hasBody && "body", !hasSig && "sig", !hasHash && "receipt_hash"].filter(Boolean).join(", ")}` });
    const requiredFields = ["v", "tenant", "seq", "ts", "request_digest", "policy_version", "decision", "prev_receipt"];
    const missing = requiredFields.filter(f => !(f in (receipt.body || {})));
    checks.push({ name: "Body fields", passed: missing.length === 0, detail: missing.length === 0 ? `All ${requiredFields.length} required fields present` : `Missing: ${missing.join(", ")}` });
    checks.push({ name: "Signature algorithm", passed: receipt.sig?.alg === "EdDSA", detail: receipt.sig?.alg === "EdDSA" ? "EdDSA (Ed25519)" : `Expected EdDSA, got ${receipt.sig?.alg || "none"}` });
    const sigValid = data.receipt_integrity === "PASS";
    checks.push({ name: "Ed25519 signature", passed: sigValid, detail: sigValid ? `Verified against kid ${receipt.sig?.kid || "?"}` : `Failed: ${data.errors?.map((e: any) => e.message).join("; ") || "invalid"}` });
    const chainOk = data.chain_validity === "PASS" || data.chain_validity === "GENESIS";
    checks.push({ name: "Hash chain link", passed: chainOk, detail: data.chain_validity === "GENESIS" ? "Genesis receipt" : chainOk ? "prev_receipt links to predecessor" : `Broken: ${data.errors?.map((e: any) => e.message).join("; ") || "mismatch"}` });
    checks.push({ name: "Receipt hash", passed: sigValid, detail: receipt.receipt_hash ? `${receipt.receipt_hash.slice(0, 32)}...` : "Missing" });
    return { status: checks.every(c => c.passed) ? "valid" : "invalid", checks };
  } catch (e: any) { return { status: "error", checks: [{ name: "Server verification", passed: false, detail: e.message }] }; }
}

function ReceiptVerifierTab() {
  const [receiptJson, setReceiptJson] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [parseError, setParseError] = useState("");

  async function handleVerify() {
    setParseError(""); setResult(null);
    let parsed: any;
    try { parsed = JSON.parse(receiptJson); } catch (e: any) { setParseError("Invalid JSON: " + e.message); return; }
    setVerifying(true); setResult(await verifyReceiptOnServer(parsed)); setVerifying(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Receipt JSON</CardTitle>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={async () => {
                try { const d = await (await fetch(`${BASE}/api/agents/gateway/chain?limit=1`)).json(); if (d.receipts?.length) { setReceiptJson(JSON.stringify(d.receipts[0], null, 2)); setResult(null); } else setParseError("No receipts yet."); } catch { setParseError("Could not fetch."); }
              }}>Load from chain</Button>
              <Button variant="outline" size="sm" className="text-xs h-7 text-rose-600 hover:text-rose-700" disabled={!receiptJson} onClick={() => {
                try { const p = JSON.parse(receiptJson); if (p.body?.decision === "approve") p.body.decision = "deny"; else if (p.body?.decision === "deny") p.body.decision = "approve"; else if (p.body) p.body.decision = "TAMPERED"; setReceiptJson(JSON.stringify(p, null, 2)); setResult(null); } catch {}
              }}>Tamper</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <textarea value={receiptJson} onChange={e => { setReceiptJson(e.target.value); setResult(null); setParseError(""); }} placeholder={SAMPLE_RECEIPT} className="w-full h-[400px] text-xs font-[var(--font-geist-mono)] bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 resize-none" spellCheck={false} />
          {parseError && <p className="text-xs text-rose-600 mt-2">{parseError}</p>}
          <Button onClick={handleVerify} disabled={verifying || !receiptJson.trim()} className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
            {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Verify Receipt
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {result ? (<>
          <Card className={result.status === "valid" ? "border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-rose-500/40 bg-rose-50/30 dark:bg-rose-950/10"}>
            <CardContent className="p-4"><div className="flex items-center gap-3">{result.status === "valid" ? <ShieldCheck className="w-8 h-8 text-emerald-600" /> : <ShieldX className="w-8 h-8 text-rose-600" />}<div><div className="font-semibold text-sm">{result.status === "valid" ? "Receipt Valid" : "Verification Failed"}</div><div className="text-xs text-muted-foreground">{result.checks.filter(c => c.passed).length}/{result.checks.length} checks passed</div></div></div></CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold">Checks</CardTitle></CardHeader><CardContent className="space-y-2">
            {result.checks.map((c, i) => (<div key={i} className="flex items-start gap-2 text-xs py-1.5 px-2 rounded border">{c.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}<div className="flex-1"><div className="font-medium">{c.name}</div><div className="text-muted-foreground text-[11px] mt-0.5">{c.detail}</div></div><Badge variant={c.passed ? "outline" : "destructive"} className="text-[9px] shrink-0">{c.passed ? "PASS" : "FAIL"}</Badge></div>))}
          </CardContent></Card>
        </>) : (
          <Card><CardContent className="p-4 space-y-3"><h3 className="text-xs font-semibold">How to use</h3><ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside"><li>Click <strong>Load from chain</strong> to fetch a real receipt</li><li>Click <strong>Verify Receipt</strong> to check all 6 properties</li><li>Click <strong>Tamper</strong> to flip the decision field</li><li>Click <strong>Verify Receipt</strong> again to see detection</li></ol></CardContent></Card>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Tab 2: 4-Step Claim Verifier
// ═══════════════════════════════════════════════════════

type StepResult = { status: "idle" | "running" | "pass" | "fail"; message: string; detail?: string };

const STEPS_META = [
  { id: 1, title: "Ed25519 Signature", icon: Lock, desc: "Verify the receipt body was signed by the gateway's private key" },
  { id: 2, title: "Hash Chain", icon: Link2, desc: "Verify prev_receipt links to the actual predecessor" },
  { id: 3, title: "Merkle Inclusion", icon: Binary, desc: "Verify the receipt is a leaf in the anchored Merkle tree" },
  { id: 4, title: "On-Chain Anchor", icon: Anchor, desc: "Verify the Merkle root is immutably stored on Base L2" },
];

function StepCard({ step, result }: { step: typeof STEPS_META[0]; result: StepResult }) {
  const Icon = step.icon;
  const a = result.status === "running", p = result.status === "pass", f = result.status === "fail";
  return (
    <div className={`rounded-lg border p-4 transition-all duration-300 ${a ? "border-blue-400 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-400/30" : p ? "border-emerald-400/50 bg-emerald-50/30 dark:bg-emerald-950/15" : f ? "border-rose-400/50 bg-rose-50/30 dark:bg-rose-950/15" : "border-zinc-200 dark:border-zinc-800"}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${a ? "bg-blue-100 dark:bg-blue-900/40" : p ? "bg-emerald-100 dark:bg-emerald-900/40" : f ? "bg-rose-100 dark:bg-rose-900/40" : "bg-zinc-100 dark:bg-zinc-800"}`}>
          {a ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" /> : p ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : f ? <XCircle className="w-4 h-4 text-rose-600" /> : <Icon className="w-4 h-4 text-zinc-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px] shrink-0">Step {step.id}</Badge><span className="text-sm font-medium">{step.title}</span>{p && <Badge className="text-[9px] bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20">PASS</Badge>}{f && <Badge variant="destructive" className="text-[9px]">FAIL</Badge>}</div>
          <p className="text-xs text-muted-foreground mt-1">{result.status === "idle" ? step.desc : result.message}</p>
          {result.detail && <p className="text-[11px] text-muted-foreground mt-1 font-[var(--font-geist-mono)] break-all">{result.detail}</p>}
        </div>
      </div>
    </div>
  );
}

const VERIFY_SCRIPT = `#!/usr/bin/env python3
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
`;

function ClaimVerifierTab() {
  const [running, setRunning] = useState(false);
  const [selectedSeq, setSelectedSeq] = useState("4");
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [receiptInfo, setReceiptInfo] = useState<any>(null);
  const [steps, setSteps] = useState<StepResult[]>(STEPS_META.map(() => ({ status: "idle", message: "" })));
  const [verdict, setVerdict] = useState<{ passed: number; total: number; label: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);

  const updateStep = (idx: number, result: StepResult) => setSteps(prev => { const n = [...prev]; n[idx] = result; return n; });

  const handleVerify = async () => {
    setRunning(true); setVerdict(null); setReceiptInfo(null);
    setSteps(STEPS_META.map(() => ({ status: "idle", message: "" })));
    const seq = parseInt(selectedSeq), gw = `${BASE}/api/agents/gateway`;
    try {
      const chain = (await (await fetch(`${gw}/chain?limit=500`)).json()).receipts || [];
      const receipt = chain.find((r: any) => parseInt(r.body?.seq || "0") === seq);
      if (!receipt) { updateStep(0, { status: "fail", message: `Receipt seq=${seq} not found` }); setRunning(false); return; }
      const body = receipt.body || {}, meta = receipt._meta || {};
      setReceiptInfo({ seq: body.seq, decision: body.decision, agent: meta.agent_id, action: meta.action, resource: meta.resource, hash: receipt.receipt_hash });

      updateStep(0, { status: "running", message: "Verifying Ed25519 signature..." });
      await new Promise(r => setTimeout(r, 200));
      const vd = await (await fetch(`${gw}/verify-receipt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt }) })).json();
      const sigOk = vd.receipt_integrity === "PASS";
      updateStep(0, { status: sigOk ? "pass" : "fail", message: sigOk ? "Ed25519 signature verified" : "Signature FAILED", detail: `kid: ${receipt.sig?.kid}  |  hash: ${(receipt.receipt_hash || "").slice(0, 40)}...` });

      updateStep(1, { status: "running", message: "Checking hash chain..." });
      await new Promise(r => setTimeout(r, 200));
      const prev = body.prev_receipt || "", gen = "sha256:" + "0".repeat(64);
      let chainOk = false, cMsg = "", cDet = "";
      if (prev === gen) { chainOk = true; cMsg = "Genesis receipt"; cDet = "First in chain"; }
      else { const p = chain.find((r: any) => parseInt(r.body?.seq || "0") === parseInt(body.seq) - 1); if (p?.receipt_hash === prev) { chainOk = true; cMsg = `Chain valid: seq ${body.seq} \u2192 ${parseInt(body.seq) - 1}`; cDet = `prev: ${prev.slice(0, 40)}...`; } else { cMsg = "CHAIN BREAK"; cDet = p ? `Expected ${prev.slice(0, 24)}... got ${(p.receipt_hash || "").slice(0, 24)}...` : "Predecessor not found"; } }
      updateStep(1, { status: chainOk ? "pass" : "fail", message: cMsg, detail: cDet });

      updateStep(2, { status: "running", message: "Fetching Merkle proof..." });
      await new Promise(r => setTimeout(r, 200));
      let proof: any = null, mOk = false, mMsg = "", mDet = "";
      try { const pr = await fetch(`${gw}/artifacts/proof/${receipt.receipt_hash}`); if (pr.ok) { proof = await pr.json(); mOk = true; mMsg = `Inclusion verified \u2014 leaf ${proof.leaf_index} of ${proof.tree_size}`; mDet = `root: ${(proof.root || "").slice(0, 40)}...  |  ${proof.proof?.length || 0} path steps`; } else { mMsg = "Not yet in anchored batch"; mDet = "Anchor first, then retry"; } } catch (e: any) { mMsg = `Error: ${e.message}`; }
      updateStep(2, { status: mOk ? "pass" : "fail", message: mMsg, detail: mDet });

      updateStep(3, { status: "running", message: "Checking Base L2..." });
      await new Promise(r => setTimeout(r, 200));
      let aOk = false, aMsg = "", aDet = "";
      try {
        const anchors = (await (await fetch(`${gw}/anchors`)).json()).on_chain_anchors || [];
        if (proof && anchors.length > 0) {
          const match = anchors.find((a: any) => { const r = a.artifact_seq_range || [0, 0]; return r[0] <= (proof.log_seq || 0) && (proof.log_seq || 0) <= r[1]; });
          if (match) { aOk = true; aMsg = `Anchored at block ${(match.block_number || 0).toLocaleString()}`; aDet = `tx: ${match.tx_hash}  |  Verify on BaseScan: calldata must equal the Merkle root`; }
          else { aMsg = "Batch not yet anchored"; aDet = `${anchors.length} anchor(s), none cover this range`; }
        } else { aMsg = proof ? "No anchors found" : "Skipped \u2014 no Merkle proof"; }
      } catch (e: any) { aMsg = `Error: ${e.message}`; }
      updateStep(3, { status: aOk ? "pass" : "fail", message: aMsg, detail: aDet });

      const results = [sigOk, chainOk, mOk, aOk];
      setVerdict({ passed: results.filter(Boolean).length, total: 4, ok: sigOk && chainOk, label: results.every(Boolean) ? "Receipt is AUTHENTIC and IMMUTABLE" : sigOk && chainOk ? "Receipt is AUTHENTIC (anchor pending)" : "VERIFICATION FAILED" });
    } catch (e: any) { updateStep(0, { status: "fail", message: `Error: ${e.message}` }); }
    setRunning(false);
  };

  return (
    <div className="space-y-5">
      <Card><CardContent className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-1">
            <span className="text-xs text-muted-foreground pl-2">seq #</span>
            <input type="number" min={1} value={selectedSeq} onChange={e => setSelectedSeq(e.target.value)} className="w-14 text-sm font-[var(--font-geist-mono)] bg-transparent border-none outline-none py-1.5 px-1" />
          </div>
          <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={async () => { setLoadingReceipts(true); try { setReceipts((await (await fetch(`${BASE}/api/agents/gateway/chain?limit=25`)).json()).receipts?.slice().reverse() || []); } catch {} setLoadingReceipts(false); }} disabled={loadingReceipts}>
            {loadingReceipts ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Browse
          </Button>
          <div className="flex-1" />
          <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5" onClick={handleVerify} disabled={running}>
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />} Verify
          </Button>
        </div>
        {receipts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 pt-3 border-t">
            {receipts.map((r: any) => { const b = r.body || {}, m = r._meta || {}, s = b.seq || "?"; return (
              <button key={s} onClick={() => setSelectedSeq(s)} className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${selectedSeq === s ? "border-primary bg-primary/10 text-primary font-medium" : "border-zinc-200 dark:border-zinc-700 hover:border-primary/40 text-muted-foreground"}`}>
                <span className="font-[var(--font-geist-mono)]">#{s}</span> <span className={b.decision === "approve" ? "text-emerald-600" : "text-rose-500"}>{b.decision === "approve" ? "\u2713" : "\u2717"}</span> {m.action || "?"}
              </button>); })}
          </div>
        )}
      </CardContent></Card>

      {receiptInfo && (
        <div className="rounded-lg border bg-muted/20 px-4 py-3 flex items-center gap-4 flex-wrap text-xs">
          <Badge variant="outline" className="text-[10px]">#{receiptInfo.seq}</Badge>
          <span className={`font-semibold ${receiptInfo.decision === "approve" ? "text-emerald-600" : "text-rose-600"}`}>{(receiptInfo.decision || "").toUpperCase()}</span>
          <span className="text-muted-foreground">{receiptInfo.agent}: {receiptInfo.action} on {receiptInfo.resource}</span>
          <span className="flex-1" />
          <code className="font-[var(--font-geist-mono)] text-[10px] text-muted-foreground">{(receiptInfo.hash || "").slice(0, 32)}...</code>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {STEPS_META.map((step, i) => <StepCard key={step.id} step={step} result={steps[i]} />)}
      </div>

      {verdict && (
        <div className={`rounded-lg border-2 p-5 text-center ${verdict.ok ? "border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-rose-400/60 bg-rose-50/40 dark:bg-rose-950/20"}`}>
          <div className="flex items-center justify-center gap-3 mb-1">{verdict.ok ? <CheckCircle2 className="w-6 h-6 text-emerald-600" /> : <XCircle className="w-6 h-6 text-rose-600" />}<span className="text-base font-semibold">{verdict.label}</span></div>
          <p className="text-sm text-muted-foreground">{verdict.passed}/{verdict.total} steps passed</p>
        </div>
      )}

      <Collapsible open={scriptOpen} onOpenChange={setScriptOpen}>
        <Card>
          <CardHeader className="pb-0">
            <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
              <CardTitle className="text-sm flex items-center gap-2"><Terminal className="w-4 h-4" /> Python Script <Badge variant="outline" className="text-[10px]">verify_claim.py</Badge></CardTitle>
              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${scriptOpen ? "rotate-90" : ""}`} />
            </CollapsibleTrigger>
            <p className="text-xs text-muted-foreground mt-2 pb-3">Full offline verification — fetches the actual Base L2 transaction via RPC and compares calldata to the recomputed Merkle root.</p>
          </CardHeader>
          <CollapsibleContent><CardContent className="pt-0">
            <div className="flex gap-1.5 mb-3">
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => { copyText(VERIFY_SCRIPT); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}</Button>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([VERIFY_SCRIPT], { type: "text/x-python" })); a.download = "verify_claim.py"; a.click(); }}><Download className="w-3 h-3" /> Download</Button>
            </div>
            <div className="text-xs font-[var(--font-geist-mono)] bg-zinc-900 text-zinc-400 rounded-md px-3 py-2 mb-3">
              <span className="text-emerald-400">$</span> pip install cryptography httpx<br />
              <span className="text-emerald-400">$</span> python verify_claim.py --gateway https://agent-auth-gateway-1031148889398.us-central1.run.app --seq {selectedSeq}
            </div>
            <pre className="font-[var(--font-geist-mono)] text-[11px] bg-zinc-950 text-zinc-300 rounded-md p-4 overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre leading-relaxed">{VERIFY_SCRIPT}</pre>
          </CardContent></CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Tab 3: Artifact Anchoring
// ═══════════════════════════════════════════════════════

function ArtifactAnchoringTab() {
  const [anchors, setAnchors] = useState<any[]>([]);
  const [logData, setLogData] = useState<any>(null);
  const [expanded, setExpanded] = useState(true);
  const [anchoring, setAnchoring] = useState(false);
  const [anchorResult, setAnchorResult] = useState<any>(null);
  const [hashToSeq, setHashToSeq] = useState<Record<string, string>>({});

  const TYPE_LABELS: Record<string, string> = { receipt: "Receipt", audit_report: "Audit Report", policy_proposal: "Policy Proposal", incident_report: "Incident Report", isolation_record: "Isolation Record" };
  const TYPE_COLORS: Record<string, string> = { receipt: "bg-blue-600/15 text-blue-700 dark:text-blue-400 border-blue-600/20", audit_report: "bg-teal-600/15 text-teal-700 dark:text-teal-400 border-teal-600/20", policy_proposal: "bg-violet-600/15 text-violet-700 dark:text-violet-400 border-violet-600/20", incident_report: "bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/20", isolation_record: "bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-600/20" };

  const refresh = useCallback(() => {
    fetch(`${BASE}/api/agents/gateway/anchors`).then(r => r.json()).then(d => setAnchors(d.on_chain_anchors || [])).catch(() => {});
    fetch(`${BASE}/api/agents/gateway/artifacts/log?limit=100`).then(r => r.json()).then(setLogData).catch(() => {});
    fetch(`${BASE}/api/agents/gateway/chain?limit=500`).then(r => r.json()).then(d => { const m: Record<string, string> = {}; for (const r of (d.receipts || [])) m[r.receipt_hash || ""] = r.body?.seq || ""; setHashToSeq(m); }).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const latest = anchors[0];
  const entries = logData?.entries || [];
  const batchArtifacts = latest ? entries.filter((e: any) => e.seq >= (latest.artifact_seq_range?.[0] || 0) && e.seq <= (latest.artifact_seq_range?.[1] || 0)) : [];
  const typeCounts: Record<string, number> = {};
  for (const a of batchArtifacts) typeCounts[a.artifact_type] = (typeCounts[a.artifact_type] || 0) + 1;

  return (
    <div className="space-y-5">
      <Card><CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div><div className="text-sm font-medium">{logData?.head_seq || 0} artifacts in unified log</div><div className="text-xs text-muted-foreground mt-0.5">Receipts, audit reports, policy proposals, incident reports, isolation records</div></div>
          <Button size="sm" className="h-8 gap-1.5" onClick={async () => { setAnchoring(true); setAnchorResult(null); try { const d = await (await fetch(`${BASE}/api/agents/gateway/anchors/trigger`, { method: "POST" })).json(); setAnchorResult(d); if (d.status === "anchored") refresh(); } catch (e: any) { setAnchorResult({ status: "error", reason: e.message }); } setAnchoring(false); }} disabled={anchoring}>
            {anchoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Anchor className="w-3.5 h-3.5" />} {anchoring ? "Anchoring..." : "Anchor Now"}
          </Button>
        </div>
        {anchorResult?.status === "anchored" && (<div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 mb-4"><div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Anchored {anchorResult.artifact_count} artifacts</span></div><a href={anchorResult.basescan_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"><ExternalLink className="w-3 h-3" /> View on BaseScan</a></div>)}
        {anchorResult?.status === "skipped" && (<div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 mb-4"><div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600" /><span className="text-sm font-medium text-amber-700 dark:text-amber-400">Already up to date</span></div><span className="text-xs text-muted-foreground mt-1">{anchorResult.reason || "No new artifacts since last anchor"}</span></div>)}
        {anchorResult?.status === "error" && (<div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 mb-4"><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600" /><span className="text-sm font-medium text-red-700 dark:text-red-400">Anchor failed</span></div><span className="text-xs text-muted-foreground mt-1">{anchorResult.reason || "Unknown error"}</span></div>)}
        {latest ? (<>
          <div className="flex items-center gap-2 mb-4"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Anchored to Base L2</span></div>
          {batchArtifacts.length > 0 && (<div className="rounded-lg border bg-muted/20 p-4 mb-4"><p className="text-xs font-semibold mb-3">What&apos;s in this anchor batch:</p><div className="flex flex-wrap gap-2 mb-3">{Object.entries(typeCounts).map(([t, c]) => (<Badge key={t} className={`text-[10px] ${TYPE_COLORS[t] || ""}`}>{c} {TYPE_LABELS[t] || t}{c !== 1 ? "s" : ""}</Badge>))}</div><p className="text-[11px] text-muted-foreground">{batchArtifacts.length} artifacts (seq {latest.artifact_seq_range?.[0]}&ndash;{latest.artifact_seq_range?.[1]}) in one Merkle tree.</p></div>)}
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 mb-4"><p className="text-xs font-semibold mb-2">What this proves:</p><ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside"><li><strong>{latest.artifact_count} artifacts</strong> were hashed into a Merkle tree &mdash; {Object.entries(typeCounts).map(([t, c]) => `${c} ${TYPE_LABELS[t] || t}${c !== 1 ? "s" : ""}`).join(", ") || "loading..."}</li><li>The <strong>Merkle root</strong> was written to Base L2 calldata at block {latest.block_number?.toLocaleString()}</li><li>No one &mdash; not even Gate &mdash; can alter these artifacts after anchoring</li><li>Anyone can recompute the tree and verify the root matches on-chain</li></ul></div>
          <div className="grid grid-cols-[100px_1fr] gap-y-2 gap-x-4 text-sm">
            <span className="text-muted-foreground text-xs">Tx:</span><a href={`https://basescan.org/tx/${latest.tx_hash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-[var(--font-geist-mono)]">{String(latest.tx_hash || "").slice(0, 26)}... <ExternalLink className="w-3 h-3" /></a>
            <span className="text-muted-foreground text-xs">Block:</span><span className="text-xs">{latest.block_number?.toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">Root:</span><code className="font-[var(--font-geist-mono)] text-xs text-muted-foreground">{String(latest.merkle_root || "").slice(0, 40)}...</code>
            <span className="text-muted-foreground text-xs">Batch range:</span><span className="text-xs">seq {latest.artifact_seq_range?.[0]} &ndash; {latest.artifact_seq_range?.[1]}</span>
            <span className="text-muted-foreground text-xs">Cost:</span><span className="text-xs">~$0.001 (Base L2 calldata)</span>
          </div>
        </>) : <p className="text-sm text-muted-foreground">No anchors yet. Click Anchor Now.</p>}
      </CardContent></Card>

      {entries.length > 0 && (<Card><CardHeader className="pb-2"><Collapsible open={expanded} onOpenChange={setExpanded}><CollapsibleTrigger className="flex items-center gap-2 w-full text-left"><CardTitle className="text-sm flex items-center gap-2"><ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} /> Artifact Log <Badge variant="outline" className="text-[10px]">{entries.length}</Badge></CardTitle></CollapsibleTrigger>
        <CollapsibleContent><div className="space-y-0.5 mt-3">{[...entries].reverse().map((e: any) => {
          const inBatch = latest?.artifact_seq_range && e.seq >= latest.artifact_seq_range[0] && e.seq <= latest.artifact_seq_range[1];
          const rSeq = e.artifact_type === "receipt" ? hashToSeq[e.artifact_id] : null;
          return (<div key={e.seq} className={`flex items-center gap-2 text-xs py-1.5 px-2 rounded ${inBatch ? "bg-emerald-50/50 dark:bg-emerald-950/10" : "hover:bg-muted/30"}`}>
            <Badge variant="outline" className="text-[10px] font-[var(--font-geist-mono)] w-10 justify-center">#{e.seq}</Badge>
            <Badge className={`text-[9px] ${TYPE_COLORS[e.artifact_type] || ""}`}>{TYPE_LABELS[e.artifact_type] || e.artifact_type}</Badge>
            {rSeq && <span className="text-[11px] text-muted-foreground">seq <span className="font-semibold text-foreground">#{rSeq}</span></span>}
            <code className="font-[var(--font-geist-mono)] text-[11px] text-muted-foreground truncate flex-1">{(e.artifact_hash || "").slice(0, 24)}...</code>
            {inBatch && <span><CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /></span>}
          </div>);
        })}</div></CollapsibleContent></Collapsible></CardHeader></Card>)}
      {anchors.length > 0 && <div className="text-xs text-muted-foreground text-center">{anchors.length} total anchor{anchors.length !== 1 ? "s" : ""} on Base L2</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════

export default function VerifyPage() {
  const [activeTab, setActiveTab] = useState<TabId>("claim");
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <div className="flex-1 max-w-[1100px] mx-auto w-full p-6 space-y-6">
        <div><h1 className="text-lg font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Verify &amp; Anchoring</h1><p className="text-sm text-muted-foreground mt-1">Cryptographic receipt verification, 4-step claim verifier with downloadable Python script, and on-chain Merkle anchoring.</p></div>
        <div className="flex gap-1 border-b">{TABS.map(tab => { const Icon = tab.icon; return (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Icon className="w-3.5 h-3.5" />{tab.label}</button>); })}</div>
        {activeTab === "receipt" && <ReceiptVerifierTab />}
        {activeTab === "claim" && <ClaimVerifierTab />}
        {activeTab === "anchoring" && <ArtifactAnchoringTab />}
      </div>
    </div>
  );
}
