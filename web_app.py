#!/usr/bin/env python3
"""
Local bilingual web UI for doge-wallet-generator.

Security model:
- binds only to 127.0.0.1;
- private WIFs are processed only by the local Python process;
- no secrets are persisted by the web app;
- language preference is the only value stored in localStorage;
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
  color-scheme: light;
  --bg:#f5f6f2;
  --surface:#ffffff;
  --surface-soft:#fafaf7;
  --text:#171912;
  --muted:#6f7468;
  --line:#e3e5dc;
  --accent:#d9a51b;
  --accent-strong:#b78300;
  --accent-soft:#fff4cf;
  --good:#19764a;
  --good-soft:#eaf8f0;
  --bad:#b63c4a;
  --bad-soft:#fff0f1;
  --shadow:0 24px 70px rgba(42,45,34,.10);
  --shadow-soft:0 10px 32px rgba(42,45,34,.07);
}
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body {
  margin:0;
  min-height:100vh;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  color:var(--text);
  background:
    radial-gradient(circle at 8% 0%, rgba(242,196,72,.18), transparent 31rem),
    radial-gradient(circle at 94% 8%, rgba(161,184,126,.13), transparent 28rem),
    var(--bg);
}
button,input,textarea { font:inherit; }
button { -webkit-tap-highlight-color:transparent; }
.wrap { max-width:1180px; margin:0 auto; padding:28px 22px 72px; }
header { display:flex; justify-content:space-between; gap:28px; align-items:flex-start; margin-bottom:22px; }
.brand { display:flex; align-items:flex-start; gap:14px; }
.brand-mark {
  flex:0 0 auto; width:46px; height:46px; display:grid; place-items:center;
  border-radius:15px; background:linear-gradient(145deg,#f4c94f,#d79e0f); color:#fff;
  box-shadow:0 10px 26px rgba(185,135,0,.22); font-size:27px; font-weight:900;
}
.eyebrow { margin:0 0 4px; color:var(--accent-strong); font-size:12px; font-weight:850; letter-spacing:.09em; text-transform:uppercase; }
h1 { margin:0; font-size:clamp(30px,5vw,48px); line-height:1; letter-spacing:-.045em; }
.subtitle { color:var(--muted); margin:9px 0 0; max-width:690px; line-height:1.55; font-size:15px; }
.header-actions { display:flex; gap:9px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
.badge {
  border:1px solid #cfe5d7; background:var(--good-soft); color:var(--good); padding:8px 11px;
  border-radius:999px; font-size:11px; font-weight:850; white-space:nowrap;
}
.lang-switch { display:flex; gap:3px; padding:4px; border:1px solid var(--line); background:rgba(255,255,255,.78); border-radius:12px; box-shadow:var(--shadow-soft); }
.lang-btn { border:0; background:transparent; color:var(--muted); border-radius:9px; padding:7px 10px; cursor:pointer; font-weight:850; font-size:12px; }
.lang-btn.active { background:var(--text); color:white; }
.notice {
  display:flex; gap:12px; align-items:flex-start; border:1px solid #eadcae; background:rgba(255,250,232,.92);
  padding:14px 16px; border-radius:17px; color:#66551f; margin:0 0 20px; line-height:1.5; box-shadow:var(--shadow-soft);
}
.notice-icon { flex:0 0 auto; width:30px; height:30px; display:grid; place-items:center; border-radius:10px; background:#fff1b7; color:#7c5d00; font-weight:900; }
.workflow-card { border:1px solid rgba(219,221,211,.92); background:rgba(255,255,255,.74); backdrop-filter:blur(12px); border-radius:24px; padding:13px; box-shadow:var(--shadow); margin-bottom:16px; }
.workflow-head { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:3px 4px 11px; }
.workflow-label { color:var(--muted); font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
.step-counter { color:var(--muted); font-size:12px; font-weight:750; }
.steps {
  display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px;
  overflow-x:auto; scrollbar-width:none; scroll-snap-type:x proximity;
}
.steps::-webkit-scrollbar { display:none; }
.step {
  min-width:0; border:1px solid transparent; background:transparent; text-align:left; cursor:pointer;
  border-radius:16px; padding:12px 13px; display:flex; gap:10px; align-items:center; color:var(--muted); scroll-snap-align:start;
  transition:background .2s ease,border-color .2s ease,transform .2s ease,color .2s ease;
}
.step:hover { background:var(--surface-soft); color:var(--text); }
.step.active { border-color:#ead38b; background:var(--accent-soft); color:var(--text); transform:translateY(-1px); }
.step-number { flex:0 0 auto; width:29px; height:29px; display:grid; place-items:center; border-radius:10px; background:#eceee6; font-size:12px; font-weight:900; }
.step.active .step-number { background:var(--accent); color:white; }
.step-copy { min-width:0; }
.step-title { display:block; font-size:13px; font-weight:850; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.step-subtitle { display:block; margin-top:2px; font-size:11px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.carousel-shell { position:relative; touch-action:pan-y; }
.panel {
  display:none; background:rgba(255,255,255,.92); border:1px solid var(--line); border-radius:24px;
  padding:clamp(20px,4vw,32px); box-shadow:var(--shadow); animation:panel-in .24s ease both;
}
.panel.active { display:block; }
@keyframes panel-in { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:none; } }
.panel-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:22px; }
.panel-copy { min-width:0; }
.panel-kicker { margin:0 0 5px; color:var(--accent-strong); font-size:11px; font-weight:850; letter-spacing:.08em; text-transform:uppercase; }
h2 { margin:0; font-size:clamp(23px,3vw,30px); letter-spacing:-.025em; }
.small { margin:8px 0 0; font-size:13px; color:var(--muted); line-height:1.55; }
.grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
.full { grid-column:1/-1; }
label { display:block; font-size:11px; font-weight:850; color:#565b50; margin:0 0 7px; text-transform:uppercase; letter-spacing:.065em; }
input,textarea {
  width:100%; border:1px solid #dfe2d8; background:#fbfbf8; color:var(--text); border-radius:13px;
  padding:13px 14px; outline:none; transition:border-color .16s ease,box-shadow .16s ease,background .16s ease;
}
input:hover,textarea:hover { background:white; }
input:focus,textarea:focus { border-color:#caa642; background:white; box-shadow:0 0 0 4px rgba(217,165,27,.12); }
textarea { min-height:124px; resize:vertical; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
.help { margin-top:7px; color:var(--muted); font-size:12px; line-height:1.45; }
.actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:19px; }
button.primary,button.secondary,button.danger,button.nav-btn {
  border:0; border-radius:12px; padding:12px 16px; cursor:pointer; font-weight:850; font-size:13px;
  transition:transform .15s ease,box-shadow .15s ease,background .15s ease;
}
button.primary { background:linear-gradient(135deg,#e2b12c,#c99509); color:#fff; box-shadow:0 10px 22px rgba(190,139,0,.18); }
button.primary:hover { transform:translateY(-1px); box-shadow:0 13px 27px rgba(190,139,0,.24); }
button.secondary { background:#eff1ea; color:#34382f; }
button.secondary:hover { background:#e5e8de; }
button.danger { background:#b74754; color:white; box-shadow:0 10px 22px rgba(183,71,84,.16); }
button.danger:hover { transform:translateY(-1px); }
.result { display:none; margin-top:20px; border:1px solid #dfe2d8; background:#fafbf7; padding:17px; border-radius:15px; overflow:auto; }
.result.show { display:block; }
.result.good { border-color:#bcdcc8; background:#f4fbf7; }
.result.bad { border-color:#efc5ca; background:var(--bad-soft); }
.kv { display:grid; grid-template-columns:190px 1fr; gap:9px 14px; margin:7px 0; }
.kv div:nth-child(odd) { color:var(--muted); }
.mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; overflow-wrap:anywhere; }
.secret { filter:blur(7px); user-select:none; transition:.15s; }
.secret.reveal { filter:none; user-select:text; }
.check { display:flex; gap:10px; align-items:flex-start; margin-top:15px; color:#555a50; line-height:1.45; }
.check input { width:auto; margin-top:3px; }
a { color:#9b7100; font-weight:750; }
.carousel-nav { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:14px; }
.nav-btn { border:1px solid var(--line); background:rgba(255,255,255,.86); color:var(--text); box-shadow:var(--shadow-soft); min-width:106px; }
.nav-btn:hover:not(:disabled) { transform:translateY(-1px); background:white; }
.nav-btn:disabled { opacity:.38; cursor:default; box-shadow:none; }
.nav-hint { color:var(--muted); font-size:11px; text-align:center; }
.title-with-help { display:flex; align-items:center; gap:9px; }
.tooltip { position:relative; display:inline-flex; align-items:center; }
.tooltip-trigger {
  width:26px; height:26px; padding:0; display:inline-grid; place-items:center; border:1px solid #d8dccc;
  border-radius:50%; background:#f6f7f1; color:#64695e; font:850 13px/1 ui-sans-serif,system-ui,sans-serif; cursor:help;
}
.tooltip-trigger:hover,.tooltip-trigger:focus-visible { border-color:#d0aa37; color:#8d6800; outline:none; box-shadow:0 0 0 4px rgba(217,165,27,.10); }
.tooltip-content {
  position:absolute; z-index:30; top:calc(100% + 10px); left:50%; transform:translate(-50%,-4px);
  width:min(390px,calc(100vw - 48px)); padding:14px 15px; border:1px solid #e0dfd6; border-radius:14px;
  background:#fff; color:#4c5148; box-shadow:0 18px 48px rgba(42,45,34,.16); font-size:13px; line-height:1.52;
  opacity:0; visibility:hidden; pointer-events:none; transition:opacity .14s ease,transform .14s ease,visibility .14s;
}
.tooltip:hover .tooltip-content,.tooltip:focus-within .tooltip-content { opacity:1; visibility:visible; transform:translate(-50%,0); pointer-events:auto; }
@media (max-width:820px) {
  .wrap { padding:20px 14px 54px; }
  header { flex-direction:column; gap:17px; }
  .header-actions { width:100%; justify-content:space-between; }
  .steps { grid-template-columns:repeat(4,minmax(150px,1fr)); margin-inline:-3px; padding:3px; }
  .workflow-card { padding:10px; }
  .grid { grid-template-columns:1fr; }
  .full { grid-column:auto; }
  .kv { grid-template-columns:1fr; }
  .panel { border-radius:20px; }
  .tooltip-content { left:0; transform:translate(0,-4px); width:min(340px,calc(100vw - 52px)); }
  .tooltip:hover .tooltip-content,.tooltip:focus-within .tooltip-content { transform:translate(0,0); }
}
@media (max-width:520px) {
  .brand-mark { width:40px; height:40px; border-radius:13px; font-size:23px; }
  .workflow-head { padding-inline:2px; }
  .panel-head { margin-bottom:18px; }
  .carousel-nav { position:sticky; bottom:8px; z-index:10; padding:8px; border:1px solid rgba(224,226,217,.9); border-radius:15px; background:rgba(247,248,243,.88); backdrop-filter:blur(12px); }
  .nav-hint { display:none; }
  .nav-btn { min-width:0; flex:1; }
}
@media (prefers-reduced-motion:reduce) { * { scroll-behavior:auto!important; animation:none!important; transition:none!important; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">Ð</div>
      <div>
        <p class="eyebrow" data-i18n="eyebrow">Local-first wallet lab</p>
        <h1>Doge Wallet Lab</h1>
        <p class="subtitle" data-i18n="subtitle">Local UI for generating Dogecoin keys, building and signing P2PKH transactions, CPFP rescue, and explicit broadcast.</p>
      </div>
    </div>
    <div class="header-actions">
      <div class="lang-switch" role="group" aria-label="Language">
        <button class="lang-btn" type="button" data-lang="ru">RU</button>
        <button class="lang-btn" type="button" data-lang="en">EN</button>
      </div>
      <div class="badge" data-i18n="localBadge">LOCAL · 127.0.0.1</div>
    </div>
  </header>

  <div class="notice">
    <div class="notice-icon" aria-hidden="true">✓</div>
    <div><b data-i18n="securityTitle">Private keys stay local.</b> <span data-i18n="securityBody">WIF values are sent only from this browser tab to the Python process on 127.0.0.1. The app does not persist them. Only an already-signed raw transaction leaves the machine when you explicitly broadcast.</span></div>
  </div>

  <div class="workflow-card">
    <div class="workflow-head">
      <span class="workflow-label" data-i18n="workflowLabel">Wallet workflow</span>
      <span class="step-counter" id="step-counter">1 / 4</span>
    </div>
    <div class="steps" id="steps" role="tablist">
      <button class="step active" type="button" data-step="0" data-tab="wallet" role="tab" aria-selected="true">
        <span class="step-number">01</span><span class="step-copy"><span class="step-title" data-i18n="tabWallet">Wallet</span><span class="step-subtitle" data-i18n="stepWalletSub">Create keys locally</span></span>
      </button>
      <button class="step" type="button" data-step="1" data-tab="send" role="tab" aria-selected="false">
        <span class="step-number">02</span><span class="step-copy"><span class="step-title" data-i18n="tabSend">Send DOGE</span><span class="step-subtitle" data-i18n="stepSendSub">Build and sign</span></span>
      </button>
      <button class="step" type="button" data-step="2" data-tab="cpfp" role="tab" aria-selected="false">
        <span class="step-number">03</span><span class="step-copy"><span class="step-title" data-i18n="tabCpfp">CPFP rescue</span><span class="step-subtitle" data-i18n="stepCpfpSub">Speed up a parent</span></span>
      </button>
      <button class="step" type="button" data-step="3" data-tab="broadcast" role="tab" aria-selected="false">
        <span class="step-number">04</span><span class="step-copy"><span class="step-title" data-i18n="tabBroadcast">Broadcast</span><span class="step-subtitle" data-i18n="stepBroadcastSub">Publish signed bytes</span></span>
      </button>
    </div>
  </div>

  <div class="carousel-shell" id="carousel-shell">
    <section id="wallet" class="panel active" role="tabpanel">
      <div class="panel-head"><div class="panel-copy"><p class="panel-kicker" data-i18n="stepOne">Step 1</p><h2 data-i18n="walletTitle">Generate a local wallet</h2><p class="small" data-i18n="walletHelp">A new secp256k1 private key is generated locally with Python's cryptographic RNG.</p></div></div>
      <div class="actions"><button class="primary" onclick="generateWallet()" data-i18n="generateWallet">Generate wallet</button></div>
      <div id="wallet-result" class="result"></div>
    </section>

    <section id="send" class="panel" role="tabpanel">
      <div class="panel-head"><div class="panel-copy"><p class="panel-kicker" data-i18n="stepTwo">Step 2</p><h2 data-i18n="sendTitle">Build & sign a transfer</h2></div></div>
      <div class="grid">
        <div class="full"><label data-i18n="sourceWif">Source WIF · local secret</label><input id="send-wif" type="password" autocomplete="off" placeholder="Q..."><div class="help" data-i18n="sourceWifHelp">The source address is derived from WIF, so there is no ambiguous source-address field.</div></div>
        <div><label data-i18n="utxoTxid">UTXO transaction ID</label><input id="send-utxo-txid" class="mono" placeholder="64 hex characters" data-i18n-placeholder="placeholder64Hex"></div>
        <div><label data-i18n="utxoVout">UTXO vout</label><input id="send-utxo-vout" type="number" min="0" value="0"></div>
        <div><label data-i18n="utxoAmount">UTXO amount · DOGE</label><input id="send-utxo-amount" inputmode="decimal" placeholder="10"></div>
        <div><label data-i18n="sendAmount">Send amount · DOGE</label><input id="send-amount" inputmode="decimal" placeholder="3"></div>
        <div class="full"><label data-i18n="recipient">Recipient · To address</label><input id="send-to" class="mono" placeholder="D..."></div>
        <div><label data-i18n="feeRate">Fee rate · DOGE/kB</label><input id="send-fee-rate" inputmode="decimal" value="0.01"><div class="help" data-i18n="feeRateHelp">0.01 DOGE/kB is the documented Dogecoin Core recommendation, not a live fee estimate.</div></div>
        <div><label data-i18n="changeAddress">Change address · optional</label><input id="send-change" class="mono" placeholder="blank = back to source" data-i18n-placeholder="placeholderChange"></div>
      </div>
      <div class="actions"><button class="primary" onclick="buildTx()" data-i18n="buildSigned">Build signed transaction</button></div>
      <div id="send-result" class="result"></div>
    </section>

    <section id="cpfp" class="panel" role="tabpanel">
      <div class="panel-head"><div class="panel-copy"><p class="panel-kicker" data-i18n="stepThree">Step 3</p><div class="title-with-help"><h2 data-i18n="cpfpTitle">CPFP rescue</h2><span class="tooltip"><button class="tooltip-trigger" type="button" aria-describedby="cpfp-tooltip-content" data-i18n-aria-label="cpfpTooltipAria">?</button><span class="tooltip-content" id="cpfp-tooltip-content" role="tooltip" data-i18n="cpfpTooltip">CPFP (Child Pays For Parent) creates a higher-fee child transaction that spends an unconfirmed output from the parent. A miner must include the parent before the child, making the combined package more attractive to confirm.</span></span></div><p class="small" data-i18n="cpfpHelp">Parent TXID and byte size are computed from the signed parent raw transaction to avoid manual TXID mistakes.</p></div></div>
      <div class="grid">
        <div class="full"><label data-i18n="sourceWif">Source WIF · local secret</label><input id="cpfp-wif" type="password" autocomplete="off" placeholder="Q..."></div>
        <div class="full"><label data-i18n="parentRaw">Parent signed raw transaction</label><textarea id="cpfp-parent-raw" placeholder="01000000..."></textarea></div>
        <div><label data-i18n="parentVout">Parent output vout to spend</label><input id="cpfp-vout" type="number" min="0" value="1"></div>
        <div><label data-i18n="parentOutputAmount">Parent output amount · DOGE</label><input id="cpfp-utxo-amount" inputmode="decimal" placeholder="6.99774000"></div>
        <div><label data-i18n="parentFee">Parent fee · DOGE</label><input id="cpfp-parent-fee" inputmode="decimal" placeholder="0.00226000"></div>
        <div><label data-i18n="targetPackageRate">Target package rate · DOGE/kB</label><input id="cpfp-rate" inputmode="decimal" value="0.80"></div>
        <div class="full"><label data-i18n="childDestination">Child destination · optional</label><input id="cpfp-to" class="mono" placeholder="blank = self-transfer back to source" data-i18n-placeholder="placeholderCpfpTo"><div class="help" data-i18n="cpfpDestinationHelp">For a pure CPFP rescue, blank means the remaining output returns to the source wallet.</div></div>
      </div>
      <div class="actions"><button class="primary" onclick="buildCpfp()" data-i18n="buildCpfp">Build CPFP child</button></div>
      <div id="cpfp-result" class="result"></div>
    </section>

    <section id="broadcast" class="panel" role="tabpanel">
      <div class="panel-head"><div class="panel-copy"><p class="panel-kicker" data-i18n="stepFour">Step 4</p><h2 data-i18n="broadcastTitle">Broadcast signed raw transaction</h2><p class="small" data-i18n="broadcastHelp">Broadcast is a separate irreversible action. Only the signed public transaction is sent to the relay provider.</p></div></div>
      <div><label data-i18n="rawTransaction">Raw transaction</label><textarea id="broadcast-raw" placeholder="Paste signed raw tx hex" data-i18n-placeholder="placeholderRaw"></textarea></div>
      <label class="check"><input id="broadcast-confirm" type="checkbox"> <span data-i18n="broadcastConfirm">I reviewed the transaction and understand that broadcast is irreversible.</span></label>
      <div class="actions"><button class="danger" onclick="broadcastTx()" data-i18n="broadcastButton">Broadcast via BlockCypher</button></div>
      <div id="broadcast-result" class="result"></div>
    </section>
  </div>

  <div class="carousel-nav">
    <button class="nav-btn" id="prev-step" type="button" data-i18n="previous">← Previous</button>
    <div class="nav-hint" data-i18n="swipeHint">You can also swipe between steps on touch screens.</div>
    <button class="nav-btn" id="next-step" type="button" data-i18n="next">Next →</button>
  </div>
</div>

<script>
const LOCAL_TOKEN = "__LOCAL_TOKEN__";
const LANG_STORAGE_KEY = "doge-wallet-lang";
const STEP_IDS = ["wallet","send","cpfp","broadcast"];
let activeStep = 0;
let touchStartX = null;

const I18N = {
  en: {
    eyebrow:"Local-first wallet lab", subtitle:"Local UI for generating Dogecoin keys, building and signing P2PKH transactions, CPFP rescue, and explicit broadcast.",
    localBadge:"LOCAL · 127.0.0.1", securityTitle:"Private keys stay local.", securityBody:"WIF values are sent only from this browser tab to the Python process on 127.0.0.1. The app does not persist them. Only an already-signed raw transaction leaves the machine when you explicitly broadcast.",
    workflowLabel:"Wallet workflow", stepWalletSub:"Create keys locally", stepSendSub:"Build and sign", stepCpfpSub:"Speed up a parent", stepBroadcastSub:"Publish signed bytes",
    tabWallet:"Wallet", tabSend:"Send DOGE", tabCpfp:"CPFP rescue", tabBroadcast:"Broadcast", stepOne:"Step 1", stepTwo:"Step 2", stepThree:"Step 3", stepFour:"Step 4",
    previous:"← Previous", next:"Next →", swipeHint:"You can also swipe between steps on touch screens.",
    walletTitle:"Generate a local wallet", walletHelp:"A new secp256k1 private key is generated locally with Python's cryptographic RNG.", generateWallet:"Generate wallet",
    sendTitle:"Build & sign a transfer", sourceWif:"Source WIF · local secret", sourceWifHelp:"The source address is derived from WIF, so there is no ambiguous source-address field.",
    utxoTxid:"UTXO transaction ID", utxoVout:"UTXO vout", utxoAmount:"UTXO amount · DOGE", sendAmount:"Send amount · DOGE", recipient:"Recipient · To address", feeRate:"Fee rate · DOGE/kB",
    feeRateHelp:"0.01 DOGE/kB is the documented Dogecoin Core recommendation, not a live fee estimate.", changeAddress:"Change address · optional", buildSigned:"Build signed transaction",
    cpfpTitle:"CPFP rescue", cpfpTooltipAria:"What is CPFP?", cpfpTooltip:"CPFP (Child Pays For Parent) is a way to speed up a pending transaction. It creates a higher-fee child transaction that spends an unconfirmed output from the parent, usually its change. A miner must include the parent before the child, so the combined package becomes more attractive to confirm.",
    cpfpHelp:"Parent TXID and byte size are computed from the signed parent raw transaction to avoid manual TXID mistakes.", parentRaw:"Parent signed raw transaction", parentVout:"Parent output vout to spend", parentOutputAmount:"Parent output amount · DOGE", parentFee:"Parent fee · DOGE", targetPackageRate:"Target package rate · DOGE/kB", childDestination:"Child destination · optional", cpfpDestinationHelp:"For a pure CPFP rescue, blank means the remaining output returns to the source wallet.", buildCpfp:"Build CPFP child",
    broadcastTitle:"Broadcast signed raw transaction", broadcastHelp:"Broadcast is a separate irreversible action. Only the signed public transaction is sent to the relay provider.", rawTransaction:"Raw transaction", broadcastConfirm:"I reviewed the transaction and understand that broadcast is irreversible.", broadcastButton:"Broadcast via BlockCypher",
    placeholder64Hex:"64 hex characters", placeholderChange:"blank = back to source", placeholderCpfpTo:"blank = self-transfer back to source", placeholderRaw:"Paste signed raw tx hex",
    dogeAddress:"DOGE address", publicKey:"Public key", wif:"WIF", privateKeyHex:"Private key hex", revealSecrets:"Reveal / hide secrets",
    fromSource:"From / source", toRecipient:"To / recipient", send:"Send", change:"Change", changeAddressResult:"Change address", networkFee:"Network fee", size:"Size", txid:"TXID", loadBroadcast:"Load into Broadcast", none:"none",
    parentTxid:"Parent TXID", parentSize:"Parent size", childDestinationResult:"Child destination", childOutput:"Child output", childFee:"Child fee", childSize:"Child size", packageRate:"Package rate", childTxid:"Child TXID", loadCpfp:"Load child into Broadcast",
    provider:"Provider", result:"Result", accepted:"accepted", openBlockchair:"Open in Blockchair ↗", irreversibleCheck:"Tick the irreversible-broadcast confirmation first.", errorPrefix:"Error"
  },
  ru: {
    eyebrow:"Локальная лаборатория кошелька", subtitle:"Локальный интерфейс для создания ключей Dogecoin, сборки и подписи P2PKH-транзакций, CPFP-ускорения и явной отправки в сеть.",
    localBadge:"ЛОКАЛЬНО · 127.0.0.1", securityTitle:"Приватные ключи остаются локально.", securityBody:"WIF передаётся только из этой вкладки браузера локальному Python-процессу на 127.0.0.1. Приложение его не сохраняет. Внешнюю сеть покидает только уже подписанная raw-транзакция после явного подтверждения отправки.",
    workflowLabel:"Процесс работы", stepWalletSub:"Создать ключи", stepSendSub:"Собрать и подписать", stepCpfpSub:"Ускорить parent", stepBroadcastSub:"Отправить raw TX",
    tabWallet:"Кошелёк", tabSend:"Отправить DOGE", tabCpfp:"Ускорение CPFP", tabBroadcast:"Отправка в сеть", stepOne:"Шаг 1", stepTwo:"Шаг 2", stepThree:"Шаг 3", stepFour:"Шаг 4",
    previous:"← Назад", next:"Далее →", swipeHint:"На сенсорном экране между шагами можно переключаться свайпом.",
    walletTitle:"Создать локальный кошелёк", walletHelp:"Новый приватный ключ secp256k1 генерируется локально криптографическим генератором Python.", generateWallet:"Создать кошелёк",
    sendTitle:"Собрать и подписать перевод", sourceWif:"WIF источника · локальный секрет", sourceWifHelp:"Адрес источника вычисляется из WIF, поэтому отдельного неоднозначного поля source нет.",
    utxoTxid:"TXID UTXO", utxoVout:"Номер выхода UTXO (vout)", utxoAmount:"Сумма UTXO · DOGE", sendAmount:"Сумма перевода · DOGE", recipient:"Получатель · адрес To", feeRate:"Ставка комиссии · DOGE/kB",
    feeRateHelp:"0.01 DOGE/kB — документированная рекомендация Dogecoin Core, а не актуальная оценка комиссии сети.", changeAddress:"Адрес сдачи · необязательно", buildSigned:"Собрать подписанную транзакцию",
    cpfpTitle:"Ускорение CPFP", cpfpTooltipAria:"Что такое CPFP?", cpfpTooltip:"CPFP (Child Pays For Parent) — способ ускорить зависшую неподтверждённую транзакцию. Создаётся дочерняя транзакция с повышенной комиссией, которая тратит неподтверждённый выход parent — обычно сдачу. Чтобы включить child, майнеру нужно сначала включить parent, поэтому общий пакет становится выгоднее для подтверждения.",
    cpfpHelp:"TXID и размер родительской транзакции вычисляются из её signed raw bytes, чтобы исключить ошибки ручного копирования TXID.", parentRaw:"Подписанная raw-транзакция родителя", parentVout:"vout родительского выхода для траты", parentOutputAmount:"Сумма родительского выхода · DOGE", parentFee:"Комиссия родителя · DOGE", targetPackageRate:"Целевая ставка пакета · DOGE/kB", childDestination:"Адрес child-транзакции · необязательно", cpfpDestinationHelp:"Для обычного CPFP поле можно оставить пустым: остаток вернётся на исходный кошелёк.", buildCpfp:"Собрать CPFP child",
    broadcastTitle:"Отправить подписанную raw-транзакцию в сеть", broadcastHelp:"Отправка в сеть — отдельное необратимое действие. Провайдеру передаётся только публичная подписанная транзакция.", rawTransaction:"Raw-транзакция", broadcastConfirm:"Я проверил транзакцию и понимаю, что после отправки действие необратимо.", broadcastButton:"Отправить через BlockCypher",
    placeholder64Hex:"64 шестнадцатеричных символа", placeholderChange:"пусто = вернуть на исходный адрес", placeholderCpfpTo:"пусто = self-transfer обратно источнику", placeholderRaw:"Вставьте hex подписанной raw-транзакции",
    dogeAddress:"Адрес DOGE", publicKey:"Публичный ключ", wif:"WIF", privateKeyHex:"Приватный ключ hex", revealSecrets:"Показать / скрыть секреты",
    fromSource:"Откуда / source", toRecipient:"Куда / получатель", send:"Отправляем", change:"Сдача", changeAddressResult:"Адрес сдачи", networkFee:"Комиссия сети", size:"Размер", txid:"TXID", loadBroadcast:"Перейти к отправке", none:"нет",
    parentTxid:"TXID родителя", parentSize:"Размер родителя", childDestinationResult:"Адрес child", childOutput:"Выход child", childFee:"Комиссия child", childSize:"Размер child", packageRate:"Ставка пакета", childTxid:"TXID child", loadCpfp:"Перейти к отправке child",
    provider:"Провайдер", result:"Результат", accepted:"принято", openBlockchair:"Открыть в Blockchair ↗", irreversibleCheck:"Сначала подтвердите, что понимаете необратимость отправки.", errorPrefix:"Ошибка"
  }
};

const ERROR_TRANSLATIONS_RU = {
  "Local UI token mismatch. Reload the page.":"Локальный токен интерфейса не совпал. Перезагрузите страницу.", "Not found":"Не найдено",
  "Request body is empty or too large.":"Тело запроса пустое или слишком большое.", "Request body must be valid JSON.":"Тело запроса должно содержать корректный JSON.", "JSON body must be an object.":"JSON-запрос должен быть объектом.",
  "Parent raw transaction must be hexadecimal.":"Raw-транзакция родителя должна быть в hex-формате.", "Parent raw transaction is empty.":"Raw-транзакция родителя пуста.",
  "Raw transaction must be hexadecimal.":"Raw-транзакция должна быть в hex-формате.", "Raw transaction is empty.":"Raw-транзакция пуста.",
  "Only compressed Dogecoin mainnet WIF keys are supported.":"Поддерживаются только compressed WIF-ключи Dogecoin mainnet.", "WIF is not a Dogecoin mainnet private key.":"Этот WIF не является приватным ключом Dogecoin mainnet.",
  "Only compressed WIF keys are supported.":"Поддерживаются только compressed WIF-ключи.", "WIF contains an invalid secp256k1 private key.":"WIF содержит некорректный приватный ключ secp256k1.",
  "Invalid Base58Check checksum.":"Некорректная контрольная сумма Base58Check.", "Expected a legacy Dogecoin P2PKH address.":"Ожидался legacy P2PKH-адрес Dogecoin.", "Address is not a Dogecoin mainnet P2PKH address.":"Адрес не является P2PKH-адресом Dogecoin mainnet.",
  "Send amount must leave room for the network fee.":"Сумма перевода должна оставлять средства на комиссию сети.", "UTXO amount must be greater than zero.":"Сумма UTXO должна быть больше нуля.", "Send amount must be greater than zero.":"Сумма перевода должна быть больше нуля.",
  "UTXO is too small for send amount plus network fee.":"UTXO слишком мал для суммы перевода и комиссии сети.", "The WIF/private key does not match --source.":"WIF/приватный ключ не соответствует адресу source."
};

let currentLang = (() => { const saved=localStorage.getItem(LANG_STORAGE_KEY); if(saved==="ru"||saved==="en") return saved; return navigator.language&&navigator.language.toLowerCase().startsWith("ru")?"ru":"en"; })();
function t(key){ return (I18N[currentLang]&&I18N[currentLang][key])||I18N.en[key]||key; }
function applyLanguage(){
  document.documentElement.lang=currentLang;
  document.querySelectorAll("[data-i18n]").forEach(el=>el.textContent=t(el.dataset.i18n));
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>el.placeholder=t(el.dataset.i18nPlaceholder));
  document.querySelectorAll("[data-i18n-aria-label]").forEach(el=>el.setAttribute("aria-label",t(el.dataset.i18nAriaLabel)));
  document.querySelectorAll(".lang-btn").forEach(btn=>{btn.classList.toggle("active",btn.dataset.lang===currentLang);btn.setAttribute("aria-pressed",btn.dataset.lang===currentLang?"true":"false");});
  document.title=currentLang==="ru"?"Doge Wallet Lab · локальный кошелёк":"Doge Wallet Lab · local wallet";
}
function setLanguage(lang){ if(lang!=="ru"&&lang!=="en")return; currentLang=lang; localStorage.setItem(LANG_STORAGE_KEY,lang); applyLanguage(); refreshRenderedResults(); }
document.querySelectorAll(".lang-btn").forEach(btn=>btn.addEventListener("click",()=>setLanguage(btn.dataset.lang)));

function goToStep(index,focus=false){
  activeStep=Math.max(0,Math.min(STEP_IDS.length-1,index));
  document.querySelectorAll(".panel").forEach((panel,i)=>panel.classList.toggle("active",i===activeStep));
  document.querySelectorAll(".step").forEach((step,i)=>{const active=i===activeStep;step.classList.toggle("active",active);step.setAttribute("aria-selected",active?"true":"false");if(active)step.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});});
  document.getElementById("step-counter").textContent=`${activeStep+1} / ${STEP_IDS.length}`;
  document.getElementById("prev-step").disabled=activeStep===0;
  document.getElementById("next-step").disabled=activeStep===STEP_IDS.length-1;
  if(focus){ const heading=document.querySelector(`#${STEP_IDS[activeStep]} h2`); if(heading){heading.setAttribute("tabindex","-1");heading.focus({preventScroll:true});} }
}
document.querySelectorAll(".step").forEach(step=>step.addEventListener("click",()=>goToStep(Number(step.dataset.step))));
document.getElementById("prev-step").addEventListener("click",()=>goToStep(activeStep-1,true));
document.getElementById("next-step").addEventListener("click",()=>goToStep(activeStep+1,true));
const shell=document.getElementById("carousel-shell");
shell.addEventListener("touchstart",e=>{touchStartX=e.changedTouches[0].clientX;},{passive:true});
shell.addEventListener("touchend",e=>{if(touchStartX===null)return;const dx=e.changedTouches[0].clientX-touchStartX;touchStartX=null;if(Math.abs(dx)<55)return;goToStep(activeStep+(dx<0?1:-1));},{passive:true});
document.addEventListener("keydown",e=>{if(e.target.matches("input,textarea"))return;if(e.key==="ArrowRight")goToStep(activeStep+1);if(e.key==="ArrowLeft")goToStep(activeStep-1);});

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
function show(id,html,good=true){const el=document.getElementById(id);el.className="result show "+(good?"good":"bad");el.innerHTML=html;}
function localizedError(message){const text=String(message||"");if(currentLang!=="ru")return text;if(ERROR_TRANSLATIONS_RU[text])return ERROR_TRANSLATIONS_RU[text];if(text.startsWith("The WIF/private key does not match --source."))return "WIF/приватный ключ не соответствует адресу source. "+text.slice("The WIF/private key does not match --source.".length).trim();if(text.startsWith("Broadcast provider returned unexpected txid"))return "Провайдер отправки вернул неожиданный TXID. "+text;return text;}
function showError(id,error){const message=localizedError(error&&error.message?error.message:error);show(id,`<b>${esc(t("errorPrefix"))}:</b> ${esc(message)}`,false);}
async function post(path,body){const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json","X-Local-Token":LOCAL_TOKEN},body:JSON.stringify(body)});let data={};try{data=await r.json();}catch(_){}if(!r.ok)throw new Error(data.error||("HTTP "+r.status));return data;}
function kv(rows){return '<div class="kv">'+rows.map(([k,v,cls=""])=>`<div>${esc(k)}</div><div class="${cls}">${esc(v)}</div>`).join("")+'</div>';}
function loadBroadcast(raw){document.getElementById("broadcast-raw").value=raw;goToStep(3,true);}

const rendered={wallet:null,send:null,cpfp:null,broadcast:null};
function renderWalletResult(d){rendered.wallet=d;show("wallet-result",kv([[t("dogeAddress"),d.address,"mono"],[t("publicKey"),d.public_key,"mono"],[t("wif"),d.wif,"mono secret"],[t("privateKeyHex"),d.private_key_hex,"mono secret"]])+`<div class="actions"><button class="secondary" id="toggle-wallet-secrets">${esc(t("revealSecrets"))}</button></div>`);document.getElementById("toggle-wallet-secrets").onclick=()=>document.querySelectorAll("#wallet-result .secret").forEach(x=>x.classList.toggle("reveal"));}
function renderSendResult(d){rendered.send=d;show("send-result",kv([[t("fromSource"),d.source,"mono"],[t("toRecipient"),d.destination,"mono"],[t("send"),d.send+" DOGE"],[t("change"),d.change+" DOGE"],[t("changeAddressResult"),d.change_address||t("none"),"mono"],[t("networkFee"),d.fee+" DOGE"],[t("size"),d.size+" bytes"],[t("txid"),d.txid,"mono"]])+`<div class="actions"><button class="secondary" id="load-built">${esc(t("loadBroadcast"))}</button></div>`);document.getElementById("load-built").onclick=()=>loadBroadcast(d.raw_hex);}
function renderCpfpResult(d){rendered.cpfp=d;show("cpfp-result",kv([[t("parentTxid"),d.parent_txid,"mono"],[t("parentSize"),d.parent_size+" bytes"],[t("childDestinationResult"),d.destination,"mono"],[t("childOutput"),d.child_output+" DOGE"],[t("childFee"),d.child_fee+" DOGE"],[t("childSize"),d.child_size+" bytes"],[t("packageRate"),d.package_rate+" DOGE/kB"],[t("childTxid"),d.txid,"mono"]])+`<div class="actions"><button class="secondary" id="load-cpfp">${esc(t("loadCpfp"))}</button></div>`);document.getElementById("load-cpfp").onclick=()=>loadBroadcast(d.raw_hex);}
function renderBroadcastResult(d){rendered.broadcast=d;const link="https://blockchair.com/dogecoin/transaction/"+encodeURIComponent(d.txid);show("broadcast-result",kv([[t("txid"),d.txid,"mono"],[t("provider"),"BlockCypher"],[t("result"),t(d.status==="accepted"?"accepted":d.status)]])+`<div class="actions"><a href="${link}" target="_blank" rel="noopener">${esc(t("openBlockchair"))}</a></div>`);}
function refreshRenderedResults(){if(rendered.wallet)renderWalletResult(rendered.wallet);if(rendered.send)renderSendResult(rendered.send);if(rendered.cpfp)renderCpfpResult(rendered.cpfp);if(rendered.broadcast)renderBroadcastResult(rendered.broadcast);}

async function generateWallet(){try{renderWalletResult(await post("/api/generate",{}));}catch(e){showError("wallet-result",e);}}
async function buildTx(){try{const d=await post("/api/build",{wif:document.getElementById("send-wif").value,utxo_txid:document.getElementById("send-utxo-txid").value.trim(),utxo_vout:document.getElementById("send-utxo-vout").value,utxo_amount:document.getElementById("send-utxo-amount").value.trim(),to:document.getElementById("send-to").value.trim(),amount:document.getElementById("send-amount").value.trim(),fee_rate:document.getElementById("send-fee-rate").value.trim(),change:document.getElementById("send-change").value.trim()});renderSendResult(d);}catch(e){showError("send-result",e);}}
async function buildCpfp(){try{const d=await post("/api/cpfp",{wif:document.getElementById("cpfp-wif").value,parent_raw:document.getElementById("cpfp-parent-raw").value,parent_vout:document.getElementById("cpfp-vout").value,parent_utxo_amount:document.getElementById("cpfp-utxo-amount").value.trim(),parent_fee:document.getElementById("cpfp-parent-fee").value.trim(),target_rate:document.getElementById("cpfp-rate").value.trim(),to:document.getElementById("cpfp-to").value.trim()});renderCpfpResult(d);}catch(e){showError("cpfp-result",e);}}
async function broadcastTx(){if(!document.getElementById("broadcast-confirm").checked){show("broadcast-result",esc(t("irreversibleCheck")),false);return;}try{renderBroadcastResult(await post("/api/broadcast",{raw_hex:document.getElementById("broadcast-raw").value}));}catch(e){showError("broadcast-result",e);}}

applyLanguage();
goToStep(0);
</script>
</body>
</html>
'''


class Handler(BaseHTTPRequestHandler):
    server_version = "DogeWalletLab/0.3"

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
            raise RuntimeError(f"Broadcast provider returned unexpected txid {remote_hash}; local txid is {txid}.")
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
