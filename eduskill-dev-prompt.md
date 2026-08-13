# Development Prompt — EduSkill.co.in Platform Fixes & Improvements

## Context
EduSkill.co.in is a single-institute skill-training and internship platform (LNMU-affiliated colleges, Bihar). It has three parts: a public student-facing site with registration, a Student Panel, and an Admin Panel. This is a single-institute product — do not build multi-tenancy, white-labeling, or per-client billing. Scope is one institute with multiple affiliated colleges under it.

Work through the items below **in the priority order given**, not in the order listed. Each item includes what's broken/missing and what "done" looks like. Flag anything ambiguous instead of guessing silently.

---

## PRIORITY 0 — Fix now, blocking core function

### 1. "Add Student" hangs on "please wait"
Investigate whether the request ever reaches the backend or hangs client-side. Add a request timeout (~15s) with a visible error state and retry option. Log failed submissions server-side with enough detail to diagnose (payload, error, timestamp). Acceptance: submitting a valid student always resolves to success or a specific error within 15s — never an infinite spinner.

### 2. Student single view not showing
Confirm the detail API/route returns data for a valid student ID. Add proper loading and error states instead of a blank screen when data is missing or slow. Acceptance: clicking any student in the list reliably opens their full detail view.

### 3. Registration form loses data on failed submit
Currently a failed submit does a full page navigation back to `/register`, wiping all entered fields. Fix: handle submit errors client-side (AJAX/fetch), re-render the form with all previously entered values intact, and show a field-specific inline error next to whatever failed. Never force the user to re-enter the whole form.

### 4. No success/error feedback after registration submit
Add a clear, visible confirmation (success) or specific error message immediately after clicking "Register Now." Right now there's no indication of outcome, which is why users resubmit repeatedly.

### 5. Password requirements not shown before submit
Show minimum length / complexity rules inline under the Password field before the user submits, not only as a rejection after.

### 6. Vague or missing error messages for Mobile/WhatsApp Number
Add real-time format validation ("10 digits, no spaces") shown before submit. If a number is already registered, say so explicitly — don't fail silently or generically.

### 7. Dropdown click handling (Select Program / College)
Fix so a single click reliably opens and allows selection — currently inconsistent between page loads (sometimes the click hits a wrapper div instead of the actual control). Test with keyboard navigation and screen reader too.

### 8. WhatsApp field label typo
The field's rendered label is "Whatup no*" — fix to "WhatsApp No*".

### 9. Notifications — student never knows if anything worked
Add SMS/email/WhatsApp confirmation on: successful registration, enrollment confirmation, and any status change relevant to the student. This is currently completely missing and is functionally as broken as the UI bugs above — students have no feedback loop at all.

### 10. Basic security hygiene
Confirm/implement: password hashing (never plaintext), session timeout, HTTPS enforced site-wide, login rate-limiting to prevent brute force. This matters immediately given the system stores phone numbers, emails, and potentially Aadhaar numbers.

---

## PRIORITY 1 — Foundational data model (build before anything below depends on it)

### 11. Student ↔ Course many-to-many relationship
Replace any single `course_id` field on the student record with a join table (`student_id`, `course_id`, `enrolled_date`, `status`). This underlies items 16, 20, and 26 below — build this first.

