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
else
  echo "==> Skipping build (--skip-build)"
fi

echo "==> Deploying to Firebase Hosting..."
$FIREBASE deploy --only hosting

echo ""
echo "==> Done. Live URLs:"
$FIREBASE hosting:channel:list 2>/dev/null | grep -i "live" || \
  echo "    https://absurdalpha.web.app  |  https://absurdalpha.firebaseapp.com"
