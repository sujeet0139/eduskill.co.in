# EduSkill Multi-Tenant — Development Guide (Phase 0 Start)
How to use: Open Claude Code in your EduSkill project folder. Paste each prompt below ONE AT A TIME,
in order. Review the diff it proposes before approving. Come back to Claude (chat) with any errors
or design questions before moving to the next prompt.

---

## STEP 0 — Safety first (do this before anything else)
1. Take a full DB backup (Hostinger VPS → export MySQL dump)
2. Create a git branch: `git checkout -b feature/multi-tenant-foundation`
3. If possible, set up a staging copy of the DB — don't run migrations on production first

---

## STEP 1 — Let Claude Code understand your current project

PASTE THIS FIRST:
```
Read my current project structure. Show me:
1. My database schema (all tables and their columns) — check for a schema.sql, prisma schema, 
   or migration files, or connect and describe the live MySQL schema if needed
2. My Express backend route files structure (list folders/files under routes or controllers)
3. My Next.js frontend page structure for the admin panel
4. How authentication currently works (JWT? session? where is the admin login logic?)

Don't change anything yet. Just give me a summary so we can plan the institute_id migration.
```

Wait for its output. Paste that output back into this chat if you want my review before proceeding.

---

## STEP 2 — Create the institutes table + migration

PASTE THIS:
```
Create a new MySQL migration that adds:

1. A new `institutes` table:
   - id (PK, auto-increment)
   - name (varchar)
   - subdomain (varchar, unique)
   - logo_url (varchar, nullable)
   - primary_color (varchar, nullable)
   - contact_email (varchar)
   - contact_phone (varchar)
   - status (enum: active/suspended, default active)
   - created_at, updated_at

2. Insert one row into `institutes` representing my current EduSkill/LNMU data:
   name = "EduSkill LNMU", subdomain = "eduskill", status = "active"

3. Add an `institute_id` column (INT, FK to institutes.id) to these existing tables:
   courses, programs, batches, students, study_materials, admin_users
   (check my actual table list from Step 1 and include any I missed)

4. Backfill institute_id = 1 (the row created above) for ALL existing rows in those tables

5. After backfill, make institute_id NOT NULL on all those tables

Show me the full migration file before running it. Do not run it yet — I'll review first.
```

**Bring the migration file back to this chat if you want a second review before running it.**

---

## STEP 3 — Run migration on staging, verify, then production

