# Remembory Share Worker — Cloudflare Deployment

## What this is
A tiny Cloudflare Worker that lets Chronicle users share memories via a short link.
- `POST /share` — stores a payload, returns a short URL
- `GET /s/:code` — serves a landing page to browsers, raw JSON to Chronicle

Data is stored in Cloudflare KV with a 30-day TTL and deleted after collection.

---

## One-time setup

### 1. Install Wrangler (Cloudflare's CLI)
```bash
npm install -g wrangler
```

### 2. Log in to Cloudflare
```bash
wrangler login
```
This opens a browser window — log in with your Cloudflare account.

### 3. Create the KV namespace
```bash
wrangler kv namespace create SHARES
```
This prints something like:
```
{ binding = "SHARES", id = "abc123def456..." }
```
Copy that `id` value.

### 4. Paste the KV id into wrangler.toml
Open `wrangler.toml` and replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` with the id from step 3.

### 5. Deploy
```bash
wrangler deploy
```
Wrangler will print your Worker URL, something like:
```
https://remembory-share.YOUR-SUBDOMAIN.workers.dev
```

---

## Update chronicle.html

Find this line near the top of `chronicle.html`:
```js
const WORKER_URL = "https://remembory.netlify.app";
```
Change it to your Worker URL:
```js
const WORKER_URL = "https://remembory-share.YOUR-SUBDOMAIN.workers.dev";
```

Then re-deploy `chronicle.html` to wherever you host it (GitHub Pages, Netlify static, etc).

---

## Custom domain (optional)
If you want share links to say `remembory.app/s/abc123` instead of the workers.dev URL,
add a custom domain in the Cloudflare Workers dashboard under your worker → Settings → Domains.

---

## Free tier limits
Cloudflare Workers free tier includes:
- 100,000 requests/day
- Unlimited bandwidth
- KV: 100,000 reads/day, 1,000 writes/day

For personal use this is effectively unlimited.
