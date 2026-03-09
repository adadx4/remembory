import { getStore } from "@netlify/blobs";
import { randomBytes } from "crypto";

// Generate a short, URL-safe code (6 chars, ~68 billion combinations)
function generateCode() {
  return randomBytes(4).toString("base64url").slice(0, 6);
}

export default async function handler(req, context) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Basic validation
  if (!payload.memories || !Array.isArray(payload.memories) || payload.memories.length === 0) {
    return new Response(JSON.stringify({ error: "No memories provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!payload.sharedBy || typeof payload.sharedBy !== "string") {
    return new Response(JSON.stringify({ error: "sharedBy is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Size guard — reject payloads over 4MB (photos can be large)
  const raw = JSON.stringify(payload);
  if (raw.length > 4 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: "Payload too large. Try sharing fewer or smaller photos." }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Generate a unique code (retry on collision, though extremely unlikely)
  const store = getStore("shares");
  let code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCode();
    const existing = await store.get(candidate);
    if (!existing) { code = candidate; break; }
  }

  if (!code) {
    return new Response(JSON.stringify({ error: "Could not generate unique code, please try again" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Store with 30-day expiry
  const entry = {
    ...payload,
    sharedAt: new Date().toISOString(),
    collected: false,
  };

  await store.setJSON(code, entry, {
    metadata: { sharedAt: entry.sharedAt },
    // Netlify Blobs TTL (seconds) — 30 days
    ttl: 60 * 60 * 24 * 30,
  });

  const shareUrl = `${new URL(req.url).origin}/s/${code}`;

  return new Response(JSON.stringify({ url: shareUrl, code }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const config = {
  path: "/share",
};
