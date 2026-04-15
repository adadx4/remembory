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

# Copy all static files except src/, scripts/, dist/, wrangler.toml
rsync -av \
  --exclude=src/ \
  --exclude=scripts/ \
  --exclude=dist/ \
  --exclude=wrangler.toml \
  --exclude=package.json \
  --exclude=README.md \
  "$ROOT/" "$DIST/"

# Swap the worker URL in chronicle.html
STAGING_WORKER="https://staging.remembory.net"
PROD_WORKER="https://social.remembory.net"
SHARE_PROD="https://share.remembory.net"

sed -i \
  -e "s|const WORKER_URL = \"$PROD_WORKER\"|const WORKER_URL = \"$STAGING_WORKER\"|g" \
  -e "s|$SHARE_PROD|$STAGING_WORKER|g" \
  "$DIST/chronicle.html"

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
