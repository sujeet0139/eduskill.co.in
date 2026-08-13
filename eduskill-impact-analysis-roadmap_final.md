# EduSkill Multi-Tenant Platform — Impact Analysis, Challenges, APIs & Phased Roadmap
**Prepared for approval before development start**

---

## 1. Impact Analysis

### Business Impact
- Converts EduSkill from single-institute (LNMU-only) product into a **sellable SaaS product** for any institute type (ITI, nursing, coaching, degree college)
- Enables recurring revenue via module-based subscription tiers (Basic/Pro/Enterprise) instead of one-time project work
- Reduces per-client onboarding from "new dev project" to "form submission" — directly cuts your delivery time per new institute from weeks to days
- Creates a defensible asset: once 3-4 institutes are live, references + working demo become your strongest sales tool

### Technical Impact
- Every existing table needs `institute_id` — this is a **breaking schema change**, not additive. Existing EduSkill (LNMU) data must be migrated as "institute #1"
- Every existing API endpoint needs institute-scoping middleware — must be added before any new module, or new modules will inherit the same gap
- Current single-admin assumption in the codebase (if any hardcoded logic exists) must be found and removed
- Increases backend complexity meaningfully — this is the trade-off for reusability; budget real time for this, not a quick patch

### Effort/Risk Impact
- Foundation phase (institute_id + module flags) is **higher risk, lower visible output** — nothing "new" appears to a client, but skipping/rushing it causes rework across every module built after
- Recommend NOT taking on a new institute client until foundation phase is complete and tested — otherwise you'll build institute #2 directly on the old single-tenant structure and have to migrate twice

---

## 2. Key Challenges

| Challenge | Why it's hard | Mitigation |
|---|---|---|
| **Data migration** of existing EduSkill/LNMU data into multi-tenant structure | Live production data, can't break current students' access | Migrate on staging first, dry-run scripts, backup before touching production |
| **Institute_id leakage** (data crossing between institutes) | One missed WHERE clause in one query = data breach between institutes | Centralize scoping in middleware/ORM layer, never trust individual controllers to remember it |
| **Template variability** (ITI/NCVT format vs nursing vs generic) | Government formats change, aren't documented consistently, vary by state | Build template engine early (HTML+placeholders), don't hardcode any one layout |
| **Module permission complexity** | Easy to over-engineer RBAC and slow down every feature after | Keep permission model to 3 levels only: view / edit / delete per module — resist adding more granularity early |
| **Communication cost control** (SMS/WhatsApp have per-message cost) | Institute admins could send unlimited messages, cost falls on you or client unexpectedly | Add usage quotas/limits per institute, log every send, make cost visible to institute admin |
| **Attendance + Fee modules are daily-use, zero tolerance for bugs** | Unlike course browsing, these are used every single day by teachers/staff — downtime or bugs directly disrupt institute operations | Build and test these later (Phase 3), only after foundation is proven stable on Phase 1 institutes |
| **Client expectations during migration** | Institutes won't understand "foundation work" — they want visible features | Communicate phase plan (this doc) upfront so approval includes the "invisible" foundation phase |

---

## 3. APIs to Build (by module)

### Institute & Auth (Foundation)
- `POST /api/institutes` — create institute (super admin only)
- `PUT /api/institutes/:id` — update institute settings/branding
- `GET /api/institutes/:id` — get institute details
- `POST /api/institutes/:id/admins` — create institute admin
- `POST /api/auth/login` — returns JWT with institute_id + role embedded
- `POST /api/staff` — create staff user (institute admin only)
- `PUT /api/staff/:id/permissions` — assign module permissions

### Module Control
- `GET /api/modules` — list all available modules (master list)
- `PUT /api/institutes/:id/modules` — enable/disable modules for an institute
- `GET /api/institutes/:id/modules` — get enabled modules (used to render admin sidebar dynamically)

### Courses / Programs / Batches (extend existing)
- Existing endpoints + `institute_id` scoping added to all
- `GET /api/courses?institute_id=` (auto-injected from JWT, not client-passed)