PASTE THIS (after you've reviewed and are ready):
```
Run this migration on [staging/production - specify which]. After running, verify:
1. Row count in institutes table = 1
2. Every existing course/program/batch/student/study_material row now has institute_id = 1
3. No NULL institute_id values remain
Show me the verification query results.
```

---

## STEP 4 — Update authentication to carry institute_id

PASTE THIS:
```
Update my admin login logic so that:
1. The JWT token issued on login includes institute_id and role (from the admin_users table)
2. Add a middleware function `resolveInstitute` that reads institute_id from the JWT 
   and attaches it to req.institute_id on every authenticated request
3. Show me this middleware code and where you're applying it (which routes)

Don't change any business logic yet, just the auth/middleware layer.
```

---

## STEP 5 — Apply institute-scoping to existing queries

PASTE THIS:
```
Now update my existing routes/controllers for courses, programs, batches, students, 
study_materials to use req.institute_id from the middleware:
1. Every GET (list/read) query must filter WHERE institute_id = req.institute_id
2. Every POST (create) query must insert institute_id = req.institute_id automatically 
   (never trust institute_id from the request body)
3. Every PUT/DELETE must verify the record's institute_id matches req.institute_id 
   before allowing the update/delete (return 403 if not)

Go file by file, show me each change before applying it. Start with the courses controller.
```

**This step will take several rounds — one controller at a time. Don't let it batch all files silently; review each one.**

---

## STEP 6 — Super Admin: Create Institute + Institute Admin flow

PASTE THIS:
```
Build a new Super-Admin-only section:
1. API: POST /api/super-admin/institutes — creates a new institute row
2. API: POST /api/super-admin/institutes/:id/admin — creates the first admin_user for 
   that institute (with institute_id set, role = institute_admin)
3. A simple Next.js admin page (super-admin only, check role from JWT) with a form: 
   institute name, subdomain, contact email/phone, then a second form to create the 
   first admin user (name, email, password) for that institute
4. Only users with role = super_admin can access these routes/pages — add that check

Show me the API code first, then the frontend page.
```

---

## STEP 7 — Verify everything before moving to Phase 1

PASTE THIS:
```
Let's test the full foundation:
1. Log in as the existing EduSkill admin — confirm courses/programs/batches still show 
   correctly (institute_id = 1 scoping working)
2. As super admin, create a second test institute + admin user
3. Log in as that new test institute admin — confirm they see ZERO courses (empty, 
   correctly isolated) and can create their own
4. Confirm the original EduSkill admin still can't see the test institute's data

Report back the results of each check.
```

---

## After Phase 0 is verified working
Only move to Phase 1 once Step 7 above is fully confirmed. Do not run Phase 1 prompts if 
institute isolation isn't verified working — every table below depends on it.

---

# PHASE 1 — Registrations, Enrollments, Exam Module

## STEP 8 — Generic registrations table

PASTE THIS:
```
Create a new MySQL migration for a generic `registrations` table:
- id (PK)
- institute_id (FK to institutes, NOT NULL)
- student_id (FK to students)
- type (enum: 'academic', 'exam')
- reference_id (INT — points to course_id/program_id/exam_id depending on type)
- status (enum: pending/confirmed/cancelled, default pending)
- created_at, updated_at

Also create:
1. API: POST /api/registrations — student registers (type + reference_id in body). 
   Must set institute_id from req.institute_id (never from client), and student_id 
   from the logged-in student's session/JWT.
2. API: GET /api/students/:id/registrations — list a student's registrations, 
   scoped to institute_id

Show me the migration and API code before applying.
```

## STEP 9 — Simplify public registration form (with OTP)

PASTE THIS:
```
Update my public student registration flow (the form before login) to:
1. Only collect: name, mobile, email, district, college (drop any other fields currently there)
2. Add OTP verification on mobile (or email if mobile OTP isn't set up yet) before the 
   account is actually created
3. On successful OTP verify: create the student row with account_status = 'guest' 
   and institute_id = req.institute_id (resolved from subdomain or a query param for now, 
   since subdomain routing isn't built yet — use a temporary institute_id param if needed)
4. Add basic rate limiting on this endpoint (max 5 requests per IP per hour)

Show me the updated registration API and frontend form code.
```

## STEP 10 — Enrollments table (free/paid access tracking)

PASTE THIS:
```
Create a new MySQL migration for an `enrollments` table:
- id (PK)
- institute_id (FK, NOT NULL)
- student_id (FK)
- item_type (enum: course/program/exam)
- item_id (INT)
- access_type (enum: free/paid)
- payment_status (enum: not_required/pending/paid/failed, default not_required)
- status (enum: active/expired/completed, default active)
- created_at, updated_at

Also:
1. Add `pricing_type` (enum: free/paid) and `price` (decimal, default 0) columns 
   to courses, programs, and exams tables if not already present
2. API: POST /api/enrollments — 
   - if item's pricing_type = free → create enrollment directly, payment_status = not_required
   - if item's pricing_type = paid → create enrollment with payment_status = pending, 
     then return a Razorpay order for checkout
3. Add a DB trigger or application-level hook: after any enrollment insert, check if 
   this is the student's first enrollment — if so, update students.account_status 
   from 'guest' to 'active'

Show me the migration and API code before applying.
```

## STEP 11 — Exam module (entities + admin CRUD)

PASTE THIS:
```
Create a new MySQL migration for an `exams` table:
- id (PK), institute_id (FK, NOT NULL)
- name, level (enum: district/college/state)
- eligibility (JSON, nullable)
- exam_date, registration_start, registration_end
- pricing_type (free/paid), price (decimal)
- max_participants (INT, nullable)
- syllabus_url (varchar, nullable)
- status (enum: draft/open/closed/completed, default draft)
- created_at, updated_at

Also build admin CRUD for Exams, following the exact same pattern as my existing 
Courses admin page (table columns: Title/Level/Date/Fee/Status/Actions with Edit/Delete), 
including institute_id scoping like the other controllers we already updated.

Show me the migration, API routes, and the admin page code (reusing the Courses page 
component structure).
```

## STEP 12 — Exam registration with eligibility check

PASTE THIS:
```
Add exam registration for students:
1. API: GET /api/exams/:id/eligibility?student_id= — checks the student's district/college/
   qualification against the exam's eligibility JSON, returns eligible: true/false + reason
2. API: POST /api/exams/:id/register — only allows registration if:
   - eligibility check passes
   - current registered count < max_participants (if set)
   - current date is within registration_start and registration_end
   This creates a row in `registrations` (type='exam') AND `enrollments` 
   (item_type='exam', access_type based on exam's pricing_type)
3. If exam is paid, return Razorpay order same as Step 10's enrollment payment flow

Show me this API code, and a simple student-facing "Register for Exam" button/flow 
that calls it and shows the eligibility result.
```

## STEP 13 — Verify Phase 1 before moving on

PASTE THIS:
```
Let's test Phase 1 end to end:
1. Register a new student (guest status) via the simplified public form with OTP
2. Log in as that student, enroll in a free course — confirm account_status becomes 'active'
3. Try enrolling in a paid course — confirm Razorpay checkout triggers correctly
4. As admin, create a test exam with an eligibility condition (e.g., specific district)
5. Try registering that student for the exam — confirm eligibility check works correctly 
   both when they qualify and when they don't
6. Confirm all the above respects institute_id scoping (test institute's exam doesn't 
   show up for the main EduSkill institute's students)

Report back the results of each check.
```

---

## After Phase 1 is verified working
Come back to this chat and confirm — I'll prepare Phase 2 prompts (document template 
engine for ID/admit cards, and SMS/WhatsApp/Email communication service).

---

## If something breaks or you're unsure at any step
Copy the exact error message or Claude Code's proposed change, paste it into the main chat 
(not Claude Code), and I'll help you decide how to proceed before you approve anything risky.
