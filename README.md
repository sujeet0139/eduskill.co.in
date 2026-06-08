# eduskill.co.in — Backend API

Express + MySQL REST API for student registration, payments, study materials,
courses, certificates and admin management. Deployed as a serverless function on
Vercel with a managed MySQL database and Cloudinary for file storage.

## Stack
- Node.js (>= 18), Express 4
- MySQL (managed, TLS) via `mysql2`
- JWT auth (`jsonwebtoken`) + bcrypt password hashing
- File uploads via Cloudinary in production, local disk in development
- Email via Nodemailer (SMTP)

## Project structure
```
server.js              Express app (exports app; listens only when run directly)
config/db.js           MySQL connection pool (port + TLS aware)
config/storage.js      Upload storage: Cloudinary (prod) / disk (dev)
routes/                API route modules (students, auth, payments, ...)
middleware/            authMiddleware (requireAdmin)
lib/                   encryption helper
scripts/seed-admin.js  Create/update an admin user
check-db.js            Create schema + seed colleges
vercel.json            Vercel @vercel/node build config
```

## Local development
```bash
cp .env.example .env      # then fill in real values
npm install
npm run db:setup          # create tables + seed colleges
npm run seed:admin        # create the admin login (uses ADMIN_* in .env)
npm run dev               # http://localhost:5000/health
```

## Environment variables
See [.env.example](.env.example). Required in production: `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`, `JWT_SECRET`, `CLOUDINARY_URL`,
and the `SMTP_*` values. **Never commit the real `.env`.**

## Deployment (Vercel)
The repo deploys as a serverless function (`vercel.json` routes all traffic to
`server.js`). Configure the environment variables above in the Vercel project
settings, then deploy. The database schema must be created once against the
managed MySQL instance (`npm run db:setup` from a machine that can reach it).

## Notes / follow-ups
- `multer` is pinned to 1.x because `multer-storage-cloudinary` requires it.
- Local-disk uploads do not persist on Vercel; production must set `CLOUDINARY_URL`.
- The frontend is a separate Next.js app (not in this repo).
