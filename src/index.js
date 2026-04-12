// Chronicle Worker — share.remembory.net + social.remembory.net
// KV bindings: SHARES, MAILING_LIST

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Chronicle-Client, X-LS-Key",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getViewerKey(request, url) {
  return request.headers.get("X-LS-Key") || url.searchParams.get("key") || "";
}

function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Visibility check ──────────────────────────────────────────────────────────
// Returns true if a viewer (identified by their emailHash) can see this memory
function canViewMemory(memory, viewerEmailHash, profileConnectionEmailHashes, isSubscriber) {
  const v = memory.visibility;
  if (!v || v === "private") return false;
  if (v === "public") return true;
  if (v === "subscriber") return !!(isSubscriber || viewerEmailHash);
  if (v === "connected" || v === "tagged") {
    return !!(viewerEmailHash && profileConnectionEmailHashes && profileConnectionEmailHashes.includes(viewerEmailHash));
  }
  return false;
}

// Returns true if the viewer holds an active license OR has a published profile (legacy subscriber)
async function checkSubscriber(env, viewerKeyHash, viewerEmailHash) {
  if (viewerEmailHash) return true; // legacy: has published profile
  if (!viewerKeyHash) return false;
  const raw = await env.SHARES.get("license:" + viewerKeyHash);
  if (!raw) return false;
  const lic = JSON.parse(raw);
  return lic.status === "active";
}

function generateLicenseKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `REM-${hex.slice(0,4)}-${hex.slice(4,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}`;
}

