# Deploy notes — 2026-08-13

Branch: `fix/timezone-and-master-prompt-phase1` (12 commits on top of `main`, not pushed anywhere yet — this is the "what changed, what to run, what to check" doc for that branch).

This work is aimed at `eduskill-master-dev-prompt.md` (the current source-of-truth dev prompt, supersedes the older ones). It's a continuation of last night's session (`DEPLOY_NOTES_2026-08-12.md`), which is already merged into `main`.

**You said you're about to share this with real users after tonight's deploy — read section 5 before you do that. Two items there change who can log in and see what.**

---

## 1. Deploy steps (home machine, then server)

```bash
git fetch origin
git checkout main && git pull
git merge fix/timezone-and-master-prompt-phase1
npm install                        # no new dependency this time -- picks up nothing new
npm run build --prefix frontend    # I could NOT run this from this session — see §4. Do it here first.
git push origin main
```

Then your normal server deploy: `ssh` → `cd /var/www/eduskill && git fetch origin && git reset --hard origin/main && bash deploy-server.sh`.

`deploy-server.sh` now has **one new step** since last night: it takes a DB backup (step 1/7, before anything else touches the database) via the new `scripts/backup-db.sh`. On this very first run after merging, that step will print a warning and skip itself once (the live release doesn't have the script yet) — that's expected, not a failure. Every deploy after this one will actually back up first.

## 2. What's in this branch

**Timezone bug (live, found on `/c/rd`):** `config/db.js` had no `timezone` option, so MySQL DATETIME columns were read back using the server's OS timezone instead of IST — a campaign or live-class time entered as 10:00 IST could read back as 15:30 IST, breaking "is this open/started yet?" checks. Fixed by pinning `timezone: '+05:30'` on the pool. Affects both campaign scheduling and live-class scheduling — same pool, same bug.

**States/Districts normalized:** new seeded `states` table (all 28 states + 8 UTs), FK'd `state_id` added to `districts`/`colleges` alongside the existing free-text `state` column (kept for API compatibility). The state dropdown now shows the full India list instead of only states someone happened to add a district for, and existing "bihar"/"BIHAR" casing drift gets normalized to canonical casing automatically.

**RBAC enforced:** `admin_users.role` existed but wasn't checked beyond "is this any admin." `'admin'` is now the elevated tier, `'moderator'` is Admin/Data-Entry-Staff — gated: managing other admin accounts, Settings (read AND write — see the review-pass fix below), and the registration form builder. **See §5 — this needs a manual step before real users touch it.**

**Teacher YouTube-link sharing + batch-targeted materials:** a teacher can now paste a YouTube link instead of only uploading a file, and share it (or a file) scoped to just their own batch, not the whole course. `study_materials` gained `video_url`/`batch_id` columns.

**Syllabus tracking (new):** ordered topics per course, a one-tap teacher checklist per batch, a three-option student self-confirmation tap (Got it / Need revision / Didn't attend), and an automatic SMS/WhatsApp heads-up to the teacher when "need revision" crosses ~30% on a topic (safe no-op if no SMS provider is configured, same as existing notifications).

**Progress dashboard:** new "Progress" tab on the admin student detail page — attendance %, assignment average, syllabus self-confirmation split, all in one place.

**University entity completed:** was name-only with GET/POST only and no admin screen at all. Now has short code/state/website/logo, full CRUD, and a new `/admin/universities` page.

**Admin UX standard rollout:** Materials and Campaigns admin screens gained search/filter/sort/pagination (Colleges/Districts/Universities already had at least search).

**Pre-production code review pass (last commit, `7e8680a`):** before writing this doc I ran a dedicated adversarial review of all the above and fixed several real bugs found in it — most importantly, batch-targeted materials were still leaking to every student in the batch's *course* (not just the target batch) because the insert also tagged them with `course_id`; a race condition could double-send the teacher's 30%-alert SMS; and a couple of state-update endpoints were silently resetting a district/college's real state to "Bihar" on any partial update. Full list in that commit's message.

**Mobile-responsiveness audit:** done as a *code-level desk review* (no browser/device available in that session) — documented in `MOBILE-AUDIT.md`. The admin shell already has a proper mobile drawer nav and every list table scrolls safely inside its own box. Nothing broken found, but it's not the same as someone actually opening it on a phone.

## 3. New dependency

None. (`qrcode`/`node-cron` were last night's addition, already on `main`.)

## 4. What I could NOT verify from this session

Same limitation as last night: `npm run build --prefix frontend` fails in this environment (Google Fonts / TLS). Every frontend file was reviewed by hand — brace/paren balance checked, JSX read line-by-line for every diff — but **not actually compiled**. Run the build at home first, before merging further, and treat any error it surfaces as real.

Backend: every `.js` file touched (18 files across the whole branch) passes `node -c` — syntax-checked after every single edit, not just at the end.

## 5. Manual (non-code) steps after deploy — do these

1. **⚠️ Check every real `admin_users.role` value, right after deploying, before telling anyone to log in.** RBAC now blocks the `'moderator'` role from Settings (including the SMS/WhatsApp provider config), Admin management, and the form builder. If your own or a staff member's account is currently `'moderator'` and needs that access:
   ```sql
   UPDATE admin_users SET role='admin' WHERE email='...';
   ```
   **Then that person must log out and back in** — their existing session token still carries the old role for up to 24h and won't reflect the promotion until they get a fresh one. This is a known limitation (JWT role is stamped at login, not re-checked per request) — see §6 for the proper fix.
2. **Set up the backup cron** — `BACKUPS.md` has the one-liner. Test one restore against a scratch DB before you actually need it.
3. **Add syllabus topics for at least one course** (`Admin → Syllabus`) if you want to demo/test that feature — it's empty until an admin populates it; the teacher checklist and student confirmation UI both show "nothing yet" states until then.
4. **Assign a real teacher to a batch** (`Admin → Batches → Teacher dropdown`) if you haven't already, to exercise the teacher-portal features (materials, syllabus checklist) end to end.

## 6. Verification checklist — run through after deploy

Roughly in order of blast radius. Since this is about to go to real users, this re-covers the original P0/P1/P2 basics too, not just what's new tonight.

1. **Nothing broke:** log in as admin, open the student list, open a student's detail view, open its new **Progress** tab.
2. **Login/RBAC:** log in as an `'admin'`-role account — confirm Settings, Admin Users, and Form Builder all load. If you have (or make) a `'moderator'` test account, confirm it gets a clear "Access denied" on those three, not a crash.
3. **Timezone:** create a campaign with `starts_at` a few minutes in the future (IST), confirm it correctly shows "not open yet" with the **actual open time** displayed, then confirm it flips to open exactly when expected — no 5.5-hour drift either direction. Do the same sanity check on a live-class `scheduled_at`.
4. **States/Districts:** `Admin → Cities/Districts → New City` — confirm the State dropdown shows the full India list, not just Bihar. Create one in a non-Bihar state, confirm it saves and displays correctly.
5. **Universities:** `Admin → Universities` — create one with a logo, edit it, delete it. Confirm it appears in the College form's university dropdown.
6. **Teacher materials — the batch-scoping fix specifically:** as a teacher, share a YouTube link in Batch A. Log in as a student in Batch A → confirm it appears. Log in as a **different student in a different batch of the same course** → confirm it does **NOT** appear. (This is the exact bug fixed in commit `7e8680a` — worth deliberately checking, not just trusting the fix.)
7. **Syllabus tracking:** `Admin → Syllabus` → add 2-3 topics to a course a real batch is taking. As that batch's teacher, mark one "completed." As an enrolled student, confirm it shows up under "Topics Covered" and the three tap-buttons work. Have 2+ students tap "Need revision" on the same topic until it crosses 30% — confirm the teacher gets exactly one SMS/WhatsApp (if a provider is configured) or check the server log for one no-op message (if not) — not zero, not two.
8. **Progress dashboard:** on a student who has some attendance/assignment/syllabus history, confirm the Progress tab shows sensible numbers, not all dashes.
9. **Materials/Campaigns admin lists:** confirm search, the new sort dropdowns, and pagination all work and combine without a page reload.
10. **Backups:** confirm `backups/*.sql.gz` actually appeared on the server after the first deploy's step 1/7, and that the cron (once set up) produces a new one daily.
11. **Everything from the previous session's checklist** (`DEPLOY_NOTES_2026-08-12.md` §6) is still worth a quick re-pass since real users are about to touch it: Add Student, bulk import, college State→District cascade, course mapping + audit log, faculty portal, both payment paths flipping a student to Enrolled, campaigns end-to-end, staff forgot-password.

## 7. Suggested next development points

Found during this pass but deliberately **not** done tonight — either lower priority, or the kind of change that shouldn't be rushed right before a deploy. Worth a dedicated look before this app has been live with real users for a while:

- **JWT role staleness (§5 above):** an admin's role change doesn't take effect until they get a new token. If this bites in practice, the fix is either shorter token expiry for admins, or a per-request DB role check (trades a little latency for correctness) — a deliberate call, not a quick patch.
- **Duplicated SQL/logic across files**, found by this session's review: the "is this student in this batch" check is re-derived inline in 4+ places instead of one shared helper; the same is true for "which students/materials belong to a batch's course." Worth consolidating into `lib/` helpers so a future fix doesn't have to be repeated in 3-4 spots (and risk being missed in one, the way the batch-materials leak happened).
- **`check-db.js` is a single 1,100+ line hand-ordered script.** It's already had two FK-ordering bugs fixed by manually re-sequencing `CREATE TABLE` statements (once last night, once flagged again this session). A real migration framework (numbered up/down files, tracked in a `schema_migrations` table) would make dependency order enforced by tooling instead of a person eyeballing the whole file correctly every time.
- **RBAC gating is applied per-route, not per-router or via a manifest** — six separate `requireRole('admin')` call sites across three files. Nothing structurally stops a future "system config" route from being added without that line. A `router.use(requireRole('admin'))` pattern (after the public routes) or a declarative route→role table would make the set of admin-only routes enumerable and harder to silently drift.
- **The 30%-need-revision alert pattern (`revision_alert_sent_at`) is a one-off column.** The next threshold-style alert (attendance drop, low quiz score, etc. — plausible given this app's direction) will need its own bespoke `*_sent_at` column and its own hand-rolled dedup guard. A generic `alerts_sent(alert_type, entity_type, entity_id)` table with a UNIQUE constraint would make every future alert type race-free by construction instead of by careful copying.
- **Minor performance opportunities**, none urgent: `routes/progress.js`'s three independent queries could run via `Promise.all` instead of sequentially; `routes/syllabus.js`'s per-topic progress view uses four correlated subqueries per row where one grouped JOIN would do; `resolveStateId()` hits the DB on every district/college write against a 36-row table that never changes at runtime and could just be cached in memory.
- **Mobile: two-column modal forms** (`grid grid-cols-2`, no responsive breakpoint) get cramped on narrow phones. Not fixed broadly (touches many files for a cosmetic issue) — worth switching new instances of this pattern to `grid-cols-1 sm:grid-cols-2` going forward.
- **Off-site backup copies.** `scripts/backup-db.sh` only writes to the same VPS as the live DB — fine against a bad migration, not fine against losing the VPS itself. Copying `backups/` somewhere else on a schedule is the natural next step.

## 8. Rollback

Same as last night: everything is on the feature branch until merged into `main` and pushed. If something in the checklist fails badly after deploy: `git log` on the server to find the commit before this merge, `git reset --hard <that-commit>`, redeploy. All schema changes here are additive (new tables/columns, `IF NOT EXISTS`/`runAlterIfMissing`-guarded, or best-effort `ALTER ... ADD CONSTRAINT` wrapped in try/catch) — nothing drops or renames an existing column, so rolling back the *code* while leaving the new (unused) columns/tables in place is safe and doesn't need a DB rollback. The one exception to watch: the `topic_confirmations` unique-key migration in commit `7e8680a` does a `DROP INDEX` + `ADD UNIQUE KEY` — harmless on a fresh table (this feature was never in production before tonight), but worth knowing it's there if you ever roll back *past* this commit after the table already has real data.
