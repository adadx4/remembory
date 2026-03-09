import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req, context) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  // Code comes from either the path param (via redirect) or the URL segment
  const code = context.params?.code || new URL(req.url).pathname.split("/").pop();

  if (!code || code.length < 4) {
    return new Response(JSON.stringify({ error: "Invalid code" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const store = getStore("shares");
  const entry = await store.get(code, { type: "json" });

  if (!entry) {
    return new Response(JSON.stringify({ error: "Not found or already collected" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  // Check if this is a browser request (share link clicked) vs Chronicle fetching
  // Browser requests get the landing page; Chronicle gets the raw JSON
  const acceptsHtml = req.headers.get("Accept")?.includes("text/html");
  const isChronicleRequest = req.headers.get("X-Chronicle-Client") === "1"
    || !acceptsHtml;

  if (!isChronicleRequest) {
    // Serve a friendly landing page for recipients who don't have Chronicle
    const memCount = entry.memories?.length ?? 0;
    const senderName = entry.sharedBy ?? "Someone";
    const message = entry.message ? `<p class="message">"${entry.message}"</p>` : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${senderName} shared ${memCount === 1 ? "a memory" : `${memCount} memories`} with you</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f5f0e8; font-family: 'Crimson Text', Georgia, serif; color: #2c2416; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border: 1px solid #d4c4a8; border-radius: 6px; padding: 40px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(44,36,22,0.08); }
    .envelope { font-size: 3rem; margin-bottom: 16px; }
    h1 { font-family: 'Playfair Display', serif; font-size: 1.6rem; margin-bottom: 8px; color: #1a1208; }
    .sub { color: #8a7460; font-style: italic; margin-bottom: 20px; font-size: 1.05rem; }
    .message { background: #f5f0e8; border-left: 3px solid #c8a87a; padding: 12px 16px; margin: 16px 0 24px; font-style: italic; font-size: 1.05rem; text-align: left; border-radius: 0 4px 4px 0; }
    .btn { display: inline-block; background: #2c2416; color: #f5f0e8; padding: 14px 32px; border-radius: 3px; text-decoration: none; font-family: 'Crimson Text', serif; font-size: 1.05rem; font-weight: 600; letter-spacing: 0.03em; transition: background 0.15s; }
    .btn:hover { background: #1a1208; }
    .note { margin-top: 20px; font-size: 0.82rem; color: #b0a08a; font-style: italic; }
    .memories { display: flex; flex-direction: column; gap: 8px; margin: 16px 0 24px; text-align: left; }
    .memory-item { padding: 10px 14px; background: #f5f0e8; border-radius: 3px; border: 1px solid #e0d4be; }
    .memory-title { font-family: 'Playfair Display', serif; font-size: 0.95rem; color: #1a1208; }
    .memory-year { font-size: 0.82rem; color: #8a7460; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="envelope">✉</div>
    <h1>${senderName} shared ${memCount === 1 ? "a memory" : `${memCount} memories`} with you</h1>
    <p class="sub">via Chronicle · Remembory</p>
    ${message}
    <div class="memories">
      ${(entry.memories || []).map(m => `
        <div class="memory-item">
          <div class="memory-title">${m.title || "Untitled"}</div>
          ${m.year ? `<div class="memory-year">${m.year}</div>` : ""}
        </div>
      `).join("")}
    </div>
    <a href="https://remembory.netlify.app/?share=${code}" class="btn">Open in Chronicle</a>
    <p class="note">You'll be able to save ${memCount === 1 ? "this memory" : "these memories"} to your own Chronicle.<br>No account needed.</p>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html;charset=utf-8", ...CORS },
    });
  }

  // Chronicle client — return the JSON payload and delete it (collected!)
  await store.delete(code);

  return new Response(JSON.stringify(entry), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const config = {
  path: ["/fetch/:code", "/s/:code"],
};
