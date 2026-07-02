#!/usr/bin/env bash
# =====================================================================
# EduSkill — one-command deploy ON THE VPS (backend + frontend, one box)
# =====================================================================
# Architecture (real):
#   - Everything runs on this VPS. MySQL is local (127.0.0.1).
#   - pm2 runs "eduskill-api" (Express server.js, PORT from .env, e.g. 3600)
#     and "eduskill-frontend" (Next.js `npm start -p 3601`) from the live
#     release dir that /var/www/eduskill/current points to.
#   - The release dir is a copy of the base repo; .env / .env.local /
#     node_modules / .next / uploads live INSIDE it and are preserved.
#
# Usage on the server:
#   cd /var/www/eduskill && git fetch origin && git reset --hard origin/main && bash deploy-server.sh
#   (after the first run, just: bash /var/www/eduskill/deploy-server.sh)
# =====================================================================
set -euo pipefail

# Re-exec from a stable /tmp copy so the git-reset/rsync below can never
# rewrite this script while it is still running.
if [ "${DEPLOY_REEXEC:-}" != "1" ]; then
  tmp="/tmp/eduskill-deploy.$$.sh"
  cp "$0" "$tmp"
  DEPLOY_REEXEC=1 exec bash "$tmp" "$@"
fi

BASE="/var/www/eduskill"
REL="$(readlink -f "$BASE/current" 2>/dev/null || echo "$BASE")"
API="eduskill-api"
FE="eduskill-frontend"

echo "==> Target live release: $REL"

echo "==> 1/6  Sync base repo to origin/main"
cd "$BASE"
git fetch origin
git reset --hard origin/main
git log --oneline -1

echo "==> 2/6  Copy source into the live release (preserve runtime files)"
rsync -a \
  --exclude=".git" --exclude="node_modules" --exclude=".next" \
  --exclude=".env" --exclude=".env.local" --exclude="uploads" \
  --exclude="releases" --exclude="current" --exclude="*.bak*" \
  "$BASE/" "$REL/"

echo "==> 3/6  Backend dependencies"
cd "$REL"
npm install --omit=dev

echo "==> 4/6  Database migration (idempotent — safe to re-run)"
node check-db.js

echo "==> 5/6  Build frontend"
cd "$REL/frontend"
npm install
npm run build

echo "==> 6/6  Restart apps + health check"
pm2 restart "$API" "$FE" --update-env
pm2 save || true
sleep 4
PORT="$(grep -E '^PORT=' "$REL/.env" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]')"
PORT="${PORT:-3600}"
CODE="$(curl -s -m 10 -o /dev/null -w '%{http_code}' "http://localhost:$PORT/health" || echo 000)"
echo "   API /health (:$PORT) -> $CODE"
if [ "$CODE" = "200" ]; then
  echo "✅ Backend healthy."
else
  echo "⚠️  API health not 200 (got $CODE). Check: pm2 logs $API"
fi

echo "==> Done. Verify: https://eduskill.co.in  and  https://api.eduskill.co.in/health"
