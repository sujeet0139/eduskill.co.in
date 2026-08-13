# Development Prompt — Campaign Link: Admin Management

## Context
This is a companion prompt to the main "Campaign / pre-filled registration link" feature (item 0 in the main dev prompt). That prompt covers what the **student** sees. This one covers what the **admin** needs to create, edit, and monitor campaigns — the part that makes the feature reusable for every future college visit without engineering involvement each time.

A campaign here means: one landing flow (benefits → pre-filled form → feedback → confirmation) tied to one event, batch, and shareable link.

---

## 1. Create and edit a campaign
Admin should be able to create a new campaign from a form, without touching code:
- **Link target:** College, Program, Course, Batch (dropdowns from existing master data)
- **Source/slug:** short identifier used in the URL and for filtering later (e.g. `noida-college-session`)
- **Landing content (Step 1):** hero tag text, headline, subheading, and a list of benefit cards (icon/emoji, title, short description) — addable/removable/reorderable, not a fixed count
- **Feedback step config (Step 3):** the list of "interest" chips (editable per campaign — an AI/ML session and a Web Dev session shouldn't show the same options by default), whether the counselor call-back toggle is shown, whether the whole feedback step is shown at all (some campaigns may not need it)
- **Confirmation message (Step 4):** template with variables (`{name}`, `{course}`, `{batch}`, `{start_date}`, `{group_link}`) — reuse the template from the main prompt as the default, editable per campaign in case wording needs to change for a specific event
- **Validity window:** optional start/end date after which the link stops accepting new registrations (auto-shows a "this link has expired" state instead of a broken form)
- **Status toggle:** Active / Paused — admin can pause a link without deleting it or its data

**Acceptance:** Admin can go from "nothing exists" to a working, shareable campaign link in under 5 minutes, entirely through the UI.

## 2. Generate the shareable link and QR code
- Auto-generate the full URL (with all query parameters) the moment the campaign is saved
- Auto-generate a QR code image for it, downloadable as PNG for slides/handouts
- Provide a shortened version of the link (either self-hosted short URL or integration with a shortener) for anyone typing it manually
- **Important:** editing a campaign's content later (headline, benefits, message template) must NOT change the URL or invalidate an already-printed/shared QR code — content is mutable, the link identity is not

## 3. Live preview before sharing
A "Preview" button that opens the actual student-facing flow exactly as a student would see it (ideally in a mobile-width preview frame), so admin can check the content reads well before printing a QR code or walking into a college. This should use the real rendering, not a separate mockup — if the two ever diverge, it defeats the purpose of previewing.

## 4. View and manage collected registrations
Per campaign, a list view showing every registration with: name, mobile, email, registered timestamp, feedback rating (if given), selected interests, counselor call-back opt-in (flagged clearly since this is the highest-value signal). Support:
- Search/filter within a campaign's registrations (reuses item 15's filter component from the main prompt)
- Export to Excel/CSV for offline follow-up or import into a CRM/WhatsApp broadcast list
- **Edit a registration** if there's a data entry error (e.g. wrong mobile number) — this depends on the single-student-view bug (item 4 in the main prompt) actually being fixed, since it's the same underlying screen
- Bulk action: mark selected registrations as "contacted" so follow-up calls aren't duplicated across staff

## 5. Campaign performance dashboard
A simple funnel per campaign: **link opens → registrations started → registrations completed → feedback submitted → counselor opt-ins**. This requires tracking link opens (a lightweight hit counter on page load, not full analytics tooling) to make the funnel meaningful — without it, admin only sees completions and can't tell if a low number means "nobody scanned the QR code" or "people scanned it and dropped off," which are very different problems to fix.
Support comparing 2+ campaigns side by side (e.g. Noida session vs. a different college's session) to see which visits are actually worth repeating.

## 6. Permissions
Creating/editing campaigns should respect the RBAC roles already scoped (item 22 in the main prompt) — likely Admin and Super Admin only, not Faculty. Every create/edit action should be attributed to the admin account that made it (audit trail), same principle as the rest of the admin panel.

## 7. Clone an existing campaign
Let admin duplicate a past campaign as the starting point for a new one (same benefit list, same feedback questions, same message template style) and just swap the College/Batch/date. Most campaigns will be near-identical between visits — cloning turns "5 minutes to set up" into "1 minute to set up," which matters if this is used regularly.

---

## Suggestions beyond what was asked (worth considering, not required for v1)

- **Real-time registration counter visible during the session.** If you're standing in the room, a simple live number ("14 registered so far") displayed on a phone or projected screen creates in-the-moment social proof and urgency — genuinely useful for exactly the scenario you described (in-person session, register before people leave).
- **Instant notification to admin/staff when a registration comes in.** A push notification or WhatsApp alert the moment someone registers, so field staff know engagement is happening in real time rather than checking the dashboard later.
- **Basic spam/bot protection on the public form.** Since this is a public link shared broadly (QR code, WhatsApp forwards), add simple protection (e.g. a lightweight CAPTCHA or rate-limit by IP) so the registration list doesn't get polluted with junk submissions if the link circulates beyond the intended audience.
- **Auto-archive expired campaigns** from the main "active campaigns" list (but keep the data) so the admin panel doesn't accumulate clutter after dozens of college visits over a year.
- **Attach the campaign's data straight into the "Guest vs Enrolled" and "Student mapping" systems** (items 6/13/16 in the main prompt) — a campaign registration should flow into the same student record and batch mapping as any other registration, not live in a separate silo. Worth double-checking this explicitly during build so campaign data doesn't end up as a second, disconnected list of students.
