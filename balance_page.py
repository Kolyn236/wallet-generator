#!/usr/bin/env python3
"""Public-address balance page for the local Dogecoin wallet lab."""

from __future__ import annotations

from blockcypher_utxos import AddressUtxos, Utxo, fetch_confirmed_utxos
from doge_wallet import format_doge, p2pkh_script_pubkey


BALANCE_HTML = r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Doge Wallet Lab · Balance</title>
<style>
:root{
  color-scheme:light;--bg:#f5f6f2;--surface:#fff;--text:#171912;--muted:#6f7468;--line:#e3e5dc;
  --accent:#d9a51b;--accent-strong:#b78300;--accent-soft:#fff4cf;--good:#19764a;--good-soft:#eaf8f0;
  --bad:#b63c4a;--bad-soft:#fff0f1;--shadow:0 24px 70px rgba(42,45,34,.10);--shadow-soft:0 10px 32px rgba(42,45,34,.07)
}
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--text);background:radial-gradient(circle at 8% 0%,rgba(242,196,72,.18),transparent 31rem),radial-gradient(circle at 94% 8%,rgba(161,184,126,.13),transparent 28rem),var(--bg)}
button,input{font:inherit}.wrap{max-width:1040px;margin:0 auto;padding:28px 22px 72px}header{display:flex;justify-content:space-between;gap:22px;align-items:flex-start;margin-bottom:24px}.brand{display:flex;gap:14px;align-items:flex-start}.brand-mark{width:46px;height:46px;display:grid;place-items:center;border-radius:15px;background:linear-gradient(145deg,#f4c94f,#d79e0f);color:white;box-shadow:0 10px 26px rgba(185,135,0,.22);font-size:27px;font-weight:900}.eyebrow{margin:0 0 4px;color:var(--accent-strong);font-size:12px;font-weight:850;letter-spacing:.09em;text-transform:uppercase}h1{margin:0;font-size:clamp(30px,5vw,48px);line-height:1;letter-spacing:-.045em}.subtitle{color:var(--muted);margin:9px 0 0;max-width:700px;line-height:1.55}.header-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.badge{border:1px solid #cfe5d7;background:var(--good-soft);color:var(--good);padding:8px 11px;border-radius:999px;font-size:11px;font-weight:850;white-space:nowrap}.lang-switch{display:flex;gap:3px;padding:4px;border:1px solid var(--line);background:rgba(255,255,255,.78);border-radius:12px;box-shadow:var(--shadow-soft)}.lang-btn{border:0;background:transparent;color:var(--muted);border-radius:9px;padding:7px 10px;cursor:pointer;font-weight:850;font-size:12px}.lang-btn.active{background:var(--text);color:white}.back-link{display:inline-flex;align-items:center;text-decoration:none;color:#4b5047;border:1px solid var(--line);background:white;padding:9px 12px;border-radius:12px;font-size:12px;font-weight:800;box-shadow:var(--shadow-soft)}
.notice{display:flex;gap:12px;align-items:flex-start;border:1px solid #cfe5d7;background:rgba(240,250,244,.92);padding:14px 16px;border-radius:17px;color:#285c41;margin-bottom:18px;line-height:1.5;box-shadow:var(--shadow-soft)}.notice-icon{flex:0 0 auto;width:30px;height:30px;display:grid;place-items:center;border-radius:10px;background:#dff3e7;color:var(--good);font-weight:900}.card{background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:24px;padding:clamp(20px,4vw,32px);box-shadow:var(--shadow)}label{display:block;font-size:11px;font-weight:850;color:#565b50;margin-bottom:7px;text-transform:uppercase;letter-spacing:.065em}.search-row{display:grid;grid-template-columns:1fr auto;gap:10px}input{width:100%;border:1px solid #dfe2d8;background:#fbfbf8;color:var(--text);border-radius:13px;padding:13px 14px;outline:none}input:focus{border-color:#caa642;background:white;box-shadow:0 0 0 4px rgba(217,165,27,.12)}button.primary{border:0;border-radius:12px;padding:12px 18px;cursor:pointer;font-weight:850;font-size:13px;background:linear-gradient(135deg,#e2b12c,#c99509);color:white;box-shadow:0 10px 22px rgba(190,139,0,.18)}.help{margin-top:8px;color:var(--muted);font-size:12px;line-height:1.45}.result{display:none;margin-top:22px}.result.show{display:block}.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.metric{border:1px solid var(--line);border-radius:16px;padding:15px;background:#fafbf7}.metric-label{display:block;color:var(--muted);font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.06em}.metric-value{display:block;margin-top:5px;font-size:clamp(18px,3vw,25px);font-weight:850;overflow-wrap:anywhere}.address-line{margin-top:13px;padding:13px 15px;border-radius:14px;background:var(--accent-soft);border:1px solid #ead38b}.address-line span{display:block}.address-label{color:#776019;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.06em}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.address-value{margin-top:4px;font-size:13px;font-weight:750}.table-card{margin-top:16px;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:white}.table-head{padding:14px 16px;border-bottom:1px solid var(--line);font-size:13px;font-weight:850}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:680px}th,td{padding:12px 16px;text-align:left;border-bottom:1px solid #eceee7;font-size:12px}th{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;background:#fafbf7}tr:last-child td{border-bottom:0}.tx-link{color:#8d6800;font-weight:750;text-decoration:none}.empty{padding:20px;color:var(--muted);font-size:13px}.error{display:none;margin-top:16px;padding:14px 16px;border:1px solid #efc5ca;background:var(--bad-soft);color:#8f3340;border-radius:14px;line-height:1.45}.error.show{display:block}.loading{display:none;margin-top:16px;color:var(--muted);font-size:13px}.loading.show{display:block}
@media(max-width:720px){.wrap{padding:20px 14px 54px}header{flex-direction:column}.header-actions{width:100%;justify-content:space-between}.search-row{grid-template-columns:1fr}.summary{grid-template-columns:1fr}.primary{width:100%}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand"><div class="brand-mark" aria-hidden="true">Ð</div><div><p class="eyebrow" data-i18n="eyebrow">Public wallet lookup</p><h1 data-i18n="title">Check wallet balance</h1><p class="subtitle" data-i18n="subtitle">Look up a Dogecoin mainnet address without entering a private key or WIF.</p></div></div>
    <div class="header-actions"><a class="back-link" href="/" data-i18n="back">← Wallet Lab</a><div class="lang-switch" role="group" aria-label="Language"><button class="lang-btn" type="button" data-lang="ru">RU</button><button class="lang-btn" type="button" data-lang="en">EN</button></div><div class="badge" data-i18n="local">LOCAL · 127.0.0.1</div></div>
  </header>

  <div class="notice"><div class="notice-icon" aria-hidden="true">✓</div><div><b data-i18n="safeTitle">No private key required.</b> <span data-i18n="safeBody">Only the public DOGE address is sent to BlockCypher to read confirmed balance and UTXOs.</span></div></div>

  <main class="card">
    <form id="balance-form">
      <label for="address" data-i18n="addressLabel">Dogecoin address</label>
      <div class="search-row"><input id="address" class="mono" autocomplete="off" spellcheck="false" placeholder="D..."><button class="primary" type="submit" data-i18n="check">Check balance</button></div>
      <div class="help" data-i18n="help">Dogecoin mainnet legacy P2PKH addresses are supported.</div>
    </form>
    <div id="loading" class="loading" data-i18n="loading">Loading confirmed balance…</div>
    <div id="error" class="error"></div>
    <div id="result" class="result"></div>
  </main>
</div>
<script>
const LOCAL_TOKEN="__LOCAL_TOKEN__";
const LANG_STORAGE_KEY="doge-wallet-lang";
const I18N={
  en:{eyebrow:"Public wallet lookup",title:"Check wallet balance",subtitle:"Look up a Dogecoin mainnet address without entering a private key or WIF.",back:"← Wallet Lab",local:"LOCAL · 127.0.0.1",safeTitle:"No private key required.",safeBody:"Only the public DOGE address is sent to BlockCypher to read confirmed balance and UTXOs.",addressLabel:"Dogecoin address",check:"Check balance",help:"Dogecoin mainnet legacy P2PKH addresses are supported.",loading:"Loading confirmed balance…",confirmedBalance:"Confirmed balance",utxoCount:"Spendable UTXOs",largestUtxo:"Largest UTXO",address:"Address",utxos:"Confirmed UTXOs",amount:"Amount",confirmations:"Confirmations",outpoint:"Outpoint",noUtxos:"No confirmed spendable UTXOs found.",error:"Error"},
  ru:{eyebrow:"Публичная проверка кошелька",title:"Проверить баланс кошелька",subtitle:"Проверка адреса Dogecoin mainnet без ввода приватного ключа или WIF.",back:"← Кошелёк",local:"ЛОКАЛЬНО · 127.0.0.1",safeTitle:"Приватный ключ не нужен.",safeBody:"BlockCypher получает только публичный DOGE-адрес для чтения подтверждённого баланса и UTXO.",addressLabel:"Адрес Dogecoin",check:"Проверить баланс",help:"Поддерживаются legacy P2PKH-адреса Dogecoin mainnet.",loading:"Загружаем подтверждённый баланс…",confirmedBalance:"Подтверждённый баланс",utxoCount:"Доступные UTXO",largestUtxo:"Крупнейший UTXO",address:"Адрес",utxos:"Подтверждённые UTXO",amount:"Сумма",confirmations:"Подтверждения",outpoint:"Выход",noUtxos:"Подтверждённых доступных UTXO нет.",error:"Ошибка"}
};
let currentLang=(()=>{const saved=localStorage.getItem(LANG_STORAGE_KEY);if(saved==="ru"||saved==="en")return saved;return navigator.language&&navigator.language.toLowerCase().startsWith("ru")?"ru":"en"})();
function t(k){return(I18N[currentLang]&&I18N[currentLang][k])||I18N.en[k]||k}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function applyLanguage(){document.documentElement.lang=currentLang;document.querySelectorAll("[data-i18n]").forEach(el=>el.textContent=t(el.dataset.i18n));document.querySelectorAll(".lang-btn").forEach(btn=>{btn.classList.toggle("active",btn.dataset.lang===currentLang);btn.setAttribute("aria-pressed",btn.dataset.lang===currentLang?"true":"false")});document.title=currentLang==="ru"?"Doge Wallet Lab · Баланс":"Doge Wallet Lab · Balance"}
function setLanguage(lang){currentLang=lang;localStorage.setItem(LANG_STORAGE_KEY,lang);applyLanguage();if(lastResult)render(lastResult)}
document.querySelectorAll(".lang-btn").forEach(btn=>btn.addEventListener("click",()=>setLanguage(btn.dataset.lang)));
let lastResult=null;
async function post(body){const r=await fetch("/api/address-balance",{method:"POST",headers:{"Content-Type":"application/json","X-Local-Token":LOCAL_TOKEN},body:JSON.stringify(body)});let data={};try{data=await r.json()}catch(_){}if(!r.ok)throw new Error(data.error||("HTTP "+r.status));return data}
function render(d){lastResult=d;const rows=d.utxos.map(u=>{const outpoint=`${u.txid}:${u.vout}`;const url="https://blockchair.com/dogecoin/transaction/"+encodeURIComponent(u.txid);return `<tr><td>${esc(u.amount)} DOGE</td><td>${esc(u.confirmations)}</td><td class="mono"><a class="tx-link" href="${url}" target="_blank" rel="noopener">${esc(outpoint)}</a></td></tr>`}).join("");document.getElementById("result").className="result show";document.getElementById("result").innerHTML=`<div class="summary"><div class="metric"><span class="metric-label">${esc(t("confirmedBalance"))}</span><span class="metric-value">${esc(d.balance)} DOGE</span></div><div class="metric"><span class="metric-label">${esc(t("utxoCount"))}</span><span class="metric-value">${esc(d.utxo_count)}</span></div><div class="metric"><span class="metric-label">${esc(t("largestUtxo"))}</span><span class="metric-value">${esc(d.largest_utxo)} DOGE</span></div></div><div class="address-line"><span class="address-label">${esc(t("address"))}</span><span class="address-value mono">${esc(d.address)}</span></div><div class="table-card"><div class="table-head">${esc(t("utxos"))}</div>${rows?`<div class="table-wrap"><table><thead><tr><th>${esc(t("amount"))}</th><th>${esc(t("confirmations"))}</th><th>${esc(t("outpoint"))}</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="empty">${esc(t("noUtxos"))}</div>`}</div>`}
const form=document.getElementById("balance-form");form.addEventListener("submit",async e=>{e.preventDefault();document.getElementById("error").className="error";document.getElementById("result").className="result";document.getElementById("loading").className="loading show";try{render(await post({address:document.getElementById("address").value.trim()}))}catch(err){const el=document.getElementById("error");el.className="error show";el.textContent=`${t("error")}: ${err.message}`}finally{document.getElementById("loading").className="loading"}});
applyLanguage();
</script>
</body>
</html>
'''


def payload_from_snapshot(snapshot: AddressUtxos) -> dict:
    largest = max((utxo.value for utxo in snapshot.utxos), default=0)
    return {
        "address": snapshot.address,
        "balance": format_doge(snapshot.balance),
        "utxo_count": len(snapshot.utxos),
        "largest_utxo": format_doge(largest),
        "utxos": [
            {
                "txid": utxo.txid,
                "vout": utxo.vout,
                "amount": format_doge(utxo.value),
                "confirmations": utxo.confirmations,
            }
            for utxo in snapshot.utxos
        ],
    }


def lookup_address_balance(address: str, token: str | None = None) -> dict:
    address = address.strip()
    if not address:
        raise ValueError("Dogecoin address is required.")

    # Validate Base58Check + Dogecoin mainnet P2PKH prefix locally before any request.
    p2pkh_script_pubkey(address)
    return payload_from_snapshot(fetch_confirmed_utxos(address, token))


def render_balance_page(local_token: str) -> bytes:
    return BALANCE_HTML.replace("__LOCAL_TOKEN__", local_token).encode("utf-8")


def self_test() -> None:
    snapshot = AddressUtxos(
        address="DExample",
        balance=900_000_000,
        utxos=(
            Utxo(txid="11" * 32, vout=0, value=300_000_000, confirmations=9),
            Utxo(txid="22" * 32, vout=1, value=600_000_000, confirmations=2),
        ),
    )
    payload = payload_from_snapshot(snapshot)
    assert payload["balance"] == "9.00000000"
    assert payload["utxo_count"] == 2
    assert payload["largest_utxo"] == "6.00000000"
    assert payload["utxos"][0]["confirmations"] == 9
    assert b"__LOCAL_TOKEN__" not in render_balance_page("test-token")
    print("Balance page self-test passed.")


if __name__ == "__main__":
    self_test()
