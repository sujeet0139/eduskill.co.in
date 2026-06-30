#!/usr/bin/env node
/**
 * EduSkill production deploy.
 *
 * ⚠️  RUN FROM A NON-CORPORATE NETWORK (home Wi-Fi / hotspot / VPN off).
 *     A Zscaler-style proxy breaks Vercel's certificate/alias call
 *     ("Issuing a certificate -> Response Error") and blocks *.vercel.app.
 *
 * Verified production topology (2026-06-30):
 *   • Frontend  = Vercel project "eduskill-co-in"  -> eduskill.co.in
 *                 Deploys AUTOMATICALLY on `git push origin main`. No CLI.
 *   • Backend   = Vercel project "intershiop" (repo root, Express serverless)
 *                 Deploy with `vercel --prod`, then alias api.eduskill.co.in
 *                 to the new deployment URL (Vercel does NOT do this for us).
 *
 * What this script does:
 *   1. git push origin main      -> frontend auto-deploys
 *   2. npx vercel --prod         -> backend deploys
 *   3. npx vercel alias set ...  -> api.eduskill.co.in -> new backend
 *   4. npm run db:setup          -> applies DB migrations (uses .env)
 *   5. smoke test                -> /health + /api/public/registration-form
 *
 * Usage:
 *   node deploy.js                 # full deploy (asks once to confirm)
 *   node deploy.js --yes           # no confirmation prompt
 *   node deploy.js --skip-push     # don't git push (skip frontend redeploy)
 *   node deploy.js --skip-db       # don't run DB migrations
 *   node deploy.js --backend-only  # only steps 2-3 (no push, no db)
 *
 * Prerequisites on the laptop you run this from:
 *   • `npx vercel login`  (once) — logged in as the account owning the projects
 *   • a local `.env` with the PRODUCTION DB creds (needed for --skip-db off)
 */

const { execSync } = require('child_process');
const https = require('https');
const readline = require('readline');

const BACKEND_DOMAIN = 'api.eduskill.co.in';
const FRONTEND_URL = 'https://eduskill.co.in';
const API_BASE = `https://${BACKEND_DOMAIN}`;

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const YES = flag('--yes');
const BACKEND_ONLY = flag('--backend-only');
const SKIP_PUSH = flag('--skip-push') || BACKEND_ONLY;
const SKIP_DB = flag('--skip-db') || BACKEND_ONLY;

function run(command, opts = {}) {
  console.log(`\n▶  ${command}`);
  return execSync(command, { encoding: 'utf-8', stdio: ['inherit', 'pipe', 'inherit'], ...opts });
}

function runInherit(command, opts = {}) {
  console.log(`\n▶  ${command}`);
  return execSync(command, { stdio: 'inherit', ...opts });
}

function ask(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (ans) => { rl.close(); resolve(ans); }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pull the new backend deployment URL out of `vercel --prod` stdout.
// Prefer the hashed "intershiop-<hash>-<team>.vercel.app" deployment URL,
// not the clean "intershiop.vercel.app" alias.
function parseDeploymentUrl(output) {
  if (!output) return null;
  const hashed = output.match(/https:\/\/intershiop-[a-z0-9-]+\.vercel\.app/i);
  if (hashed) return hashed[0];
  const any = output.match(/https:\/\/[a-z0-9-]+\.vercel\.app/i);
  return any ? any[0] : null;
}

function httpJson(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch { /* not json */ }
        resolve({ status: res.statusCode, body, json });
      });
    }).on('error', (e) => resolve({ status: 0, body: e.message, json: null }));
  });
}

async function aliasWithRetry(deploymentUrl, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      runInherit(`npx vercel alias set ${deploymentUrl} ${BACKEND_DOMAIN}`);
      return true;
    } catch (e) {
      console.warn(`   ⚠️  alias attempt ${i}/${attempts} failed.`);
      if (i < attempts) await sleep(5000);
    }
  }
  return false;
}

