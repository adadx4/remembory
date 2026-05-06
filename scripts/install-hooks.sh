#!/usr/bin/env bash
# Install the versioned git hooks from scripts/hooks/ into .git/hooks/.
# Run once after cloning the repo to a new machine.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
SRC="$ROOT/scripts/hooks"
DST="$ROOT/.git/hooks"
for hook in "$SRC"/*; do
  name="$(basename "$hook")"
  cp "$hook" "$DST/$name"
  chmod +x "$DST/$name"
  echo "installed: $name"
done
