// Chronicle Share Worker — share.remembory.net
// KV binding: SHARES

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Chronicle-Client",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function bridgePage(code, senderName, memCount) {
  const chronicleUrl = `https://remembory.net/chronicle.html?share=${code}`;
  const isIOS = (ua) => /iPhone|iPad|iPod/i.test(ua);
  // We can't know UA here server-side, so we use JS in the page
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex">
  <title>Chronicle — Memory shared with you</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', serif;
      background: #f7f2ea;
      color: #2c2416;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fffcf5;
      border: 1px solid #d4c4a8;
      border-radius: 8px;
      padding: 36px 28px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 8px 40px rgba(44,36,22,0.12);
      text-align: center;
    }
    .logo { font-size: 1rem; color: #a8885a; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 24px; font-family: Arial, sans-serif; }
    h1 { font-size: 1.4rem; font-style: italic; color: #1a1208; margin-bottom: 10px; line-height: 1.3; }
    .sub { font-size: 0.9rem; color: #6a5840; line-height: 1.6; margin-bottom: 24px; }
    .warning {
      background: #fff8ec;
      border: 1px solid #e8d4a0;
      border-radius: 6px;
      padding: 14px 16px;
      margin-bottom: 24px;
      text-align: left;
    }
    .warning-title { font-size: 0.75rem; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; color: #8a6020; margin-bottom: 8px; font-family: Arial, sans-serif; }
    .warning p { font-size: 0.88rem; color: #5a4820; line-height: 1.6; }
    .btn {
      display: block;
      width: 100%;
      padding: 14px;
      background: #2c2416;
      color: #f5f0e8;
      border: none;
      border-radius: 4px;
      font-family: 'Georgia', serif;
      font-size: 1rem;
      cursor: pointer;
      text-decoration: none;
      margin-bottom: 12px;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }
    .btn-out {
      display: block;
      width: 100%;
      padding: 12px;
      background: transparent;
      color: #6a5840;
      border: 1px solid #c8b89a;
      border-radius: 4px;
      font-family: 'Georgia', serif;
      font-size: 0.88rem;
      cursor: pointer;
      text-decoration: none;
      margin-bottom: 8px;
    }
    .note { font-size: 0.78rem; color: #8a7460; font-style: italic; margin-top: 16px; line-height: 1.5; }
    .link-row { display: flex; gap: 6px; margin-top: 12px; }
    .link-input {
      flex: 1; padding: 8px 10px;
      border: 1px solid #c8b89a; border-radius: 4px;
      font-size: 0.75rem; color: #4a5a7a;
      background: #fffcf5; font-family: Arial, sans-serif;
    }
    .copy-btn {
      padding: 8px 12px; background: transparent;
      border: 1px solid #c8b89a; border-radius: 4px;
      font-size: 0.82rem; cursor: pointer; color: #6a5840;
      white-space: nowrap; font-family: Arial, sans-serif;
    }
    #iab-warning { display: none; }
  </style>
</head>
<body>
<div class="card">
  <div class="logo">Chronicle by Remembory</div>
  <h1>${senderName ? `${senderName} shared ${memCount === 1 ? 'a memory' : memCount + ' memories'} with you` : 'Someone shared memories with you'}</h1>
  <p class="sub">Chronicle is a private memory keeper. Nothing is stored in the cloud — your memories live on your device.</p>

  <div class="warning" id="iab-warning">
    <div class="warning-title">⚠ Open in your browser first</div>
    <p id="iab-instruction">Tap the menu icon in the top corner, then choose <strong>Open in browser</strong>. This link won't work properly inside a messaging app.</p>
  </div>

  <a href="${chronicleUrl}" class="btn" id="open-btn">Open in Chronicle</a>

  <p class="note">This link expires in 30 days and can only be used once.<br>If it's already been collected, it won't work.</p>

  <div class="link-row">
    <input class="link-input" id="link-input" readonly value="${chronicleUrl}" onclick="this.select()">
    <button class="copy-btn" onclick="copyLink()">Copy link</button>
  </div>
</div>
<script>
  const chronicleUrl = ${JSON.stringify(chronicleUrl)};
  const ua = navigator.userAgent;

  function isIAB() {
    return /FBAN|FBAV|Instagram|WhatsApp|Snapchat|TikTok|Twitter|LinkedInApp|Messenger/i.test(ua);
  }
  function getInstruction() {
    const ios = /iPhone|iPad|iPod/i.test(ua);
    if (/FBAN|FBAV|Messenger/i.test(ua)) return ios ? 'Tap ··· at the bottom right, then "Open in Safari"' : 'Tap ··· at the top right, then "Open in browser"';
    if (/Instagram/i.test(ua)) return ios ? 'Tap ··· at the top right, then "Open in external browser"' : 'Tap ··· at the top right, then "Open in Chrome"';
    if (/WhatsApp/i.test(ua)) return ios ? 'Tap the link, then "Open in Safari" at the bottom' : 'Tap ··· then "Open in Chrome"';
    if (/TikTok/i.test(ua)) return ios ? 'Tap ··· then "Open in Safari"' : 'Tap ··· then "Open in system browser"';
    if (/Twitter/i.test(ua)) return ios ? 'Tap the share icon, then "Open in Safari"' : 'Tap ··· then "Open in Chrome"';
    return ios ? 'Tap the share icon at the bottom, then "Open in Safari"' : 'Tap the menu icon, then "Open in browser"';
  }

  if (isIAB()) {
    document.getElementById('iab-warning').style.display = 'block';
    document.getElementById('iab-instruction').innerHTML = getInstruction();
    // Don't auto-navigate in IAB — make them open the browser
    const btn = document.getElementById('open-btn');
    btn.textContent = 'Copy link and open in browser';
    btn.href = '#';
    btn.onclick = function(e) { e.preventDefault(); copyLink(); };
  }

  function copyLink() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(chronicleUrl).then(() => {
        document.querySelector('.copy-btn').textContent = '✓ Copied';
        setTimeout(() => document.querySelector('.copy-btn').textContent = 'Copy link', 2000);
      });
    } else {
      document.getElementById('link-input').select();
      document.execCommand('copy');
    }
  }
</script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // POST /share — store a new share payload
    if (request.method === "POST" && path === "/share") {
      try {
        const body = await request.json();
        if (!body.memories || !Array.isArray(body.memories)) {
          return json({ error: "Invalid payload" }, 400);
        }
        const code = crypto.randomUUID().slice(0, 8);
        const payload = {
          ...body,
          sharedAt: new Date().toISOString(),
          collected: false,
        };
        // Expire after 30 days
        await env.SHARES.put(code, JSON.stringify(payload), {
          expirationTtl: 60 * 60 * 24 * 30,
        });
        return json({ url: `https://share.remembory.net/s/${code}`, code });
      } catch (e) {
        return json({ error: "Server error: " + e.message }, 500);
      }
    }

    // GET /s/:code — serve bridge page OR return JSON payload
    if (request.method === "GET" && path.startsWith("/s/")) {
      const code = path.slice(3);
      if (!code) return json({ error: "No code" }, 400);

      const raw = await env.SHARES.get(code);
      if (!raw) {
        // Code not found — serve a friendly error page or JSON
        const isChronicleClient = request.headers.get("X-Chronicle-Client") === "1";
        if (isChronicleClient) return json({ error: "not_found" }, 404);
        return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Chronicle — Link expired</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Georgia,serif;background:#f7f2ea;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}.card{background:#fffcf5;border:1px solid #d4c4a8;border-radius:8px;padding:36px 28px;max-width:400px;text-align:center;}h1{font-size:1.3rem;font-style:italic;margin-bottom:12px;}p{color:#6a5840;font-size:0.9rem;line-height:1.6;}a{color:#a8885a;}</style></head><body><div class="card"><h1>This link has expired</h1><p>Share links are single-use and expire after 30 days. Ask the sender to share again.</p><p style="margin-top:16px"><a href="https://remembory.net">Visit Remembory</a></p></div></body></html>`, {
          status: 410,
          headers: { "Content-Type": "text/html;charset=UTF-8" },
        });
      }

      const data = JSON.parse(raw);
      const isChronicleClient = request.headers.get("X-Chronicle-Client") === "1";

      if (isChronicleClient) {
        // Chronicle app fetching — mark collected and return JSON
        const updated = { ...data, collected: true };
        // Keep in KV briefly so rapid retries don't break; real expiry handles cleanup
        await env.SHARES.put(code, JSON.stringify(updated), { expirationTtl: 60 * 60 * 24 });
        return json(data);
      }

      // Regular browser — serve the bridge page
      const senderName = data.sharedBy || "";
      const memCount = data.memories?.length || 0;
      return new Response(bridgePage(code, senderName, memCount), {
        status: 200,
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "X-Frame-Options": "DENY",
          "Cache-Control": "no-store",
        },
      });
    }

    // Health check
    if (path === "/health") return json({ ok: true });

    return json({ error: "Not found" }, 404);
  },
};
