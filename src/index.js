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
function canViewMemory(memory, viewerEmailHash, profileConnectionEmailHashes) {
  const v = memory.visibility;
  if (!v || v === "private") return false;
  if (v === "public") return true;
  if (v === "subscriber") return !!viewerEmailHash; // any keyed user counts as subscriber
  if (v === "connected" || v === "tagged") {
    return !!(viewerEmailHash && profileConnectionEmailHashes && profileConnectionEmailHashes.includes(viewerEmailHash));
  }
  return false;
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
  <button onclick="switchTab('interests')" id="tab-interests">Interests</button>
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
  rs.innerHTML = '<div class="rs-section"><p class="loading" style="font-size:0.8rem;padding:4px 0">Loading\u2026</p></div><div class="rs-section"><a class="rs-donate" href="https://ko-fi.com/remembory" target="_blank" rel="noopener">\u2615 Support on Ko-fi</a></div>';
  try {
    var data = await (await fetch(API+'/explore/stats')).json();
    var h = '<div class="rs-title">Community</div>'+
      '<div class="rs-stat-row"><span>Chronicles</span><span class="rs-stat-num">'+(data.totalChronicles||0)+'</span></div>'+
      '<div class="rs-stat-row"><span>Public memories</span><span class="rs-stat-num">'+(data.publicMems||0)+'</span></div>';
    if (data.subscriberMems) h += '<div class="rs-stat-row"><span>Subscriber</span><span class="rs-stat-num">'+data.subscriberMems+'</span></div>';
    if (data.connectedMems) h += '<div class="rs-stat-row"><span>Connected</span><span class="rs-stat-num">'+data.connectedMems+'</span></div>';
    if (data.taggedMems) h += '<div class="rs-stat-row"><span>Tagged</span><span class="rs-stat-num">'+data.taggedMems+'</span></div>';
    rs.innerHTML = '<div class="rs-section">'+h+'</div><div class="rs-section"><a class="rs-donate" href="https://ko-fi.com/remembory" target="_blank" rel="noopener">\u2615 Support on Ko-fi</a></div>';
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
function locationDisplay(m, detail) {
  if (detail === "country") {
    return m.locationCountry || m.locationState || m.location || "";
  }
  // "town" — default
  return [m.locationTown, m.locationCountry].filter(Boolean).join(", ") || m.locationCountry || m.locationState || m.location || "";
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
      const locStr = locationDisplay(m);
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
      const visibleMems = isOwner
        ? (profile.memories || [])
        : (profile.memories || []).filter(m => canViewMemory(m, vEmailHash, profile.connectionEmailHashes || []));
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
        pub.memories = (profile.memories || []).filter(m => canViewMemory(m, vEmailHash, profile.connectionEmailHashes || []));
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

      let entries = await buildEntries(env, profiles.slice(0, 50), vEmailHash, viewerIdentifier, sort, cutoff);

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
      const allEntries = await buildEntries(env, finalMatched.slice(0, 30), vEmailHash, viewerIdentifier2, null);

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

    // Health check
    if (path === "/health") return json({ ok: true });

    return json({ error: "Not found" }, 404);
  },
};

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
async function buildEntries(env, profileCompacts, viewerEmailHash, viewerIdentifier, sort, cutoff) {
  const entries = [];
  for (const compact of profileCompacts) {
    const raw = await env.SHARES.get("profile:" + compact.identifier);
    if (!raw) continue;
    const profile = JSON.parse(raw);
    const isOwner = !!(viewerIdentifier && viewerIdentifier === compact.identifier);
    const visibleMems = isOwner
      ? (profile.memories || []).filter(m => (m.visibility || "private") !== "private")
      : (profile.memories || []).filter(m => canViewMemory(m, viewerEmailHash, profile.connectionEmailHashes || []));
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
