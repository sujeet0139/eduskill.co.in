# EduSkill — How to Deploy (Home Laptop Guide)

> ⚠️ **Deploy from HOME Wi‑Fi or a mobile hotspot.** The office Zscaler proxy
> blocks Vercel and the deploy will fail. Cloud deploy only works off Zscaler.

There are two ways to deploy. **Easiest = double-click the `.bat` files.**

---

## A. Easiest way — double-click (Windows)

### One-time setup (do once on the home laptop)
1. Install **Node.js**: https://nodejs.org (LTS version) and **Git**: https://git-scm.com
2. Get the project (pick ONE):
   - **Git (recommended):** open a terminal and run
     ```
     git clone https://github.com/sujeet0139/eduskill.co.in.git
     ```
   - **Manual copy:** copy the whole project folder from your office PC to the
     home laptop via USB/Drive. **Also copy the hidden `.env` file** (it is not
     included in Git). Then in the folder run `npm install`.
3. Put your **`.env`** file in the project root (production DB, SMTP, Cloudinary,
   JWT keys — see `.env.example` for the list). This file is secret and is never
   in Git, so you must copy it yourself.
4. Double-click **`setup.bat`** — it installs everything and logs you into Vercel
   (a browser opens; log in as the account that owns the Vercel projects).

### Every time you want to deploy
- Double-click **`deploy.bat`**.
  It pulls the latest code, deploys the backend, points `api.eduskill.co.in` at
  it, updates the database, and runs a health check. Read the messages at the end.

That's it. ✅

---

## B. Command way (any OS)

```bash
# one-time
git clone https://github.com/sujeet0139/eduskill.co.in.git
cd eduskill.co.in
npm install
npx vercel login          # log in as the project owner
# copy your .env file into this folder

# every deploy
git pull
npm run deploy            # = node deploy.js
```

### Deploy flags
```bash
node deploy.js --yes           # skip the confirm prompt
node deploy.js --backend-only  # only redeploy the API
node deploy.js --skip-db       # don't touch the database
```

---

## What the deploy does (so you know it's safe)

| Step | Action |
|------|--------|
| 1 | `git push` → **frontend** auto-builds on Vercel (`eduskill.co.in`) |
| 2 | `vercel --prod` → **backend** deploys (project `intershiop`) |
| 3 | aliases **`api.eduskill.co.in`** to the new backend |
| 4 | `npm run db:setup` → applies new DB columns safely (no data loss) |
| 5 | health-checks the API + site |

## Check it worked
Open these in a browser (should NOT say "Cannot GET"):
- https://api.eduskill.co.in/health → `{"database":"Connected"}`
- https://api.eduskill.co.in/api/public/registration-form → `{"success":true,...}`
- https://eduskill.co.in/register → the registration form loads

---

## One-time fix to make deploys painless (optional but recommended)
In the **Vercel dashboard → project `intershiop` → Settings → Domains**, add
`api.eduskill.co.in` as a **Production** domain. After that you can skip the alias
step and even auto-deploy the backend from Git like the frontend.

## If something fails
- "Issuing a certificate → Response Error" → you're on Zscaler/office network.
  Switch to home Wi-Fi / hotspot and run again.
- DB step fails → make sure `.env` points at the **production** database.
- Manual fallback commands are in the "B. Command way" section above.
