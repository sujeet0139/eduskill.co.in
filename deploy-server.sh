#!/usr/bin/env bash
# ===== EduSkill: deploy ON THE VPS (frontend + backend on one server) =====
# Run this from the project root on your server:  bash deploy-server.sh
set -e
cd "$(dirname "$0")"

echo "==> 1/5  Pulling latest code from GitHub"
git pull origin main

echo "==> 2/5  Backend dependencies"
npm install

echo "==> 3/5  Applying database migrations (safe/idempotent)"
node check-db.js || echo "   (check-db reported an issue — review above)"

echo "==> 4/5  Building the frontend"
cd frontend
npm install
npm run build
cd ..

echo "==> 5/5  Restarting apps"
# Adjust the process names to match your pm2 setup (see: pm2 list).
# Defaults try common names, then fall back to restarting everything.
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart eduskill-backend eduskill-frontend --update-env 2>/dev/null \
    || pm2 restart all --update-env
  pm2 save || true
else
  echo "   pm2 not found. Restart your backend (node server.js) and frontend (npm start) manually."
fi

echo "==> Done. Check https://eduskill.co.in and https://api.eduskill.co.in/health"
