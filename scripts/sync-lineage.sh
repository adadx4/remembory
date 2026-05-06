#!/usr/bin/env bash
# Keep lineage.html in lock-step with chronicle.html.
# Lineage and Chronicle share the same code; they're served at different URLs so
# the in-page URL detection can pick the right product flag. GitHub Pages can't
# rewrite URLs to point two paths at one file, so we keep two physical files.
# Run this before committing any chronicle.html change that should also ship to
# Lineage (which is essentially every change).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
cp "$ROOT/chronicle.html" "$ROOT/lineage.html"
echo "lineage.html ← chronicle.html"
