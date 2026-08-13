# EduSkill Platform — Enhancement Plan (Multi-Institute Version)

## 1. Core Shift: Institute Layer (Multi-Tenant Foundation)
- Add `institutes` table — every institute (college/org) is one row: name, subdomain, logo, status
- Add `institute_id` FK to every existing table: courses, programs, batches, teachers, students, exams, study_materials
- One codebase, one database, one deployment — NOT separate copies per institute
- Institute-scoping enforced in backend middleware (every query auto-filtered by institute_id)
- Each institute gets its own subdomain: `smrck.eduskill.co.in`, `ecrku.eduskill.co.in`, etc.
- Subdomain → resolves institute_id → scopes data, branding, homepage content for that request

## 2. Role Structure & Admin Hierarchy

### Super Admin (You / Platform Owner)
- Create/suspend/manage institutes
- Create the first **Institute Admin** account for each new institute (this IS the handover step — no code copying)
- Cross-institute reports and visibility into all data
- Platform-level settings (payment gateway keys, global policies)

### Institute Admin (per institute — e.g., S.M.R.C.K. College admin)
- Manages ONLY their own institute's data (enforced by institute_id scoping)
- Institute Settings: name, logo, colors, subdomain, contact info
- Full CRUD on: Courses, Programs, Batches, Teachers/Faculty, Exams, Study Materials
- Create **Staff Users** under their institute with specific roles

### Staff Roles (created by Institute Admin)
- Role-based access control (RBAC) — each staff sees only what their role permits
- Example roles: `content_manager` (courses/study materials only), `exam_coordinator` (exams/exam registrations only), `student_support` (student records, no delete rights), `teacher` (batch/attendance/results only)
- Permissions table maps role → allowed modules → allowed actions (view/edit/delete)

## 3. Student-Facing Side — Two Separate Sections
- **Academic Registration** — student registers for Course / Program → later Enroll/Purchase after login
- **Exam Registration** — student registers/browses Exams separately → Register (free) or Buy (paid) after login
- Clear separation in navigation/dashboard — not mixed into one generic "Register" flow
- Both sections use the same underlying `registrations` table but are presented as distinct tabs/cards to the student

## 4. Registration → Purchase Workflow
- **Step 1 (Public, no login):** Simple registration form — Name, Mobile, Email, District, College + OTP verification
- **Step 2 (Login required):** Browse courses/programs/exams
- **Step 3 (Purchase/Enroll):**
  - Free item → Enroll Now → instant access
  - Paid item → Razorpay checkout → access granted on payment success
- Account status auto-updates: `guest` (registered, no enrollment) → `active` (has ≥1 enrollment)

## 5. Generic "Registration" Concept
- Single `registrations` table with a `type` field: `academic` / `exam` (extensible — add `workshop`, `certification` later without new tables)
- Points to relevant `reference_id` (course_id / program_id / exam_id)
- Keeps reporting unified across all registration types

## 6. Enrollment & Status Tracking
- Separate `enrollments` table (per item purchased/enrolled): item_type, item_id, access_type (free/paid), payment_status, status
- `account_status` (guest/active) = auto-computed summary flag for filtering "has this student purchased anything"
- Enables admin filters: "students enrolled in Web Development," "unpaid exam registrations," etc.

## 7. Admin Panel Additions — Exam Module
- New sidebar section: **Exams** | **Exam Registrations**
- Exam entity fields: name, level (district/college/state), eligibility conditions (JSON — flexible, avoids schema changes per exam), exam date, registration window, fee, max participants, syllabus, status
- Mirrors existing Courses table UI pattern — same component reused, no new UI to learn

## 8. Free vs Paid — Uniform Pattern
- `pricing_type` (free/paid) + `price` field added consistently to Courses, Programs, AND Exams
- Same frontend card component reads this flag — "Enroll Free" vs "Buy ₹X" — no duplicate logic per module

## 9. Payment Strategy
- **Courses/Programs:** partial/wallet-based payment allowed (existing system) — suited to considered, high-cost purchases
- **Exams:** always full payment upfront — avoids seat-holding/reconciliation issues tied to fixed exam logistics (hall tickets, centers)

## 10. Homepage — Admin-Controlled Visibility
- Add `show_on_homepage` and `is_featured` flags to Courses/Programs/Exams — admin toggles per item, not hardcoded
- Suggested homepage order: Hero/urgency banner → Featured Programs → Courses grid → Upcoming Exams → (Batches NOT shown on homepage — operational detail, shown only during enrollment step)
- Each institute controls their own homepage sections independently once subdomain-scoped

## 11. Anti-Fraud / Fake Registration Prevention
- Mandatory OTP (mobile/email) at registration — biggest single filter
- Rate limiting on registration API (e.g., 5 requests/hour per IP)
- Invisible reCAPTCHA v3 on registration form
- DB-level uniqueness constraint on mobile/email
- Seat-limited exams: enforce `max_participants` at DB level with locking to prevent overbooking
- Admin report: flag guest accounts with zero enrollments after 30/60 days for cleanup

## 12. Server-Side Validation (Required Everywhere)
- Never trust client-side checks alone — validate on backend for: eligibility rules (exam JSON conditions), payment amount vs actual price (prevent tampering), seat availability at registration time (not just at form load), institute_id scoping on every write (prevent cross-institute data injection), file upload types/sizes (study materials, certificates)

## 13. Suggested "Premium" Feature Tier (Upsell to Institutes)
- Custom subdomain + branding (logo/colors) — could be a paid tier vs default shared theme
- Advanced analytics dashboard (enrollment trends, revenue reports, exam pass rates)
- Bulk student import (CSV upload) — saves manual entry for large institutes
- Automated certificate generation with QR verification (you already have this — package as premium)
- WhatsApp/SMS notification broadcasts (exam reminders, results) — you've already built this for ECRKU, generalize it
- Custom exam question bank + auto-evaluation (MCQ-based) for a scored online exam feature
- Priority support / dedicated onboarding for larger institutes

## 14. Build Priority Order
1. `institutes` table + `institute_id` scoping on all existing tables (foundation — do first)
2. Super Admin → Create Institute + Institute Admin flow
3. Role-based staff user creation under Institute Admin
4. Registration form simplification + OTP + generic `registrations` table
5. `enrollments` table + auto account_status logic
6. Exam module (entities + admin UI, reusing Courses pattern)
7. Free/paid flags across Courses/Programs/Exams
8. Homepage visibility toggles
9. reCAPTCHA + rate limiting + server-side validation pass
10. Subdomain-based multi-tenant routing (Next.js middleware)
11. Premium feature packaging (phase 2, once core is stable)
