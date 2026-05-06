#!/usr/bin/env bash
# Build staging assets and deploy to staging.remembory.net
# Usage: bash scripts/build-staging.sh [--dry-run]
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
DIST="$ROOT/dist"

echo "Building staging assets…"

# Clean and recreate dist/
rm -rf "$DIST"
mkdir -p "$DIST"

# Copy static assets to dist/ (explicit list avoids rsync dependency on Windows)
cp "$ROOT/chronicle.html" "$DIST/"
cp "$ROOT/chronicle.css" "$DIST/"
cp "$ROOT/index.html" "$DIST/"
cp "$ROOT/manual.html" "$DIST/"
cp "$ROOT/tips.html" "$DIST/"
cp "$ROOT/research.html" "$DIST/"
cp "$ROOT/sw.js" "$DIST/"
cp "$ROOT/manifest.json" "$DIST/"
cp "$ROOT/favicon.ico" "$DIST/"
cp "$ROOT/favicon-96x96.png" "$DIST/"
cp "$ROOT/icon-192.png" "$DIST/"
cp "$ROOT/icon-512.png" "$DIST/"
cp "$ROOT/icon-apple.png" "$DIST/"
[ -f "$ROOT/CNAME" ] && cp "$ROOT/CNAME" "$DIST/"

# Copy resources directory (genealogy data)
mkdir -p "$DIST/resources"
cp "$ROOT/resources/genealogy-free-resources.js" "$DIST/resources/"

# Swap the worker URL in chronicle.html
STAGING_WORKER="https://staging.remembory.net"
PROD_WORKER="https://social.remembory.net"
SHARE_PROD="https://share.remembory.net"

sed -i \
  -e "s|const WORKER_URL = \"$PROD_WORKER\"|const WORKER_URL = \"$STAGING_WORKER\"|g" \
  -e "s|$SHARE_PROD|$STAGING_WORKER|g" \
  "$DIST/chronicle.html"

# Rewrite prod URLs in index.html so landing page links stay within staging
sed -i \
  -e "s|$PROD_WORKER|$STAGING_WORKER|g" \
  -e "s|$SHARE_PROD|$STAGING_WORKER|g" \
  "$DIST/index.html"

echo "Staging build written to dist/"
echo "  Worker URL → $STAGING_WORKER"

if [[ "$1" == "--dry-run" ]]; then
  echo "(dry-run — skipping deploy)"
  exit 0
fi

echo ""
echo "Deploying to staging.remembory.net…"
cd "$ROOT"
npx wrangler deploy --env staging

echo ""
echo "Done. https://staging.remembory.net"