async function verifyStripeSignature(bodyText, sigHeader, secret) {
  const parts = Object.fromEntries(sigHeader.split(",").map(p => p.split("=")));
  const ts = parts.t, v1 = parts.v1;
  if (!ts || !v1) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(ts)) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${bodyText}`));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

// ── Guest contribution form ───────────────────────────────────────────────────
function contributionFormPage(code, subjectName, ownerNote) {
  const apiUrl = `https://share.remembory.net/contribute/${esc(code)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex">
  <title>Share a Memory — Chronicle by Remembory</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; background: #f7f2ea; color: #2c2416; min-height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding: 24px 16px 60px; }
    .card { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 8px; padding: 32px 28px; max-width: 520px; width: 100%; box-shadow: 0 8px 40px rgba(44,36,22,0.10); }
    .logo { font-size: 0.82rem; color: #a8885a; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 20px; font-family: Arial, sans-serif; }
    h1 { font-size: 1.4rem; font-style: italic; color: #1a1208; margin-bottom: 8px; line-height: 1.3; }
    .sub { font-size: 0.9rem; color: #6a5840; line-height: 1.6; margin-bottom: 20px; }
    .owner-note { background: #fff8ec; border: 1px solid #e8d4a0; border-radius: 6px; padding: 12px 14px; margin-bottom: 20px; font-size: 0.88rem; color: #5a4820; line-height: 1.6; font-style: italic; }
    label { display: block; font-size: 0.78rem; font-family: Arial, sans-serif; letter-spacing: 0.05em; text-transform: uppercase; color: #8a7460; margin-bottom: 4px; margin-top: 16px; }
    input, textarea { width: 100%; padding: 9px 11px; border: 1px solid #c8b89a; border-radius: 4px; font-family: Georgia, serif; font-size: 0.95rem; color: #2c2416; background: #fffcf5; }
    textarea { resize: vertical; min-height: 100px; }
    input:focus, textarea:focus { outline: none; border-color: #a8885a; }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .mem-block { background: #f5f0e8; border: 1px solid #d4c4a8; border-radius: 6px; padding: 16px; margin-top: 16px; position: relative; }
    .mem-block h3 { font-size: 0.88rem; font-family: Arial, sans-serif; color: #6a5840; margin-bottom: 2px; }
    .remove-btn { position: absolute; top: 10px; right: 12px; background: none; border: none; cursor: pointer; color: #c87060; font-size: 1rem; }
    .add-btn { display: block; width: 100%; margin-top: 14px; padding: 9px; border: 1px dashed #a8885a; border-radius: 4px; background: transparent; color: #a8885a; font-family: Georgia, serif; font-size: 0.92rem; cursor: pointer; }
    .add-btn:hover { background: rgba(168,136,90,0.07); }
    .submit-btn { display: block; width: 100%; margin-top: 24px; padding: 14px; background: #2c2416; color: #f5f0e8; border: none; border-radius: 4px; font-family: Georgia, serif; font-size: 1rem; cursor: pointer; transition: opacity 0.15s; }
    .submit-btn:hover:not(:disabled) { opacity: 0.85; }
    .submit-btn:disabled { opacity: 0.5; cursor: default; }
    .success { text-align: center; padding: 40px 0; display: none; }
    .success h2 { font-size: 1.3rem; font-style: italic; margin-bottom: 10px; }
    .success p { font-size: 0.9rem; color: #6a5840; }
    .err { color: #b04040; font-size: 0.85rem; margin-top: 8px; display: none; }
  </style>
</head>
<body>
<div class="card">
  <div class="logo">Chronicle by Remembory</div>
  <div id="form-wrap">
    <h1>Share a memory${subjectName ? ` about ${esc(subjectName)}` : ""}</h1>
    <p class="sub">You've been invited to contribute memories. They'll be delivered privately to the Chronicle owner — nothing is published.</p>
    ${ownerNote ? `<div class="owner-note">${esc(ownerNote)}</div>` : ""}
    <label>Your name</label>
    <input id="contributor-name" type="text" placeholder="How you'd like to be credited" maxlength="100">
    <div id="memories-list"></div>
    <button class="add-btn" onclick="addMemory()">+ Add a memory</button>
    <button class="submit-btn" id="submit-btn" onclick="submitForm()">Send memories</button>
    <div class="err" id="err-msg"></div>
  </div>
  <div class="success" id="success-wrap">
    <h2>Thank you!</h2>
    <p>Your memories have been sent. The Chronicle owner will review them privately.</p>
  </div>
</div>
<script>
var API = ${JSON.stringify(apiUrl)};
var memCount = 0;
function addMemory() {
  memCount++;
  var id = 'mem' + memCount;
  var div = document.createElement('div');
  div.className = 'mem-block';
  div.id = id;
  div.innerHTML = '<h3>Memory #' + memCount + '</h3>' +
    (memCount > 1 ? '<button class="remove-btn" onclick="removeMemory(\\''+id+'\\')">✕</button>' : '') +
    '<label>Title</label><input class="m-title" type="text" maxlength="200" placeholder="e.g. Summer holiday 1987">' +
    '<label>What do you remember?</label><textarea class="m-content" maxlength="4000" placeholder="Share the memory in as much detail as you like..."></textarea>' +
    '<div class="row2"><div><label>Year</label><input class="m-year" type="number" min="1800" max="2099" placeholder="1987"></div>' +
    '<div><label>Location (optional)</label><input class="m-loc" type="text" maxlength="200" placeholder="e.g. Cornwall"></div></div>';
  document.getElementById('memories-list').appendChild(div);
}
function removeMemory(id) { var el = document.getElementById(id); if (el) el.remove(); }
function submitForm() {
  var name = document.getElementById('contributor-name').value.trim();
  var blocks = document.querySelectorAll('.mem-block');
  var err = document.getElementById('err-msg');
  err.style.display = 'none';
  var memories = [];
  blocks.forEach(function(b) {
    var title = b.querySelector('.m-title').value.trim();
    var content = b.querySelector('.m-content').value.trim();
    if (!title && !content) return;
    memories.push({ title: title, content: content,
      year: parseInt(b.querySelector('.m-year').value) || 0,
      location: b.querySelector('.m-loc').value.trim() });
  });
  if (memories.length === 0) { err.textContent = 'Please add at least one memory.'; err.style.display = 'block'; return; }
  var btn = document.getElementById('submit-btn');
  btn.disabled = true; btn.textContent = 'Sending…';
  fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contributorName: name || 'Anonymous', memories: memories }) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok) {
        document.getElementById('form-wrap').style.display = 'none';
        document.getElementById('success-wrap').style.display = 'block';
      } else {
        err.textContent = data.error || 'Something went wrong. Please try again.';
        err.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Send memories';
      }
    }).catch(function() {
      err.textContent = 'Network error. Please check your connection and try again.';
      err.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Send memories';
    });
}
addMemory();
</script>
</body>
</html>`;
}

function contributionExpiredPage() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Chronicle — Link expired</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Georgia,serif;background:#f7f2ea;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}.card{background:#fffcf5;border:1px solid #d4c4a8;border-radius:8px;padding:36px 28px;max-width:400px;text-align:center;}h1{font-size:1.3rem;font-style:italic;margin-bottom:12px;}p{color:#6a5840;font-size:0.9rem;line-height:1.6;}a{color:#a8885a;}</style></head><body><div class="card"><h1>This link has expired</h1><p>Contribution links expire after one year. Ask the person who shared it to create a new one.</p><p style="margin-top:16px"><a href="https://remembory.net">Visit Remembory</a></p></div></body></html>`;
}

// ── Bridge page (share links) ─────────────────────────────────────────────────
function bridgePage(code, senderName, memCount) {
  const chronicleUrl = `https://remembory.net/chronicle.html?share=${code}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex">
  <title>Chronicle — Memory shared with you</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', serif; background: #f7f2ea; color: #2c2416; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 8px; padding: 36px 28px; max-width: 420px; width: 100%; box-shadow: 0 8px 40px rgba(44,36,22,0.12); text-align: center; }
    .logo { font-size: 1rem; color: #a8885a; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 24px; font-family: Arial, sans-serif; }
    h1 { font-size: 1.4rem; font-style: italic; color: #1a1208; margin-bottom: 10px; line-height: 1.3; }
    .sub { font-size: 0.9rem; color: #6a5840; line-height: 1.6; margin-bottom: 24px; }
    .warning { background: #fff8ec; border: 1px solid #e8d4a0; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px; text-align: left; }
    .warning-title { font-size: 0.75rem; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; color: #8a6020; margin-bottom: 8px; font-family: Arial, sans-serif; }
    .warning p { font-size: 0.88rem; color: #5a4820; line-height: 1.6; }
    .btn { display: block; width: 100%; padding: 14px; background: #2c2416; color: #f5f0e8; border: none; border-radius: 4px; font-family: 'Georgia', serif; font-size: 1rem; cursor: pointer; text-decoration: none; margin-bottom: 12px; transition: opacity 0.15s; }
    .btn:hover { opacity: 0.85; }
    .note { font-size: 0.78rem; color: #8a7460; font-style: italic; margin-top: 16px; line-height: 1.5; }
    .link-row { display: flex; gap: 6px; margin-top: 12px; }
    .link-input { flex: 1; padding: 8px 10px; border: 1px solid #c8b89a; border-radius: 4px; font-size: 0.75rem; color: #4a5a7a; background: #fffcf5; font-family: Arial, sans-serif; }
    .copy-btn { padding: 8px 12px; background: transparent; border: 1px solid #c8b89a; border-radius: 4px; font-size: 0.82rem; cursor: pointer; color: #6a5840; white-space: nowrap; font-family: Arial, sans-serif; }
    #iab-warning { display: none; }
  </style>
</head>
<body>
<div class="card">
  <div class="logo">Chronicle by Remembory</div>
  <h1>${senderName ? `${esc(senderName)} shared ${memCount === 1 ? "a memory" : memCount + " memories"} with you` : "Someone shared memories with you"}</h1>
  <p class="sub">Chronicle is a private memory keeper. Nothing is stored in the cloud — your memories live on your device.</p>
  <div class="warning" id="iab-warning">
    <div class="warning-title">&#9888; Open in your browser first</div>
    <p id="iab-instruction">Tap the menu icon in the top corner, then choose <strong>Open in browser</strong>.</p>
  </div>
  <a href="${chronicleUrl}" class="btn" id="open-btn">Open in Chronicle</a>
  <p class="note">This link expires in 30 days and can only be used once.</p>
  <div class="link-row">
    <input class="link-input" id="link-input" readonly value="${chronicleUrl}" onclick="this.select()">
    <button class="copy-btn" onclick="copyLink()">Copy link</button>
  </div>
</div>
<script>
  var chronicleUrl = ${JSON.stringify(chronicleUrl)};
  var ua = navigator.userAgent;
  function isIAB() { return /FBAN|FBAV|Instagram|WhatsApp|Snapchat|TikTok|Twitter|LinkedInApp|Messenger/i.test(ua); }
  function getInstruction() {
    var ios = /iPhone|iPad|iPod/i.test(ua);
    if (/FBAN|FBAV|Messenger/i.test(ua)) return ios ? 'Tap \u00b7\u00b7\u00b7 at the bottom right, then "Open in Safari"' : 'Tap \u00b7\u00b7\u00b7 at the top right, then "Open in browser"';
    if (/Instagram/i.test(ua)) return ios ? 'Tap \u00b7\u00b7\u00b7 at the top right, then "Open in external browser"' : 'Tap \u00b7\u00b7\u00b7 at the top right, then "Open in Chrome"';
    if (/WhatsApp/i.test(ua)) return ios ? 'Tap the link, then "Open in Safari" at the bottom' : 'Tap \u00b7\u00b7\u00b7 then "Open in Chrome"';
    return ios ? 'Tap the share icon at the bottom, then "Open in Safari"' : 'Tap the menu icon, then "Open in browser"';
  }
  if (isIAB()) {
    document.getElementById('iab-warning').style.display = 'block';
    document.getElementById('iab-instruction').innerHTML = getInstruction();
    var btn = document.getElementById('open-btn');
    btn.textContent = 'Copy link and open in browser';
    btn.href = '#';
    btn.onclick = function(e) { e.preventDefault(); copyLink(); };
  }
  function copyLink() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(chronicleUrl).then(function() {
        document.querySelector('.copy-btn').textContent = '\u2713 Copied';
        setTimeout(function() { document.querySelector('.copy-btn').textContent = 'Copy link'; }, 2000);
      });
    } else { document.getElementById('link-input').select(); document.execCommand('copy'); }
  }
</script>
</body>
</html>`;
}

// ── Explore HTML page ─────────────────────────────────────────────────────────
function explorePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Explore — Chronicle by Remembory</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Crimson Text', Georgia, serif; background: #f7f2ea; color: #2c2416; min-height: 100vh; }
    a { color: inherit; text-decoration: none; }
    header { background: rgba(245,240,232,0.96); border-bottom: 1px solid #c8b89a; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; backdrop-filter: blur(8px); }
    .logo { font-family: 'Playfair Display', serif; font-size: 1.2rem; font-weight: 700; color: #1a1208; }
    .logo span { font-weight: 400; font-style: italic; font-size: 0.95rem; color: #8a7460; margin-left: 6px; }
    .key-status { font-size: 0.76rem; color: #8a7460; font-style: italic; }
    .key-status.active { color: #4a7a5a; }
    nav.tabs { display: flex; border-bottom: 2px solid #e0d4be; background: #faf7f2; }
    nav.tabs button { padding: 10px 24px 8px; border: none; background: transparent; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.95rem; color: #8a7460; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color 0.15s; }
    nav.tabs button.active { color: #1a1208; border-bottom-color: #2c2416; font-weight: 600; }
    nav.tabs button:hover:not(.active) { color: #4a3820; }
    /* Three-column layout */
    .layout { display: grid; grid-template-columns: 176px 1fr 216px; gap: 20px; max-width: 1240px; margin: 0 auto; padding: 20px 16px 60px; align-items: start; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 176px 1fr; } .sidebar-right { display: none !important; } }
    @media (max-width: 720px) { .layout { grid-template-columns: 1fr; } .sidebar-left { display: none !important; } }
    .sidebar-left, .sidebar-right { position: sticky; top: 88px; max-height: calc(100vh - 108px); overflow-y: auto; }
    /* Left sidebar */
    .sl-section { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 4px; padding: 12px; margin-bottom: 10px; }
    .sl-viewer { display: flex; align-items: center; gap: 8px; }
    .sl-avatar { width: 36px; height: 36px; border-radius: 50%; background: #c8a87a; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #1a1208; font-size: 1rem; flex-shrink: 0; overflow: hidden; }
    .sl-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .sl-name { font-size: 0.86rem; font-weight: 600; color: #1a1208; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
    .sl-links { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; }
    .sl-link { font-size: 0.82rem; color: #8a7460; padding: 5px 6px; border-radius: 3px; display: flex; align-items: center; gap: 6px; transition: background 0.1s; }
    .sl-link:hover { background: rgba(44,36,22,0.06); color: #2c2416; }
    .sl-group-header { font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; color: #a8a090; font-family: Arial, sans-serif; margin-bottom: 5px; }
    .sl-expand-btn { background: none; border: none; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.8rem; color: #a8885a; padding: 2px 0; text-decoration: underline; }
    .sl-person { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 0.82rem; }
    .sl-mini-av { width: 22px; height: 22px; border-radius: 50%; background: #c8a87a; display: flex; align-items: center; justify-content: center; font-size: 0.62rem; font-weight: 600; color: #1a1208; overflow: hidden; flex-shrink: 0; }
    .sl-mini-av img { width: 100%; height: 100%; object-fit: cover; }
    .sl-person a { color: #a8885a; text-decoration: underline; font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* Cards */
    .card { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 4px; padding: 18px; margin-bottom: 14px; transition: box-shadow 0.15s; }
    .card:hover { box-shadow: 0 4px 20px rgba(44,36,22,0.1); }
    .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; background: #c8a87a; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #1a1208; font-size: 0.95rem; flex-shrink: 0; overflow: hidden; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .card-byline { flex: 1; min-width: 0; }
    .card-byline strong { display: block; font-size: 0.92rem; color: #1a1208; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-byline span { font-size: 0.76rem; color: #8a7460; font-style: italic; }
    .vis-badge { font-size: 0.66rem; padding: 2px 6px; border-radius: 10px; font-family: Arial, sans-serif; letter-spacing: 0.04em; flex-shrink: 0; }
    .vis-public { background: rgba(74,122,90,0.12); color: #2d6b3a; border: 1px solid rgba(74,122,90,0.3); }
    .vis-connected { background: rgba(100,120,160,0.12); color: #3a4a7a; border: 1px solid rgba(100,120,160,0.3); }
    .vis-subscriber { background: rgba(168,136,90,0.12); color: #7a5a20; border: 1px solid rgba(168,136,90,0.3); }
    .memory-title { font-family: 'Playfair Display', serif; font-size: 1.05rem; font-style: italic; color: #1a1208; margin-bottom: 6px; line-height: 1.3; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
    .chip { font-size: 0.74rem; padding: 2px 7px; background: rgba(200,168,122,0.15); border: 1px solid rgba(200,168,122,0.35); border-radius: 10px; color: #5a4020; }
    .excerpt { font-size: 0.88rem; color: #5a4830; line-height: 1.6; margin-bottom: 10px; }
    .card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid #ede4d4; }
    .react-btn { background: transparent; border: 1px solid #d4c4a8; border-radius: 20px; padding: 3px 10px; cursor: pointer; font-size: 0.84rem; color: #8a7460; font-family: 'Crimson Text', serif; transition: all 0.15s; display: flex; align-items: center; gap: 4px; }
    .react-btn:hover, .react-btn.reacted { background: rgba(200,100,100,0.08); border-color: rgba(200,100,100,0.3); color: #a04040; }
    .profile-link { font-size: 0.76rem; color: #a8885a; text-decoration: underline; }
    .loading { color: #8a7460; font-style: italic; padding: 40px 0; text-align: center; font-size: 0.9rem; }
    .empty { text-align: center; padding: 50px 20px; color: #8a7460; }
    .empty h3 { font-family: 'Playfair Display', serif; font-style: italic; margin-bottom: 8px; font-size: 1.2rem; color: #4a3820; }
    .empty p { font-size: 0.88rem; line-height: 1.6; }
    /* Browse controls */
    .browse-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
    .sort-group { display: flex; border: 1px solid #c8b89a; border-radius: 20px; overflow: hidden; }
    .sort-btn { padding: 5px 14px; border: none; background: transparent; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.86rem; color: #8a7460; transition: all 0.15s; }
    .sort-btn.active { background: #2c2416; color: #f5f0e8; }
    .sort-btn:not(.active):hover { background: rgba(44,36,22,0.06); }
    .period-group { display: flex; border: 1px solid #c8b89a; border-radius: 20px; overflow: hidden; }
    .period-btn { padding: 5px 12px; border: none; background: transparent; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.86rem; color: #8a7460; transition: all 0.15s; }
    .period-btn.active { background: #2c2416; color: #f5f0e8; }
    .period-btn:not(.active):hover { background: rgba(44,36,22,0.06); }
    .connected-filter { display: flex; align-items: center; gap: 5px; font-size: 0.86rem; color: #6a5840; cursor: pointer; margin-left: auto; }
    .connected-filter input { cursor: pointer; accent-color: #2c2416; width: 14px; height: 14px; }
    /* Right sidebar */
    .rs-section { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 4px; padding: 14px; margin-bottom: 10px; }
    .rs-title { font-family: 'Playfair Display', serif; font-style: italic; font-size: 0.95rem; color: #1a1208; margin-bottom: 8px; }
    .rs-stat-row { display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; font-size: 0.82rem; color: #4a3820; border-bottom: 1px solid #f0e8d8; }
    .rs-stat-row:last-child { border-bottom: none; }
    .rs-stat-num { font-weight: 600; color: #2c2416; }
    .rs-donate { display: block; text-align: center; padding: 8px 12px; background: #2c2416; color: #f5f0e8; border-radius: 3px; font-size: 0.86rem; font-family: 'Crimson Text', serif; transition: opacity 0.15s; margin-top: 4px; }
    .rs-donate:hover { opacity: 0.85; }
    /* Interest right sidebar form */
    .rs-field-label { display: block; font-size: 0.68rem; letter-spacing: 0.05em; text-transform: uppercase; color: #6a5840; margin: 12px 0 5px; font-family: Arial, sans-serif; }
    .rs-field-label:first-child { margin-top: 0; }
    .chip-group { display: flex; flex-wrap: wrap; gap: 4px; min-height: 20px; }
    .int-chip { display: inline-flex; align-items: center; gap: 3px; font-size: 0.72rem; padding: 2px 7px; background: rgba(200,168,122,0.15); border: 1px solid rgba(200,168,122,0.35); border-radius: 10px; color: #5a4020; }
    .int-chip button { background: none; border: none; cursor: pointer; color: #a8885a; font-size: 0.82rem; padding: 0 0 0 1px; line-height: 1; }
    .int-chip button:hover { color: #c04040; }
    .rs-add-row { display: flex; gap: 4px; margin-top: 5px; }
    .rs-add-row input { flex: 1; padding: 4px 7px; border: 1px solid #c8b89a; border-radius: 3px; font-family: 'Crimson Text', serif; font-size: 0.84rem; background: #faf7f2; color: #1a1208; min-width: 0; }
    .rs-add-row input:focus { outline: none; border-color: #a8885a; }
    .rs-add-row button { padding: 4px 9px; background: #2c2416; color: #f5f0e8; border: none; border-radius: 3px; cursor: pointer; font-size: 0.88rem; flex-shrink: 0; }
    .year-row { display: flex; gap: 5px; align-items: center; }
    .year-row span { color: #8a7460; font-size: 0.8rem; flex-shrink: 0; }
    .year-row input { flex: 1; padding: 4px 7px; border: 1px solid #c8b89a; border-radius: 3px; font-family: 'Crimson Text', serif; font-size: 0.84rem; background: #faf7f2; color: #1a1208; min-width: 0; }
    .year-row input:focus { outline: none; border-color: #a8885a; }
    .rs-search-btn { width: 100%; margin-top: 12px; padding: 8px; background: #2c2416; color: #f5f0e8; border: none; border-radius: 3px; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.9rem; }
    .rs-search-btn:disabled { opacity: 0.5; }
    .rs-save-msg { font-size: 0.76rem; margin-top: 5px; font-style: italic; text-align: center; }
    .rs-save-msg.ok { color: #4a7a5a; }
    .rs-save-msg.err { color: #c4858a; }
    .rs-results-count { font-size: 0.78rem; color: #8a7460; font-style: italic; margin-top: 6px; text-align: center; }
  </style>
</head>
<body>
<header>
  <div class="logo">Chronicle <span>Explore</span></div>
  <div class="key-status" id="key-status">Not signed in</div>
</header>
<nav class="tabs">
  <button onclick="switchTab('browse')" id="tab-browse" class="active">Browse</button>
  <button onclick="switchTab('interests')" id="tab-interests">Find</button>
</nav>
<div class="layout">
  <aside class="sidebar-left">
    <div id="sl-content"><p class="loading" style="padding:16px 0;font-size:0.8rem">Loading\u2026</p></div>
  </aside>
  <div>
    <div id="main-content"></div>
  </div>
  <aside class="sidebar-right" id="sidebar-right"></aside>
</div>

<script>
var API = 'https://social.remembory.net';
var viewerKey = '', viewerId = '', activeTab = 'browse';
var browseSort = 'latest', browsePeriod = '7d', browseConnected = false;
var interests = { locations: [], yearFrom: null, yearTo: null, tags: [] };
var reactedMemories = {}, ownProfile = null;

function getParam(n) { return new URLSearchParams(location.search).get(n) || ''; }
function lsGet(k) { try { return localStorage.getItem(k); } catch(e) { return null; } }
function lsSet(k,v) { try { localStorage.setItem(k,v); } catch(e) {} }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
async function apiFetch(path) { var r = await fetch(API+path); if (!r.ok) throw new Error('Server error '+r.status); return r.json(); }

async function init() {
  var ku = getParam('key'), iu = getParam('id');
  if (ku) { lsSet('chronicle-explore-key', ku); viewerKey = ku; }
  else viewerKey = lsGet('chronicle-explore-key') || '';
  if (iu) { lsSet('chronicle-explore-id', iu); viewerId = iu; }
  else viewerId = lsGet('chronicle-explore-id') || '';
  var reacted = lsGet('chronicle-explore-reacted');
  if (reacted) { try { reactedMemories = JSON.parse(reacted); } catch(e) {} }
  updateKeyStatus();
  await Promise.all([loadOwnProfile(), loadInterestPrefs()]);
  renderLeftSidebar();
  loadConnections();
  switchTab(getParam('tab') || 'browse');
}

function updateKeyStatus() {
  var el = document.getElementById('key-status');
  if (viewerKey) { el.textContent = 'Signed in via Chronicle'; el.className = 'key-status active'; }
  else { el.textContent = 'Not signed in'; el.className = 'key-status'; }
}

async function loadOwnProfile() {
  if (!viewerKey || !viewerId) return;
  try {
    var r = await fetch(API+'/profile/'+encodeURIComponent(viewerId)+'?key='+encodeURIComponent(viewerKey));
    if (!r.ok) return;
    ownProfile = await r.json();
    if (!interests.locations.length && !interests.tags.length && !interests.yearFrom && !interests.yearTo) {
      var locs=[], tags=[], years=[];
      (ownProfile.memories||[]).forEach(function(m) {
        var loc = m.locationTown && m.locationCountry ? m.locationTown+', '+m.locationCountry
          : m.locationTown || m.locationCountry || m.location || '';
        if (loc && !locs.includes(loc)) locs.push(loc);
        if (m.year && !years.includes(m.year)) years.push(m.year);
        (m.tags||[]).forEach(function(t) { if (t && !tags.includes(t)) tags.push(t); });
      });
      interests.locations = locs; interests.tags = tags;
      if (years.length) { interests.yearFrom = Math.min.apply(null,years); interests.yearTo = Math.max.apply(null,years); }
    }
  } catch(e) {}
}

async function loadInterestPrefs() {
  if (!viewerKey) return;
  try {
    var r = await fetch(API+'/interest/get?key='+encodeURIComponent(viewerKey));
    if (r.ok) { var d = await r.json(); if (d && (d.locations&&d.locations.length||d.tags&&d.tags.length||d.yearFrom||d.yearTo)) interests = d; }
  } catch(e) {}
}

function renderLeftSidebar() {
  var el = document.getElementById('sl-content'); if (!el) return;
  var av = ownProfile && ownProfile.imageUrl
    ? '<div class="sl-avatar"><img src="'+esc(ownProfile.imageUrl)+'" alt="" onerror="this.style.display=&apos;none&apos;"></div>'
    : '<div class="sl-avatar">'+esc(((ownProfile&&ownProfile.displayName)||viewerKey||'?')[0].toUpperCase())+'</div>';
  var profLink = viewerId ? API+'/p/'+viewerId+'?key='+encodeURIComponent(viewerKey) : '#';
  el.innerHTML =
    '<div class="sl-section">'+
      '<div class="sl-viewer">'+av+'<div class="sl-name">'+esc((ownProfile&&ownProfile.displayName)||(viewerKey?'Signed in':'Not signed in'))+'</div></div>'+
      '<div class="sl-links">'+
        '<a class="sl-link" href="https://remembory.net/chronicle.html">\uD83D\uDCD6 My Chronicle</a>'+
        (viewerId?'<a class="sl-link" href="'+profLink+'">\u25CE My Profile</a>':'')+
      '</div>'+
    '</div>'+
    '<div class="sl-section" id="sl-connections"><div class="sl-group-header">Connections</div><p class="loading" style="font-size:0.78rem;padding:4px 0">Loading\u2026</p></div>'+
    '<div class="sl-section"><div class="sl-group-header">Following</div><p style="font-size:0.76rem;color:#8a7460;font-style:italic;padding:2px 0">Coming soon</p></div>';
}

async function loadConnections() {
  var el = document.getElementById('sl-connections'); if (!el) return;
  if (!viewerKey) { el.innerHTML = '<div class="sl-group-header">Connections</div><p style="font-size:0.76rem;color:#8a7460;font-style:italic;padding:2px 0">Sign in to view</p>'; return; }
  try {
    var data = await (await fetch(API+'/connections?key='+encodeURIComponent(viewerKey))).json();
    var conns = data.connections || [];
    if (!conns.length) { el.innerHTML = '<div class="sl-group-header">Connections</div><p style="font-size:0.76rem;color:#8a7460;font-style:italic;padding:2px 0">None yet</p>'; return; }
    var shown = conns.slice(0,4);
    var html = '<div class="sl-group-header">Connections ('+conns.length+')</div>';
    shown.forEach(function(c) {
      var av = c.imageUrl ? '<div class="sl-mini-av"><img src="'+esc(c.imageUrl)+'" alt=""></div>' : '<div class="sl-mini-av">'+esc((c.displayName||'?')[0])+'</div>';
      html += '<div class="sl-person">'+av+'<a href="'+API+'/p/'+esc(c.identifier)+'?key='+encodeURIComponent(viewerKey)+'">'+esc(c.displayName)+'</a></div>';
    });
    if (conns.length > 4) html += '<button class="sl-expand-btn" data-conns="'+esc(JSON.stringify(conns))+'" onclick="expandConns(this)">+'+(conns.length-4)+' more</button>';
    el.innerHTML = html;
  } catch(e) { el.innerHTML = '<div class="sl-group-header">Connections</div>'; }
}

function expandConns(btn) {
  var conns = JSON.parse(btn.getAttribute('data-conns')||'[]');
  var el = btn.closest('.sl-section');
  var html = '<div class="sl-group-header">Connections ('+conns.length+')</div>';
  conns.forEach(function(c) {
    var av = c.imageUrl ? '<div class="sl-mini-av"><img src="'+esc(c.imageUrl)+'" alt=""></div>' : '<div class="sl-mini-av">'+esc((c.displayName||'?')[0])+'</div>';
    html += '<div class="sl-person">'+av+'<a href="'+API+'/p/'+esc(c.identifier)+'?key='+encodeURIComponent(viewerKey)+'">'+esc(c.displayName)+'</a></div>';
  });
  el.innerHTML = html;
}

function switchTab(tab) {
  activeTab = tab;
  document.getElementById('tab-browse').className = tab==='browse'?'active':'';
  document.getElementById('tab-interests').className = tab==='interests'?'active':'';
  if (tab==='browse') { renderBrowseCenter(); renderBrowseRightSidebar(); }
  else { renderInterestsCenter(); renderInterestsRightSidebar(); }
}

// ── Browse tab ─────────────────────────────────────────────────────────────────
function renderBrowseCenter() {
  document.getElementById('main-content').innerHTML =
    '<div class="browse-controls">'+
      '<div class="sort-group">'+
        '<button class="sort-btn'+(browseSort==='latest'?' active':'')+'" onclick="setSort(&apos;latest&apos;)">Latest</button>'+
        '<button class="sort-btn'+(browseSort==='popular'?' active':'')+'" onclick="setSort(&apos;popular&apos;)">Popular</button>'+
      '</div>'+
      '<div class="period-group" id="period-group" style="'+(browseSort==='popular'?'':'display:none')+'">'+
        '<button class="period-btn'+(browsePeriod==='7d'?' active':'')+'" onclick="setPeriod(&apos;7d&apos;)">7 days</button>'+
        '<button class="period-btn'+(browsePeriod==='24h'?' active':'')+'" onclick="setPeriod(&apos;24h&apos;)">24 hours</button>'+
      '</div>'+
      '<label class="connected-filter"><input type="checkbox" id="connected-cb"'+(browseConnected?' checked':'')+' onchange="setConnected(this.checked)"> My connections</label>'+
    '</div>'+
    '<div id="browse-feed"><p class="loading">Loading\u2026</p></div>';
  loadBrowseFeed();
}

async function renderBrowseRightSidebar() {
  var rs = document.getElementById('sidebar-right'); if (!rs) return;
  var supportHtml =
    '<div class="rs-section">'+
      '<div class="rs-title">Subscribe</div>'+
      '<p style="font-size:0.78rem;color:#6a5840;line-height:1.5;margin-bottom:8px">Unlock subscriber-level memories across all Chronicles.</p>'+
      '<a class="rs-donate" href="https://buy.stripe.com/14A5kC9s67KS9Ll49n8IU02" target="_blank" rel="noopener">&#10024; Subscribe &mdash; $20 AUD / year</a>'+
      '<p style="font-size:0.74rem;text-align:center;margin-top:8px"><a href="https://social.remembory.net/license/recover" target="_blank" style="color:#a8885a">Lost your key?</a></p>'+
    '</div>'+
    '<div class="rs-section"><a class="rs-donate" href="https://ko-fi.com/remembory" target="_blank" rel="noopener">\u2615 Support on Ko-fi</a></div>';
  rs.innerHTML = '<div class="rs-section"><p class="loading" style="font-size:0.8rem;padding:4px 0">Loading\u2026</p></div>'+supportHtml;
  try {
    var data = await (await fetch(API+'/explore/stats')).json();
    var h = '<div class="rs-title">Community</div>'+
      '<div class="rs-stat-row"><span>Chronicles</span><span class="rs-stat-num">'+(data.totalChronicles||0)+'</span></div>'+
      '<div class="rs-stat-row"><span>Public memories</span><span class="rs-stat-num">'+(data.publicMems||0)+'</span></div>';
    if (data.subscriberMems) h += '<div class="rs-stat-row"><span>Subscriber</span><span class="rs-stat-num">'+data.subscriberMems+'</span></div>';
    if (data.connectedMems) h += '<div class="rs-stat-row"><span>Connected</span><span class="rs-stat-num">'+data.connectedMems+'</span></div>';
    if (data.taggedMems) h += '<div class="rs-stat-row"><span>Tagged</span><span class="rs-stat-num">'+data.taggedMems+'</span></div>';
    rs.innerHTML = '<div class="rs-section">'+h+'</div>'+supportHtml;
  } catch(e) {}
}

function setSort(sort) {
  browseSort = sort;
  var pg = document.getElementById('period-group'); if (pg) pg.style.display = sort==='popular'?'':'none';
  document.querySelectorAll('.sort-btn').forEach(function(b){ b.className='sort-btn'+(b.textContent.toLowerCase()===sort?' active':''); });
  loadBrowseFeed();
}
function setPeriod(period) {
  browsePeriod = period;
  document.querySelectorAll('.period-btn').forEach(function(b){ b.className='period-btn'+(b.textContent.trim()===(period==='7d'?'7 days':'24 hours')?' active':''); });
  loadBrowseFeed();
}
function setConnected(checked) { browseConnected = checked; loadBrowseFeed(); }

async function loadBrowseFeed() {
  var el = document.getElementById('browse-feed'); if (!el) return;
  el.innerHTML = '<p class="loading">Loading\u2026</p>';
  try {
    var qs = '/explore/feed?sort='+browseSort+'&period='+browsePeriod+'&key='+encodeURIComponent(viewerKey);
    if (browseConnected) qs += '&connected=1';
    renderEntries((await apiFetch(qs)).entries||[], el, browseConnected?'No memories from your connections yet.':'No memories published yet.');
  } catch(e) { el.innerHTML = '<p class="loading" style="color:#c4858a">Could not load: '+esc(e.message)+'</p>'; }
}

// ── Interests tab ──────────────────────────────────────────────────────────────
function renderInterestsCenter() {
  var hasFilters = interests.locations.length||interests.tags.length||interests.yearFrom||interests.yearTo;
  document.getElementById('main-content').innerHTML = '<div id="interest-feed">'+
    (hasFilters ? '<p class="loading">Finding matches\u2026</p>' : '<div class="empty"><h3>Set your interests</h3><p>Use the panel on the right to define the places, periods, and themes you care about.</p></div>')+
    '</div>';
  if (hasFilters) loadInterestResults();
}

function renderInterestsRightSidebar() {
  var rs = document.getElementById('sidebar-right'); if (!rs) return;
  rs.innerHTML = buildInterestForm();
}

function buildInterestForm() {
  var lc = (interests.locations||[]).map(function(l){ return '<span class="int-chip">'+esc(l)+'<button onclick="removeILoc('+JSON.stringify(l).replace(/"/g,'&quot;')+')" title="Remove">&times;</button></span>'; }).join('');
  var tc = (interests.tags||[]).map(function(t){ return '<span class="int-chip">'+esc(t)+'<button onclick="removeITag('+JSON.stringify(t).replace(/"/g,'&quot;')+')" title="Remove">&times;</button></span>'; }).join('');
  return '<div class="rs-section">'+
    '<div class="rs-title">Your Interests</div>'+
    '<label class="rs-field-label">Locations</label>'+
    '<div class="chip-group" id="loc-chips">'+(lc||'<span style="font-size:0.74rem;color:#8a7460;font-style:italic">None</span>')+'</div>'+
    '<div class="rs-add-row"><input type="text" id="loc-input" placeholder="Add a place\u2026" onkeydown="if(event.key===&apos;Enter&apos;){addILoc();event.preventDefault();}"><button onclick="addILoc()">+</button></div>'+
    '<label class="rs-field-label">Time period</label>'+
    '<div class="year-row"><input type="number" id="int-year-from" value="'+esc(String(interests.yearFrom||''))+'" placeholder="From" min="1700" max="2100"><span>\u2013</span><input type="number" id="int-year-to" value="'+esc(String(interests.yearTo||''))+'" placeholder="To" min="1700" max="2100"></div>'+
    '<label class="rs-field-label">Tags &amp; themes</label>'+
    '<div class="chip-group" id="tag-chips">'+(tc||'<span style="font-size:0.74rem;color:#8a7460;font-style:italic">None</span>')+'</div>'+
    '<div class="rs-add-row"><input type="text" id="tag-input" placeholder="Add a tag\u2026" onkeydown="if(event.key===&apos;Enter&apos;){addITag();event.preventDefault();}"><button onclick="addITag()">+</button></div>'+
    '<button class="rs-search-btn" onclick="saveAndSearch()" id="save-int-btn">Find matching memories</button>'+
    '<div class="rs-save-msg" id="save-int-msg"></div>'+
    '<div class="rs-results-count" id="int-results-count"></div>'+
  '</div>';
}

function refreshLocChips() {
  var el = document.getElementById('loc-chips'); if (!el) return;
  el.innerHTML = (interests.locations||[]).map(function(l){ return '<span class="int-chip">'+esc(l)+'<button onclick="removeILoc('+JSON.stringify(l).replace(/"/g,'&quot;')+')" title="Remove">&times;</button></span>'; }).join('')||'<span style="font-size:0.74rem;color:#8a7460;font-style:italic">None</span>';
}
function refreshTagChips() {
  var el = document.getElementById('tag-chips'); if (!el) return;
  el.innerHTML = (interests.tags||[]).map(function(t){ return '<span class="int-chip">'+esc(t)+'<button onclick="removeITag('+JSON.stringify(t).replace(/"/g,'&quot;')+')" title="Remove">&times;</button></span>'; }).join('')||'<span style="font-size:0.74rem;color:#8a7460;font-style:italic">None</span>';
}
function addILoc() { var i=document.getElementById('loc-input'),v=(i.value||'').trim(); if(!v) return; if(!interests.locations.includes(v)){interests.locations.push(v);refreshLocChips();} i.value=''; }
function removeILoc(l) { interests.locations=interests.locations.filter(function(x){return x!==l;}); refreshLocChips(); }
function addITag() { var i=document.getElementById('tag-input'),v=(i.value||'').trim().toLowerCase(); if(!v) return; if(!interests.tags.includes(v)){interests.tags.push(v);refreshTagChips();} i.value=''; }
function removeITag(t) { interests.tags=interests.tags.filter(function(x){return x!==t;}); refreshTagChips(); }

async function saveAndSearch() {
  var yf=document.getElementById('int-year-from'),yt=document.getElementById('int-year-to');
  interests.yearFrom = yf&&yf.value?parseInt(yf.value):null;
  interests.yearTo = yt&&yt.value?parseInt(yt.value):null;
  var btn=document.getElementById('save-int-btn'),msg=document.getElementById('save-int-msg');
  if (btn) btn.disabled=true;
  if (viewerKey) {
    try {
      var r=await fetch(API+'/interest/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:viewerKey,interests:interests})});
      if (!r.ok) throw new Error();
      if (msg){msg.textContent='\u2713 Saved';msg.className='rs-save-msg ok';}
    } catch(e) { if(msg){msg.textContent='Could not save';msg.className='rs-save-msg err';} }
  }
  await loadInterestResults();
  if (btn) btn.disabled=false;
}

async function loadInterestResults() {
  var el=document.getElementById('interest-feed'); if(!el) return;
  el.innerHTML='<p class="loading">Finding matches\u2026</p>';
  var qs='/explore/interest?key='+encodeURIComponent(viewerKey);
  if (interests.locations&&interests.locations.length) qs+='&locations='+encodeURIComponent(interests.locations.join(','));
  var yf=document.getElementById('int-year-from'),yt=document.getElementById('int-year-to');
  var yFrom=(yf&&yf.value)?parseInt(yf.value):interests.yearFrom, yTo=(yt&&yt.value)?parseInt(yt.value):interests.yearTo;
  if (yFrom) qs+='&yearFrom='+yFrom; if (yTo) qs+='&yearTo='+yTo;
  if (interests.tags&&interests.tags.length) qs+='&tags='+encodeURIComponent(interests.tags.join(','));
  try {
    var entries=(await apiFetch(qs)).entries||[];
    renderEntries(entries,el,'No memories match these interests yet.');
    var ce=document.getElementById('int-results-count');
    if(ce) ce.textContent=entries.length?(entries.length+' matching '+(entries.length===1?'memory':'memories')):'';
  } catch(e) { el.innerHTML='<p class="loading" style="color:#c4858a">Could not load: '+esc(e.message)+'</p>'; }
}

// ── Cards ──────────────────────────────────────────────────────────────────────
function renderEntries(entries,container,emptyMsg) {
  if (!entries.length) { container.innerHTML='<div class="empty"><h3>Nothing here yet</h3><p>'+esc(emptyMsg||'')+'</p></div>'; return; }
  container.innerHTML='';
  entries.forEach(function(e){ container.appendChild(makeCard(e)); });
}

function makeCard(entry) {
  var p=entry.profile,m=entry.memory,reactions=entry.reactions||0;
  var mk=p.identifier+':'+m.id,reacted=!!reactedMemories[mk];
  var vis=m.visibility||'public';
  var vbc=vis==='connected'?'vis-connected':vis==='subscriber'?'vis-subscriber':'vis-public';
  var vl=vis==='connected'?'Connected':vis==='subscriber'?'Subscribers':'Public';
  var chips='';
  if(m.year) chips+='<span class="chip">'+esc(String(m.year))+'</span>';
  if(m.location) chips+='<span class="chip">\uD83D\uDCCD '+esc(m.location)+'</span>';
  (m.tags||[]).slice(0,3).forEach(function(t){chips+='<span class="chip">'+esc(t)+'</span>';});
  var av=p.imageUrl?'<img src="'+esc(p.imageUrl)+'" alt="" onerror="this.style.display=&apos;none&apos;">':esc((p.displayName||'?')[0]);
  var ex=(m.content||'').replace(/<[^>]*>/g,'').slice(0,200)+(m.content&&m.content.length>200?'\u2026':'');
  var div=document.createElement('div'); div.className='card';
  div.innerHTML=
    '<div class="card-header"><div class="avatar">'+av+'</div>'+
    '<div class="card-byline"><strong>'+esc(p.displayName)+'</strong><span>'+esc(memDateLabel(m))+'</span></div>'+
    '<span class="vis-badge '+vbc+'">'+vl+'</span></div>'+
    (m.title?'<div class="memory-title">'+esc(m.title)+'</div>':'')+
    (chips?'<div class="chips">'+chips+'</div>':'')+
    (ex?'<p class="excerpt">'+ex+'</p>':'')+
    '<div class="card-footer">'+
    '<button class="react-btn'+(reacted?' reacted':'')+'" onclick="doReact(&apos;'+esc(p.identifier)+'&apos;,&apos;'+esc(m.id)+'&apos;,this)">'+(reacted?'\u2764':'\u2661')+' <span class="react-count">'+reactions+'</span></button>'+
    '<a class="profile-link" href="'+API+'/p/'+esc(p.identifier)+'?key='+encodeURIComponent(viewerKey)+'">'+esc(p.displayName)+'&apos;s chronicle \u2192</a>'+
    '</div>';
  return div;
}

function memDateLabel(m) {
  if (!m.year) return '';
  if (m.month) return new Date(m.year,m.month-1,1).toLocaleString('default',{month:'long',year:'numeric'});
  return String(m.year);
}

async function doReact(identifier,memId,btn) {
  var mk=identifier+':'+memId,reacted=!!reactedMemories[mk],action=reacted?'remove':'add';
  try {
    var data=(await (await fetch(API+'/react',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,memId,action,key:viewerKey})})).json());
    var count=data.count||0;
    if(action==='add'){reactedMemories[mk]=true;btn.className='react-btn reacted';btn.innerHTML='\u2764 <span class="react-count">'+count+'</span>';}
    else{delete reactedMemories[mk];btn.className='react-btn';btn.innerHTML='\u2661 <span class="react-count">'+count+'</span>';}
    lsSet('chronicle-explore-reacted',JSON.stringify(reactedMemories));
  } catch(e) {}
}

window.addEventListener('DOMContentLoaded', init);
</script>
</body>
</html>`;
}

// ── Location display helper ───────────────────────────────────────────────────
// detail: "full"|"town"|"state"|"country", or undefined to use m.locationPrivacy
function locationDisplay(m, detail) {
  const priv = detail !== undefined ? detail : (m.locationPrivacy || "town");
  if (priv === "full") {
    return m.location || [m.locationTown, m.locationState, m.locationCountry].filter(Boolean).join(", ") || "";
  }
  if (priv === "state") {
    return [m.locationState, m.locationCountry].filter(Boolean).join(", ") || m.locationCountry || "";
  }
  if (priv === "country") {
    return m.locationCountry || m.locationState || "";
  }
  // "town" — default
  return [m.locationTown, m.locationCountry].filter(Boolean).join(", ") || m.locationCountry || m.locationState || "";
}

// ── Individual profile page ───────────────────────────────────────────────────
function profilePage(profile, visibleMems, isOwner, viewerKey, viewerIdentifier, connectionLevel) {
  const mems = visibleMems || [];
  // Compute stats from visible memories
  const years = mems.map(m => m.year).filter(Boolean);
  const yearMin = years.length ? Math.min(...years) : null;
  const yearMax = years.length ? Math.max(...years) : null;
  const yearRange = yearMin && yearMax ? (yearMin === yearMax ? String(yearMin) : `${yearMin}–${yearMax}`) : "";
  // Tag frequency cloud (top 20)
  const tagFreq = {};
  mems.forEach(m => (m.tags || []).forEach(t => { tagFreq[t] = (tagFreq[t] || 0) + 1; }));
  const topTags = Object.entries(tagFreq).sort((a,b) => b[1]-a[1]).slice(0,20);
  // Visibility breakdown (for owner) from stored counts
  const mvc = profile.memCountByVisibility || {};
  const vk = viewerKey || "";
  const safeConns = JSON.stringify([]); // placeholder; actual left sidebar loaded via JS
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(profile.displayName)} — Chronicle</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Crimson Text', Georgia, serif; background: #f7f2ea; color: #2c2416; min-height: 100vh; }
    a { color: inherit; text-decoration: none; }
    header { background: rgba(245,240,232,0.96); border-bottom: 1px solid #c8b89a; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; backdrop-filter: blur(8px); }
    .logo { font-family: 'Playfair Display', serif; font-size: 1.2rem; font-weight: 700; color: #1a1208; }
    .logo span { font-weight: 400; font-style: italic; font-size: 0.95rem; color: #8a7460; margin-left: 6px; }
    .header-back { font-size: 0.84rem; color: #8a7460; }
    .header-back:hover { color: #2c2416; }
    /* Three-column layout */
    .layout { display: grid; grid-template-columns: 176px 1fr 216px; gap: 20px; max-width: 1240px; margin: 0 auto; padding: 20px 16px 60px; align-items: start; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 176px 1fr; } .sidebar-right { display: none !important; } }
    @media (max-width: 720px) { .layout { grid-template-columns: 1fr; } .sidebar-left { display: none !important; } }
    .sidebar-left, .sidebar-right { position: sticky; top: 88px; max-height: calc(100vh - 108px); overflow-y: auto; }
    /* Left sidebar */
    .sl-section { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 4px; padding: 12px; margin-bottom: 10px; }
    .sl-viewer { display: flex; align-items: center; gap: 8px; }
    .sl-avatar { width: 36px; height: 36px; border-radius: 50%; background: #c8a87a; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #1a1208; font-size: 1rem; flex-shrink: 0; overflow: hidden; }
    .sl-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .sl-name { font-size: 0.86rem; font-weight: 600; color: #1a1208; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
    .sl-links { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; }
    .sl-link { font-size: 0.82rem; color: #8a7460; padding: 5px 6px; border-radius: 3px; display: flex; align-items: center; gap: 6px; transition: background 0.1s; }
    .sl-link:hover { background: rgba(44,36,22,0.06); color: #2c2416; }
    .sl-group-header { font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; color: #a8a090; font-family: Arial, sans-serif; margin-bottom: 5px; }
    .sl-expand-btn { background: none; border: none; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.8rem; color: #a8885a; padding: 2px 0; text-decoration: underline; }
    .sl-person { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 0.82rem; }
    .sl-mini-av { width: 22px; height: 22px; border-radius: 50%; background: #c8a87a; display: flex; align-items: center; justify-content: center; font-size: 0.62rem; font-weight: 600; color: #1a1208; overflow: hidden; flex-shrink: 0; }
    .sl-mini-av img { width: 100%; height: 100%; object-fit: cover; }
    .sl-person a { color: #a8885a; text-decoration: underline; font-size: 0.8rem; }
    /* Main content */
    .profile-header { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 24px; padding: 18px; background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 4px; }
    .big-avatar { width: 60px; height: 60px; border-radius: 50%; background: #c8a87a; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 600; color: #1a1208; flex-shrink: 0; overflow: hidden; }
    .big-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .profile-info h2 { font-family: 'Playfair Display', serif; font-size: 1.4rem; font-style: italic; color: #1a1208; }
    .profile-info p { font-size: 0.88rem; color: #5a4830; line-height: 1.6; margin-top: 5px; }
    .profile-info .meta { font-size: 0.78rem; color: #8a7460; margin-top: 5px; }
    .owner-banner { background: rgba(74,122,90,0.08); border: 1px solid rgba(74,122,90,0.25); border-radius: 4px; padding: 9px 13px; margin-bottom: 16px; font-size: 0.82rem; color: #3a5a3a; }
    /* Memory cards */
    .memory-card { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 4px; padding: 16px 18px; margin-bottom: 12px; }
    .memory-card h3 { font-family: 'Playfair Display', serif; font-style: italic; font-size: 1.05rem; color: #1a1208; margin-bottom: 5px; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
    .chip { font-size: 0.74rem; padding: 2px 7px; background: rgba(200,168,122,0.15); border: 1px solid rgba(200,168,122,0.35); border-radius: 10px; color: #5a4020; }
    .memory-card p { font-size: 0.9rem; color: #4a3820; line-height: 1.7; white-space: pre-wrap; }
    .no-mems { text-align: center; padding: 40px; color: #8a7460; font-style: italic; font-size: 0.9rem; }
    .vis-badge { font-size: 0.66rem; padding: 2px 6px; border-radius: 10px; font-family: Arial, sans-serif; letter-spacing: 0.04em; float: right; margin-left: 8px; }
    .vis-public { background: rgba(74,122,90,0.12); color: #2d6b3a; border: 1px solid rgba(74,122,90,0.3); }
    .vis-connected { background: rgba(100,120,160,0.12); color: #3a4a7a; border: 1px solid rgba(100,120,160,0.3); }
    .vis-subscriber { background: rgba(168,136,90,0.12); color: #7a5a20; border: 1px solid rgba(168,136,90,0.3); }
    /* Right sidebar */
    .rs-section { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 4px; padding: 14px; margin-bottom: 10px; }
    .rs-title { font-family: 'Playfair Display', serif; font-style: italic; font-size: 0.95rem; color: #1a1208; margin-bottom: 8px; }
    .rs-about { font-size: 0.84rem; color: #5a4830; line-height: 1.6; }
    .rs-stat-row { display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; font-size: 0.82rem; color: #4a3820; border-bottom: 1px solid #f0e8d8; }
    .rs-stat-row:last-child { border-bottom: none; }
    .rs-stat-num { font-weight: 600; color: #2c2416; }
    .conn-badge { display: inline-block; font-size: 0.72rem; padding: 2px 8px; border-radius: 10px; font-family: Arial, sans-serif; margin-bottom: 8px; }
    .conn-badge.connected { background: rgba(100,120,160,0.12); color: #3a4a7a; border: 1px solid rgba(100,120,160,0.3); }
    .conn-badge.public { background: rgba(74,122,90,0.12); color: #2d6b3a; border: 1px solid rgba(74,122,90,0.3); }
    .rs-owner-avatar { width: 48px; height: 48px; border-radius: 50%; background: #c8a87a; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 600; color: #1a1208; overflow: hidden; margin-bottom: 8px; }
    .rs-owner-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .rs-year-range { font-size: 0.78rem; color: #8a7460; font-style: italic; margin-bottom: 6px; }
    .tag-cloud { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .tag-cloud .chip { cursor: default; }
  </style>
</head>
<body>
<header>
  <div class="logo">Chronicle <span>${esc(profile.displayName)}</span></div>
  <a class="header-back" href="/explore">&#8592; Explore</a>
</header>
<div class="layout">
  <aside class="sidebar-left">
    <div id="sl-content"><p style="font-size:0.78rem;color:#8a7460;font-style:italic;padding:8px 0">Loading&hellip;</p></div>
  </aside>
  <div>
    ${isOwner ? `<div class="owner-banner">&#128100; Your chronicle — all visibility levels shown.</div>` : ""}
    <div class="profile-header">
      <div class="big-avatar">${profile.imageUrl ? `<img src="${esc(profile.imageUrl)}" alt="" onerror="this.style.display='none'">` : esc((profile.displayName || "?")[0])}</div>
      <div class="profile-info">
        <h2>${esc(profile.displayName)}</h2>
        ${profile.about ? `<p>${esc(profile.about)}</p>` : ""}
        <div class="meta">${mems.length} ${mems.length === 1 ? "memory" : "memories"}${yearRange ? ` · ${yearRange}` : ""} · Published ${profile.publishedAt ? new Date(profile.publishedAt).toLocaleDateString() : ""}</div>
      </div>
    </div>
    ${mems.length ? mems.map(m => {
      const vis = m.visibility || "public";
      const visBadgeClass = vis === "connected" ? "vis-connected" : vis === "subscriber" ? "vis-subscriber" : "vis-public";
      const visLabel = vis === "connected" ? "Connected" : vis === "subscriber" ? "Subscribers" : "Public";
      const locStr = locationDisplay(m, isOwner ? "full" : undefined);
      return `<div class="memory-card">
      <span class="vis-badge ${visBadgeClass}">${visLabel}</span>
      ${m.title ? `<h3>${esc(m.title)}</h3>` : ""}
      <div class="chips">
        ${m.year ? `<span class="chip">${esc(String(m.year))}</span>` : ""}
        ${locStr ? `<span class="chip">&#128205; ${esc(locStr)}</span>` : ""}
        ${(m.tags||[]).map(t => `<span class="chip">${esc(t)}</span>`).join("")}
      </div>
      ${m.content ? `<p>${esc(m.content)}</p>` : ""}
    </div>`;
    }).join("") : `<p class="no-mems">No memories visible to you in this chronicle.</p>`}
  </div>
  <aside class="sidebar-right">
    ${isOwner ? `
    <div class="rs-section">
      <div class="rs-title">About Me</div>
      ${profile.about ? `<p class="rs-about">${esc(profile.about)}</p>` : `<p class="rs-about" style="color:#8a7460;font-style:italic">No about text yet.</p>`}
    </div>
    <div class="rs-section">
      <div class="rs-title">Memory Stats</div>
      ${yearRange ? `<div class="rs-year-range">&#128197; ${yearRange}</div>` : ""}
      ${mvc.public ? `<div class="rs-stat-row"><span>Public</span><span class="rs-stat-num">${mvc.public}</span></div>` : ""}
      ${mvc.subscriber ? `<div class="rs-stat-row"><span>Subscribers</span><span class="rs-stat-num">${mvc.subscriber}</span></div>` : ""}
      ${mvc.connected ? `<div class="rs-stat-row"><span>Connected</span><span class="rs-stat-num">${mvc.connected}</span></div>` : ""}
      ${mvc.private ? `<div class="rs-stat-row"><span>Private</span><span class="rs-stat-num">${mvc.private}</span></div>` : ""}
      ${!mvc.public && !mvc.subscriber && !mvc.connected && !mvc.private ? `<div class="rs-stat-row"><span>Total</span><span class="rs-stat-num">${mems.length}</span></div>` : ""}
      ${topTags.length ? `<div style="margin-top:10px"><div class="sl-group-header">Tags</div><div class="tag-cloud">${topTags.map(([t,n]) => `<span class="chip" title="${esc(t)} (${n})">${esc(t)}</span>`).join("")}</div></div>` : ""}
    </div>
    ` : `
    <div class="rs-section">
      ${profile.imageUrl ? `<div class="rs-owner-avatar"><img src="${esc(profile.imageUrl)}" alt="" onerror="this.style.display='none'"></div>` : ""}
      <div class="rs-title">${esc(profile.displayName)}</div>
      ${connectionLevel === "connected" ? `<span class="conn-badge connected">Connected</span>` : `<span class="conn-badge public">Public</span>`}
      ${profile.about ? `<p class="rs-about">${esc(profile.about)}</p>` : ""}
      ${yearRange ? `<div class="rs-year-range" style="margin-top:8px">&#128197; ${yearRange}</div>` : ""}
      <div class="rs-stat-row" style="margin-top:8px"><span>Visible memories</span><span class="rs-stat-num">${mems.length}</span></div>
      ${topTags.length ? `<div style="margin-top:10px"><div class="sl-group-header">Tags</div><div class="tag-cloud">${topTags.map(([t,n]) => `<span class="chip">${esc(t)}</span>`).join("")}</div></div>` : ""}
    </div>
    `}
  </aside>
</div>

<script>
var API = 'https://social.remembory.net';
var viewerKey = '${esc(vk)}';
var viewerId = '${esc(viewerIdentifier || "")}';

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderLeftSidebar() {
  var el = document.getElementById('sl-content'); if (!el) return;
  var profLink = viewerId ? API+'/p/'+viewerId+'?key='+encodeURIComponent(viewerKey) : '#';
  el.innerHTML =
    '<div class="sl-section">'+
      '<div class="sl-viewer">'+
        '<div class="sl-avatar" id="sl-av">'+esc((viewerKey||'?')[0].toUpperCase())+'</div>'+
        '<div class="sl-name" id="sl-nm">'+(viewerKey?'Signed in':'Not signed in')+'</div>'+
      '</div>'+
      '<div class="sl-links">'+
        '<a class="sl-link" href="https://remembory.net/chronicle.html">\uD83D\uDCD6 My Chronicle</a>'+
        (viewerId?'<a class="sl-link" href="'+profLink+'">\u25CE My Profile</a>':'')+
      '</div>'+
    '</div>'+
    '<div class="sl-section" id="sl-connections"><div class="sl-group-header">Connections</div><p style="font-size:0.76rem;color:#8a7460;font-style:italic;padding:2px 0">Loading\u2026</p></div>'+
    '<div class="sl-section"><div class="sl-group-header">Following</div><p style="font-size:0.76rem;color:#8a7460;font-style:italic;padding:2px 0">Coming soon</p></div>';
  if (viewerKey) {
    loadViewerProfile();
    loadConnections();
  }
}

async function loadViewerProfile() {
  if (!viewerKey || !viewerId) return;
  try {
    var r = await fetch(API+'/profile/'+encodeURIComponent(viewerId)+'?key='+encodeURIComponent(viewerKey));
    if (!r.ok) return;
    var p = await r.json();
    var av = document.getElementById('sl-av'), nm = document.getElementById('sl-nm');
    if (av) { if (p.imageUrl) av.innerHTML = '<img src="'+esc(p.imageUrl)+'" alt="" onerror="this.style.display=\'none\'">'; else av.textContent = (p.displayName||'?')[0]; }
    if (nm) nm.textContent = p.displayName || viewerKey;
  } catch(e) {}
}

async function loadConnections() {
  var el = document.getElementById('sl-connections'); if (!el) return;
  if (!viewerKey) { el.innerHTML = '<div class="sl-group-header">Connections</div><p style="font-size:0.76rem;color:#8a7460;font-style:italic;padding:2px 0">Sign in to view</p>'; return; }
  try {
    var data = await (await fetch(API+'/connections?key='+encodeURIComponent(viewerKey))).json();
    var conns = data.connections || [];
    if (!conns.length) { el.innerHTML = '<div class="sl-group-header">Connections</div><p style="font-size:0.76rem;color:#8a7460;font-style:italic;padding:2px 0">None yet</p>'; return; }
    var shown = conns.slice(0,4);
    var html = '<div class="sl-group-header">Connections ('+conns.length+')</div>';
    shown.forEach(function(c) {
      var av = c.imageUrl ? '<div class="sl-mini-av"><img src="'+esc(c.imageUrl)+'" alt=""></div>' : '<div class="sl-mini-av">'+esc((c.displayName||'?')[0])+'</div>';
      html += '<div class="sl-person">'+av+'<a href="'+API+'/p/'+esc(c.identifier)+'?key='+encodeURIComponent(viewerKey)+'">'+esc(c.displayName)+'</a></div>';
    });
    if (conns.length > 4) html += '<button class="sl-expand-btn" data-conns="'+esc(JSON.stringify(conns))+'" onclick="expandConns(this)">+'+(conns.length-4)+' more</button>';
    el.innerHTML = html;
  } catch(e) { el.innerHTML = '<div class="sl-group-header">Connections</div>'; }
}

function expandConns(btn) {
  var conns = JSON.parse(btn.getAttribute('data-conns')||'[]');
  var el = btn.closest('.sl-section');
  var html = '<div class="sl-group-header">Connections ('+conns.length+')</div>';
  conns.forEach(function(c) {
    var av = c.imageUrl ? '<div class="sl-mini-av"><img src="'+esc(c.imageUrl)+'" alt=""></div>' : '<div class="sl-mini-av">'+esc((c.displayName||'?')[0])+'</div>';
    html += '<div class="sl-person">'+av+'<a href="'+API+'/p/'+esc(c.identifier)+'?key='+encodeURIComponent(viewerKey)+'">'+esc(c.displayName)+'</a></div>';
  });
  el.innerHTML = html;
}

window.addEventListener('DOMContentLoaded', renderLeftSidebar);
</script>
</body>
</html>`;
}

// ── Worker ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── Social / Explore site ──────────────────────────────────────────────────

    // Serve Explore page at root and /explore
    if (request.method === "GET" && (path === "/" || path === "/explore" || path === "")) {
      return new Response(explorePage(), {
        headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public,max-age=300" },
      });
    }

    // GET /p/:identifier — individual profile page
    if (request.method === "GET" && path.startsWith("/p/")) {
      const identifier = path.slice(3).split("?")[0];
      if (!identifier) return json({ error: "Not found" }, 404);
      const raw = await env.SHARES.get("profile:" + identifier);
      if (!raw) return new Response("<html><body><p>Profile not found or has been removed.</p><a href='/explore'>Back to Explore</a></body></html>", { status: 404, headers: { "Content-Type": "text/html" } });
      const profile = JSON.parse(raw);
      const viewerKey = getViewerKey(request, url);
      const viewerKeyHash = viewerKey ? await sha256hex(viewerKey.trim().toUpperCase()) : "";
      const viewerIdentifier = viewerKeyHash ? await env.SHARES.get("keymap:" + viewerKeyHash) : "";
      const isOwner = !!(viewerIdentifier && viewerIdentifier === identifier);
      const vEmailHash = (!isOwner && viewerKeyHash) ? await getViewerEmailHash(env, viewerKeyHash) : "";
      const isSub = !isOwner ? await checkSubscriber(env, viewerKeyHash, vEmailHash) : false;
      const visibleMems = isOwner
        ? (profile.memories || [])
        : (profile.memories || []).filter(m => canViewMemory(m, vEmailHash, profile.connectionEmailHashes || [], isSub));
      const connectionLevel = isOwner ? "owner" : (vEmailHash && (profile.connectionEmailHashes || []).includes(vEmailHash)) ? "connected" : "public";
      return new Response(profilePage(profile, visibleMems, isOwner, viewerKey, viewerIdentifier || "", connectionLevel), {
        headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store" },
      });
    }

    // POST /profile/publish
    if (request.method === "POST" && path === "/profile/publish") {
      const key = request.headers.get("X-LS-Key");
      if (!key) return json({ error: "Unauthorized" }, 401);
      try {
        const body = await request.json();
        if (!body.memories || !Array.isArray(body.memories)) return json({ error: "Invalid payload" }, 400);
        const keyHash = await sha256hex(key.trim().toUpperCase());

        // Get or create stable identifier
        let identifier = await env.SHARES.get("keymap:" + keyHash);
        if (!identifier) {
          identifier = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
          await env.SHARES.put("keymap:" + keyHash, identifier);
        }

        // Hash connection emails for privacy
        const connectionEmailHashes = await Promise.all(
          (body.connectionEmails || []).filter(Boolean).map(e => sha256hex(e.trim().toLowerCase()))
        );
        const ownerEmailHash = body.ownerEmail ? await sha256hex(body.ownerEmail.trim().toLowerCase()) : "";

        // Check for existing profile (preserve publishedAt)
        const existingRaw = await env.SHARES.get("profile:" + identifier);
        const existing = existingRaw ? JSON.parse(existingRaw) : null;

        const memCountByVisibility = {};
        (body.memories || []).forEach(m => {
          const v = m.visibility || "private";
          memCountByVisibility[v] = (memCountByVisibility[v] || 0) + 1;
        });

        const profile = {
          identifier,
          displayName: (body.displayName || body.ownerName || "Anonymous").slice(0, 80),
          about: (body.about || "").slice(0, 500),
          imageUrl: (body.imageUrl || "").slice(0, 500),
          ownerEmailHash,
          connectionEmailHashes,
          memories: body.memories,
          presenceIndex: body.presenceIndex || [],
          profilePrivacy: body.profilePrivacy || "open",
          allowFollowers: body.allowFollowers !== false,
          publishedAt: existing?.publishedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          memCount: body.memories.length,
          memCountByVisibility,
        };

        await env.SHARES.put("profile:" + identifier, JSON.stringify(profile), {
          expirationTtl: 60 * 60 * 24 * 365 * 2,
        });
        if (body.ownerEmail) await env.SHARES.put("profile_email:" + identifier, body.ownerEmail.trim().toLowerCase());

        // Update compact profiles index
        await updateProfilesIndex(env, {
          identifier,
          displayName: profile.displayName,
          about: profile.about,
          imageUrl: profile.imageUrl,
          ownerEmailHash,
          connectionEmailHashes,
          profilePrivacy: profile.profilePrivacy,
          publishedAt: profile.publishedAt,
          updatedAt: profile.updatedAt,
          memCount: profile.memCount,
          memCountByVisibility,
          presenceIndex: profile.presenceIndex,
        });

        return json({ ok: true, identifier, url: "https://social.remembory.net/p/" + identifier });
      } catch (e) {
        return json({ error: "Server error: " + e.message }, 500);
      }
    }

    // POST /profile/unpublish
    if (request.method === "POST" && path === "/profile/unpublish") {
      const key = request.headers.get("X-LS-Key");
      if (!key) return json({ error: "Unauthorized" }, 401);
      try {
        const body = await request.json();
        const identifier = body.identifier;
        if (!identifier) return json({ error: "No identifier" }, 400);
        await env.SHARES.delete("profile:" + identifier);
        const rawList = await env.SHARES.get("profiles:list");
        if (rawList) {
          const list = JSON.parse(rawList).filter(p => p.identifier !== identifier);
          await env.SHARES.put("profiles:list", JSON.stringify(list));
        }
        return json({ ok: true });
      } catch (e) {
        return json({ error: "Server error: " + e.message }, 500);
      }
    }

    // GET /profile/:identifier — JSON profile (owner gets all memories; others filtered by visibility)
    if (request.method === "GET" && path.startsWith("/profile/")) {
      const identifier = path.slice("/profile/".length);
      if (!identifier) return json({ error: "Not found" }, 404);
      const raw = await env.SHARES.get("profile:" + identifier);
      if (!raw) return json({ error: "not_found" }, 404);
      const profile = JSON.parse(raw);
      const viewerKey = getViewerKey(request, url);
      const viewerKeyHash = viewerKey ? await sha256hex(viewerKey.trim().toUpperCase()) : "";
      const viewerIdentifier = viewerKeyHash ? await env.SHARES.get("keymap:" + viewerKeyHash) || "" : "";
      const isOwner = !!(viewerIdentifier && viewerIdentifier === identifier);
      const pub = { ...profile };
      if (!isOwner) {
        const vEmailHash = viewerKeyHash ? await getViewerEmailHash(env, viewerKeyHash) : "";
        const isSub = await checkSubscriber(env, viewerKeyHash, vEmailHash);
        pub.memories = (profile.memories || []).filter(m => canViewMemory(m, vEmailHash, profile.connectionEmailHashes || [], isSub));
      }
      pub.isOwner = isOwner;
      delete pub.connectionEmailHashes; // don't expose
      return json(pub);
    }

    // GET /explore/feed?sort=latest|popular&period=7d|24h&connected=1
    if (request.method === "GET" && path === "/explore/feed") {
      const viewerKey = getViewerKey(request, url);
      const viewerKeyHash = viewerKey ? await sha256hex(viewerKey.trim().toUpperCase()) : "";
      const vEmailHash = viewerKeyHash ? await getViewerEmailHash(env, viewerKeyHash) : "";
      const isSub = await checkSubscriber(env, viewerKeyHash, vEmailHash);
      const sort = url.searchParams.get("sort") || "latest";
      const period = url.searchParams.get("period") || "7d";
      const connectedOnly = url.searchParams.get("connected") === "1";
      const cutoff = sort === "popular" ? Date.now() - (period === "24h" ? 86400000 : 7 * 86400000) : 0;

      const viewerIdentifier = viewerKeyHash ? await env.SHARES.get("keymap:" + viewerKeyHash) || "" : "";

      const list = await getProfilesList(env);
      let profiles = list.filter(p => p.profilePrivacy !== "disabled");

      if (connectedOnly) {
        if (!vEmailHash) return json({ entries: [], hint: "Publish your profile to use the Connected filter." });
        profiles = profiles.filter(p =>
          p.identifier === viewerIdentifier ||
          (p.connectionEmailHashes || []).includes(vEmailHash)
        );
      }

      let entries = await buildEntries(env, profiles.slice(0, 50), vEmailHash, viewerIdentifier, isSub, sort, cutoff);

      if (sort === "popular") {
        entries.sort((a, b) => b._sortScore - a._sortScore);
      } else {
        // latest: sort by profile updatedAt desc, then memory year desc within same profile
        entries.sort((a, b) => {
          const dateDiff = b._profileUpdatedAt.localeCompare(a._profileUpdatedAt);
          if (dateDiff !== 0) return dateDiff;
          return (b.memory.year || 0) - (a.memory.year || 0);
        });
      }

      // Strip internal sort fields
      entries = entries.slice(0, 100).map(({ _sortScore, _profileUpdatedAt, ...e }) => e);
      return json({ entries });
    }

    // GET /explore/interest
    if (request.method === "GET" && path === "/explore/interest") {
      const viewerKey = getViewerKey(request, url);
      const viewerKeyHash = viewerKey ? await sha256hex(viewerKey.trim().toUpperCase()) : "";
      const vEmailHash = viewerKeyHash ? await getViewerEmailHash(env, viewerKeyHash) : "";
      const isSub2 = await checkSubscriber(env, viewerKeyHash, vEmailHash);

      // Interests from query params (freshest) or stored prefs
      let locations = (url.searchParams.get("locations") || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      let yearFrom = parseInt(url.searchParams.get("yearFrom") || "0") || 0;
      let yearTo = parseInt(url.searchParams.get("yearTo") || "0") || 0;
      let tags = (url.searchParams.get("tags") || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

      // Fall back to stored prefs if nothing in params
      if (!locations.length && !yearFrom && !yearTo && !tags.length && viewerKeyHash) {
        const rawPrefs = await env.SHARES.get("interest:" + viewerKeyHash);
        if (rawPrefs) {
          const prefs = JSON.parse(rawPrefs);
          locations = (prefs.locations || []).map(s => s.toLowerCase());
          yearFrom = prefs.yearFrom || 0;
          yearTo = prefs.yearTo || 0;
          tags = (prefs.tags || []).map(s => s.toLowerCase());
        }
      }

      if (!locations.length && !yearFrom && !yearTo && !tags.length) {
        return json({ entries: [], hint: "Set your interests to find matching memories." });
      }

      const list = await getProfilesList(env);
      const matched = list.filter(p => {
        if (p.profilePrivacy === "disabled") return false;
        const pi = p.presenceIndex || [];
        return pi.some(entry => {
          // Location match
          const locMatch = !locations.length || (entry.locations || []).some(l =>
            locations.some(il => l.toLowerCase().includes(il))
          );
          // Year range match
          const entryStart = entry.year || 0;
          const entryEnd = entry.yearEnd || entryStart;
          const yearMatch = (!yearFrom && !yearTo) ||
            (yearFrom && yearTo ? entryStart <= yearTo && entryEnd >= yearFrom :
             yearFrom ? entryEnd >= yearFrom : entryStart <= yearTo);
          // Tag match (against memory tags in the full profile — we only have presenceIndex here so skip tags in index match)
          return locMatch && yearMatch;
        });
      });

      // Tag matching requires full profile load (only if tags specified and not too many matches)
      let finalMatched = matched;
      if (tags.length && matched.length <= 30) {
        finalMatched = await Promise.all(matched.map(async p => {
          if (!tags.length) return p;
          const raw = await env.SHARES.get("profile:" + p.identifier);
          if (!raw) return null;
          const full = JSON.parse(raw);
          const hasTag = (full.memories || []).some(m =>
            (m.tags || []).some(t => tags.some(it => t.toLowerCase().includes(it)))
          );
          return hasTag ? p : null;
        }));
        finalMatched = finalMatched.filter(Boolean);
      }

      const viewerIdentifier2 = viewerKeyHash ? await env.SHARES.get("keymap:" + viewerKeyHash) || "" : "";
      const allEntries = await buildEntries(env, finalMatched.slice(0, 30), vEmailHash, viewerIdentifier2, isSub2, null);

      // Filter to only memories that actually match the interest criteria
      const entries = allEntries.filter(e => {
        const m = e.memory;
        // Location match: check all location fields
        const locMatch = !locations.length || (() => {
          const memLocs = [m.locationTown, m.locationCountry, m.locationState, m.location]
            .filter(Boolean).map(l => l.toLowerCase());
          return memLocs.some(ml => locations.some(il => ml.includes(il)));
        })();
        // Year match
        const yearMatch = (!yearFrom && !yearTo) || !!(
          m.year && (yearFrom && yearTo ? m.year >= yearFrom && m.year <= yearTo :
                     yearFrom ? m.year >= yearFrom : m.year <= yearTo)
        );
        // Tag match
        const tagMatch = !tags.length ||
          (m.tags || []).some(t => tags.some(it => t.toLowerCase().includes(it)));
        return locMatch && yearMatch && tagMatch;
      });
      return json({ entries });
    }

    // GET /connections — profiles connected to the viewer (mutual or one-way)
    if (request.method === "GET" && path === "/connections") {
      const viewerKey = getViewerKey(request, url);
      if (!viewerKey) return json({ connections: [], following: [] });
      const viewerKeyHash = await sha256hex(viewerKey.trim().toUpperCase());
      const viewerIdentifier = await env.SHARES.get("keymap:" + viewerKeyHash) || "";
      if (!viewerIdentifier) return json({ connections: [], following: [] });
      const viewerProfile = JSON.parse(await env.SHARES.get("profile:" + viewerIdentifier) || "null");
      if (!viewerProfile) return json({ connections: [], following: [] });
      const viewerEmailHash = viewerProfile.ownerEmailHash || "";
      const viewerConnectionHashes = viewerProfile.connectionEmailHashes || [];
      const list = await getProfilesList(env);
      const connections = [];
      for (const p of list) {
        if (p.identifier === viewerIdentifier || p.profilePrivacy === "disabled") continue;
        const iConnectedToThem = viewerConnectionHashes.includes(p.ownerEmailHash);
        const theyConnectedToMe = viewerEmailHash && (p.connectionEmailHashes || []).includes(viewerEmailHash);
        if (iConnectedToThem || theyConnectedToMe) {
          connections.push({ identifier: p.identifier, displayName: p.displayName, imageUrl: p.imageUrl || "", memCount: p.memCount || 0 });
        }
      }
      return json({ connections, following: [] });
    }

    // GET /explore/stats — aggregate community counts
    if (request.method === "GET" && path === "/explore/stats") {
      const list = await getProfilesList(env);
      const profiles = list.filter(p => p.profilePrivacy !== "disabled");
      let publicMems = 0, subscriberMems = 0, connectedMems = 0, taggedMems = 0;
      profiles.forEach(p => {
        const mvc = p.memCountByVisibility || {};
        publicMems += mvc.public || 0;
        subscriberMems += mvc.subscriber || 0;
        connectedMems += mvc.connected || 0;
        taggedMems += mvc.tagged || 0;
      });
      return json({ totalChronicles: profiles.length, publicMems, subscriberMems, connectedMems, taggedMems });
    }

    // POST /react
    if (request.method === "POST" && path === "/react") {
      try {
        const body = await request.json();
        const { identifier, memId, action } = body;
        if (!identifier || !memId) return json({ error: "Invalid" }, 400);
        const reactKey = "reactions:" + identifier + ":" + memId;
        const raw = await env.SHARES.get(reactKey);
        let count = raw ? parseInt(raw) : 0;
        if (action === "remove") { count = Math.max(0, count - 1); }
        else { count += 1; }
        await env.SHARES.put(reactKey, String(count), { expirationTtl: 60 * 60 * 24 * 365 });
        // Update totals index
        const totalsKey = "reactions:totals:" + identifier;
        const rawTotals = await env.SHARES.get(totalsKey);
        const totals = rawTotals ? JSON.parse(rawTotals) : {};
        totals[memId] = { count, lastReactedAt: new Date().toISOString() };
        await env.SHARES.put(totalsKey, JSON.stringify(totals), { expirationTtl: 60 * 60 * 24 * 365 });
        return json({ ok: true, count });
      } catch (e) {
        return json({ error: "Server error: " + e.message }, 500);
      }
    }

    // GET /reactions/:identifier — get all reaction counts for a profile
    if (request.method === "GET" && path.startsWith("/reactions/")) {
      const identifier = path.slice("/reactions/".length);
      const rawTotals = await env.SHARES.get("reactions:totals:" + identifier);
      return json(rawTotals ? JSON.parse(rawTotals) : {});
    }

    // POST /interest/save
    if (request.method === "POST" && path === "/interest/save") {
      try {
        const body = await request.json();
        const key = body.key || getViewerKey(request, url);
        if (!key) return json({ error: "No key" }, 400);
        const keyHash = await sha256hex(key.trim().toUpperCase());
        await env.SHARES.put("interest:" + keyHash, JSON.stringify(body.interests || {}), {
          expirationTtl: 60 * 60 * 24 * 365 * 2,
        });
        return json({ ok: true });
      } catch (e) {
        return json({ error: "Server error: " + e.message }, 500);
      }
    }

    // GET /interest/get
    if (request.method === "GET" && path === "/interest/get") {
      const key = getViewerKey(request, url);
      if (!key) return json({});
      const keyHash = await sha256hex(key.trim().toUpperCase());
      const raw = await env.SHARES.get("interest:" + keyHash);
      return json(raw ? JSON.parse(raw) : {});
    }

    // ── Share links ───────────────────────────────────────────────────────────

    // POST /share
    if (request.method === "POST" && path === "/share") {
      try {
        const body = await request.json();
        if (!body.memories || !Array.isArray(body.memories)) {
          return json({ error: "Invalid payload" }, 400);
        }
        const code = crypto.randomUUID().slice(0, 8);
        const payload = { ...body, sharedAt: new Date().toISOString(), collected: false };
        await env.SHARES.put(code, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 * 30 });
        return json({ url: `https://share.remembory.net/s/${code}`, code });
      } catch (e) {
        return json({ error: "Server error: " + e.message }, 500);
      }
    }

    // POST /share/deliver — push a share directly to a recipient's delivery queue
    if (request.method === "POST" && path === "/share/deliver") {
      try {
        const body = await request.json();
        const { shareId, toEmail, fromName, fromEmail } = body;
        if (!shareId || !toEmail) return json({ error: "Missing shareId or toEmail" }, 400);
        const emailHash = await sha256hex(toEmail.trim().toLowerCase());
        const existing = await env.SHARES.get("deliveries:" + emailHash);
        const arr = existing ? JSON.parse(existing) : [];
        // Avoid duplicates
        if (!arr.find(d => d.shareId === shareId)) {
          arr.push({ shareId, fromName: fromName || "", fromEmail: fromEmail || "", sentAt: new Date().toISOString() });
        }
        await env.SHARES.put("deliveries:" + emailHash, JSON.stringify(arr), { expirationTtl: 60 * 60 * 24 * 365 });
        return json({ ok: true });
      } catch (e) {
        return json({ error: "Server error: " + e.message }, 500);
      }
    }

    // POST /my/deliveries/fetch — retrieve and clear pending deliveries for an email address
    if (request.method === "POST" && path === "/my/deliveries/fetch") {
      try {
        const body = await request.json();
        const email = (body.email || "").trim().toLowerCase();
        if (!email || !email.includes("@")) return json({ error: "Invalid email" }, 400);
        const emailHash = await sha256hex(email);
        const raw = await env.SHARES.get("deliveries:" + emailHash);
        if (!raw) return json({ deliveries: [] });
        const arr = JSON.parse(raw);
        // Fetch full share payloads
        const full = await Promise.all(arr.map(async d => {
          const shareRaw = await env.SHARES.get(d.shareId);
          if (!shareRaw) return null;
          const share = JSON.parse(shareRaw);
          return { ...share, _shareId: d.shareId, _deliveredAt: d.sentAt };
        }));
        // Clear the queue after fetching
        await env.SHARES.delete("deliveries:" + emailHash);
        return json({ deliveries: full.filter(Boolean) });
      } catch (e) {
        return json({ error: "Server error: " + e.message }, 500);
      }
    }

    // POST /contribute/create — create a guest contribution link
    if (request.method === "POST" && path === "/contribute/create") {
      try {
        const body = await request.json();
        const { ownerEmail, subjectName, subjectId, note } = body;
        if (!ownerEmail || !ownerEmail.includes("@")) return json({ error: "Missing ownerEmail" }, 400);
        const code = "gc_" + crypto.randomUUID().slice(0, 10);
        const ownerEmailHash = await sha256hex(ownerEmail.trim().toLowerCase());
        const payload = { ownerEmailHash, subjectName: subjectName || "", subjectId: subjectId || "",
          note: note || "", createdAt: new Date().toISOString() };
        await env.SHARES.put("contrib:" + code, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 * 365 });
        return json({ code, url: `https://share.remembory.net/contribute/${code}` });
      } catch (e) {
        return json({ error: "Server error: " + e.message }, 500);
      }
    }

    // GET /contribute/:code — serve guest contribution form
    if (request.method === "GET" && path.startsWith("/contribute/")) {
      const code = path.slice("/contribute/".length);
      if (!code) return json({ error: "No code" }, 400);
      const raw = await env.SHARES.get("contrib:" + code);
      if (!raw) return new Response(contributionExpiredPage(), {
        status: 410, headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
      const contrib = JSON.parse(raw);
      return new Response(contributionFormPage(code, contrib.subjectName, contrib.note), {
        headers: { "Content-Type": "text/html;charset=UTF-8", "X-Frame-Options": "DENY", "Cache-Control": "no-store" },
      });
    }

    // POST /contribute/:code — accept guest submission
    if (request.method === "POST" && path.startsWith("/contribute/")) {
      const code = path.slice("/contribute/".length);
      if (!code) return json({ error: "No code" }, 400);
      try {
        const raw = await env.SHARES.get("contrib:" + code);
        if (!raw) return json({ error: "Link not found or expired" }, 404);
        const contrib = JSON.parse(raw);
        const body = await request.json();
        const { contributorName, memories } = body;
        if (!memories || !Array.isArray(memories) || memories.length === 0) {
          return json({ error: "No memories provided" }, 400);
        }
        // Sanitise: keep only safe fields from guest submission
        const safe = memories.map(m => ({
          id: "gc_" + crypto.randomUUID().slice(0, 8),
          title: String(m.title || "").slice(0, 200),
          content: String(m.content || "").slice(0, 4000),
          year: parseInt(m.year) || 0,
          month: parseInt(m.month) || 0,
          day: parseInt(m.day) || 0,
          location: String(m.location || "").slice(0, 200),
          mood: String(m.mood || "").slice(0, 40),
          tags: Array.isArray(m.tags) ? m.tags.slice(0, 10).map(t => String(t).slice(0, 40)) : [],
          visibility: "private",
          _guestContributor: String(contributorName || "Anonymous").slice(0, 100),
          _contributedAt: new Date().toISOString(),
        }));
        // Push to owner's delivery queue under a share-style payload
        const shareCode = "gc_sub_" + crypto.randomUUID().slice(0, 8);
        const sharePayload = {
          memories: safe,
          sharedBy: String(contributorName || "Anonymous").slice(0, 100),
          sharedAt: new Date().toISOString(),
          _type: "guest_contribution",
          _subjectId: contrib.subjectId || "",
          _subjectName: contrib.subjectName || "",
        };
        await env.SHARES.put(shareCode, JSON.stringify(sharePayload), { expirationTtl: 60 * 60 * 24 * 90 });
        const existing = await env.SHARES.get("deliveries:" + contrib.ownerEmailHash);
        const arr = existing ? JSON.parse(existing) : [];
        arr.push({ shareId: shareCode, fromName: String(contributorName || "Anonymous").slice(0, 100),
          fromEmail: "", sentAt: new Date().toISOString(), _type: "guest_contribution" });
        await env.SHARES.put("deliveries:" + contrib.ownerEmailHash, JSON.stringify(arr),
          { expirationTtl: 60 * 60 * 24 * 365 });
        return json({ ok: true });
      } catch (e) {
        return json({ error: "Server error: " + e.message }, 500);
      }
    }

    // GET /s/:code
    if (request.method === "GET" && path.startsWith("/s/")) {
      const code = path.slice(3);
      if (!code) return json({ error: "No code" }, 400);
      const raw = await env.SHARES.get(code);
      if (!raw) {
        const isChronicleClient = request.headers.get("X-Chronicle-Client") === "1";
        if (isChronicleClient) return json({ error: "not_found" }, 404);
        return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Chronicle — Link expired</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Georgia,serif;background:#f7f2ea;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}.card{background:#fffcf5;border:1px solid #d4c4a8;border-radius:8px;padding:36px 28px;max-width:400px;text-align:center;}h1{font-size:1.3rem;font-style:italic;margin-bottom:12px;}p{color:#6a5840;font-size:0.9rem;line-height:1.6;}a{color:#a8885a;}</style></head><body><div class="card"><h1>This link has expired</h1><p>Share links are single-use and expire after 30 days. Ask the sender to share again.</p><p style="margin-top:16px"><a href="https://remembory.net">Visit Remembory</a></p></div></body></html>`, {
          status: 410, headers: { "Content-Type": "text/html;charset=UTF-8" },
        });
      }
      const data = JSON.parse(raw);
      const isChronicleClient = request.headers.get("X-Chronicle-Client") === "1";
      if (isChronicleClient) {
        await env.SHARES.put(code, JSON.stringify({ ...data, collected: true }), { expirationTtl: 60 * 60 * 24 });
        return json(data);
      }
      return new Response(bridgePage(code, data.sharedBy || "", data.memories?.length || 0), {
        headers: { "Content-Type": "text/html;charset=UTF-8", "X-Frame-Options": "DENY", "Cache-Control": "no-store" },
      });
    }

    // ── Sync ──────────────────────────────────────────────────────────────────

    // POST /sync/push
    if (request.method === "POST" && path === "/sync/push") {
      try {
        const body = await request.json();
        if (!body.keyHash || !body.ciphertext) return json({ error: "Invalid payload" }, 400);
        if (!/^[0-9a-f]{64}$/.test(body.keyHash)) return json({ error: "Invalid key" }, 400);
        await env.SHARES.put("sync:" + body.keyHash, JSON.stringify({
          ciphertext: body.ciphertext, iv: body.iv, salt: body.salt,
          checkIv: body.checkIv, check: body.check, pushedAt: new Date().toISOString(),
        }), { expirationTtl: 60 * 60 * 24 * 90 });
        return json({ ok: true });
      } catch (e) {
        return json({ error: "Server error: " + e.message }, 500);
      }
    }

    // GET /sync/pull/:keyHash
    if (request.method === "GET" && path.startsWith("/sync/pull/")) {
      const keyHash = path.slice("/sync/pull/".length);
      if (!/^[0-9a-f]{64}$/.test(keyHash)) return json({ error: "Invalid key" }, 400);
      const raw = await env.SHARES.get("sync:" + keyHash);
      if (!raw) return json({ error: "no_data" }, 404);
      return json(JSON.parse(raw));
    }

    // ── Mailing list ──────────────────────────────────────────────────────────

    // POST /mailing/subscribe
    if (request.method === "POST" && path === "/mailing/subscribe") {
      try {
        const text = await request.text();
        let email = "";
        try { email = JSON.parse(text).email || ""; } catch { email = new URLSearchParams(text).get("email") || ""; }
        email = email.trim().toLowerCase();
        if (!email || !email.includes("@")) return json({ error: "Invalid email" }, 400);
        await env.MAILING_LIST.put("sub:" + email, JSON.stringify({ email, subscribedAt: new Date().toISOString() }));
        return json({ ok: true });
      } catch (e) {
        return json({ error: "Server error: " + e.message }, 500);
      }
    }

    // GET /mailing/list?secret=...
    if (request.method === "GET" && path === "/mailing/list") {
      const secret = url.searchParams.get("secret") || request.headers.get("X-Admin-Secret");
      if (!secret || secret !== (env.ADMIN_SECRET || "")) return json({ error: "Forbidden" }, 403);
      const list = await env.MAILING_LIST.list({ prefix: "sub:" });
      const subscribers = await Promise.all(list.keys.map(async k => {
        const val = await env.MAILING_LIST.get(k.name);
        return val ? JSON.parse(val) : null;
      }));
      return json({ subscribers: subscribers.filter(Boolean), total: subscribers.length });
    }

    // ── Stripe ────────────────────────────────────────────────────────────────

    // POST /stripe/webhook
    if (request.method === "POST" && path === "/stripe/webhook") {
      const sig = request.headers.get("stripe-signature") || "";
      const bodyText = await request.text();
      const secret = env.STRIPE_WEBHOOK_SECRET || "";
      if (!secret) return new Response("Webhook secret not configured", { status: 500 });
      if (!await verifyStripeSignature(bodyText, sig, secret)) {
        return new Response("Invalid signature", { status: 400 });
      }
      const event = JSON.parse(bodyText);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const email = (session.customer_details?.email || "").toLowerCase();
        const customerId = session.customer || "";
        const subscriptionId = session.subscription || "";
        const licenseKey = generateLicenseKey();
        const keyHash = await sha256hex(licenseKey.trim().toUpperCase());
        const now = new Date().toISOString();
        const record = { licenseKey, keyHash, email, customerId, subscriptionId, status: "active", createdAt: now, renewedAt: now };
        await env.SHARES.put("license:" + keyHash, JSON.stringify(record));
        // Index by customerId and subscriptionId for webhook lookups
        await env.SHARES.put("license_by_customer:" + customerId, keyHash);
        if (subscriptionId) await env.SHARES.put("license_by_sub:" + subscriptionId, keyHash);
        if (email) await env.SHARES.put("license_by_email:" + email, keyHash);
        // Store pending key for success page retrieval (expires after 10 min)
        await env.SHARES.put("license_pending:" + session.id, licenseKey, { expirationTtl: 600 });
      }

      if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object;
        const keyHash = await env.SHARES.get("license_by_sub:" + sub.id);
        if (keyHash) {
          const raw = await env.SHARES.get("license:" + keyHash);
          if (raw) {
            const rec = JSON.parse(raw);
            rec.status = "cancelled";
            rec.cancelledAt = new Date().toISOString();
            await env.SHARES.put("license:" + keyHash, JSON.stringify(rec));
          }
        }
      }

      if (event.type === "invoice.payment_failed") {
        const inv = event.data.object;
        const subId = inv.subscription || "";
        if (subId) {
          const keyHash = await env.SHARES.get("license_by_sub:" + subId);
          if (keyHash) {
            const raw = await env.SHARES.get("license:" + keyHash);
            if (raw) {
              const rec = JSON.parse(raw);
              rec.status = "suspended";
              rec.suspendedAt = new Date().toISOString();
              await env.SHARES.put("license:" + keyHash, JSON.stringify(rec));
            }
          }
        }
      }

      if (event.type === "invoice.paid") {
        const inv = event.data.object;
        const subId = inv.subscription || "";
        if (subId) {
          const keyHash = await env.SHARES.get("license_by_sub:" + subId);
          if (keyHash) {
            const raw = await env.SHARES.get("license:" + keyHash);
            if (raw) {
              const rec = JSON.parse(raw);
              rec.status = "active";
              rec.renewedAt = new Date().toISOString();
              await env.SHARES.put("license:" + keyHash, JSON.stringify(rec));
            }
          }
        }
      }

      return new Response("OK", { status: 200 });
    }

    // GET /stripe/success?session_id=…
    if (request.method === "GET" && path === "/stripe/success") {
      const sessionId = url.searchParams.get("session_id") || "";
      if (!sessionId) return new Response("Missing session_id", { status: 400 });
      const pendingRaw = sessionId ? await env.SHARES.get("license_pending:" + sessionId) : null;
      let licenseKey = null, customerEmail = "";
      if (pendingRaw) {
        try { const p = JSON.parse(pendingRaw); licenseKey = p.key; customerEmail = p.email || ""; }
        catch(e) { licenseKey = pendingRaw; } // backwards compat with old plain-string format
      }
      const found = !!licenseKey;
      return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Remembory — Thank you!</title>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Crimson Text', Georgia, serif; background: #f7f2ea; color: #2c2416; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 6px; padding: 40px 36px; max-width: 480px; width: 100%; text-align: center; }
    h1 { font-family: 'Playfair Display', serif; font-size: 1.8rem; font-style: italic; color: #1a1208; margin-bottom: 12px; }
    .subtitle { color: #6a5840; font-size: 1rem; line-height: 1.6; margin-bottom: 28px; }
    .key-box { background: #f0e8d8; border: 1px solid #c8b89a; border-radius: 4px; padding: 14px 18px; font-family: monospace; font-size: 1.15rem; letter-spacing: 0.06em; color: #1a1208; margin-bottom: 10px; word-break: break-all; }
    .copy-btn { background: #2c2416; color: #f5f0e8; border: none; border-radius: 3px; padding: 8px 20px; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.95rem; margin-bottom: 24px; transition: opacity 0.15s; }
    .copy-btn:hover { opacity: 0.85; }
    .instructions { font-size: 0.88rem; color: #6a5840; line-height: 1.7; text-align: left; background: rgba(200,168,122,0.08); border: 1px solid rgba(200,168,122,0.25); border-radius: 4px; padding: 14px 16px; }
    .instructions strong { color: #2c2416; }
    .warn { font-size: 0.82rem; color: #a85a2a; font-style: italic; margin-top: 16px; }
    .mailing-opt { display: flex; align-items: flex-start; gap: 8px; margin-top: 16px; text-align: left; font-size: 0.86rem; color: #6a5840; line-height: 1.5; }
    .mailing-opt input { margin-top: 3px; flex-shrink: 0; accent-color: #2c2416; width: 15px; height: 15px; cursor: pointer; }
    .mailing-opt label { cursor: pointer; }
    .mailing-msg { font-size: 0.8rem; font-style: italic; margin-top: 6px; }
    .mailing-msg.ok { color: #4a7a5a; }
    a { color: #a8885a; }
  </style>
</head>
<body>
<div class="card">
  ${found ? `
  <h1>Welcome to Remembory</h1>
  <p class="subtitle">Your subscription is active. Here is your license key — save it somewhere safe.</p>
  <div class="key-box" id="lk">${esc(licenseKey)}</div>
  <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('lk').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy key',1500)})">Copy key</button>
  <div class="instructions">
    <strong>How to use your key:</strong><br>
    Open <a href="https://remembory.net/chronicle.html">Chronicle</a> and paste this key into the licence key field in Settings. It unlocks Subscriber-level content across all Chronicles and lets others mark you as a subscriber contact.
  </div>
  <p class="warn">This page will not show your key again. Please save it now.</p>
  <div class="mailing-opt">
    <input type="checkbox" id="mailing-cb" checked>
    <label for="mailing-cb">Keep me updated with Remembory news and new features.</label>
  </div>
  <div class="mailing-msg" id="mailing-msg"></div>
  <script>
  (function() {
    var email = ${JSON.stringify(customerEmail)};
    var cb = document.getElementById('mailing-cb');
    var msg = document.getElementById('mailing-msg');
    // Auto-subscribe if checkbox still checked after 2s (gives user time to uncheck)
    var timer = setTimeout(function() { if (cb.checked && email) subscribe(); }, 2000);
    cb.addEventListener('change', function() {
      if (!this.checked) { clearTimeout(timer); msg.textContent = ''; }
    });
    function subscribe() {
      if (!email) return;
      fetch('https://social.remembory.net/mailing/subscribe', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({email: email})
      }).then(function(r) {
        if (r.ok) { msg.textContent = '\\u2713 Subscribed to updates.'; msg.className = 'mailing-msg ok'; }
      }).catch(function(){});
    }
  })();
  </script>
  ` : `
  <h1>Something went wrong</h1>
  <p class="subtitle">We could not retrieve your license key. This link may have expired (valid for 10 minutes after purchase).<br><br>Please <a href="mailto:hello@remembory.net">contact us</a> with your order confirmation and we'll issue your key manually.</p>
  `}
</div>
</body>
</html>`, { headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store" } });
    }

    // ── PayPal ────────────────────────────────────────────────────────────────

    // POST /paypal/webhook?secret=…
    // Verified by a shared secret placed in the webhook URL registered in PayPal.
    // PayPal event types handled:
    //   BILLING.SUBSCRIPTION.ACTIVATED  → issue license key
    //   BILLING.SUBSCRIPTION.CANCELLED  → cancel license
    //   BILLING.SUBSCRIPTION.SUSPENDED  → suspend license
    //   PAYMENT.SALE.COMPLETED          → renew license (recurring payment)
    if (request.method === "POST" && path === "/paypal/webhook") {
      const secret = url.searchParams.get("secret") || "";
      const expected = env.PAYPAL_WEBHOOK_SECRET || "";
      if (!expected || secret !== expected) return new Response("Forbidden", { status: 403 });
      try {
        const event = await request.json();
        const type = event.event_type || "";
        const res  = event.resource || {};

        if (type === "BILLING.SUBSCRIPTION.ACTIVATED") {
          const subscriptionId = res.id || "";
          const email = (res.subscriber?.email_address || "").toLowerCase();
          if (!subscriptionId) return new Response("OK", { status: 200 });
          // Idempotent: skip if already issued
          const existing = await env.SHARES.get("license_by_paypal_sub:" + subscriptionId);
          if (!existing) {
            const licenseKey = generateLicenseKey();
            const keyHash = await sha256hex(licenseKey.trim().toUpperCase());
            const now = new Date().toISOString();
            const record = { licenseKey, keyHash, email, subscriptionId, source: "paypal", status: "active", createdAt: now, renewedAt: now };
            await env.SHARES.put("license:" + keyHash, JSON.stringify(record));
            await env.SHARES.put("license_by_paypal_sub:" + subscriptionId, keyHash);
            if (email) await env.SHARES.put("license_by_email:" + email, keyHash);
            // Store pending key for success page retrieval (expires 15 min)
            await env.SHARES.put("paypal_pending:" + subscriptionId, licenseKey, { expirationTtl: 900 });
          }
        }

        if (type === "BILLING.SUBSCRIPTION.CANCELLED") {
          const subscriptionId = res.id || "";
          const keyHash = await env.SHARES.get("license_by_paypal_sub:" + subscriptionId);
          if (keyHash) {
            const raw = await env.SHARES.get("license:" + keyHash);
            if (raw) {
              const rec = JSON.parse(raw);
              rec.status = "cancelled"; rec.cancelledAt = new Date().toISOString();
              await env.SHARES.put("license:" + keyHash, JSON.stringify(rec));
            }
          }
        }

        if (type === "BILLING.SUBSCRIPTION.SUSPENDED") {
          const subscriptionId = res.id || "";
          const keyHash = await env.SHARES.get("license_by_paypal_sub:" + subscriptionId);
          if (keyHash) {
            const raw = await env.SHARES.get("license:" + keyHash);
            if (raw) {
              const rec = JSON.parse(raw);
              rec.status = "suspended"; rec.suspendedAt = new Date().toISOString();
              await env.SHARES.put("license:" + keyHash, JSON.stringify(rec));
            }
          }
        }

        if (type === "PAYMENT.SALE.COMPLETED") {
          const subscriptionId = res.billing_agreement_id || "";
          if (subscriptionId) {
            const keyHash = await env.SHARES.get("license_by_paypal_sub:" + subscriptionId);
            if (keyHash) {
              const raw = await env.SHARES.get("license:" + keyHash);
              if (raw) {
                const rec = JSON.parse(raw);
                rec.status = "active"; rec.renewedAt = new Date().toISOString();
                await env.SHARES.put("license:" + keyHash, JSON.stringify(rec));
              }
            }
          }
        }

        return new Response("OK", { status: 200 });
      } catch (e) {
        return new Response("Error: " + e.message, { status: 500 });
      }
    }

    // GET /paypal/success?subscription_id=…
    // PayPal redirects here after subscription approval.
    // Polls for the key generated by the webhook (the webhook may arrive slightly after the redirect).
    if (request.method === "GET" && path === "/paypal/success") {
      const subscriptionId = url.searchParams.get("subscription_id") || "";
      if (!subscriptionId) return new Response("Missing subscription_id", { status: 400 });
      const pendingKey = subscriptionId ? await env.SHARES.get("paypal_pending:" + subscriptionId) : null;
      const found = !!pendingKey;
      let customerEmail = "";
      if (found) {
        const keyHash = await sha256hex(pendingKey.trim().toUpperCase());
        const rec = await env.SHARES.get("license:" + keyHash);
        if (rec) customerEmail = JSON.parse(rec).email || "";
      }
      return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Remembory — Thank you!</title>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Crimson Text', Georgia, serif; background: #f7f2ea; color: #2c2416; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 6px; padding: 40px 36px; max-width: 480px; width: 100%; text-align: center; }
    h1 { font-family: 'Playfair Display', serif; font-size: 1.8rem; font-style: italic; color: #1a1208; margin-bottom: 12px; }
    .subtitle { color: #6a5840; font-size: 1rem; line-height: 1.6; margin-bottom: 28px; }
    .key-box { background: #f0e8d8; border: 1px solid #c8b89a; border-radius: 4px; padding: 14px 18px; font-family: monospace; font-size: 1.15rem; letter-spacing: 0.06em; color: #1a1208; margin-bottom: 10px; word-break: break-all; }
    .copy-btn { background: #2c2416; color: #f5f0e8; border: none; border-radius: 3px; padding: 8px 20px; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.95rem; margin-bottom: 24px; transition: opacity 0.15s; }
    .copy-btn:hover { opacity: 0.85; }
    .instructions { font-size: 0.88rem; color: #6a5840; line-height: 1.7; text-align: left; background: rgba(200,168,122,0.08); border: 1px solid rgba(200,168,122,0.25); border-radius: 4px; padding: 14px 16px; }
    .instructions strong { color: #2c2416; }
    .warn { font-size: 0.82rem; color: #a85a2a; font-style: italic; margin-top: 16px; }
    .waiting { color: #8a7460; font-style: italic; font-size: 0.95rem; }
    .spinner { display: inline-block; width: 18px; height: 18px; border: 2px solid #d4c4a8; border-top-color: #a8885a; border-radius: 50%; animation: spin 0.8s linear infinite; vertical-align: middle; margin-right: 8px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    a { color: #a8885a; }
  </style>
</head>
<body>
<div class="card">
  ${found ? `
  <h1>Welcome to Remembory</h1>
  <p class="subtitle">Your PayPal subscription is active. Here is your licence key — save it somewhere safe.</p>
  <div class="key-box" id="lk">${esc(pendingKey)}</div>
  <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('lk').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy key',1500)})">Copy key</button>
  <div class="instructions">
    <strong>How to use your key:</strong><br>
    Open <a href="https://remembory.net/chronicle.html">Chronicle</a> and paste this key into the licence key field in Settings. It unlocks Subscriber-level content across all Chronicles.
  </div>
  <p class="warn">This page will not show your key again. Please save it now.</p>
  ` : `
  <h1>Just a moment…</h1>
  <p class="subtitle waiting"><span class="spinner"></span>Activating your subscription…</p>
  <p class="waiting" style="font-size:0.88rem;margin-top:8px;">This usually takes a few seconds. The page will update automatically.</p>
  <script>
  (function(){
    var sid = ${JSON.stringify(subscriptionId)};
    var attempts = 0;
    function poll() {
      fetch('/paypal/key?subscription_id=' + encodeURIComponent(sid))
        .then(function(r){ return r.json(); })
        .then(function(d){
          if (d.licenseKey) { window.location.reload(); }
          else if (++attempts < 20) { setTimeout(poll, 2000); }
          else { document.querySelector('.subtitle').innerHTML = 'Your subscription was received but key generation is taking longer than expected. Please <a href="mailto:hello@remembory.net">contact us</a> with your PayPal subscription ID: <code>${esc(subscriptionId)}</code>'; }
        }).catch(function(){ if (++attempts < 20) setTimeout(poll, 3000); });
    }
    setTimeout(poll, 2000);
  })();
  </script>
  `}
</div>
</body>
</html>`, { headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store" } });
    }

    // GET /paypal/key?subscription_id=… (JSON polling endpoint for success page)
    if (request.method === "GET" && path === "/paypal/key") {
      const subscriptionId = url.searchParams.get("subscription_id") || "";
      if (!subscriptionId) return json({ ready: false });
      const pendingKey = await env.SHARES.get("paypal_pending:" + subscriptionId);
      if (!pendingKey) return json({ ready: false });
      return json({ ready: true, licenseKey: pendingKey });
    }

    // GET /license/check?key=…
    if (request.method === "GET" && path === "/license/check") {
      const key = getViewerKey(request, url);
      if (!key) return json({ valid: false });
      const keyHash = await sha256hex(key.trim().toUpperCase());
      const raw = await env.SHARES.get("license:" + keyHash);
      if (!raw) return json({ valid: false });
      const rec = JSON.parse(raw);
      return json({ valid: rec.status === "active", status: rec.status, renewedAt: rec.renewedAt });
    }

    // POST /license/generate  (admin — manual key issuance)
    if (request.method === "POST" && path === "/license/generate") {
      const secret = request.headers.get("X-Admin-Secret") || "";
      if (!secret || secret !== (env.ADMIN_SECRET || "")) return json({ error: "Forbidden" }, 403);
      const body = await request.json().catch(() => ({}));
      const licenseKey = generateLicenseKey();
      const keyHash = await sha256hex(licenseKey.trim().toUpperCase());
      const now = new Date().toISOString();
      const record = {
        licenseKey, keyHash,
        email: (body.email || "").toLowerCase(),
        customerId: body.customerId || "",
        subscriptionId: body.subscriptionId || "",
        status: "active",
        createdAt: now, renewedAt: now,
        note: body.note || "manually issued",
      };
      await env.SHARES.put("license:" + keyHash, JSON.stringify(record));
      if (record.email) await env.SHARES.put("license_by_email:" + record.email, keyHash);
      return json({ ok: true, licenseKey });
    }

    // GET /license/recover — self-service key recovery page (or admin lookup)
    if (request.method === "GET" && path === "/license/recover") {
      const email = (url.searchParams.get("email") || "").trim().toLowerCase();
      const adminSecret = url.searchParams.get("secret") || request.headers.get("X-Admin-Secret") || "";
      const isAdmin = !!(adminSecret && adminSecret === (env.ADMIN_SECRET || ""));

      let result = null;
      if (email) {
        const keyHash = await env.SHARES.get("license_by_email:" + email);
        if (keyHash) {
          const raw = await env.SHARES.get("license:" + keyHash);
          if (raw) result = JSON.parse(raw);
        }
      }

      // Admin JSON response
      if (isAdmin && email) {
        if (!result) return json({ found: false });
        return json({ found: true, licenseKey: result.licenseKey, status: result.status, createdAt: result.createdAt, renewedAt: result.renewedAt });
      }

      // HTML recovery page
      const found = !!(result && result.status === "active");
      const cancelled = !!(result && result.status !== "active");
      return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Remembory — Recover licence key</title>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Crimson Text', Georgia, serif; background: #f7f2ea; color: #2c2416; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 6px; padding: 40px 36px; max-width: 460px; width: 100%; }
    h1 { font-family: 'Playfair Display', serif; font-size: 1.6rem; font-style: italic; color: #1a1208; margin-bottom: 10px; }
    .subtitle { color: #6a5840; font-size: 0.95rem; line-height: 1.6; margin-bottom: 24px; }
    form { display: flex; flex-direction: column; gap: 10px; }
    input { padding: 10px 13px; border: 1px solid #c8b89a; border-radius: 3px; font-family: 'Crimson Text', serif; font-size: 1rem; background: #faf7f2; color: #1a1208; }
    input:focus { outline: none; border-color: #a8885a; }
    button { padding: 10px; background: #2c2416; color: #f5f0e8; border: none; border-radius: 3px; font-family: 'Crimson Text', serif; font-size: 1rem; cursor: pointer; transition: opacity 0.15s; }
    button:hover { opacity: 0.85; }
    .key-box { background: #f0e8d8; border: 1px solid #c8b89a; border-radius: 4px; padding: 14px 18px; font-family: monospace; font-size: 1.1rem; letter-spacing: 0.06em; color: #1a1208; word-break: break-all; margin-bottom: 10px; }
    .copy-btn { background: #2c2416; color: #f5f0e8; border: none; border-radius: 3px; padding: 8px 20px; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.95rem; transition: opacity 0.15s; }
    .copy-btn:hover { opacity: 0.85; }
    .msg { font-size: 0.88rem; line-height: 1.6; padding: 12px 14px; border-radius: 3px; margin-top: 4px; }
    .msg.warn { background: rgba(196,133,138,0.1); border: 1px solid rgba(196,133,138,0.3); color: #8a3030; }
    .msg.info { background: rgba(74,122,90,0.08); border: 1px solid rgba(74,122,90,0.25); color: #3a5a3a; }
    a { color: #a8885a; }
  </style>
</head>
<body>
<div class="card">
  <h1>Recover your key</h1>
  ${!email ? `
  <p class="subtitle">Enter the email address you used to subscribe and we'll show your licence key.</p>
  <form method="GET" action="/license/recover">
    <input type="email" name="email" placeholder="your@email.com" required autofocus>
    <button type="submit">Look up my key</button>
  </form>
  ` : found ? `
  <p class="subtitle">Active licence key for <strong>${esc(email)}</strong>:</p>
  <div class="key-box" id="lk">${esc(result.licenseKey)}</div>
  <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('lk').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy key',1500)})">Copy key</button>
  <p style="font-size:0.82rem;color:#8a7460;margin-top:12px;font-style:italic">Paste this into Chronicle &rarr; Settings &rarr; Subscription.</p>
  ` : cancelled ? `
  <div class="msg warn">Your subscription for <strong>${esc(email)}</strong> is no longer active (${esc(result.status)}). <a href="https://buy.stripe.com/14A5kC9s67KS9Ll49n8IU02">Resubscribe &rarr;</a></div>
  ` : `
  <div class="msg warn">No active subscription found for <strong>${esc(email)}</strong>. Check for typos, or <a href="mailto:hello@remembory.net">contact us</a> if you think this is an error.</div>
  <form method="GET" action="/license/recover" style="margin-top:16px">
    <input type="email" name="email" value="${esc(email)}" required>
    <button type="submit">Try again</button>
  </form>
  `}
</div>
</body>
</html>`, { headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store" } });
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    // GET /admin — dashboard HTML
    if (request.method === "GET" && path === "/admin") {
      return new Response(adminPage(), { headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store" } });
    }

    // GET /admin/licenses — list all licenses
    if (request.method === "GET" && path === "/admin/licenses") {
      const secret = request.headers.get("X-Admin-Secret") || "";
      if (!secret || secret !== (env.ADMIN_SECRET || "")) return json({ error: "Forbidden" }, 403);
      const list = await env.SHARES.list({ prefix: "license:" });
      const records = await Promise.all(list.keys.map(async k => {
        const raw = await env.SHARES.get(k.name);
        return raw ? JSON.parse(raw) : null;
      }));
      return json({ licenses: records.filter(Boolean) });
    }

    // POST /admin/license/revoke
    if (request.method === "POST" && path === "/admin/license/revoke") {
      const secret = request.headers.get("X-Admin-Secret") || "";
      if (!secret || secret !== (env.ADMIN_SECRET || "")) return json({ error: "Forbidden" }, 403);
      const { keyHash } = await request.json().catch(() => ({}));
      if (!keyHash) return json({ error: "Missing keyHash" }, 400);
      const raw = await env.SHARES.get("license:" + keyHash);
      if (!raw) return json({ error: "Not found" }, 404);
      const rec = JSON.parse(raw);
      rec.status = "cancelled"; rec.cancelledAt = new Date().toISOString();
      await env.SHARES.put("license:" + keyHash, JSON.stringify(rec));
      return json({ ok: true });
    }

    // POST /admin/license/reinstate
    if (request.method === "POST" && path === "/admin/license/reinstate") {
      const secret = request.headers.get("X-Admin-Secret") || "";
      if (!secret || secret !== (env.ADMIN_SECRET || "")) return json({ error: "Forbidden" }, 403);
      const { keyHash } = await request.json().catch(() => ({}));
      if (!keyHash) return json({ error: "Missing keyHash" }, 400);
      const raw = await env.SHARES.get("license:" + keyHash);
      if (!raw) return json({ error: "Not found" }, 404);
      const rec = JSON.parse(raw);
      rec.status = "active"; rec.renewedAt = new Date().toISOString();
      delete rec.cancelledAt; delete rec.suspendedAt;
      await env.SHARES.put("license:" + keyHash, JSON.stringify(rec));
      return json({ ok: true });
    }

    // GET /admin/profiles — full profiles index
    if (request.method === "GET" && path === "/admin/profiles") {
      const secret = request.headers.get("X-Admin-Secret") || "";
      if (!secret || secret !== (env.ADMIN_SECRET || "")) return json({ error: "Forbidden" }, 403);
      const list = await getProfilesList(env);
      const withEmails = await Promise.all(list.map(async p => {
        const email = await env.SHARES.get("profile_email:" + p.identifier);
        return { ...p, email: email || "" };
      }));
      return json({ profiles: withEmails, total: withEmails.length });
    }

    // POST /admin/profile/remove — remove a profile from public index
    if (request.method === "POST" && path === "/admin/profile/remove") {
      const secret = request.headers.get("X-Admin-Secret") || "";
      if (!secret || secret !== (env.ADMIN_SECRET || "")) return json({ error: "Forbidden" }, 403);
      const { identifier } = await request.json().catch(() => ({}));
      if (!identifier) return json({ error: "Missing identifier" }, 400);
      const list = await getProfilesList(env);
      const filtered = list.filter(p => p.identifier !== identifier);
      await env.SHARES.put("profiles:list", JSON.stringify(filtered));
      return json({ ok: true, removed: list.length - filtered.length });
    }

    // Health check
    if (path === "/health") return json({ ok: true });

    return json({ error: "Not found" }, 404);
  },
};

// ── Admin dashboard ───────────────────────────────────────────────────────────
function adminPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Remembory Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Crimson Text', Georgia, serif; background: #f7f2ea; color: #2c2416; min-height: 100vh; }
    a { color: inherit; text-decoration: none; }
    header { background: #1a1208; color: #f5f0e8; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; }
    header h1 { font-family: 'Playfair Display', serif; font-size: 1.2rem; font-style: italic; }
    header .signed-in { font-size: 0.8rem; color: #a8a090; }
    .login-wrap { display: flex; align-items: center; justify-content: center; min-height: 80vh; }
    .login-card { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 6px; padding: 36px; width: 320px; }
    .login-card h2 { font-family: 'Playfair Display', serif; font-style: italic; margin-bottom: 16px; font-size: 1.4rem; color: #1a1208; }
    .login-card input { width: 100%; padding: 10px 12px; border: 1px solid #c8b89a; border-radius: 3px; font-family: 'Crimson Text', serif; font-size: 1rem; background: #faf7f2; color: #1a1208; margin-bottom: 10px; }
    .login-card input:focus { outline: none; border-color: #a8885a; }
    .btn { padding: 9px 18px; background: #2c2416; color: #f5f0e8; border: none; border-radius: 3px; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.95rem; transition: opacity 0.15s; }
    .btn:hover { opacity: 0.85; }
    .btn:disabled { opacity: 0.4; cursor: default; }
    .btn-sm { padding: 4px 10px; font-size: 0.82rem; }
    .btn-danger { background: #8a3030; }
    .btn-success { background: #3a6a4a; }
    .btn-outline { background: transparent; border: 1px solid #c8b89a; color: #5a4020; }
    .btn-outline:hover { background: rgba(44,36,22,0.06); opacity: 1; }
    .tabs { display: flex; border-bottom: 2px solid #e0d4be; background: #faf7f2; padding: 0 24px; }
    .tab { padding: 11px 20px 9px; border: none; background: transparent; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.95rem; color: #8a7460; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color 0.15s; }
    .tab.active { color: #1a1208; border-bottom-color: #2c2416; font-weight: 600; }
    .tab:hover:not(.active) { color: #4a3820; }
    .content { max-width: 1100px; margin: 0 auto; padding: 28px 24px 60px; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, 200px); gap: 14px; margin-bottom: 28px; justify-content: center; }
    .stat-card { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 4px; padding: 18px 20px; }
    .stat-card .num { font-family: 'Playfair Display', serif; font-size: 2rem; color: #1a1208; font-style: italic; }
    .stat-card .label { font-size: 0.8rem; color: #8a7460; text-transform: uppercase; letter-spacing: 0.05em; font-family: Arial, sans-serif; margin-top: 2px; }
    .card { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 4px; padding: 20px; margin-bottom: 18px; }
    .card-title { font-family: 'Playfair Display', serif; font-style: italic; font-size: 1.1rem; color: #1a1208; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th { text-align: left; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #8a7460; font-family: Arial, sans-serif; padding: 6px 10px; border-bottom: 2px solid #e0d4be; }
    td { padding: 9px 10px; border-bottom: 1px solid #f0e8d8; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(200,168,122,0.04); }
    .badge { display: inline-block; font-size: 0.68rem; padding: 2px 7px; border-radius: 10px; font-family: Arial, sans-serif; letter-spacing: 0.04em; }
    .badge-active { background: rgba(74,122,90,0.12); color: #2d6b3a; border: 1px solid rgba(74,122,90,0.3); }
    .badge-cancelled { background: rgba(196,133,138,0.12); color: #8a3030; border: 1px solid rgba(196,133,138,0.3); }
    .badge-suspended { background: rgba(168,136,90,0.12); color: #7a5a20; border: 1px solid rgba(168,136,90,0.3); }
    .key-mono { font-family: monospace; font-size: 0.82rem; color: #5a4020; letter-spacing: 0.04em; }
    .form-row { display: flex; gap: 8px; margin-bottom: 10px; }
    .form-row input { flex: 1; padding: 8px 12px; border: 1px solid #c8b89a; border-radius: 3px; font-family: 'Crimson Text', serif; font-size: 0.95rem; background: #faf7f2; color: #1a1208; }
    .form-row input:focus { outline: none; border-color: #a8885a; }
    .msg { font-size: 0.84rem; padding: 8px 12px; border-radius: 3px; margin-top: 6px; }
    .msg.ok { background: rgba(74,122,90,0.1); color: #2d6b3a; border: 1px solid rgba(74,122,90,0.25); }
    .msg.err { background: rgba(196,133,138,0.1); color: #8a3030; border: 1px solid rgba(196,133,138,0.3); }
    .loading { color: #8a7460; font-style: italic; padding: 20px 0; text-align: center; }
    .search-bar { display: flex; gap: 8px; margin-bottom: 16px; }
    .search-bar input { flex: 1; padding: 8px 12px; border: 1px solid #c8b89a; border-radius: 3px; font-family: 'Crimson Text', serif; font-size: 0.95rem; background: #faf7f2; color: #1a1208; }
    .search-bar input:focus { outline: none; border-color: #a8885a; }
    .copy-link { font-size: 0.74rem; color: #a8885a; cursor: pointer; text-decoration: underline; margin-left: 6px; }
    #app { display: none; }
  </style>
</head>
<body>

<!-- Login -->
<div class="login-wrap" id="login">
  <div class="login-card">
    <h2>Admin Login</h2>
    <input type="password" id="secret-input" placeholder="Admin secret…" onkeydown="if(event.key==='Enter')doLogin()">
    <div id="login-err" style="font-size:0.82rem;color:#8a3030;margin-bottom:8px;display:none">Incorrect secret.</div>
    <button class="btn" id="login-btn" style="width:100%" onclick="doLogin()">Sign in</button>
  </div>
</div>

<!-- Dashboard -->
<div id="app">
  <header>
    <h1>Remembory Admin</h1>
    <div class="signed-in" id="signed-in-label"></div>
  </header>
  <nav class="tabs">
    <button class="tab active" onclick="switchTab('overview')" id="tab-overview">Overview</button>
    <button class="tab" onclick="switchTab('licenses')" id="tab-licenses">Subscriptions</button>
    <button class="tab" onclick="switchTab('generate')" id="tab-generate">Issue Key</button>
    <button class="tab" onclick="switchTab('profiles')" id="tab-profiles">Profiles</button>
    <button class="tab" onclick="switchTab('mailing')" id="tab-mailing">Mailing List</button>
  </nav>
  <div class="content" id="tab-content"></div>
</div>

<script>
var API = 'https://social.remembory.net';
var secret = '';
var activeTab = 'overview';
var allLicenses = [], allProfiles = [], allMailing = [];

function ss(k,v) { try { sessionStorage.setItem(k,v); } catch(e) {} }
function sg(k) { try { return sessionStorage.getItem(k)||''; } catch(e) { return ''; } }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(iso) { return iso ? new Date(iso).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : '—'; }
function copyText(t,el) { navigator.clipboard.writeText(t).then(()=>{ var old=el.textContent; el.textContent='Copied!'; setTimeout(()=>el.textContent=old,1500); }).catch(()=>{}); }

async function api(method, path, body) {
  var opts = { method, headers: { 'X-Admin-Secret': secret } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  var r = await fetch(API + path, opts);
  if (r.status === 403) { logout(); throw new Error('Forbidden'); }
  return r.json();
}

async function doLogin() {
  var inp = document.getElementById('secret-input');
  var btn = document.getElementById('login-btn');
  var err = document.getElementById('login-err');
  var s = (inp.value||'').trim();
  if (!s) return;
  btn.disabled = true; btn.textContent = 'Signing in\u2026';
  err.style.display = 'none';
  try {
    var r = await fetch(API + '/admin/licenses', { headers: { 'X-Admin-Secret': s } });
    if (r.status === 403) {
      err.textContent = 'Incorrect secret.';
      err.style.display = '';
      btn.disabled = false; btn.textContent = 'Sign in';
      return;
    }
    if (!r.ok) throw new Error('Server error ' + r.status);
    var data = await r.json();
    secret = s; ss('admin-secret', s);
    allLicenses = data.licenses || [];
    showApp();
  } catch(e) {
    err.textContent = 'Could not connect: ' + e.message;
    err.style.display = '';
    btn.disabled = false; btn.textContent = 'Sign in';
  }
}

function logout() { secret=''; ss('admin-secret',''); document.getElementById('app').style.display='none'; document.getElementById('login').style.display='flex'; }

function showApp() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('signed-in-label').textContent = 'Signed in';
  switchTab('overview');
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(function(b){ b.className='tab'+(b.id==='tab-'+tab?' active':''); });
  if (tab==='overview') renderOverview();
  else if (tab==='licenses') renderLicenses();
  else if (tab==='generate') renderGenerate();
  else if (tab==='profiles') renderProfiles();
  else if (tab==='mailing') renderMailing();
}

// ── Overview ─────────────────────────────────────────────────────────────────
async function renderOverview() {
  var el = document.getElementById('tab-content');
  el.innerHTML = '<p class="loading">Loading…</p>';
  try {
    var [ldata, pdata, mdata, stats] = await Promise.all([
      api('GET','/admin/licenses'),
      api('GET','/admin/profiles'),
      fetch(API+'/mailing/list?secret='+encodeURIComponent(secret)).then(r=>r.json()),
      fetch(API+'/explore/stats').then(r=>r.json())
    ]);
    allLicenses = ldata.licenses || [];
    allProfiles = pdata.profiles || [];
    allMailing = mdata.subscribers || [];
    var active = allLicenses.filter(function(l){return l.status==='active';}).length;
    var suspended = allLicenses.filter(function(l){return l.status==='suspended';}).length;
    var cancelled = allLicenses.filter(function(l){return l.status==='cancelled';}).length;
    el.innerHTML =
      '<div class="stat-grid">'+
        '<div class="stat-card"><div class="num">'+active+'</div><div class="label">Subscribers</div></div>'+
        '<div class="stat-card"><div class="num">'+allMailing.length+'</div><div class="label">Mailing list</div></div>'+
        '<div class="stat-card"><div class="num">'+allProfiles.length+'</div><div class="label">Public profiles</div></div>'+
        '<div class="stat-card"><div class="num">'+(stats.publicMems||0)+'</div><div class="label">Public memories</div></div>'+
        '<div class="stat-card"><div class="num">'+(stats.subscriberMems||0)+'</div><div class="label">Subscriber memories</div></div>'+
        '<div class="stat-card"><div class="num">'+(stats.connectedMems||0)+'</div><div class="label">Connected memories</div></div>'+
        '<div class="stat-card"><div class="num">'+(stats.taggedMems||0)+'</div><div class="label">Tagged memories</div></div>'+
      '</div>'+
      '<div class="card"><div class="card-title">Recent subscriptions</div>'+licenseTable(allLicenses.slice().sort(function(a,b){return (b.createdAt||'').localeCompare(a.createdAt||'');}).slice(0,10))+'</div>';
  } catch(e) { el.innerHTML = '<p class="loading" style="color:#c4858a">Failed to load: '+esc(e.message)+'</p>'; }
}

// ── Licenses ─────────────────────────────────────────────────────────────────
async function renderLicenses() {
  var el = document.getElementById('tab-content');
  if (!allLicenses.length) {
    el.innerHTML = '<p class="loading">Loading…</p>';
    var data = await api('GET','/admin/licenses');
    allLicenses = data.licenses || [];
  }
  renderLicenseTable(el, '');
}

function renderLicenseTable(el, filter) {
  var licenses = filter
    ? allLicenses.filter(function(l){ var f=filter.toLowerCase(); return (l.email||'').includes(f)||(l.licenseKey||'').toLowerCase().includes(f)||(l.status||'').includes(f); })
    : allLicenses.slice();
  licenses.sort(function(a,b){return (b.createdAt||'').localeCompare(a.createdAt||'');});
  el.innerHTML =
    '<div class="card">'+
      '<div class="card-title">All subscriptions ('+licenses.length+')<button class="btn btn-sm btn-outline" onclick="refreshLicenses()" style="margin-left:8px">Refresh</button></div>'+
      '<div class="search-bar"><input id="lic-search" placeholder="Search email, key or status…" value="'+esc(filter)+'"></div>'+
      licenseTable(licenses)+
    '</div>';
  var s = document.getElementById('lic-search');
  if (s) s.addEventListener('input', function(){ renderLicenseTable(document.getElementById('tab-content'), this.value); });
  el.addEventListener('click', function(e) {
    var copyEl = e.target.closest('[data-copy]');
    if (copyEl) { copyText(copyEl.getAttribute('data-copy'), copyEl); return; }
    var actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    var action = actionEl.getAttribute('data-action'), key = actionEl.getAttribute('data-key');
    if (action === 'revoke') revokeKey(key, actionEl);
    else if (action === 'reinstate') reinstateKey(key, actionEl);
  });
}

function licenseTable(licenses) {
  if (!licenses.length) return '<p style="color:#8a7460;font-style:italic;padding:10px 0">None found.</p>';
  return '<table><thead><tr><th>Email</th><th>Key</th><th>Status</th><th>Created</th><th>Renewed</th><th>Actions</th></tr></thead><tbody>'+
    licenses.map(function(l){
      var bc = l.status==='active'?'badge-active':l.status==='suspended'?'badge-suspended':'badge-cancelled';
      return '<tr>'+
        '<td>'+esc(l.email||'—')+'</td>'+
        '<td><span class="key-mono">'+esc(l.licenseKey||'—')+'</span>'+
          (l.licenseKey?'<span class="copy-link" data-copy="'+esc(l.licenseKey)+'">copy</span>':'')+
        '</td>'+
        '<td><span class="badge '+bc+'">'+esc(l.status)+'</span>'+
          (l.note?' <span style="font-size:0.74rem;color:#a8a090;font-style:italic">'+esc(l.note)+'</span>':'')+
        '</td>'+
        '<td>'+fmt(l.createdAt)+'</td>'+
        '<td>'+fmt(l.renewedAt)+'</td>'+
        '<td style="white-space:nowrap">'+
          (l.status==='active'
            ? '<button class="btn btn-sm btn-danger" data-action="revoke" data-key="'+esc(l.keyHash)+'">Revoke</button>'
            : '<button class="btn btn-sm btn-success" data-action="reinstate" data-key="'+esc(l.keyHash)+'">Reinstate</button>')+
        '</td>'+
      '</tr>';
    }).join('')+
    '</tbody></table>';
}

async function refreshLicenses() {
  var data = await api('GET','/admin/licenses');
  allLicenses = data.licenses || [];
  var el = document.getElementById('tab-content');
  var filter = document.getElementById('lic-search');
  renderLicenseTable(el, filter?filter.value:'');
}

async function revokeKey(keyHash, btn) {
  if (!confirm('Revoke this licence? The subscriber will lose access on next key check.')) return;
  btn.disabled = true; btn.textContent = '…';
  try {
    await api('POST','/admin/license/revoke',{keyHash});
    var rec = allLicenses.find(function(l){return l.keyHash===keyHash;});
    if (rec) rec.status = 'cancelled';
    var el = document.getElementById('tab-content'); var filter = document.getElementById('lic-search');
    renderLicenseTable(el, filter?filter.value:'');
  } catch(e) { btn.disabled=false; btn.textContent='Revoke'; alert('Failed: '+e.message); }
}

async function reinstateKey(keyHash, btn) {
  btn.disabled = true; btn.textContent = '…';
  try {
    await api('POST','/admin/license/reinstate',{keyHash});
    var rec = allLicenses.find(function(l){return l.keyHash===keyHash;});
    if (rec) { rec.status = 'active'; rec.renewedAt = new Date().toISOString(); }
    var el = document.getElementById('tab-content'); var filter = document.getElementById('lic-search');
    renderLicenseTable(el, filter?filter.value:'');
  } catch(e) { btn.disabled=false; btn.textContent='Reinstate'; alert('Failed: '+e.message); }
}

// ── Generate ──────────────────────────────────────────────────────────────────
function renderGenerate() {
  document.getElementById('tab-content').innerHTML =
    '<div class="card" style="max-width:480px">'+
      '<div class="card-title">Issue a free licence key</div>'+
      '<div class="form-row"><input id="gen-email" type="email" placeholder="Recipient email (optional)…"></div>'+
      '<div class="form-row"><input id="gen-note" type="text" placeholder="Note, e.g. "complimentary" or "beta tester"…"></div>'+
      '<button class="btn" onclick="generateKey()">Generate key</button>'+
      '<div id="gen-result"></div>'+
    '</div>';
}

async function generateKey() {
  var email = (document.getElementById('gen-email').value||'').trim();
  var note = (document.getElementById('gen-note').value||'').trim()||'manually issued';
  var res = document.getElementById('gen-result');
  res.innerHTML = '<p style="color:#8a7460;font-style:italic;margin-top:10px">Generating…</p>';
  try {
    var data = await api('POST','/license/generate',{email,note});
    res.innerHTML = '<div class="msg ok" style="margin-top:10px">Key issued: <span class="key-mono">'+esc(data.licenseKey)+'</span> <span class="copy-link" data-copy="'+esc(data.licenseKey)+'">copy</span></div>';
    var c = res.querySelector('[data-copy]'); if (c) c.addEventListener('click', function(){ copyText(this.getAttribute('data-copy'),this); });
    allLicenses = []; // invalidate cache so next visit to Subscriptions tab refreshes
  } catch(e) { res.innerHTML = '<div class="msg err" style="margin-top:10px">Failed: '+esc(e.message)+'</div>'; }
}

// ── Profiles ──────────────────────────────────────────────────────────────────
async function renderProfiles() {
  var el = document.getElementById('tab-content');
  el.innerHTML = '<p class="loading">Loading…</p>';
  try {
    var data = await api('GET','/admin/profiles');
    allProfiles = data.profiles || [];
    renderProfileTable(el, '');
  } catch(e) { el.innerHTML = '<p class="loading" style="color:#c4858a">Failed: '+esc(e.message)+'</p>'; }
}

function renderProfileTable(el, filter) {
  var profiles = filter
    ? allProfiles.filter(function(p){ var f=filter.toLowerCase(); return (p.displayName||'').toLowerCase().includes(f)||(p.identifier||'').toLowerCase().includes(f); })
    : allProfiles.slice();
  el.innerHTML =
    '<div class="card">'+
      '<div class="card-title">Published chronicles ('+profiles.length+')</div>'+
      '<div class="search-bar"><input id="prof-search" placeholder="Search name or identifier…"></div>'+
      '<table><thead><tr><th>Name</th><th>Email</th><th>Memories</th><th>Published</th><th>Privacy</th><th>Actions</th></tr></thead><tbody>'+
      profiles.map(function(p){
        return '<tr>'+
          '<td><a href="'+API+'/p/'+esc(p.identifier)+'" target="_blank" style="color:#a8885a;text-decoration:underline">'+esc(p.displayName||'—')+'</a></td>'+
          '<td>'+esc(p.email||'—')+'</td>'+
          '<td>'+(p.memCount||0)+'</td>'+
          '<td>'+fmt(p.publishedAt||p.updatedAt)+'</td>'+
          '<td>'+esc(p.profilePrivacy||'open')+'</td>'+
          '<td><button class="btn btn-sm btn-danger" data-remove="'+esc(p.identifier)+'">Remove</button></td>'+
        '</tr>';
      }).join('')+
      '</tbody></table>'+
    '</div>';
  var ps = document.getElementById('prof-search');
  if (ps) ps.addEventListener('input', function(){ renderProfileTable(document.getElementById('tab-content'), this.value); });
  el.addEventListener('click', function(e) {
    var rm = e.target.closest('[data-remove]');
    if (rm) removeProfile(rm.getAttribute('data-remove'), rm);
  });
}

async function removeProfile(identifier, btn) {
  if (!confirm('Remove "'+identifier+'" from the public index? The data is NOT deleted — they can republish.')) return;
  btn.disabled = true; btn.textContent = '…';
  try {
    await api('POST','/admin/profile/remove',{identifier});
    allProfiles = allProfiles.filter(function(p){return p.identifier!==identifier;});
    renderProfileTable(document.getElementById('tab-content'),'');
  } catch(e) { btn.disabled=false; btn.textContent='Remove'; alert('Failed: '+e.message); }
}

// ── Mailing list ──────────────────────────────────────────────────────────────
async function renderMailing() {
  var el = document.getElementById('tab-content');
  el.innerHTML = '<p class="loading">Loading…</p>';
  try {
    var data = await fetch(API+'/mailing/list?secret='+encodeURIComponent(secret)).then(function(r){return r.json();});
    allMailing = data.subscribers || [];
    el.innerHTML =
      '<div class="card">'+
        '<div class="card-title">Mailing list ('+allMailing.length+')'+
          '<button class="btn btn-sm btn-outline" onclick="exportMailing()" style="margin-left:8px">Export CSV</button>'+
        '</div>'+
        '<table><thead><tr><th>Email</th><th>Subscribed</th></tr></thead><tbody>'+
        allMailing.sort(function(a,b){return (b.subscribedAt||'').localeCompare(a.subscribedAt||'');}).map(function(s){
          return '<tr><td>'+esc(s.email)+'</td><td>'+fmt(s.subscribedAt)+'</td></tr>';
        }).join('')+
        '</tbody></table>'+
      '</div>';
  } catch(e) { el.innerHTML = '<p class="loading" style="color:#c4858a">Failed: '+esc(e.message)+'</p>'; }
}

function exportMailing() {
  var csv = 'email,subscribed_at\\n' + allMailing.map(function(s){return s.email+','+s.subscribedAt;}).join('\\n');
  var a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download = 'mailing-list-'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
}

// ── Init ──────────────────────────────────────────────────────────────────────
(function() {
  var s = sg('admin-secret');
  if (s) {
    secret = s;
    // Verify it's still valid
    fetch(API+'/admin/licenses', { headers: { 'X-Admin-Secret': s } }).then(function(r) {
      if (r.status===403) { logout(); return; }
      return r.json().then(function(data) {
        allLicenses = data.licenses || [];
        showApp();
      });
    }).catch(function(){ showApp(); }); // network error — show app optimistically
  }
})();
</script>
</body>
</html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getProfilesList(env) {
  const raw = await env.SHARES.get("profiles:list");
  return raw ? JSON.parse(raw) : [];
}

async function updateProfilesIndex(env, compact) {
  const raw = await env.SHARES.get("profiles:list");
  let list = raw ? JSON.parse(raw) : [];
  list = list.filter(p => p.identifier !== compact.identifier);
  list.unshift(compact); // most recently updated first
  if (list.length > 5000) list = list.slice(0, 5000);
  await env.SHARES.put("profiles:list", JSON.stringify(list));
}

// Look up viewer's ownerEmailHash from their profile (identified by their keyHash)
async function getViewerEmailHash(env, viewerKeyHash) {
  const identifier = await env.SHARES.get("keymap:" + viewerKeyHash);
  if (!identifier) return "";
  const raw = await env.SHARES.get("profile:" + identifier);
  if (!raw) return "";
  const profile = JSON.parse(raw);
  return profile.ownerEmailHash || "";
}

// Build feed entries: all visible memories across profiles
// sort: "latest" (by profile updatedAt then memory year desc) | "popular" (by reactions in period)
async function buildEntries(env, profileCompacts, viewerEmailHash, viewerIdentifier, isSubscriber, sort, cutoff) {
  const entries = [];
  for (const compact of profileCompacts) {
    const raw = await env.SHARES.get("profile:" + compact.identifier);
    if (!raw) continue;
    const profile = JSON.parse(raw);
    const isOwner = !!(viewerIdentifier && viewerIdentifier === compact.identifier);
    const visibleMems = isOwner
      ? (profile.memories || []).filter(m => (m.visibility || "private") !== "private")
      : (profile.memories || []).filter(m => canViewMemory(m, viewerEmailHash, profile.connectionEmailHashes || [], isSubscriber));
    if (!visibleMems.length) continue;

    const profileMeta = {
      identifier: compact.identifier,
      displayName: compact.displayName,
      about: compact.about,
      imageUrl: compact.imageUrl,
    };

    const rawTotals = sort === "popular" ? await env.SHARES.get("reactions:totals:" + compact.identifier) : null;
    const totals = rawTotals ? JSON.parse(rawTotals) : {};

    for (const memory of visibleMems) {
      const reactionCount = sort === "popular"
        ? (totals[memory.id]?.count || 0)
        : 0;
      const recentReactions = sort === "popular" && cutoff
        ? (totals[memory.id]?.lastReactedAt && new Date(totals[memory.id].lastReactedAt).getTime() > cutoff ? reactionCount : 0)
        : reactionCount;
      // For latest, use stored total reactions for display even though sort is by date
      const displayReactions = totals[memory.id]?.count || 0;
      entries.push({
        profile: profileMeta,
        memory,
        reactions: displayReactions,
        _sortScore: sort === "popular" ? recentReactions : (memory.year || 0),
        _profileUpdatedAt: compact.updatedAt || "",
      });
    }
  }
  return entries;
}