### 12. Expanded student master record
Add these fields to the student profile, split into **required at registration** vs **optional / fill later from student panel** (don't make all of these mandatory at signup — that adds friction):
- Address, Date of Birth, Gender, Blood Group (optional)
- Emergency Contact Name & Number, Parent/Guardian Name & Number
- LinkedIn, GitHub (optional)
- Current employment status
- Referral source (how they heard about EduSkill)
- Aadhaar Number — **only if genuinely required**; if included, mark as a restricted field with access logging, not a plain text column

### 13. Educational background fields
Add (optional, fillable post-registration): 10th (Board, Year, Percentage/CGPA), 12th (Board, Stream, Year, Percentage/CGPA), Technical/Graduate Degree (Degree, Institution, Year, Percentage/CGPA). Allow uploading a marksheet/certificate scan per entry.

### 14. Program → Track → Course → Batch hierarchy
Build this structure:
```
Program (e.g. "BCA – 1 Year")
 └── Track: Major Training / Minor Training
      └── Course (e.g. Java, Python, AI, ML)
           └── Batch (e.g. "Java – Morning – Aug 2026")
                └── Students mapped to that batch
```
A student maps to a Program, then separately to one or more Courses across Major/Minor tracks, using the many-to-many model from item 11.

---

## PRIORITY 1 — Daily-use admin features

### 15. Filters and search on student list
Add: search by name/mobile/email; sort by name/registration date/program; filter by Active/Inactive; filter by Guest/Enrolled. All filters must combine (e.g. Active + Enrolled + Program=Java) without a page reload.

### 16. Automatic Guest vs Enrolled status
**Guest** = registered, no paid course. **Enrolled** = has at least one confirmed paid course. On payment confirmation (see item 22), automatically flip status and record which course triggered it — this should not be a manual admin toggle.

### 17. Pagination
Server-side pagination on the student list (not client-side load-all-then-slice), configurable page size (25/50/100).

### 18. Active/Inactive manual toggle
A separate manual override on each student record from the automatic Guest/Enrolled status in item 16 — e.g. an Enrolled student on a break should be markable Inactive without losing Enrolled history.

---

## PRIORITY 1/2 — Payments and Certificates

### 19. Payment system
Build a payment flow (gateway integration, invoice generation, refund handling) for paid courses. This is what item 16's "purchase triggers Enrolled" logic depends on — it doesn't currently exist anywhere in the system. Sequence this after item 11 (data model) is stable so payment records can attach cleanly to student-course mappings.

### 20. Certificate generation and verification
Build certificate generation on course completion, with a way for students to download it and for third parties to verify authenticity (e.g. a verification ID/link). This is core to the platform's value proposition (the homepage already advertises certificates issued) and shouldn't stay unbuilt.

---

## PRIORITY 2 — Content, roles, and college data

### 21. Content publishing workflow (Draft/Published)
Every course/banner item gets a status: Draft (admin-only) or Published (visible to students). The student panel must only ever render Published content — this lets admins prepare new course pages without accidental early exposure.

### 22. Role-based access control (RBAC)
Implement roles:
| Role | Access |
|---|---|
| Super Admin | Everything, including managing other admin accounts |
| Admin / Data Entry Staff | Register/update students, view reports — no system config |
| Faculty | Only their assigned batches — attendance, materials, grading |

Every account should have an individual login with an audit trail of changes (who did what, when) — no shared/generic admin credentials.

### 23. College form improvements
Rebuild with: College Name, College ID/Code (unique), Affiliated University (dropdown), State dropdown → District dropdown (cascading, filtered by selected state), Full Address, Principal Name & contact, HOD Details (support multiple), College Website, College Logo upload. Reuse the same State→District component on the student registration form.

---

## PRIORITY 2 — Bulk features and uploads

### 24. Bulk student import via sample sheet
"Download Sample Sheet" button providing a template with exact expected column headers. On upload, validate every row before committing any — show a per-row error report (row number, field, reason), don't silently auto-fix bad data. Validation rules:
- Mobile/WhatsApp: exactly 10 digits, numeric only
- Email: valid format, reject duplicates
- Name: no numbers/special characters
- DOB: valid date, sane age range
- Program/College: must match existing master records (constrain via dropdown/data validation in the sheet template itself)

### 25. Document/resume/image upload
Add file upload to student profile (resume, ID proof, marksheets, photo) — store as referenced files, not inline blobs. Reuse the same upload component for course/banner images in the admin course screens.

### 26. Student-to-course/subject/program mapping screen
Dedicated screen: select a student → view all current mappings → Map button to add, Demap button (with confirmation) to remove. Support bulk mapping (select multiple students, map all to one course in one action). Keep a mapping history/audit log. Build on the many-to-many table from item 11.

### 27. Faculty panel
Build a scoped panel (not full admin access) for faculty: profile (expertise, contact, bio, photo), view of only their assigned courses/batches, attendance marking per batch/session, material upload (notes/slides/recordings, visible only to that batch's enrolled students), student progress/grading.

### 28. Form builder — image upload field type
Add "Image Upload" as a selectable field type in the form builder's field-type list, alongside existing types (text, dropdown, checkbox, etc.).

---

## PRIORITY 2 — Operational safety net

### 29. Backups and data recovery
Confirm automated backups exist and a tested recovery path in case of database failure or accidental bulk deletion/demapping.

### 30. Password/account recovery
Standard forgot-password flow for both students and staff/admin accounts.

### 31. Reporting/analytics dashboard
Once item 11's data model is in place, build basic reporting: enrollments per month, per-course drop-off, active vs inactive counts, etc.

### 32. Mobile responsiveness of Admin/Faculty panels
Confirm both panels are usable on mobile viewports, not just the student-facing site.

---

## PRIORITY 3 — Do last

### 33. Public API
Read-only, authenticated API first (API keys, rate limiting, audit logging of every access) — do NOT expose public write access (add/update) until items 11, 12, 24's validation rules are proven stable in the admin UI itself. This must comply with India's DPDP Act for any student PII exposed. Version the API (`/v1/`) from day one since external consumers will depend on the response shape.

---

## General engineering notes for whoever builds this
- Treat every "add X" item as needing both the database schema change AND the corresponding UI — don't ship one without the other.
- Every new required field on the registration form is a new failure point — default new fields to optional and fillable later unless there's a clear reason they must be captured at signup.
- Sensitive fields (Aadhaar, payment info) need access logging regardless of which priority tier they land in.
- This is a single-institute product — do not build multi-tenant data isolation, white-labeling, or per-client billing as part of this scope.
