# EduSkill — Production Deploy Guide

> ⚠️ **Deploy from home / a non-corporate network.** The office Zscaler proxy
> breaks Vercel's certificate + alias step (`Issuing a certificate -> Response Error`)
> and blocks `*.vercel.app`. Cloud deploy will not work behind Zscaler.

## Production topology (verified 2026-06-30)

| Tier | Vercel project | Domain | How it deploys |
|------|----------------|--------|----------------|
| Frontend (Next.js, `frontend/`) | `eduskill-co-in` | `eduskill.co.in` | **`git push origin main`** → auto-builds |
| Backend (Express, repo root) | `intershiop` | `api.eduskill.co.in` | `vercel --prod` + alias the domain |

Both run on Vercel (the backend is a serverless function — see `server.js`).
There is **no** VPS / pm2 anymore.

## One-time setup on your home laptop

1. Get the code (it's already on GitHub):
   ```bash
   git clone https://github.com/sujeet0139/eduskill.co.in.git
   cd eduskill.co.in
   npm install
   ```
2. Copy your **`.env`** into the repo root (it is git-ignored, so it is NOT in the
   clone). It must contain the **production** DB credentials, JWT secret, SMTP,
   Cloudinary keys, etc. (see `.env.example` for the list).
3. Log in to Vercel once:
   ```bash
   npx vercel login
   ```
   Use the account that owns the `eduskill-co-in` / `intershiop` projects
   (`sujeet0139-...`).

## Deploy (every time)

```bash
git pull            # get the latest code
npm run deploy      # = node deploy.js
```

`deploy.js` will:
1. `git push origin main` → frontend auto-deploys
2. `vercel --prod` → backend deploys
3. alias `api.eduskill.co.in` → the new backend deployment
4. `npm run db:setup` → apply any DB migrations
5. smoke-test `/health`, `/api/public/registration-form`, and `/register`

### Useful flags
```bash
node deploy.js --yes           # no confirm prompt
node deploy.js --backend-only  # only backend deploy + alias
node deploy.js --skip-db       # don't touch the database
node deploy.js --skip-push     # don't redeploy the frontend
```

## Verify it worked

```bash
curl https://api.eduskill.co.in/health
curl https://api.eduskill.co.in/api/public/registration-form
```
The second must return `{"success":true,"fields":[...]}` — if it says
`Cannot GET`, the backend alias did not switch over (re-run step 2–3 off Zscaler).

## Recommended one-time fix (kills the flaky alias step forever)

In the **Vercel dashboard → project `intershiop` → Settings → Domains**, add
`api.eduskill.co.in` as a **Production** domain (and set DNS `A api 76.76.21.21`
at GoDaddy if Vercel flags it). After that, `vercel --prod` assigns the domain
automatically and you can drop the alias step.

## Manual fallback (if the script ever fails mid-way)

```bash
# frontend
git push origin main

# backend
npx vercel --prod --yes
# copy the printed https://intershiop-XXXX.vercel.app URL, then:
npx vercel alias set https://intershiop-XXXX....vercel.app api.eduskill.co.in

# database (only when schema changed)
npm run db:setup
```