### Exams
- `POST /api/exams`, `GET /api/exams`, `PUT /api/exams/:id`, `DELETE /api/exams/:id`
- `POST /api/exams/:id/register` — student exam registration
- `GET /api/exams/:id/eligibility-check?student_id=` — server-side eligibility validation

### Registration / Enrollment
- `POST /api/registrations` — generic registration (type: academic/exam)
- `POST /api/enrollments` — post-login enroll/purchase (free or triggers payment)
- `GET /api/students/:id/enrollments` — all items a student has purchased/enrolled

### Attendance
- `POST /api/attendance/mark` — bulk mark for a batch/date
- `GET /api/attendance/student/:id` — attendance history/percentage
- `GET /api/attendance/batch/:id?date=` — daily register view

### Fee Management
- `POST /api/fees/structure` — define fee structure per course/program
- `POST /api/fees/payment` — record payment (or webhook from Razorpay)
- `GET /api/fees/due/:student_id` — outstanding dues
- `GET /api/fees/receipt/:payment_id` — generate/fetch receipt PDF

### Documents (ID Card / Admit Card / Certificate)
- `POST /api/templates` — create/update a document template (institute or global)
- `GET /api/templates/:type?institute_id=` — fetch applicable template
- `POST /api/documents/generate` — generate PDF (type, student_id/exam_id, template_id) → returns file URL

### Timetable
- `POST /api/timetable`, `GET /api/timetable/batch/:id`

### Communication (SMS/WhatsApp/Email) — see Section 4 for detail
- `POST /api/communication/send` — unified send endpoint (channel, template, recipient(s))
- `GET /api/communication/logs?institute_id=` — delivery/usage logs
- `PUT /api/institutes/:id/communication-settings` — store provider credentials per institute

---

## 4. Communication Integration (SMS / WhatsApp / Email) — Per Admin

### Recommended architecture: unified notification service, provider-agnostic

```
communication_settings (per institute)
├── institute_id
├── sms_provider (e.g. MSG91/Twilio), sms_api_key, sms_sender_id
├── whatsapp_provider (e.g. WhatsApp Business API/Gupshup/Interakt), whatsapp_api_key
├── email_provider (e.g. SendGrid/SES), email_api_key, from_email
├── monthly_quota (sms_count, whatsapp_count, email_count)

communication_logs
├── institute_id, channel, recipient, template_used, status (sent/failed/delivered), cost, sent_at
```

**Key design decisions:**
- Each institute can plug in **their own provider account/API key** (many institutes already have SMS gateway contracts) — OR use your default shared provider and get billed via your platform (this is a monetizable feature — "managed communication" as a paid add-on)
- One internal function `sendNotification(institute_id, channel, template_key, data)` — used everywhere in code (registration confirmation, exam admit card ready, fee due reminder, attendance alert). Never call SMS/WhatsApp/Email APIs directly from feature code — always through this wrapper, so provider swaps or quota limits are enforced in one place
- **Templates**, not hardcoded messages: `notification_templates(institute_id, event_key, sms_text, whatsapp_text, email_subject, email_body)` — lets each institute customize wording (e.g., their own name/signature) without code changes
- Trigger points to wire up early: registration success, payment success, exam admit card ready, fee due reminder (3 days before), attendance shortage alert

### Why this matters for cost control
Without quotas, one institute admin could send a WhatsApp blast to 5,000 students and the bill lands on you unexpectedly if you're using a shared provider. Quota + logging from day one prevents this.

---

## 5. Data Redundancy / Isolation Strategy (one institute doesn't impact another)

### a) Query-level isolation (primary defense)
- Every table with `institute_id` — **no exceptions**, including junction/log tables
- ORM-level global scope/middleware auto-injects `WHERE institute_id = req.user.institute_id` on every query — developer never manually adds this per-query (removes human error as the failure point)
- Super Admin routes are the only ones allowed to bypass this scope, and only via a distinct, clearly-marked admin API layer

