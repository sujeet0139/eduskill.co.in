# eduskill.co.in — Frontend

Next.js 14 (App Router) + Tailwind CSS. Talks to the eduskill backend API.

## Pages
- `/` landing (lists live courses)
- `/register` student registration → returns a reference number
- `/login` student login (email + reference number)
- `/dashboard` student dashboard (status, payment upload, materials, courses)
- `/admin/login` admin login
- `/admin` admin dashboard + Students / Payments / Courses / Programs
  - (Colleges, Materials, Certificates, Announcements, Admins, Settings: to be added later)

## Configuration
Set the API base URL via env var (see [.env.example](.env.example)):
```
NEXT_PUBLIC_API_URL=https://api.eduskill.co.in
```

## Local development
```bash
cp .env.example .env.local   # point at http://localhost:3003 for local backend
npm install
npm run dev                  # http://localhost:3000
```

## Deploy on Vercel
- Connect this repo to the Vercel project.
- **Root Directory: `frontend`**
- Environment variable: `NEXT_PUBLIC_API_URL = https://api.eduskill.co.in`
- Framework preset: Next.js (auto-detected). Deploy.