async function smokeTest() {
  console.log('\n🔥 Smoke testing production...');
  const health = await httpJson(`${API_BASE}/health`);
  const okHealth = health.json && health.json.database === 'Connected';
  console.log(`   ${okHealth ? '✓' : '✗'} ${API_BASE}/health -> ${health.status} ${health.json ? `(db: ${health.json.database})` : ''}`);

  const reg = await httpJson(`${API_BASE}/api/public/registration-form`);
  const okReg = reg.json && reg.json.success === true;
  console.log(`   ${okReg ? '✓' : '✗'} ${API_BASE}/api/public/registration-form -> ${reg.status} ${okReg ? `(${reg.json.fields.length} fields)` : '(NOT the new code yet)'}`);

  const front = await httpJson(`${FRONTEND_URL}/register`);
  console.log(`   ${front.status === 200 ? '✓' : '✗'} ${FRONTEND_URL}/register -> ${front.status}`);

  return okHealth && okReg;
}

async function main() {
  console.log('🚀 EduSkill Production Deploy\n');
  console.log('⚠️  Run this OFF any corporate proxy (Zscaler) or the alias step will fail.\n');

  if (!YES) {
    const ans = await ask('Deploy to PRODUCTION now? (y/n) ');
    if (ans.trim().toLowerCase() !== 'y') { console.log('Cancelled.'); process.exit(0); }
  }

  // Step 1 — Frontend via git push (auto-builds the eduskill-co-in project)
  if (!SKIP_PUSH) {
    console.log('\n=== 1/5  Frontend: git push (auto-deploys eduskill.co.in) ===');
    runInherit('git push origin main');
  } else {
    console.log('\n=== 1/5  Skipped git push ===');
  }

  // Step 2 — Backend deploy
  console.log('\n=== 2/5  Backend: vercel --prod (project: intershiop) ===');
  const out = run('npx vercel --prod --yes');
  process.stdout.write(out);
  const deploymentUrl = parseDeploymentUrl(out);
  if (!deploymentUrl) {
    console.error('\n❌ Could not parse the backend deployment URL from Vercel output.');
    console.error('   Deploy succeeded but you must alias manually:');
    console.error(`   npx vercel alias set <deployment-url> ${BACKEND_DOMAIN}`);
    process.exit(1);
  }
  console.log(`\n   ✓ Backend deployed: ${deploymentUrl}`);

  // Step 3 — Alias custom domain
  console.log(`\n=== 3/5  Alias ${BACKEND_DOMAIN} -> new backend ===`);
  const aliased = await aliasWithRetry(deploymentUrl);
  if (!aliased) {
    console.error(`\n❌ Aliasing failed (cert/proxy issue). Run this from a clean network:`);
    console.error(`   npx vercel alias set ${deploymentUrl} ${BACKEND_DOMAIN}`);
    console.error('   Tip: add api.eduskill.co.in as a Production domain on the "intershiop"');
    console.error('   project in the Vercel dashboard ONCE, then future deploys auto-assign it.');
    process.exit(1);
  }
  console.log('   ✓ Alias set.');

  // Step 4 — DB migrations
  if (!SKIP_DB) {
    console.log('\n=== 4/5  Database migrations (npm run db:setup) ===');
    try {
      runInherit('npm run db:setup');
    } catch (e) {
      console.warn('   ⚠️  db:setup failed. Check your .env points at the PRODUCTION DB.');
    }
  } else {
    console.log('\n=== 4/5  Skipped DB migrations ===');
  }

  // Step 5 — Smoke test
  console.log('\n=== 5/5  Smoke test ===');
  console.log('   waiting 20s for the alias/cert to propagate...');
  await sleep(20000);
  const ok = await smokeTest();

  console.log(ok
    ? '\n🎉 Deploy complete and verified.'
    : '\n⚠️  Deploy finished but smoke test did not fully pass — re-check the items marked ✗ above.');
}

main().catch((e) => { console.error(e); process.exit(1); });