### b) Database-level safety net
- Add DB constraint/foreign key checks so `enrollments.institute_id` must match the `course.institute_id` it references — catches bugs where wrong institute_id slips through application logic
- Consider PostgreSQL Row-Level Security (RLS) if you migrate off MySQL later — enforces isolation at the database engine level, not just application code. (Not urgent now, but worth knowing as a stronger long-term option.)

### c) Backup / redundancy (data loss prevention, separate concern from isolation)
- Automated daily DB backups (you likely have this on Hostinger VPS — confirm retention period, e.g., 7-30 days)
- Before any migration (like the institute_id rollout), take a manual full backup + test restore on staging — don't skip the "test restore" step, a backup you haven't restored isn't verified
- Separate staging environment mirroring production — foundation phase changes get tested here first, always

### d) Cross-institute reporting (Super Admin only)
- Super Admin dashboards that aggregate across institutes should use **read-only replica queries or scheduled aggregation jobs**, not live cross-institute joins in the main app — keeps reporting from ever becoming a path where institute A's data touches institute B's live request

---

## 6. Additional Suggestions (from my side)

- **Audit log**: `activity_logs(user_id, institute_id, action, entity, timestamp)` — who created/edited/deleted what. Cheap to build now, very hard to retrofit later, and institutes will ask for this once staff accounts multiply.
- **Soft delete, not hard delete**: add `deleted_at` instead of actually deleting rows (students, courses, payments) — protects against accidental data loss and is often a compliance expectation for fee/payment records.
- **Bulk student import (CSV)**: for institutes onboarding an existing batch of 200+ students — manual entry won't be acceptable at that scale. Build this alongside Phase 1 registration work.
- **Mobile responsiveness for Attendance module specifically** — teachers will mark attendance from phones in classrooms, not desktops. Prioritize mobile UI for this one module even if others stay desktop-first initially.
- **Sandbox/demo institute**: keep one seeded demo institute always available — makes sales demos instant without touching real client data.

---

## 7. Phase-Wise Development Roadmap

### Phase 0 — Foundation (must complete before anything else)
- `institutes` table + `institute_id` migration across all existing tables
- Institute-scoping middleware (query isolation)
- Super Admin: Create Institute + Create Institute Admin flow
- Module master list + `institute_modules` + `staff_module_permissions`
- Staging environment + backup/restore verified
- **Approval gate**: no client-visible features here — get sign-off on this being necessary before starting, using this document

### Phase 1 — Core Revenue Features (visible, sellable)
- Generic `registrations` + `enrollments` tables
- Registration form (OTP + reCAPTCHA + rate limiting)
- Free/paid flags on Courses/Programs
- Exam module (entities, admin CRUD, student registration + eligibility check)
- Payment integration confirmed working per-institute (Razorpay keys per institute, not shared)
- Homepage visibility toggles (`show_on_homepage`/`is_featured`)

### Phase 2 — Documents & Communication
- Document template engine (ID card, admit card, receipt, certificate)
- Communication service (SMS/WhatsApp/Email unified sender + per-institute credentials + quotas)
- Notification triggers wired to Phase 1 events (registration, payment, exam admit card)

### Phase 3 — Daily Operations Modules
- Attendance (mobile-first)
- Timetable/weekly schedule
- Fee Management + auto-receipts
- Exam pattern/syllabus fields

### Phase 4 — Scale & Polish
- Subdomain-based routing (Next.js middleware) — full white-label per institute
- Bulk CSV import
- Audit logs + soft deletes (can start earlier if time allows, but not blocking)
- Analytics dashboard (super admin cross-institute view)
- Premium tier packaging finalized (module bundles → pricing plans)

### Suggested Strategy
- Build and stabilize Phase 0 + Phase 1 on your **existing EduSkill/LNMU institute** first — it's your live testbed with real data, lowest risk
- Onboard **institute #2** (ideally a smaller/simpler one, e.g., a coaching center) only after Phase 1 is stable — this proves multi-tenancy actually works before you're relying on it for revenue
- Don't start Phase 2/3 module builds until at least 2 institutes are successfully running Phase 0+1 — validates the foundation under real multi-tenant load before adding complexity
- Treat each phase as a separate approval/billing milestone if this is client-funded — makes scope and payment easier to track against this document
