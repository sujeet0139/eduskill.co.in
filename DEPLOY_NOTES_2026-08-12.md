# Deploy notes — office-laptop session, 2026-08-12

Branch: `fix/p0-add-student-hang-and-student-view` (18 commits on top of `main`, not pushed anywhere — this laptop never touched origin or the production server).

Read this before you merge/deploy from home. It's the "what changed, what to run, what to check" doc — the individual commit messages have the full reasoning for each change if you want more detail (`git log main..fix/p0-add-student-hang-and-student-view`).

---

## 1. Deploy steps (home machine)

```bash
git fetch origin
git checkout main && git pull
git merge fix/p0-add-student-hang-and-student-view
npm install                       # picks up the new `qrcode` dependency (root package.json)
npm run build --prefix frontend    # this laptop could NOT run this — see §4. Do it here first.
git push origin main
```

Then your normal server deploy (`ssh` → `git fetch origin && git reset --hard origin/main && bash deploy-server.sh`). `deploy-server.sh` already runs `npm install --omit=dev` and `node check-db.js` as part of its own steps — no extra manual commands needed on the server itself.

## 2. What's in this branch

**Priority 0 (dev-prompt items #1–#10):** all fixed — Add Student / student-detail hangs (root cause: no SMTP timeout + a connection-pool leak later found to be repo-wide), registration UX, password/mobile validation hints, duplicate-phone check, login rate-limiting, legacy-password migration, admin-configurable SMS/WhatsApp notifications.

**Systemic fix:** every route file in `routes/` had the same connection-leak bug (`const connection` declared inside `try`, so `catch` could never release it on error — exhausts the 10-connection pool, everything hangs). Fixed in all 28 files.

**Priority 1 (items #11–#20):** expanded student profile fields, education history, Program→Track→Course hierarchy, server-side search/filter/sort/pagination on the student list, automatic Guest→Enrolled status (now correctly fires on all 3 payment paths — wallet-instant, admin-approved, and manual/offline), Active/Inactive toggle.

**Priority 2 (items #21, #23–#28, #30):** college form rebuild (State→District cascade, university/logo/HOD fields), bulk-import with a real validate-before-commit flow, shared image-upload component, dedicated bulk course-mapping screen with an audit log, faculty portal (profile/attendance/materials — this one also fixed a real architecture gap: batches had no link to the `teachers` login table at all before this), staff/admin forgot-password, "Image Upload" form-builder field type.

**Campaign links** (`eduskill-campaign-admin-prompt.md`, sections 1–7): a new, fully separate feature — shareable pre-filled registration links for college visits/events. Public 4-step flow at `/c/[slug]`, self-hosted short links at `/s/[code]`, full admin builder at `/admin/campaigns`. Not part of the original numbered dev-prompt.

**Post-session fix:** found and corrected 3 table-creation-ordering bugs in `check-db.js` (new tables/columns whose foreign keys pointed at tables created later in the same script). Zero effect on your production DB tonight — those tables already exist there — but would have broken a from-scratch database setup. Fixed regardless.

## 3. New dependency

`qrcode` (root `package.json`) — generates campaign QR codes server-side. Installed automatically by `npm install`, nothing else to configure.

No new required environment variables. `FRONTEND_URL` (already in your `.env`) is reused for building campaign/short-link URLs.

## 4. What I could NOT verify from this laptop

The office network's TLS interception blocks `next/font`'s Google Fonts fetch, so `npm run build` in `frontend/` fails here for reasons unrelated to any of this code. Every frontend file was checked by careful manual review plus a brace/paren balance script, **not an actual compile**. Run `npm run build --prefix frontend` at home — first thing, before merging further or deploying — and treat any error it surfaces as something to fix, not a sign this doc undersold the risk.

## 5. Manual (non-code) steps after deploy

- **Item #8 typo**: Admin → Settings → Registration Form → fix the WhatsApp field label ("Whatup no*" → "WhatsApp No*"). Content, not code.
- **Item #9 SMS/WhatsApp**: Admin → Settings → SMS/WhatsApp tab → paste your provider's send-URL template (`{phone}`/`{message}` placeholders) once you have one. Everything works without it (safe no-op), this just turns it on.
- **Campaigns**: create at least one via Admin → Campaign Links → New Campaign to sanity-check the whole flow end to end (see checklist below).

## 6. Verification checklist

Run through these after deploy, roughly in order of blast radius:

1. **Nothing broke**: log in as admin, open the student list, open a student's detail view. (These were the two original P0 bugs — if either hangs, the connection-leak fix didn't take.)
2. **Add Student** still resolves within 15s (with a deliberately broken SMTP config if you want to stress-test the timeout, or just normally).
3. **Student list**: filters (status/enrollment/active/program), search, pagination, sort — all combine without a page reload.
4. **Bulk import**: download the sample sheet, upload it, confirm Validate shows a report before Confirm Import is clickable.
5. **Colleges**: create/edit one with the new State→District cascade, university dropdown, logo upload, HOD add/remove.
6. **Course mapping**: `/admin/mapping` — select 2+ students, map to a course, confirm the audit log entry appears.
7. **Faculty portal**: log in as a teacher assigned to a batch (`batches.teacher_id` — set this via Admin → Batches → Teacher dropdown first), confirm My Batches shows it, mark attendance for a session, upload a material.
8. **Payments**: confirm a wallet-covered instant enrollment AND an admin-approved payment both flip the student to "Enrolled" (not just one of the two paths, which was a bug I found and fixed this session).
9. **Campaigns** (new feature, most likely to have something to shake out):
   - Create a campaign targeting an existing course/batch.
   - Open `/c/{slug}` in an incognito window — confirm the landing page, complete registration, confirm the created student shows up in the admin student list with the campaign's college/course pre-set.
   - Generate a short link, confirm `/s/{code}` redirects correctly.
   - Download the QR PNG, confirm it scans to the right URL.
   - Check the Funnel tab shows the link-open count incrementing.
   - Clone the campaign, confirm the clone has its own new slug and copied content.
10. **Staff forgot-password**: Admin login page → Forgot password → confirm the email arrives and the reset link works.

## 7. Rollback

Everything is on the feature branch until you merge it into `main` and push. If something in the checklist above fails badly after deploy: `git log` on the server to find the commit before this merge, `git reset --hard <that-commit>`, redeploy. The schema migrations are all additive (new tables/columns, `IF NOT EXISTS`/`runAlterIfMissing`-guarded) — nothing here drops or renames existing columns, so rolling back the *code* while leaving the new (unused) columns/tables in place is safe and doesn't need a DB rollback.
