# Architecture decisions

Short, dated records of a design call that isn't obvious from the code alone.
Add to this file rather than re-litigating the same question in a future
session.

---

## 2026-08-13 — Faculty vs. Teacher: two genuinely different roles, not a duplicate

**Context:** `eduskill-master-dev-prompt.md` Section E#3 asked to confirm and
document whether `faculty.js`/`faculty` and `teachers.js`/`teachers` are
accidental duplicates before building Faculty Assignment / Timetable on top
of them.

**Finding, from the actual code (not assumption):**

- **`faculty`** (`routes/faculty.js`) — external subject-matter experts:
  name, email, phone, `expertise`, `college_id`, `hourly_rate`. No login, no
  password, no auth middleware on any route. Referenced today as
  `batches.mentor_id` — the person credited as a batch's subject expert.
- **`teachers`** (`routes/teachers.js`) — actual staff accounts: login
  credentials, `requireAdmin`-gated CRUD, profile photo. Referenced as
  `batches.teacher_id`, and it's exactly this table `teacher-portal.js`
  authenticates against (`req.teacher.id`) to drive "My Batches",
  attendance, and material upload.

**Decision:** keep them separate. `faculty` is a lightweight external-expert
directory (who to credit / pay per hour); `teachers` is the login-capable
staff role the teacher portal is built on. A batch can have both a
`mentor_id` (faculty) and a `teacher_id` (teacher) at the same time, and
that's correct, not redundant — they answer different questions ("who's the
named subject expert" vs. "who's actually running the portal for this
batch").

**Consequence for Section E#4 (Faculty Assignment) / E#5 (Timetable):** build
the assignment join table against **`teachers`**, since that's the role with
a real login that actually delivers the class and would appear on a
timetable. `faculty.mentor_id` stays as the existing lightweight credit
field on `batches` — no separate faculty-assignment table needed unless a
future requirement has one faculty expert supporting multiple batches
concurrently (not true today: `mentor_id` is 1:1 per batch already).

---

## 2026-08-13 — RBAC: reused the existing `admin`/`moderator` role values, did not add `super_admin`

**Context:** master-dev-prompt Section H#2 asks for Super Admin vs.
Admin/Data-Entry-Staff enforcement. `admin_users.role` already existed as a
column, but nothing checked it beyond `requireAdmin` treating `'admin'` and
`'moderator'` as equally privileged.

**Decision:** rather than introduce a new `'super_admin'` string (which
would've required a data migration to decide who gets it, with no way to
verify existing account data from this environment), I reused what's already
there: **`'admin'` is now the elevated tier**, **`'moderator'` is the
restricted Admin/Data-Entry-Staff tier** — exactly matching
`routes/admins.js`'s existing `role || 'moderator'` default on account
creation. Added `requireRole(...)` in `middleware/authMiddleware.js` and
gated: managing other admin accounts (`routes/admins.js` POST/PUT/password),
bulk settings incl. SMS/WhatsApp config (`routes/settings.js` PUT), and the
registration form field builder (`routes/form-settings.js` mutations) to
`'admin'` only.

**⚠️ Deploy-night action required:** this restricts every existing
`'moderator'`-role account from Settings/Admin-management/form-builder
access, starting the moment this deploys. **Check `admin_users.role` for
every real staff login before/right after deploying** — if a staff member
who actually needs Settings access is currently `'moderator'`, promote them
to `'admin'` via `UPDATE admin_users SET role='admin' WHERE email='...'` (or
the Admins screen, once logged in as an `'admin'`-role account) or they'll
get a 403 where they didn't before.
