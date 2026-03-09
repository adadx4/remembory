# Remembory — Netlify Backend

This folder contains the Netlify Functions that power Chronicle's share link feature.

## Structure

```
netlify.toml                  ← Netlify config (functions path, redirects, CORS headers)
netlify/functions/
  share.mjs                   ← POST /share  — stores a payload, returns a short link
  fetch.mjs                   ← GET  /s/:code — serves landing page or JSON to Chronicle
```

## How it works

1. **Sender** clicks Share in Chronicle → app POSTs encrypted payload to `/share`
2. Server stores it in **Netlify Blobs** with a 30-day TTL, returns a short URL like `https://remembory.netlify.app/s/abc123`
3. Sender pastes the link anywhere (iMessage, WhatsApp, email, etc.)
4. **Recipient** clicks the link:
   - **Browser** → sees a friendly landing page listing the memories, with an "Open in Chronicle" button
   - **Chronicle app** → fetches the raw JSON via `X-Chronicle-Client: 1` header, payload is deleted immediately after collection

## Deploying

### 1. Connect your repo to Netlify
- Push this folder to GitHub (or drag-drop to Netlify)
- In Netlify dashboard: Site settings → Build & deploy → point to this repo

### 2. Enable Netlify Blobs
Blobs are enabled automatically on Netlify — no configuration needed.
The store named `"shares"` is created on first use.

### 3. Deploy
```bash
netlify deploy --prod
```
Or just push to main if you have continuous deployment set up.

### 4. Update chronicle.html
`WORKER_URL` is already set to `https://remembory.netlify.app` in the updated chronicle.html.

## Environment
No environment variables required. Netlify Blobs uses your site's credentials automatically.

## Free tier limits
- Functions: 125,000 invocations/month
- Blobs: 5GB storage, 50GB bandwidth/month
- More than enough for personal use.
