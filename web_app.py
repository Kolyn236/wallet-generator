#!/usr/bin/env python3
"""
Local web UI for doge-wallet-generator.

Security model:
- binds only to 127.0.0.1;
- private WIFs are processed only by the local Python process;
- no secrets are persisted by the web app;
- network access is used only when the user explicitly broadcasts a signed tx.
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
import urllib.error
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from broadcast_blockcypher import broadcast as broadcast_blockcypher
from build_cpfp import build_cpfp
from doge_wallet import (
    build_signed_transaction,
    doge_to_koinu,
    double_sha256,
    format_doge,
    generate_wallet,
    wallet_from_wif,
)

HOST = "127.0.0.1"
DEFAULT_PORT = 8765
LOCAL_TOKEN = secrets.token_urlsafe(32)


def txid_from_raw(raw: bytes) -> str:
    return double_sha256(raw)[::-1].hex()


HTML = r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Doge Wallet Lab</title>
<style>
:root {
  color-scheme: dark;
  --bg:#0b1020;
  --panel:#121a30;
  --text:#eef3ff;
  --muted:#91a0bf;
  --line:#263451;
  --accent:#f5b942;
  --accent2:#ffd86b;
  --good:#5ee6a8;
  --bad:#ff7f91;
  --shadow:0 18px 60px rgba(0,0,0,.30);
}
* { box-sizing:border-box; }
body {
  margin:0; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  background:radial-gradient(circle at 15% 0%, #162246 0, var(--bg) 38%), var(--bg);
  color:var(--text); min-height:100vh;
}
.wrap { max-width:1180px; margin:0 auto; padding:34px 22px 70px; }
header { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:24px; }
h1 { margin:0; font-size:clamp(30px,5vw,54px); letter-spacing:-.04em; }
.subtitle { color:var(--muted); margin:8px 0 0; max-width:720px; line-height:1.55; }
.badge {
  border:1px solid #38513f; background:#102b22; color:var(--good); padding:8px 11px;
  border-radius:999px; font-size:12px; font-weight:800; white-space:nowrap;
}
.notice {
  border:1px solid #5a4726; background:#2a2215; padding:14px 16px; border-radius:14px;
  color:#f6d99f; margin:0 0 22px; line-height:1.5;
}
.tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px; }
.tab {
  border:1px solid var(--line); background:#0f172b; color:var(--muted); border-radius:11px;
  padding:10px 14px; cursor:pointer; font-weight:750;
}
.tab.active { background:var(--accent); color:#201600; border-color:var(--accent); }
.panel {
  display:none; background:linear-gradient(180deg,var(--panel),#0f1729);
  border:1px solid var(--line); border-radius:20px; padding:22px; box-shadow:var(--shadow);
}
.panel.active { display:block; }
.grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.full { grid-column:1/-1; }
label { display:block; font-size:12px; font-weight:800; color:#b7c3dd; margin:0 0 7px; text-transform:uppercase; letter-spacing:.06em; }
input, textarea {
  width:100%; border:1px solid var(--line); background:#0a1122; color:var(--text);
  border-radius:11px; padding:12px 13px; font:inherit; outline:none;
}
input:focus, textarea:focus { border-color:#a57b2b; box-shadow:0 0 0 3px rgba(245,185,66,.10); }
textarea { min-height:118px; resize:vertical; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
button.primary, button.secondary, button.danger {
  border:0; border-radius:11px; padding:12px 16px; cursor:pointer; font-weight:850; font-size:14px;
}
button.primary { background:var(--accent); color:#211600; }
button.primary:hover { background:var(--accent2); }
button.secondary { background:#22304d; color:var(--text); }
button.danger { background:#522231; color:#ffdbe1; }
.actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:16px; }
.help { margin-top:6px; color:var(--muted); font-size:12px; line-height:1.45; }
.result {
  display:none; margin-top:18px; border:1px solid #2c3c5e; background:#0a1224;
  padding:16px; border-radius:14px; overflow:auto;
}
.result.show { display:block; }
.result.good { border-color:#275742; }
.result.bad { border-color:#6c3240; }
.kv { display:grid; grid-template-columns:190px 1fr; gap:8px 12px; margin:8px 0; }
.kv div:nth-child(odd) { color:var(--muted); }
.mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; overflow-wrap:anywhere; }
.secret { filter:blur(7px); user-select:none; transition:.15s; }
.secret.reveal { filter:none; user-select:text; }
h2 { margin:0 0 16px; font-size:23px; }
.small { font-size:12px; color:var(--muted); }
.check { display:flex; gap:10px; align-items:flex-start; margin-top:14px; color:#c9d3e8; }
.check input { width:auto; margin-top:3px; }
a { color:#ffd16c; }
@media (max-width:760px) {
  header { flex-direction:column; }
  .grid { grid-template-columns:1fr; }
  .kv { grid-template-columns:1fr; }
}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>Doge Wallet Lab</h1>
      <p class="subtitle">Local UI for generating Dogecoin keys, building and signing P2PKH transactions, CPFP rescue, and explicit broadcast.</p>
    </div>
    <div class="badge">LOCAL · 127.0.0.1</div>
  </header>

  <div class="notice"><b>Private keys stay local.</b> WIF values are sent only from this browser tab to the Python process on 127.0.0.1. The app does not persist them. Only an already-signed raw transaction leaves the machine when you explicitly broadcast.</div>

  <div class="tabs">
    <button class="tab active" data-tab="wallet">Wallet</button>
    <button class="tab" data-tab="send">Send DOGE</button>
    <button class="tab" data-tab="cpfp">CPFP rescue</button>
    <button class="tab" data-tab="broadcast">Broadcast</button>
  </div>

  <section id="wallet" class="panel active">
    <h2>Generate a local wallet</h2>
    <p class="small">A new secp256k1 private key is generated locally with Python's cryptographic RNG.</p>
    <div class="actions"><button class="primary" onclick="generateWallet()">Generate wallet</button></div>
    <div id="wallet-result" class="result"></div>
  </section>

  <section id="send" class="panel">
    <h2>Build & sign a transfer</h2>
    <div class="grid">
      <div class="full">
        <label>Source WIF · local secret</label>
        <input id="send-wif" type="password" autocomplete="off" placeholder="Q...">
        <div class="help">The source address is derived from WIF, so there is no ambiguous source-address field.</div>
      </div>
      <div>
        <label>UTXO transaction ID</label>
        <input id="send-utxo-txid" class="mono" placeholder="64 hex characters">
      </div>
      <div>
        <label>UTXO vout</label>
        <input id="send-utxo-vout" type="number" min="0" value="0">
      </div>
      <div>
        <label>UTXO amount · DOGE</label>
        <input id="send-utxo-amount" inputmode="decimal" placeholder="10">
      </div>
      <div>
        <label>Send amount · DOGE</label>
        <input id="send-amount" inputmode="decimal" placeholder="3">
      </div>
      <div class="full">
        <label>Recipient · To address</label>
        <input id="send-to" class="mono" placeholder="D...">
      </div>
      <div>
        <label>Fee rate · DOGE/kB</label>
        <input id="send-fee-rate" inputmode="decimal" value="0.01">
        <div class="help">0.01 DOGE/kB is the documented Dogecoin Core recommendation, not a live fee estimate.</div>
      </div>
      <div>
        <label>Change address · optional</label>
        <input id="send-change" class="mono" placeholder="blank = back to source">
      </div>
    </div>
    <div class="actions"><button class="primary" onclick="buildTx()">Build signed transaction</button></div>
    <div id="send-result" class="result"></div>
  </section>

  <section id="cpfp" class="panel">
    <h2>CPFP rescue</h2>
    <p class="small">Parent TXID and byte size are computed from the signed parent raw transaction to avoid manual TXID mistakes.</p>
    <div class="grid">
      <div class="full">
        <label>Source WIF · local secret</label>
        <input id="cpfp-wif" type="password" autocomplete="off" placeholder="Q...">
      </div>
      <div class="full">
        <label>Parent signed raw transaction</label>
        <textarea id="cpfp-parent-raw" placeholder="01000000..."></textarea>
      </div>
      <div>
        <label>Parent output vout to spend</label>
        <input id="cpfp-vout" type="number" min="0" value="1">
      </div>
      <div>
        <label>Parent output amount · DOGE</label>
        <input id="cpfp-utxo-amount" inputmode="decimal" placeholder="6.99774000">
      </div>
      <div>
        <label>Parent fee · DOGE</label>
        <input id="cpfp-parent-fee" inputmode="decimal" placeholder="0.00226000">
      </div>
      <div>
        <label>Target package rate · DOGE/kB</label>
        <input id="cpfp-rate" inputmode="decimal" value="0.80">
      </div>
      <div class="full">
        <label>Child destination · optional</label>
        <input id="cpfp-to" class="mono" placeholder="blank = self-transfer back to source">
        <div class="help">For a pure CPFP rescue, blank means the remaining output returns to the source wallet.</div>
      </div>
    </div>
    <div class="actions"><button class="primary" onclick="buildCpfp()">Build CPFP child</button></div>
    <div id="cpfp-result" class="result"></div>
  </section>

  <section id="broadcast" class="panel">
    <h2>Broadcast signed raw transaction</h2>
    <div>
      <label>Raw transaction</label>
      <textarea id="broadcast-raw" placeholder="Paste signed raw tx hex"></textarea>
    </div>
    <label class="check"><input id="broadcast-confirm" type="checkbox"> <span>I reviewed the transaction and understand that broadcast is irreversible.</span></label>
    <div class="actions"><button class="danger" onclick="broadcastTx()">Broadcast via BlockCypher</button></div>
    <div id="broadcast-result" class="result"></div>
  </section>
</div>

<script>
const LOCAL_TOKEN = "__LOCAL_TOKEN__";

document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(btn.dataset.tab).classList.add("active");
}));

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
}
function show(id, html, good=true) {
  const el = document.getElementById(id);
  el.className = "result show " + (good ? "good" : "bad");
  el.innerHTML = html;
}
async function post(path, body) {
  const r = await fetch(path, {
    method:"POST",
    headers:{"Content-Type":"application/json","X-Local-Token":LOCAL_TOKEN},
    body:JSON.stringify(body)
  });
  let data = {};
  try { data = await r.json(); } catch (_) {}
  if (!r.ok) throw new Error(data.error || ("HTTP " + r.status));
  return data;
}
function kv(rows) {
  return '<div class="kv">' + rows.map(([k,v,cls=""]) => `<div>${esc(k)}</div><div class="${cls}">${esc(v)}</div>`).join("") + '</div>';
}
function loadBroadcast(raw) {
  document.getElementById("broadcast-raw").value = raw;
  document.querySelector('[data-tab="broadcast"]').click();
}

async function generateWallet() {
  try {
    const d = await post("/api/generate", {});
    show("wallet-result",
      kv([
        ["DOGE address", d.address, "mono"],
        ["Public key", d.public_key, "mono"],
        ["WIF", d.wif, "mono secret"],
        ["Private key hex", d.private_key_hex, "mono secret"]
      ]) + '<div class="actions"><button class="secondary" id="toggle-wallet-secrets">Reveal / hide secrets</button></div>'
    );
    document.getElementById("toggle-wallet-secrets").onclick = () => {
      document.querySelectorAll("#wallet-result .secret").forEach(x => x.classList.toggle("reveal"));
    };
  } catch(e) { show("wallet-result", esc(e.message), false); }
}

async function buildTx() {
  try {
    const d = await post("/api/build", {
      wif: document.getElementById("send-wif").value,
      utxo_txid: document.getElementById("send-utxo-txid").value.trim(),
      utxo_vout: document.getElementById("send-utxo-vout").value,
      utxo_amount: document.getElementById("send-utxo-amount").value.trim(),
      to: document.getElementById("send-to").value.trim(),
      amount: document.getElementById("send-amount").value.trim(),
      fee_rate: document.getElementById("send-fee-rate").value.trim(),
      change: document.getElementById("send-change").value.trim()
    });
    show("send-result",
      kv([
        ["From / source", d.source, "mono"],
        ["To / recipient", d.destination, "mono"],
        ["Send", d.send + " DOGE"],
        ["Change", d.change + " DOGE"],
        ["Change address", d.change_address || "none", "mono"],
        ["Network fee", d.fee + " DOGE"],
        ["Size", d.size + " bytes"],
        ["TXID", d.txid, "mono"]
      ]) + '<div class="actions"><button class="secondary" id="load-built">Load into Broadcast</button></div>'
    );
    document.getElementById("load-built").onclick = () => loadBroadcast(d.raw_hex);
  } catch(e) { show("send-result", esc(e.message), false); }
}

async function buildCpfp() {
  try {
    const d = await post("/api/cpfp", {
      wif: document.getElementById("cpfp-wif").value,
      parent_raw: document.getElementById("cpfp-parent-raw").value,
      parent_vout: document.getElementById("cpfp-vout").value,
      parent_utxo_amount: document.getElementById("cpfp-utxo-amount").value.trim(),
      parent_fee: document.getElementById("cpfp-parent-fee").value.trim(),
      target_rate: document.getElementById("cpfp-rate").value.trim(),
      to: document.getElementById("cpfp-to").value.trim()
    });
    show("cpfp-result",
      kv([
        ["Parent TXID", d.parent_txid, "mono"],
        ["Parent size", d.parent_size + " bytes"],
        ["Child destination", d.destination, "mono"],
        ["Child output", d.child_output + " DOGE"],
        ["Child fee", d.child_fee + " DOGE"],
        ["Child size", d.child_size + " bytes"],
        ["Package rate", d.package_rate + " DOGE/kB"],
        ["Child TXID", d.txid, "mono"]
      ]) + '<div class="actions"><button class="secondary" id="load-cpfp">Load child into Broadcast</button></div>'
    );
    document.getElementById("load-cpfp").onclick = () => loadBroadcast(d.raw_hex);
  } catch(e) { show("cpfp-result", esc(e.message), false); }
}

async function broadcastTx() {
  if (!document.getElementById("broadcast-confirm").checked) {
    show("broadcast-result", "Tick the irreversible-broadcast confirmation first.", false); return;
  }
  try {
    const d = await post("/api/broadcast", {raw_hex: document.getElementById("broadcast-raw").value});
    const link = "https://blockchair.com/dogecoin/transaction/" + encodeURIComponent(d.txid);
    show("broadcast-result",
      kv([["TXID", d.txid, "mono"],["Provider", "BlockCypher"],["Result", d.status]]) +
      `<div class="actions"><a href="${link}" target="_blank" rel="noopener">Open in Blockchair ↗</a></div>`
    );
  } catch(e) { show("broadcast-result", esc(e.message), false); }
}
</script>
</body>
</html>
'''


class Handler(BaseHTTPRequestHandler):
    server_version = "DogeWalletLab/0.1"

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("[web] " + (fmt % args) + "\n")

    def _headers(self, status: int, content_type: str = "application/json; charset=utf-8") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; "
            "connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
        )
        self.end_headers()

    def _json(self, status: int, payload: dict) -> None:
        self._headers(status)
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def _body(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ValueError("Invalid Content-Length.") from exc
        if length <= 0 or length > 2_000_000:
            raise ValueError("Request body is empty or too large.")
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("Request body must be valid JSON.") from exc
        if not isinstance(value, dict):
            raise ValueError("JSON body must be an object.")
        return value

    def _authorized(self) -> bool:
        return secrets.compare_digest(self.headers.get("X-Local-Token", ""), LOCAL_TOKEN)

    def do_GET(self) -> None:
        if self.path != "/":
            self._json(404, {"error": "Not found"})
            return
        page = HTML.replace("__LOCAL_TOKEN__", LOCAL_TOKEN).encode("utf-8")
        self._headers(200, "text/html; charset=utf-8")
        self.wfile.write(page)

    def do_POST(self) -> None:
        if not self._authorized():
            self._json(403, {"error": "Local UI token mismatch. Reload the page."})
            return
        try:
            body = self._body()
            if self.path == "/api/generate":
                self._api_generate()
            elif self.path == "/api/build":
                self._api_build(body)
            elif self.path == "/api/cpfp":
                self._api_cpfp(body)
            elif self.path == "/api/broadcast":
                self._api_broadcast(body)
            else:
                self._json(404, {"error": "Not found"})
        except (RuntimeError, ValueError, OSError, urllib.error.URLError) as exc:
            self._json(400, {"error": str(exc)})

    def _api_generate(self) -> None:
        wallet = generate_wallet()
        self._json(200, {
            "address": wallet.address,
            "public_key": wallet.public_key_compressed.hex(),
            "wif": wallet.wif,
            "private_key_hex": f"{wallet.private_key:064x}",
        })

    def _api_build(self, body: dict) -> None:
        wif = str(body.get("wif", "")).strip()
        wallet = wallet_from_wif(wif)
        change = str(body.get("change", "")).strip() or None
        tx = build_signed_transaction(
            private_key=wallet.private_key,
            source_address=wallet.address,
            prev_txid=str(body.get("utxo_txid", "")).strip(),
            vout=int(body.get("utxo_vout", 0)),
            input_value=doge_to_koinu(str(body.get("utxo_amount", "")).strip()),
            destination_address=str(body.get("to", "")).strip(),
            send_value=doge_to_koinu(str(body.get("amount", "")).strip()),
            fee_rate_koinu_per_kb=doge_to_koinu(str(body.get("fee_rate", "0.01")).strip()),
            change_address=change,
        )
        self._json(200, {
            "source": tx.source_address,
            "destination": tx.destination_address,
            "send": format_doge(tx.sent),
            "change": format_doge(tx.change),
            "change_address": tx.change_address,
            "fee": format_doge(tx.fee),
            "size": tx.size,
            "txid": tx.txid,
            "raw_hex": tx.raw.hex(),
        })

    def _api_cpfp(self, body: dict) -> None:
        wif = str(body.get("wif", "")).strip()
        wallet = wallet_from_wif(wif)

        raw_hex = "".join(str(body.get("parent_raw", "")).split())
        try:
            parent_raw = bytes.fromhex(raw_hex)
        except ValueError as exc:
            raise ValueError("Parent raw transaction must be hexadecimal.") from exc
        if not parent_raw:
            raise ValueError("Parent raw transaction is empty.")

        parent_txid = txid_from_raw(parent_raw)
        parent_size = len(parent_raw)
        destination = str(body.get("to", "")).strip() or wallet.address

        raw, child_fee, output_value, child_size, package_rate = build_cpfp(
            wif=wif,
            source_address=wallet.address,
            parent_txid=parent_txid,
            parent_vout=int(body.get("parent_vout", 0)),
            parent_utxo_value=doge_to_koinu(str(body.get("parent_utxo_amount", "")).strip()),
            parent_fee=doge_to_koinu(str(body.get("parent_fee", "")).strip()),
            parent_size=parent_size,
            destination_address=destination,
            target_package_rate=doge_to_koinu(str(body.get("target_rate", "0.80")).strip()),
        )
        self._json(200, {
            "parent_txid": parent_txid,
            "parent_size": parent_size,
            "destination": destination,
            "child_output": format_doge(output_value),
            "child_fee": format_doge(child_fee),
            "child_size": child_size,
            "package_rate": f"{package_rate:.8f}",
            "txid": txid_from_raw(raw),
            "raw_hex": raw.hex(),
        })

    def _api_broadcast(self, body: dict) -> None:
        raw_hex = "".join(str(body.get("raw_hex", "")).split())
        try:
            raw = bytes.fromhex(raw_hex)
        except ValueError as exc:
            raise ValueError("Raw transaction must be hexadecimal.") from exc
        if not raw:
            raise ValueError("Raw transaction is empty.")

        txid = txid_from_raw(raw)
        result = broadcast_blockcypher(raw.hex(), os.environ.get("BLOCKCYPHER_TOKEN"))
        remote_hash = None
        if isinstance(result, dict):
            tx = result.get("tx")
            if isinstance(tx, dict):
                remote_hash = tx.get("hash")
        if remote_hash and remote_hash != txid:
            raise RuntimeError(
                f"Broadcast provider returned unexpected txid {remote_hash}; local txid is {txid}."
            )
        self._json(200, {"txid": txid, "status": "accepted", "provider_response": result})


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the local Dogecoin wallet web UI.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--open", action="store_true", help="open the UI in the default browser")
    args = parser.parse_args()

    if not (1 <= args.port <= 65535):
        print("error: --port must be between 1 and 65535", file=sys.stderr)
        return 1

    server = ThreadingHTTPServer((HOST, args.port), Handler)
    url = f"http://{HOST}:{args.port}/"
    print("Doge Wallet Lab")
    print(f"Listening only on {HOST}:{args.port}")
    print(url)
    print("Press Ctrl+C to stop.")
    if args.open:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
