#!/usr/bin/env bash
#
# Build the app and deploy it to Firebase Hosting.
# Usage: ./scripts/deploy.sh [--skip-build]
#
set -euo pipefail

cd "$(dirname "$0")/.."

SKIP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

# Resolve the Firebase CLI: prefer a global install, fall back to npx.
if command -v firebase >/dev/null 2>&1; then
  FIREBASE="firebase"
else
  FIREBASE="npx --yes firebase-tools"
fi

if [ "$SKIP_BUILD" = false ]; then
  echo "==> Building production bundle..."
  npm run build
  echo "==> Building Harbor into dist/harbor..."
  npm run build:harbor
  echo "==> Building the Ledgerline demo into dist/ledgerline..."
  npm run build:ledgerline
else
  echo "==> Skipping build (--skip-build)"
fi

# `npm run build` empties dist/, so a gallery-only rebuild drops the separately built apps.
# Refuse to deploy a dist/ that would take them offline.
for required in dist/index.html dist/harbor/shell/index.html dist/ledgerline/index.html; do
  if [ ! -f "$required" ]; then
    echo "Missing $required. Run a full deploy (npm run deploy) so every app is built." >&2
    exit 1
  fi
done

echo "==> Deploying to Firebase Hosting..."
$FIREBASE deploy --only hosting

echo ""
echo "==> Done. Live URLs:"
$FIREBASE hosting:channel:list 2>/dev/null | grep -i "live" || \
  echo "    https://absurdalpha.web.app  |  https://absurdalpha.firebaseapp.com"
