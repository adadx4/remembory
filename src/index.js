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
    header { background: rgba(245,240,232,0.96); border-bottom: 1px solid #c8b89a; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; backdrop-filter: blur(8px); }
    .logo { font-family: 'Playfair Display', serif; font-size: 1.3rem; font-weight: 700; color: #1a1208; }
    .logo span { font-weight: 400; font-style: italic; font-size: 1rem; color: #8a7460; margin-left: 6px; }
    .key-status { font-size: 0.78rem; color: #8a7460; font-style: italic; }
    .key-status.active { color: #4a7a5a; }
    nav.tabs { display: flex; border-bottom: 2px solid #e0d4be; background: #faf7f2; overflow-x: auto; }
    nav.tabs button { flex: 1; min-width: 90px; padding: 12px 8px 10px; border: none; background: transparent; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.95rem; color: #8a7460; border-bottom: 2px solid transparent; margin-bottom: -2px; white-space: nowrap; transition: color 0.15s; }
    nav.tabs button.active { color: #1a1208; border-bottom-color: #2c2416; font-weight: 600; }
    nav.tabs button:hover:not(.active) { color: #4a3820; }
    main { max-width: 680px; margin: 0 auto; padding: 24px 16px 60px; }
    .feed-header { margin-bottom: 20px; }
    .feed-header h2 { font-family: 'Playfair Display', serif; font-size: 1.5rem; font-style: italic; color: #1a1208; margin-bottom: 4px; }
    .feed-header p { font-size: 0.88rem; color: #8a7460; line-height: 1.5; }
    .card { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 4px; padding: 20px; margin-bottom: 16px; transition: box-shadow 0.15s; }
    .card:hover { box-shadow: 0 4px 20px rgba(44,36,22,0.1); }
    .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; background: #c8a87a; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #1a1208; font-size: 1rem; flex-shrink: 0; overflow: hidden; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .card-byline { flex: 1; min-width: 0; }
    .card-byline strong { display: block; font-size: 0.95rem; color: #1a1208; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-byline span { font-size: 0.78rem; color: #8a7460; font-style: italic; }
    .vis-badge { font-size: 0.68rem; padding: 2px 7px; border-radius: 10px; font-family: Arial, sans-serif; letter-spacing: 0.04em; }
    .vis-public { background: rgba(74,122,90,0.12); color: #2d6b3a; border: 1px solid rgba(74,122,90,0.3); }
    .vis-connected { background: rgba(100,120,160,0.12); color: #3a4a7a; border: 1px solid rgba(100,120,160,0.3); }
    .vis-subscriber { background: rgba(168,136,90,0.12); color: #7a5a20; border: 1px solid rgba(168,136,90,0.3); }
    .memory-title { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-style: italic; color: #1a1208; margin-bottom: 8px; line-height: 1.3; }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
    .chip { font-size: 0.76rem; padding: 2px 8px; background: rgba(200,168,122,0.15); border: 1px solid rgba(200,168,122,0.35); border-radius: 10px; color: #5a4020; }
    .excerpt { font-size: 0.9rem; color: #5a4830; line-height: 1.6; margin-bottom: 12px; }
    .card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid #ede4d4; }
    .react-btn { background: transparent; border: 1px solid #d4c4a8; border-radius: 20px; padding: 4px 12px; cursor: pointer; font-size: 0.88rem; color: #8a7460; font-family: 'Crimson Text', serif; transition: all 0.15s; display: flex; align-items: center; gap: 5px; }
    .react-btn:hover, .react-btn.reacted { background: rgba(200,100,100,0.08); border-color: rgba(200,100,100,0.3); color: #a04040; }
    .profile-link { font-size: 0.78rem; color: #a8885a; text-decoration: underline; cursor: pointer; }
    .loading { color: #8a7460; font-style: italic; padding: 40px 0; text-align: center; }
    .empty { text-align: center; padding: 60px 20px; color: #8a7460; }
    .empty h3 { font-family: 'Playfair Display', serif; font-style: italic; margin-bottom: 8px; font-size: 1.2rem; color: #4a3820; }
    .empty p { font-size: 0.9rem; line-height: 1.6; }
    .period-toggle { display: flex; gap: 6px; margin-bottom: 20px; }
    .period-btn { padding: 5px 14px; border: 1px solid #c8b89a; border-radius: 20px; background: transparent; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.88rem; color: #8a7460; }
    .period-btn.active { background: #2c2416; color: #f5f0e8; border-color: #2c2416; }
    /* Interest tab */
    .interest-form { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 4px; padding: 20px; margin-bottom: 24px; }
    .interest-form h3 { font-family: 'Playfair Display', serif; font-style: italic; font-size: 1.1rem; margin-bottom: 4px; color: #1a1208; }
    .interest-form p { font-size: 0.84rem; color: #8a7460; margin-bottom: 16px; line-height: 1.5; }
    label.field-label { display: block; font-size: 0.78rem; letter-spacing: 0.05em; text-transform: uppercase; color: #6a5840; margin-bottom: 5px; margin-top: 14px; font-family: Arial, sans-serif; }
    input[type=text], input[type=number] { width: 100%; padding: 8px 10px; border: 1px solid #c8b89a; border-radius: 3px; font-family: 'Crimson Text', serif; font-size: 0.95rem; background: #faf7f2; color: #1a1208; }
    input[type=text]:focus, input[type=number]:focus { outline: none; border-color: #a8885a; }
    .year-row { display: flex; gap: 8px; align-items: center; }
    .year-row span { color: #8a7460; font-size: 0.88rem; }
    .year-row input { flex: 1; }
    .tags-input-row { display: flex; gap: 6px; }
    .tags-input-row input { flex: 1; }
    .tags-input-row button { padding: 8px 12px; background: #2c2416; color: #f5f0e8; border: none; border-radius: 3px; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 0.9rem; }
    .tag-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
    .tag-chip { display: flex; align-items: center; gap: 4px; font-size: 0.78rem; padding: 2px 8px; background: rgba(200,168,122,0.15); border: 1px solid rgba(200,168,122,0.35); border-radius: 10px; color: #5a4020; }
    .tag-chip button { background: none; border: none; cursor: pointer; color: #8a7460; font-size: 0.9rem; padding: 0; line-height: 1; }
    .save-btn { margin-top: 16px; padding: 10px 20px; background: #2c2416; color: #f5f0e8; border: none; border-radius: 3px; cursor: pointer; font-family: 'Crimson Text', serif; font-size: 1rem; }
    .save-btn:disabled { opacity: 0.5; }
    .save-msg { font-size: 0.82rem; margin-top: 8px; font-style: italic; }
    .save-msg.ok { color: #4a7a5a; }
    .save-msg.err { color: #c4858a; }
    /* No-key banner */
    .no-key-banner { background: #fff8ec; border: 1px solid #e8d4a0; border-radius: 4px; padding: 14px 16px; margin-bottom: 20px; font-size: 0.88rem; color: #5a4820; line-height: 1.6; }
    .no-key-banner strong { display: block; margin-bottom: 4px; }
  </style>
</head>
<body>
<header>
  <div class="logo">Chronicle <span>Explore</span></div>
  <div class="key-status" id="key-status">Not signed in</div>
</header>
<nav class="tabs" id="tabs">
  <button onclick="switchTab('latest')" id="tab-latest">Latest</button>
  <button onclick="switchTab('popular')" id="tab-popular">Popular</button>
  <button onclick="switchTab('connected')" id="tab-connected">Connected</button>
  <button onclick="switchTab('interests')" id="tab-interests">Interests</button>
</nav>
<main>
  <div id="feed-header" class="feed-header"></div>
  <div id="period-toggle" style="display:none" class="period-toggle">
    <button class="period-btn active" id="period-7d" onclick="setPeriod('7d')">Last 7 days</button>
    <button class="period-btn" id="period-24h" onclick="setPeriod('24h')">Last 24 hours</button>
  </div>
  <div id="feed"></div>
</main>

<script>
var API = 'https://social.remembory.net';
var viewerKey = '';
var activeTab = 'latest';
var popularPeriod = '7d';
var interests = { locations: [], yearFrom: '', yearTo: '', tags: [] };
var reactedMemories = {};

function getParam(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

function lsGet(k) { try { return localStorage.getItem(k); } catch(e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch(e) {} }

function init() {
  var keyFromUrl = getParam('key');
  if (keyFromUrl) { lsSet('chronicle-explore-key', keyFromUrl); viewerKey = keyFromUrl; }
  else { viewerKey = lsGet('chronicle-explore-key') || ''; }

  var tabFromUrl = getParam('tab');

  var reacted = lsGet('chronicle-explore-reacted');
  if (reacted) { try { reactedMemories = JSON.parse(reacted); } catch(e) {} }

  updateKeyStatus();
  loadInterestPrefs().then(function() {
    switchTab(tabFromUrl || 'latest');
  });
}

function updateKeyStatus() {
  var el = document.getElementById('key-status');
  if (viewerKey) {
    el.textContent = 'Signed in via Chronicle';
    el.className = 'key-status active';
  } else {
    el.textContent = 'Not signed in';
    el.className = 'key-status';
  }
}

function switchTab(tab) {
  activeTab = tab;
  ['latest','popular','connected','interests'].forEach(function(t) {
    var btn = document.getElementById('tab-' + t);
    if (btn) btn.className = t === tab ? 'active' : '';
  });
  document.getElementById('period-toggle').style.display = tab === 'popular' ? 'flex' : 'none';
  loadTab();
}

function setPeriod(period) {
  popularPeriod = period;
  document.getElementById('period-7d').className = 'period-btn' + (period === '7d' ? ' active' : '');
  document.getElementById('period-24h').className = 'period-btn' + (period === '24h' ? ' active' : '');
  loadTab();
}

function setFeedHeader(title, subtitle) {
  document.getElementById('feed-header').innerHTML =
    '<h2>' + esc(title) + '</h2>' + (subtitle ? '<p>' + esc(subtitle) + '</p>' : '');
}

async function loadTab() {
  if (activeTab === 'interests') { renderInterestTab(); return; }
  var feed = document.getElementById('feed');
  feed.innerHTML = '<p class="loading">Loading\u2026</p>';
  try {
    var data;
    if (activeTab === 'latest') {
      setFeedHeader('Latest', 'Recently updated chronicles from the community.');
      data = await apiFetch('/explore/latest?key=' + encodeURIComponent(viewerKey));
      renderCards(data.entries || []);
    } else if (activeTab === 'popular') {
      setFeedHeader('Popular', 'Memories that resonated most recently.');
      data = await apiFetch('/explore/popular?key=' + encodeURIComponent(viewerKey) + '&period=' + popularPeriod);
      renderCards(data.entries || []);
    } else if (activeTab === 'connected') {
      setFeedHeader('Connected', 'Memories from people in your connections.');
      if (!viewerKey) {
        feed.innerHTML = noKeyBanner('The Connected tab shows memories from people you know in Chronicle. Open Chronicle and use Explore from there to sign in.');
        return;
      }
      data = await apiFetch('/explore/connected?key=' + encodeURIComponent(viewerKey));
      renderCards(data.entries || []);
    }
  } catch(e) {
    feed.innerHTML = '<p class="loading" style="color:#c4858a">Could not load feed: ' + esc(e.message) + '</p>';
  }
}

async function apiFetch(path) {
  var r = await fetch(API + path);
  if (!r.ok) throw new Error('Server error ' + r.status);
  return r.json();
}

function noKeyBanner(msg) {
  return '<div class="no-key-banner"><strong>Sign in with Chronicle</strong>' + esc(msg) + '</div>';
}

function renderCards(entries) {
  var feed = document.getElementById('feed');
  if (!entries.length) {
    feed.innerHTML = '<div class="empty"><h3>Nothing here yet</h3><p>Be the first — publish your chronicle in the Chronicle app.</p></div>';
    return;
  }
  feed.innerHTML = '';
  entries.forEach(function(entry) {
    feed.appendChild(makeCard(entry));
  });
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function makeCard(entry) {
  var p = entry.profile;
  var m = entry.memory;
  var reactions = entry.reactions || 0;
  var memKey = p.identifier + ':' + m.id;
  var alreadyReacted = !!reactedMemories[memKey];

  var vis = m.visibility || 'public';
  var visBadgeClass = vis === 'connected' ? 'vis-connected' : vis === 'subscriber' ? 'vis-subscriber' : 'vis-public';
  var visLabel = vis === 'connected' ? 'Connected' : vis === 'subscriber' ? 'Subscribers' : 'Public';

  var chips = '';
  if (m.year) chips += '<span class="chip">' + esc(String(m.year)) + '</span>';
  if (m.location) chips += '<span class="chip">&#128205; ' + esc(m.location) + '</span>';
  (m.tags || []).slice(0,3).forEach(function(t) { chips += '<span class="chip">' + esc(t) + '</span>'; });

  var avatarInner = p.imageUrl
    ? '<img src="' + esc(p.imageUrl) + '" alt="" onerror="this.style.display=\'none\'">'
    : esc((p.displayName || '?')[0]);

  var excerpt = (m.content || '').replace(/<[^>]*>/g, '').slice(0, 220);
  if ((m.content || '').length > 220) excerpt += '\u2026';

  var div = document.createElement('div');
  div.className = 'card';
  div.innerHTML =
    '<div class="card-header">' +
      '<div class="avatar">' + avatarInner + '</div>' +
      '<div class="card-byline">' +
        '<strong>' + esc(p.displayName) + '</strong>' +
        '<span>' + esc(memDateLabel(m)) + '</span>' +
      '</div>' +
      '<span class="vis-badge ' + visBadgeClass + '">' + visLabel + '</span>' +
    '</div>' +
    (m.title ? '<div class="memory-title">' + esc(m.title) + '</div>' : '') +
    (chips ? '<div class="chips">' + chips + '</div>' : '') +
    (excerpt ? '<p class="excerpt">' + esc(excerpt) + '</p>' : '') +
    '<div class="card-footer">' +
      '<button class="react-btn' + (alreadyReacted ? ' reacted' : '') + '" id="react-' + esc(memKey.replace(':','-')) + '" onclick="doReact(\'' + esc(p.identifier) + '\',\'' + esc(m.id) + '\',this)">' +
        (alreadyReacted ? '&#10084;' : '&#9825;') + ' <span class="react-count">' + reactions + '</span>' +
      '</button>' +
      '<a class="profile-link" href="' + API + '/p/' + esc(p.identifier) + '?key=' + encodeURIComponent(viewerKey) + '">' + esc(p.displayName) + '\'s chronicle \u2192</a>' +
    '</div>';
  return div;
}

function memDateLabel(m) {
  if (!m.year) return '';
  if (m.fuzzy === 'year') return String(m.year);
  if (m.month) return new Date(m.year, m.month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  return String(m.year);
}

async function doReact(identifier, memId, btn) {
  var memKey = identifier + ':' + memId;
  var alreadyReacted = !!reactedMemories[memKey];
  var action = alreadyReacted ? 'remove' : 'add';
  try {
    var r = await fetch(API + '/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier, memId: memId, action: action, key: viewerKey })
    });
    var data = await r.json();
    var count = data.count || 0;
    if (action === 'add') {
      reactedMemories[memKey] = true;
      btn.className = 'react-btn reacted';
      btn.innerHTML = '&#10084; <span class="react-count">' + count + '</span>';
    } else {
      delete reactedMemories[memKey];
      btn.className = 'react-btn';
      btn.innerHTML = '&#9825; <span class="react-count">' + count + '</span>';
    }
    lsSet('chronicle-explore-reacted', JSON.stringify(reactedMemories));
  } catch(e) { /* silent */ }
}

// ── Interest tab ─────────────────────────────────────────────────────────────
async function loadInterestPrefs() {
  if (!viewerKey) return;
  try {
    var r = await fetch(API + '/interest/get?key=' + encodeURIComponent(viewerKey));
    if (r.ok) {
      var d = await r.json();
      interests = d || interests;
    }
  } catch(e) {}
}

function renderInterestTab() {
  setFeedHeader('Interests', 'Declare your interests to find relevant memories.');
  var feed = document.getElementById('feed');

  if (!viewerKey) {
    feed.innerHTML = noKeyBanner('Save your interests and find memories that match what matters to you. Open Chronicle and use Explore from there to sign in.') +
      renderInterestFormHTML();
    bindInterestForm();
    return;
  }

  feed.innerHTML = renderInterestFormHTML();
  bindInterestForm();

  // Also show matching results below the form
  loadInterestResults();
}

function renderInterestFormHTML() {
  var locVal = (interests.locations || []).join(', ');
  var tagChips = (interests.tags || []).map(function(t) {
    return '<span class="tag-chip">' + esc(t) + '<button onclick="removeTag(\'' + esc(t) + '\')" title="Remove">&times;</button></span>';
  }).join('');

  return '<div class="interest-form">' +
    '<h3>Your interests</h3>' +
    '<p>Chronicle will find memories that match these interests across all published chronicles.</p>' +
    '<label class="field-label">Locations</label>' +
    '<input type="text" id="int-locations" value="' + esc(locVal) + '" placeholder="Edinburgh, Scotland, Nova Scotia\u2026">' +
    '<label class="field-label">Time period</label>' +
    '<div class="year-row">' +
      '<input type="number" id="int-year-from" value="' + esc(String(interests.yearFrom || '')) + '" placeholder="From year" min="1700" max="2100">' +
      '<span>to</span>' +
      '<input type="number" id="int-year-to" value="' + esc(String(interests.yearTo || '')) + '" placeholder="To year" min="1700" max="2100">' +
    '</div>' +
    '<label class="field-label">Tags &amp; themes</label>' +
    '<div class="tags-input-row">' +
      '<input type="text" id="int-tag-input" placeholder="wartime, emigration, music\u2026" onkeydown="if(event.key===\'Enter\'){addTag();event.preventDefault();}">' +
      '<button onclick="addTag()">Add</button>' +
    '</div>' +
    '<div class="tag-chips" id="tag-chips">' + tagChips + '</div>' +
    '<button class="save-btn" onclick="saveInterests()" id="save-int-btn">Save &amp; find matches</button>' +
    '<div class="save-msg" id="save-int-msg"></div>' +
  '</div>';
}

function bindInterestForm() {}

function addTag() {
  var input = document.getElementById('int-tag-input');
  var val = (input.value || '').trim().toLowerCase();
  if (!val) return;
  if (!interests.tags) interests.tags = [];
  if (!interests.tags.includes(val)) {
    interests.tags.push(val);
    refreshTagChips();
  }
  input.value = '';
}

function removeTag(tag) {
  interests.tags = (interests.tags || []).filter(function(t) { return t !== tag; });
  refreshTagChips();
}

function refreshTagChips() {
  var el = document.getElementById('tag-chips');
  if (!el) return;
  el.innerHTML = (interests.tags || []).map(function(t) {
    return '<span class="tag-chip">' + esc(t) + '<button onclick="removeTag(\'' + esc(t) + '\')" title="Remove">&times;</button></span>';
  }).join('');
}

async function saveInterests() {
  var locRaw = (document.getElementById('int-locations') || {}).value || '';
  var locs = locRaw.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  var yfEl = document.getElementById('int-year-from');
  var ytEl = document.getElementById('int-year-to');
  interests.locations = locs;
  interests.yearFrom = yfEl && yfEl.value ? parseInt(yfEl.value) : null;
  interests.yearTo = ytEl && ytEl.value ? parseInt(ytEl.value) : null;

  var btn = document.getElementById('save-int-btn');
  var msg = document.getElementById('save-int-msg');
  if (btn) btn.disabled = true;
  try {
    var r = await fetch(API + '/interest/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: viewerKey, interests: interests })
    });
    if (!r.ok) throw new Error('Server error');
    if (msg) { msg.textContent = '\u2713 Saved'; msg.className = 'save-msg ok'; }
    loadInterestResults();
  } catch(e) {
    if (msg) { msg.textContent = 'Could not save: ' + esc(e.message); msg.className = 'save-msg err'; }
  }
  if (btn) btn.disabled = false;
}

async function loadInterestResults() {
  var qs = '/explore/interest?key=' + encodeURIComponent(viewerKey);
  if (interests.locations && interests.locations.length) qs += '&locations=' + encodeURIComponent(interests.locations.join(','));
  if (interests.yearFrom) qs += '&yearFrom=' + interests.yearFrom;
  if (interests.yearTo) qs += '&yearTo=' + interests.yearTo;
  if (interests.tags && interests.tags.length) qs += '&tags=' + encodeURIComponent(interests.tags.join(','));

  var feed = document.getElementById('feed');
  var existing = feed.querySelector('.interest-form');
  var resultsDiv = document.getElementById('interest-results');
  if (!resultsDiv) {
    resultsDiv = document.createElement('div');
    resultsDiv.id = 'interest-results';
    feed.appendChild(resultsDiv);
  }
  resultsDiv.innerHTML = '<p class="loading">Finding matches\u2026</p>';

  try {
    var data = await apiFetch(qs);
    var entries = data.entries || [];
    if (!entries.length) {
      resultsDiv.innerHTML = '<div class="empty"><h3>No matches yet</h3><p>Refine your interests above, or wait for more chronicles to be published.</p></div>';
    } else {
      resultsDiv.innerHTML = '<div class="feed-header" style="margin-bottom:16px"><h2 style="font-size:1.1rem">Matching memories (' + entries.length + ')</h2></div>';
      var frag = document.createDocumentFragment();
      entries.forEach(function(entry) { frag.appendChild(makeCard(entry)); });
      resultsDiv.appendChild(frag);
    }
  } catch(e) {
    resultsDiv.innerHTML = '<p class="loading" style="color:#c4858a">Could not load: ' + esc(e.message) + '</p>';
  }
}

window.addEventListener('DOMContentLoaded', init);
</script>
</body>
</html>`;
}

// ── Individual profile page ───────────────────────────────────────────────────
function profilePage(profile, visibleMems) {
  var mems = visibleMems || [];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(profile.displayName)} — Chronicle</title>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Crimson Text', Georgia, serif; background: #f7f2ea; color: #2c2416; min-height: 100vh; }
    header { background: rgba(245,240,232,0.96); border-bottom: 1px solid #c8b89a; padding: 14px 20px; display: flex; align-items: center; gap: 14px; }
    .back { color: #8a7460; text-decoration: none; font-size: 0.9rem; }
    .back:hover { color: #2c2416; }
    header h1 { font-family: 'Playfair Display', serif; font-size: 1.2rem; font-weight: 700; color: #1a1208; }
    main { max-width: 680px; margin: 0 auto; padding: 28px 16px 60px; }
    .profile-header { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 28px; }
    .big-avatar { width: 64px; height: 64px; border-radius: 50%; background: #c8a87a; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: 600; color: #1a1208; flex-shrink: 0; overflow: hidden; }
    .big-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .profile-info h2 { font-family: 'Playfair Display', serif; font-size: 1.5rem; font-style: italic; color: #1a1208; }
    .profile-info p { font-size: 0.9rem; color: #6a5840; line-height: 1.6; margin-top: 6px; }
    .profile-info .meta { font-size: 0.8rem; color: #8a7460; margin-top: 4px; }
    .memory-card { background: #fffcf5; border: 1px solid #d4c4a8; border-radius: 4px; padding: 18px 20px; margin-bottom: 14px; }
    .memory-card h3 { font-family: 'Playfair Display', serif; font-style: italic; font-size: 1.1rem; color: #1a1208; margin-bottom: 6px; }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
    .chip { font-size: 0.76rem; padding: 2px 8px; background: rgba(200,168,122,0.15); border: 1px solid rgba(200,168,122,0.35); border-radius: 10px; color: #5a4020; }
    .memory-card p { font-size: 0.92rem; color: #4a3820; line-height: 1.7; white-space: pre-wrap; }
    .no-mems { text-align: center; padding: 40px; color: #8a7460; font-style: italic; }
  </style>
</head>
<body>
<header>
  <a class="back" href="/explore">&#8592; Explore</a>
  <h1>${esc(profile.displayName)}'s Chronicle</h1>
</header>
<main>
  <div class="profile-header">
    <div class="big-avatar">${profile.imageUrl ? `<img src="${esc(profile.imageUrl)}" alt="" onerror="this.style.display='none'">` : esc((profile.displayName || "?")[0])}</div>
    <div class="profile-info">
      <h2>${esc(profile.displayName)}</h2>
      ${profile.about ? `<p>${esc(profile.about)}</p>` : ""}
      <div class="meta">${mems.length} ${mems.length === 1 ? "memory" : "memories"} · Published ${profile.publishedAt ? new Date(profile.publishedAt).toLocaleDateString() : ""}</div>
    </div>
  </div>
  ${mems.length ? mems.map(m => `
  <div class="memory-card">
    ${m.title ? `<h3>${esc(m.title)}</h3>` : ""}
    <div class="chips">
      ${m.year ? `<span class="chip">${esc(String(m.year))}</span>` : ""}
      ${m.location ? `<span class="chip">&#128205; ${esc(m.location)}</span>` : ""}
      ${(m.tags||[]).map(t => `<span class="chip">${esc(t)}</span>`).join("")}
    </div>
    ${m.content ? `<p>${esc(m.content)}</p>` : ""}
  </div>`).join("") : `<p class="no-mems">No memories visible to you in this chronicle.</p>`}
</main>
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
      const viewerEmailHash = viewerKey ? await sha256hex(viewerKey.trim().toUpperCase()) : "";
      const vEmail = viewerEmailHash ? await getViewerEmailHash(env, viewerEmailHash) : "";
      const visibleMems = (profile.memories || []).filter(m => canViewMemory(m, vEmail, profile.connectionEmailHashes || []));
      return new Response(profilePage(profile, visibleMems), {
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

    // GET /profile/:identifier — JSON profile (for Chronicle app)
    if (request.method === "GET" && path.startsWith("/profile/")) {
      const identifier = path.slice("/profile/".length);
      if (!identifier) return json({ error: "Not found" }, 404);
      const raw = await env.SHARES.get("profile:" + identifier);
      if (!raw) return json({ error: "not_found" }, 404);
      const profile = JSON.parse(raw);
      const viewerKey = getViewerKey(request, url);
      const viewerEmailHash = viewerKey ? await sha256hex(viewerKey.trim().toUpperCase()) : "";
      const vEmailHash = viewerEmailHash ? await getViewerEmailHash(env, viewerEmailHash) : "";
      const pub = { ...profile };
      pub.memories = (profile.memories || []).filter(m => canViewMemory(m, vEmailHash, profile.connectionEmailHashes || []));
      delete pub.connectionEmailHashes; // don't expose
      return json(pub);
    }

    // GET /explore/latest
    if (request.method === "GET" && path === "/explore/latest") {
      const viewerKey = getViewerKey(request, url);
      const viewerEmailHash = viewerKey ? await sha256hex(viewerKey.trim().toUpperCase()) : "";
      const vEmailHash = viewerEmailHash ? await getViewerEmailHash(env, viewerEmailHash) : "";
      const list = await getProfilesList(env);
      const open = list.filter(p => p.profilePrivacy !== "disabled");
      const cursor = parseInt(url.searchParams.get("cursor") || "0");
      const page = open.slice(cursor, cursor + 20);
      const entries = await buildEntries(env, page, vEmailHash, null);
      return json({ entries, nextCursor: cursor + page.length < open.length ? cursor + page.length : null });
    }

    // GET /explore/popular?period=7d|24h
    if (request.method === "GET" && path === "/explore/popular") {
      const viewerKey = getViewerKey(request, url);
      const viewerEmailHash = viewerKey ? await sha256hex(viewerKey.trim().toUpperCase()) : "";
      const vEmailHash = viewerEmailHash ? await getViewerEmailHash(env, viewerEmailHash) : "";
      const period = url.searchParams.get("period") || "7d";
      const cutoff = Date.now() - (period === "24h" ? 86400000 : 7 * 86400000);
      const list = await getProfilesList(env);
      const open = list.filter(p => p.profilePrivacy !== "disabled");
      // Fetch reaction totals for each profile in open list (batch — up to 20)
      const sample = open.slice(0, 40);
      const withReactions = await Promise.all(sample.map(async p => {
        const rawRx = await env.SHARES.get("reactions:totals:" + p.identifier);
        const totals = rawRx ? JSON.parse(rawRx) : {};
        const recentTotal = Object.values(totals).reduce((s, v) => {
          return s + (v.lastReactedAt && new Date(v.lastReactedAt).getTime() > cutoff ? v.count : 0);
        }, 0);
        return { ...p, recentTotal };
      }));
      withReactions.sort((a, b) => b.recentTotal - a.recentTotal);
      const entries = await buildEntries(env, withReactions.slice(0, 20), vEmailHash, "most-reacted");
      return json({ entries });
    }

    // GET /explore/connected
    if (request.method === "GET" && path === "/explore/connected") {
      const viewerKey = getViewerKey(request, url);
      if (!viewerKey) return json({ entries: [] });
      const viewerKeyHash = await sha256hex(viewerKey.trim().toUpperCase());
      const vEmailHash = await getViewerEmailHash(env, viewerKeyHash);
      if (!vEmailHash) return json({ entries: [], hint: "Publish your profile first to see connected memories." });
      const viewerIdentifier = await env.SHARES.get("keymap:" + viewerKeyHash) || "";
      const list = await getProfilesList(env);
      // A profile is "connected" to viewer if viewer's emailHash is in their connectionEmailHashes
      const connected = list.filter(p =>
        p.profilePrivacy !== "disabled" &&
        p.identifier !== viewerIdentifier &&
        (p.connectionEmailHashes || []).includes(vEmailHash)
      );
      const entries = await buildEntries(env, connected, vEmailHash, null);
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

      const entries = await buildEntries(env, finalMatched.slice(0, 30), vEmailHash, null);
      return json({ entries });
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

// Build feed entries: [{profile (compact), memory, reactions}]
// Picks one representative memory per profile (most recent with public visibility)
async function buildEntries(env, profileCompacts, viewerEmailHash, sortHint) {
  const entries = [];
  for (const compact of profileCompacts) {
    const raw = await env.SHARES.get("profile:" + compact.identifier);
    if (!raw) continue;
    const profile = JSON.parse(raw);
    const visibleMems = (profile.memories || []).filter(m =>
      canViewMemory(m, viewerEmailHash, profile.connectionEmailHashes || [])
    );
    if (!visibleMems.length) continue;

    // Sort visible memories: if sortHint is "most-reacted", we need reaction counts
    let sorted = [...visibleMems].sort((a, b) => {
      const ay = a.year || 0, by2 = b.year || 0;
      return by2 - ay;
    });

    if (sortHint === "most-reacted") {
      // Fetch reaction totals for this profile
      const rawTotals = await env.SHARES.get("reactions:totals:" + compact.identifier);
      const totals = rawTotals ? JSON.parse(rawTotals) : {};
      sorted = sorted.sort((a, b) => ((totals[b.id]?.count || 0) - (totals[a.id]?.count || 0)));
    }

    const memory = sorted[0];
    const rxRaw = await env.SHARES.get("reactions:" + compact.identifier + ":" + memory.id);
    const reactions = rxRaw ? parseInt(rxRaw) : 0;

    entries.push({
      profile: {
        identifier: compact.identifier,
        displayName: compact.displayName,
        about: compact.about,
        imageUrl: compact.imageUrl,
      },
      memory,
      reactions,
    });
  }
  return entries;
}
