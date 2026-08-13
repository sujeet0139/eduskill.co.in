# EduSkill — Master Development Prompt (Fix + Enhance)
**This is the single, current source of truth.** It supersedes the earlier separate documents (`eduskill-dev-prompt.md`, `eduskill-campaign-admin-prompt.md`, `eduskill-teacher-content-platform-plan.md`, `eduskill-syllabus-progress-tracking-plan.md`) — everything relevant from those is consolidated and re-prioritized here.

## Scope note — read this before starting
- Single-institute platform. Do not build multi-tenancy, white-labeling, or per-client billing.
- **Payments are explicitly OUT OF SCOPE for this pass.** Do not build, modify, or "improve" any payment/gateway code. Leave the existing manual payment-proof-upload flow (`payments.js`) exactly as it is and fully functional — students can still pay and get approved the way they do today. Do not remove it, just don't invest further engineering time in it here. It will be revisited as its own dedicated phase later (likely: real gateway integration + fraud detection on the proof-upload flow).
- Exam/Question Bank: deferred, same as before. Leave `exams.js` as-is; do not extend it this pass.
- **Admin usability is a first-class requirement in this pass, not an afterthought** — see Section A. Every other section's UI work should follow those principles by default.

---

## Section A — Admin UX Standard (apply to every admin screen, new or existing)

The admin panel has real, confirmed friction today (Add Student hanging, single-student view not loading, no filters on lists). Before/while building new admin features, bring the panel up to one consistent standard:

1. **No infinite loading states.** Every action (save, load, delete) has a timeout (~15s) and a visible error with retry — never a spinner with no way out.
2. **Every action gives clear feedback.** A toast/banner confirms success or explains failure specifically ("Mobile number already exists" not "Error"). No action should leave the admin wondering if it worked.
3. **Destructive actions require confirmation.** Delete, demap, deactivate — always a confirm step with a clear description of what's about to happen.
4. **Every list view gets search, filter, sort, and pagination** — not just the student list. Same reusable component across Students, Colleges, Universities, Campaigns, Materials, etc.
5. **Empty states guide the next action.** "No students yet — click here to add your first one," not a blank table.
6. **Forms preserve entered data on error** and show field-specific inline errors, not a full reset.
7. **Consistent layout and navigation** — same header/sidebar/breadcrumb pattern across every admin section so it feels like one product, not stitched-together screens.
8. **Bulk actions where they make sense** — bulk mapping, bulk status change, bulk export — anywhere an admin would otherwise repeat the same click many times.
9. **Mobile-usable, not just desktop.** Admin/teacher staff may check things from a phone — confirm no horizontal scroll or unusable tap targets.
10. **Keyboard and screen-reader accessible forms** — especially dropdowns, which have already caused real bugs (see Section B, item 7).

---

## Section B — Confirmed bugs to fix first (P0)

1. **Add Student hangs on "please wait."** Diagnose whether it's a client-side hang or backend timeout; add the 15s timeout + error state from Section A item 1; log failures server-side.
2. **Single student view doesn't load.** Confirm the detail endpoint returns data reliably; add proper loading/error states.
3. **Registration form loses all data on failed submit** (currently does a full page navigation back to `/register`). Handle errors client-side; re-render with values intact plus a field-specific inline error.
4. **No visible success/error state after "Register Now."** Add one — this is why users were resubmitting repeatedly in testing.
5. **Password rules not shown before submit.** Show minimum length/complexity inline, before rejection.
6. **Vague Mobile/WhatsApp validation errors.** Real-time format validation with specific messages ("10 digits, no spaces"; "This number is already registered").
7. **Dropdown click handling inconsistent** (Select Program/College) — sometimes the click hits a wrapper div instead of the control. Fix so a single click always works; test keyboard nav too.
8. **WhatsApp field label typo** — rendered as "Whatup no*", should be "WhatsApp No*".
9. **Campaign link timezone bug (found live in production on `/c/rd`).** Root cause: `datetime-local` inputs carry no timezone info, and there's no `timezone` setting on the MySQL connection (`config/db.js`) nor any `TZ` env var — so a campaign's `starts_at` can be interpreted several hours later than the admin intended, making an active campaign show "isn't open yet."
   - Fix: set `timezone: '+05:30'` on the MySQL pool config, and treat all stored campaign/scheduling times as IST consistently (no conversion needed for a single-timezone institute).
   - Also: when a campaign shows "not started," display the actual open time in the message, not just "check back soon" — turns a support mystery into something self-diagnosable.

---

## Section C — Core data: States, Districts, Universities, Colleges

1. **Seed full India state/district reference data** (currently states are only derived from `SELECT DISTINCT state FROM districts`, so the dropdown only shows states someone happened to add a district for). Normalize `state` into a proper foreign-keyed `states` table instead of a free-text column on `districts` and `colleges` — prevents "Bihar"/"bihar"/"BIHAR" fragmenting the dropdown.
2. **Optional `city` field** on College and Student address, separate from District, for places where district ≠ recognizable city (e.g. Noida is in Gautam Buddh Nagar district).
3. **Complete the University entity.** Currently name-only with GET/POST only. Add PUT/DELETE, plus: short code, state, website, logo upload (reuse the College logo upload component).
4. **College form improvements:** College Name, College ID/Code (unique), Affiliated University (dropdown, already FK'd correctly), State → District cascading dropdown, Full Address, Principal Name & contact, HOD Details (support multiple), College Website, College Logo.

---

## Section D — Student data model and admin usability for Students

1. **Bulk student import** via downloadable sample sheet template with exact expected headers; validate every row before committing any; per-row error report (row, field, reason), not silent auto-fix. Validation: Mobile/WhatsApp exactly 10 digits numeric; Email valid + unique; Name no digits/special chars; DOB valid + sane age range; Program/College must match existing records.
2. **Expanded student master fields** (make required-at-signup vs. optional-fill-later a deliberate split, don't bloat the registration form): Address, DOB, Gender, Blood Group (optional), Emergency Contact, Parent/Guardian contact, LinkedIn/GitHub (optional), current employment status, referral source. Aadhaar Number only if genuinely required, and if kept, treat as a restricted/access-logged field.
3. **Educational background fields** (optional, fillable post-registration): 10th (Board, Year, %), 12th (Board, Stream, Year, %), Technical/Graduate Degree (Degree, Institution, Year, %), with optional document upload per entry.
4. **Student ↔ Course/Program many-to-many mapping**, replacing any single-course-field assumption — needed for Section E's hierarchy and for a student to be in both a Major and Minor track simultaneously.
5. **Dedicated mapping/demapping screen:** pick a student → see current mappings → Map/Demap with confirmation, bulk-map support, audit log of who mapped/demapped whom and when.
6. **Filters + pagination** on the student list (search by name/mobile/email; filter by Active/Inactive, Guest/Enrolled, Program) — server-side pagination, not load-all-then-slice.
7. **Guest vs. Enrolled status stays automatic**, not a manual toggle — Enrolled the moment a payment is approved via the existing (untouched, per scope note) payment flow. Active/Inactive remains a separate manual override.
8. **Resume/document/photo upload** on the student profile, stored as referenced files.

---

## Section E — Program / Course / Batch / Faculty structure

1. **Hierarchy:** `Program → Track (Major/Minor) → Course → Subject`, with `Batch` carrying its own semester/year number as an attribute (don't build Semester as a separate entity layer).
2. **Subjects** — new entity under Course (e.g. Course "Java Advance" → Subjects "OOP", "Collections", "Exceptions"). Needed for subject-level syllabus tracking (Section H) and future subject-level results.
3. **Resolve the Faculty vs. Teacher distinction explicitly.** Two separate tables/routes exist (`faculty.js`, `teachers.js`) — confirm and document whether these are genuinely different roles or should be unified, before Faculty Assignment and Timetable are built on top of an ambiguous foundation.
4. **Faculty Assignment** — join table: which faculty/teacher teaches which subject, for which batch, with a role (lead/assistant).
5. **Timetable** — build last in this group; it's a scheduled view composed from Faculty Assignment + `live-classes.js` sessions, not a new independent data structure. Reuse `live-classes.js` for session scheduling rather than building a separate "Classes" entity, unless there's a genuine structural difference (recurring slot definition vs. one-off session) — confirm this distinction before building anything new here.

---

## Section F — Teacher Portal enhancements

Currently `teacher-portal.js` is **read-only** — no way for a teacher to upload or share anything themselves, which is a real bottleneck.

1. **Teacher-scoped material upload.** New `POST /teacher-portal/materials`: title, description, subject, either a file upload or a video URL (below), and a `batch_id` restricted to the teacher's own assigned batches only (via `my-batches` — never let a teacher target a batch that isn't theirs).
2. **YouTube/video link sharing.** Add `video_url` and `batch_id` columns to `study_materials` (currently only supports uploaded files, and only targets Course/Program level, not a specific Batch). A teacher pastes a normal YouTube share URL — parse the video ID server-side and auto-embed; don't make teachers extract embed codes manually.
3. **Publish policy decision (make this explicit, don't default silently):** either teacher uploads go live immediately (consistent with teachers already grading assignments unsupervised), or go through a Draft → admin-review → Publish step reusing the existing Draft/Published pattern. Recommendation: direct publish, given the existing trust level, but this should be a deliberate call.
4. **Student-facing materials view** (`student-dashboard.js` `/materials`) — extend the existing course/program filter to also match the student's `batch_id`, and render video-type materials as an embedded player instead of a download link.

---

## Section G — Syllabus Coverage & Progress Tracking (new)

Confirmed: no structured syllabus exists today — `live_classes.topic` is just a free-text field per session, with no completion tracking and no student confirmation anywhere.

1. **`syllabus_topics`** — ordered topic list per Course, defined once, reused across every batch taking that course.
2. **`batch_topic_progress`** — per-batch coverage: status (not started/in progress/completed), covered_by, covered_at, optionally linked to a specific live-class session. Teacher UI: a one-tap checklist directly on their existing batch view — no separate screen to remember to visit.
3. **Student self-confirmation** — one tap per completed topic: 🟢 Got it / 🟡 Need revision / ⚪ Didn't attend. Keep this to a single tap; no text fields, or response rates will collapse.
4. **Admin view per batch:** progress bar (X of Y topics done), per-topic breakdown (who covered it, when, and the student confirmation split).
5. **Threshold alert:** notify the teacher/admin automatically when a topic crosses roughly 30% "Need revision" — catch weak spots in real time instead of discovering them in a later result.
6. This feeds directly into the Progress dashboard (Section I) as one of three inputs (attendance %, assignment scores, topic self-confirmation).

---

## Section H — Content Publishing & Roles

1. **Draft/Published status** on course/banner content — the student panel only ever renders Published items, so admin can prepare new content without early exposure.
2. **RBAC roles:** Super Admin (everything), Admin/Data Entry Staff (students, no system config), Faculty/Teacher (only their own assigned batches). Every account has its own login; every create/edit action is attributed to that account (audit trail) — no shared generic admin logins.

---

## Section I — Systems that are missing entirely (build now, minus payments)

- **Notifications.** SMS/email/WhatsApp confirmation on registration, enrollment, and status changes — students currently have no feedback loop beyond the in-app state (which had its own bugs, Section B).
- **Password/account recovery** for students and staff.
- **Basic security hygiene:** confirm password hashing is used everywhere (already bcrypt on registration — extend the check to any other auth path), session timeout, HTTPS enforced, login rate-limiting.
- **Backups and tested recovery path** in case of DB failure or accidental bulk delete/demap.
- **Progress dashboard** — per-student rollup of attendance %, assignment scores, and syllabus self-confirmation (Section G) — the one clear gap in an otherwise well-covered Academic Operations area.
- **Mobile responsiveness audit** specifically for the Admin and Teacher panels, not just the student-facing site.

**Certificates note:** certificates currently generate on an 80% attendance threshold alone, with no assessment behind them. Leave the mechanism as-is this pass (exam integration is deferred, Section — scope note), but any marketing copy calling this "industry-certified" should be reviewed for accuracy against what's actually being verified.

---

## Suggested build order

1. **P0 bugs** (Section B) — especially the timezone bug, since it's live and actively blocking a real campaign link right now
2. **Admin UX standard** (Section A) — apply as a pattern while touching each screen below, not as a separate isolated project
3. **Core data: states/districts/universities/colleges** (Section C) — small, contained, unblocks dropdowns used everywhere else
4. **Student data model + mapping** (Section D) — foundational for everything downstream
5. **Notifications + security hygiene + backups** (Section I, minus Progress dashboard) — as urgent as the P0 bugs in terms of trust, cheap relative to impact
6. **Program/Course/Batch/Faculty structure** (Section E) — resolve the Faculty/Teacher ambiguity early here
7. **Teacher Portal upload + video sharing** (Section F) — unblocks teachers from depending on admin for every piece of content
8. **Syllabus tracking** (Section G) — depends on Subjects existing (Section E)
9. **Progress dashboard** (Section I) — depends on Section G's data existing
10. **Content publishing + RBAC** (Section H)
11. **Payments, Exam/Question Bank, Public API** — explicitly deferred, revisit as separate future phases, not part of this pass
