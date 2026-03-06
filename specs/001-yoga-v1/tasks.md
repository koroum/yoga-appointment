# Tasks: Yoga Appointment App — v1 Core

**Input**: `specs/001-yoga-v1/` (spec.md, plan.md, data-model.md, research.md, contracts/)
**Prerequisites**: All spec-kit phases complete (constitution → specify → clarify → plan)
**Testing**: `docs/TESTING.md` — full strategy. Tests are inline per phase; write them first, verify they fail, then implement.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton, environment, tooling, and base component tests.

### Tests (write first)

- [ ] T001 [P] Write `src/__tests__/unit/dates.test.ts` — formatInNY, isWithin24h, DST boundary cases
- [ ] T002 [P] Write `src/__tests__/unit/imageCompression.test.ts` — PDF rejection, >5MB compression, resolution cap
- [ ] T003 [P] Write `src/__tests__/unit/bookingState.test.ts` — canCancelImmediately, requiresInstructorApproval for all booking states
- [ ] T004 [P] Write `src/__tests__/components/BookingStatusBadge.test.tsx` — correct color + symbol per status
- [ ] T005 [P] Write `src/__tests__/components/EmptyState.test.tsx` — shows next slot date or fallback message

### Implementation

- [ ] T006 Create `.env.example` — all required keys: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, SITE_URL
- [ ] T007 Create `src/types/index.ts` — all TypeScript types: User, InstructorProfile, Class, AvailabilityRule, Slot, Booking, NotificationsLog, InstructorStudent, StudentNotificationPref
- [ ] T008 [P] Create `src/lib/supabase.ts` — Supabase client with `detectSessionInUrl: false`
- [ ] T009 [P] Create `src/utils/dates.ts` — formatInNY, toNYTime, isWithin24h (America/New_York via date-fns-tz)
- [ ] T010 [P] Create `src/utils/imageCompression.ts` — browser-image-compression wrapper: max 5MB → 4.5MB, 1920px cap, PDF rejection with user error
- [ ] T011 [P] Create `src/utils/bookingState.ts` — canCancelImmediately, requiresInstructorApproval pure functions
- [ ] T012 Configure `vite.config.ts` — manualChunks: vendor-react, vendor-supabase, vendor-utils
- [ ] T013 [P] Create `src/components/BookingStatusBadge.tsx` — status badge: ●◌▪✕⚠✓ with correct colors
- [ ] T014 [P] Create `src/components/EmptyState.tsx` — next slot date or "no classes scheduled yet — check back soon"
- [ ] T015 [P] Create `src/components/SlotCard.tsx` — class title, date/time, duration, X of Y spots, status badge
- [ ] T016 Create `src/components/Navbar.tsx` — mobile-first nav: logo, hamburger menu, account dropdown
- [ ] T017 Create `src/components/ProtectedRoute.tsx` — auth guard with loading state + role check (instructor/student)
- [ ] T018 Create `src/hooks/useAuth.tsx` — auth context: session, user, role, loading; `useRef(false)` StrictMode guard

### Run tests
```
npx vitest run src/__tests__/unit/
npx vitest run src/__tests__/components/BookingStatusBadge.test.tsx
npx vitest run src/__tests__/components/EmptyState.test.tsx
```

**Checkpoint**: All unit + component tests pass. `npm run dev` starts. `.env.example` committed.

---

## Phase 2: Foundational — Database & Auth

**Purpose**: Supabase schema, RLS, DB functions, and auth pages. BLOCKS all user story work.

**WARNING**: No feature work can begin until this phase is complete.

### Tests (write first)

- [ ] T019 Write `tests/db/migrations.test.ts` — all 9 tables exist, CHECK constraints work (email/phone null), status column constraints, FK references, composite PK on instructor_students
- [ ] T020 Write `tests/db/rls.test.ts` — anon/student/instructor access per table per operation (see docs/TESTING.md Layer 3 for full case list)
- [ ] T021 Write `tests/db/book_slot.test.ts` — happy path, capacity enforcement, pending-not-counted, concurrent race condition, past slot rejection, unavailable slot rejection

### Implementation

- [ ] T022 Write `supabase/migrations/001_core_tables.sql` — users (CHECK: email OR phone not null, role IN constraint, username unique), instructor_profiles, classes
- [ ] T023 Write `supabase/migrations/002_scheduling.sql` — availability_rules, slots (status IN constraint)
- [ ] T024 Write `supabase/migrations/003_bookings_notifications.sql` — instructor_students (composite PK), bookings (status IN constraint, proposed_slot_id FK), notifications_log, student_notification_prefs; PostgreSQL function `book_slot(slot_id uuid, student_id uuid, booked_by text)` with `SELECT FOR UPDATE` capacity check
- [ ] T025 Write `supabase/migrations/004_rls_policies.sql` — RLS on all 9 tables per data-model.md
- [ ] T026 Write `supabase/migrations/005_indexes.sql` — slots(starts_at), bookings(slot_id, student_id, status), notifications_log(booking_id, type, sent_at)
- [ ] T027 Apply all migrations: `supabase db reset`
- [ ] T028 Create `src/pages/AuthCallback.tsx` — handles `?code=`, `#access_token=`, `?token_hash=`; `useRef(false)` double-exchange guard; redirects by role
- [ ] T029 Create `src/pages/Login.tsx` — email OTP + phone OTP, mobile-first
- [ ] T030 Create `src/pages/Signup.tsx` — role selector, name + email + phone (at least one required), OTP verification
- [ ] T031 Wire up `src/App.tsx` — react-router-dom v7 routes per plan.md routing table; ProtectedRoute wrapping

### Run tests
```
supabase start
npx vitest run tests/db/
```

**Checkpoint**: All DB tests pass. Sign up as instructor and student, session persists, role-based redirect works.

---

## Phase 3: Story 1 — Instructor Profile & Availability (P1) — MVP

**Goal**: Instructor signs up, creates her public profile, sets recurring availability, shares her link.

**Independent Test**: Visit `/instructor/[username]` as anonymous user — see name, bio, photos, upcoming slots.

### Tests (write first)

- [ ] T032 [P] Write `supabase/functions/generate-slots/index.test.ts` (Deno.test) — generates 2-month window, idempotent, skips unavailable dates, completes <2s, handles rule change (deletes unbooked, leaves confirmed intact)
- [ ] T033 [P] Write `tests/e2e/instructor-setup.spec.ts` (Playwright) — full instructor journey: signup → profile → availability → public profile visible at /instructor/[username] → unavailable date blocks slot

### Implementation

- [ ] T034 [P] [US1] Create `src/pages/instructor/Profile.tsx` — edit form (name, bio, passion); photo upload with compression to `instructor-photos` bucket; display + copy profile URL
- [ ] T035 [P] [US1] Create `src/pages/GuestProfile.tsx` — public `/instructor/:username` (anon access); instructor_profiles + upcoming available slots; cover photo, avatar, bio, photos grid, class cards; "Book a Class / Sign Up" CTA
- [ ] T036 [US1] Create `src/pages/instructor/Availability.tsx` — recurring rules list (day, time, class, duration, max_capacity, edit/delete); date override picker (mark unavailable); upcoming overrides list; [+ Add recurring slot]
- [ ] T037 [US1] Create `supabase/functions/generate-slots/index.ts` — reads availability_rules, generates slots for rolling 2-month window; idempotent; skips unavailable overrides; on rule change: deletes unbooked future slots, regenerates, triggers schedule_changed notifications for affected students
- [ ] T038 [US1] Register `generate-slots`: daily pg_cron + DB webhook on availability_rules INSERT/UPDATE
- [ ] T039 [US1] Create `src/pages/instructor/Dashboard.tsx` — CSS Grid calendar (month nav); slot status legend; day detail panel (slot cards + Add slot); Quick Actions grid

### Run tests
```
deno test supabase/functions/generate-slots/
npx playwright test tests/e2e/instructor-setup.spec.ts
```

**Checkpoint**: Instructor sets up profile → shares link → anonymous user sees upcoming classes at /instructor/sarah.

---

## Phase 4: Story 2 — Student Discovers and Books (P1) — MVP

**Goal**: Student visits instructor profile, signs up, browses slots, requests booking. Instructor confirms. Both notified.

**Independent Test**: Full round-trip — student requests → PENDING → instructor accepts → CONFIRMED → email + SMS sent.

### Tests (write first)

- [ ] T040 [P] Write `src/__tests__/components/BookingRequestModal.test.tsx` — renders slot details, note field, Send Request calls book_slot RPC, shows "slot full" error on capacity exceeded, closes on cancel
- [ ] T041 [P] Write `supabase/functions/send-notifications/index.test.ts` (Deno.test) — all notification types, email-only (no phone), SMS-only (no email), dedup by booking_id+type+sent_date, retry on failure, mark failed after retry failure
- [ ] T042 Write `tests/e2e/student-booking.spec.ts` (Playwright) — student visits profile → signs up (linked to instructor) → browses slots → requests booking → PENDING in My Bookings → instructor accepts → CONFIRMED → instructor direct-books another student → immediately CONFIRMED

### Implementation

- [ ] T043 [US2] Extend `src/pages/Signup.tsx` — detect instructor context from URL; on account creation INSERT instructor_students row (linked_via: 'discovery')
- [ ] T044 [US2] Create `src/pages/student/Browse.tsx` — list/calendar toggle; slots grouped by This Week/Next Week; capacity indicator; [Request] button per slot; empty state (next slot date or "no classes scheduled")
- [ ] T045 [US2] Create `src/components/BookingRequestModal.tsx` — slot details, spots available, optional note, Send Request → `supabase.rpc('book_slot')` → pending; "slot full" error handling
- [ ] T046 [US2] Create `src/pages/student/MyBookings.tsx` — Upcoming/Past tabs; booking cards with status badge; Cancel button (respects 24h rule via canCancelImmediately); "Awaiting instructor" note on PENDING
- [ ] T047 [US2] Create `src/pages/instructor/BookingRequests.tsx` — pending requests (Accept/Reject/Propose alternate); Cancellation Requests section with late-cancel warning; update booking status via Supabase
- [ ] T048 [US2] Create `supabase/functions/send-notifications/index.ts` — DB webhook on bookings INSERT/UPDATE; sends Resend (email) + Twilio (SMS) in parallel; channel skipped if student has no email/phone; dedup check before send; log to notifications_log (sent/retrying/failed)
- [ ] T049 [US2] Implement retry in send-notifications — pg_cron retry after 5 min on failure; mark `failed` if retry also fails

### Run tests
```
npx vitest run src/__tests__/components/BookingRequestModal.test.tsx
deno test supabase/functions/send-notifications/
npx playwright test tests/e2e/student-booking.spec.ts
```

**Checkpoint**: Full booking round-trip works. Student requests → instructor confirms → both receive email + SMS.

---

## Phase 5: Story 3 — Instructor Direct-Books Student (P1)

**Goal**: Instructor assigns a student to a slot; booking confirmed immediately, student notified.

**Independent Test**: Instructor opens slot → assigns student → booking is CONFIRMED (no pending step) → student notified.

### Tests (write first)

- [ ] T050 Extend `tests/e2e/student-booking.spec.ts` — instructor direct-book scenario: selects slot + student → booking immediately CONFIRMED → student notification sent

### Implementation

- [ ] T051 [US3] Add "Assign student" to slot detail in `Dashboard.tsx` — linked students dropdown; on confirm, `supabase.rpc('book_slot', { booked_by: 'instructor' })` → inserts with status 'confirmed'; send-notifications fires via DB webhook

### Run tests
```
npx playwright test tests/e2e/student-booking.spec.ts
```

**Checkpoint**: Direct-book creates confirmed booking. Student notified immediately. SHIP MVP.

---

## Phase 6: Story 4 — Cancellation Flows (P2)

**Goal**: >24h cancellation is immediate. <24h goes through instructor approval or alt slot proposal.

**Independent Test**: All four paths work: pending cancel, >24h cancel, <24h cancel → instructor accepts, <24h cancel → instructor proposes alt.

### Tests (write first)

- [ ] T052 [P] Extend `src/__tests__/unit/bookingState.test.ts` — verify canCancelImmediately and requiresInstructorApproval for all paths including pending booking edge case
- [ ] T053 [P] Write `tests/e2e/cancellation.spec.ts` (Playwright) — all four cancellation paths; verify slot freed after immediate cancel; verify proposed alt offer appears in My Bookings; verify decline cancels original

### Implementation

- [ ] T054 [US4] Add cancel handler to `MyBookings.tsx` — pending → immediate cancel; confirmed >24h → immediate cancel; confirmed <24h → set status cancellation_requested + cancellation_requested_at
- [ ] T055 [US4] Add cancellation_requested section to `BookingRequests.tsx` — Accept (→ cancelled) or Propose new slot (→ set proposed_slot_id, notify student)
- [ ] T056 [US4] Add alt slot acceptance to `MyBookings.tsx` — show offer when proposed_slot_id set; Confirm (→ new slot confirmed) or Decline (→ original cancelled)
- [ ] T057 [US4] Extend send-notifications — add types: cancellation_requested, alternative_proposed, alternative_confirmed, slot_cancelled

### Run tests
```
npx vitest run src/__tests__/unit/bookingState.test.ts
npx playwright test tests/e2e/cancellation.spec.ts
```

**Checkpoint**: All cancellation paths correct. Slot freed on cancellation. Notifications sent for each path.

---

## Phase 7: Story 5 — Automated Reminders (P2)

**Goal**: Students receive reminders at 28h and 4h before class. Instructor can disable per student.

**Independent Test**: Reminder fires within 5 min of 28h mark. Disabled student gets nothing. No duplicate reminders.

### Tests (write first)

- [ ] T058 Write `supabase/functions/send-reminders/index.test.ts` (Deno.test) — finds bookings in 28h–27h window, finds bookings in 4h–3h window, skips reminders_enabled=false students, dedup prevents double-send
- [ ] T059 Write `tests/e2e/reminders.spec.ts` (Playwright) — manually invoke reminder function for a confirmed booking; verify notifications_log entry; verify reminders_enabled=false student has no entry

### Implementation

- [ ] T060 [US5] Create `supabase/functions/send-reminders/index.ts` — query confirmed bookings in 28h–27h window (reminder_28h) and 4h–3h window (reminder_4h); check student_notification_prefs.reminders_enabled; dedup via notifications_log; send email + SMS
- [ ] T061 [US5] Register reminder cron: every 15 minutes
- [ ] T062 [US5] Add reminders toggle to `Students.tsx` — per-student toggle updates student_notification_prefs.reminders_enabled

### Run tests
```
deno test supabase/functions/send-reminders/
npx playwright test tests/e2e/reminders.spec.ts
```

**Checkpoint**: Reminder fires within 5 min of scheduled time. Disabled student skipped. No duplicates.

---

## Phase 8: Story 6 — Recurring Schedule Changes (P2)

**Goal**: When instructor changes recurring availability, unbooked slots update. Affected students notified.

**Independent Test**: Change Mon 9am → Mon 10am; unbooked Mon slots shift; confirmed Mon bookings trigger schedule_changed notification.

### Tests (write first)

- [ ] T063 Extend `supabase/functions/generate-slots/index.test.ts` — rule change: unbooked future slots deleted and regenerated; confirmed bookings untouched; schedule_changed notification triggered for affected students

### Implementation

- [ ] T064 [US6] Extend `generate-slots` — on availability_rules UPDATE: delete unbooked future slots in affected range, regenerate; find students with confirmed bookings in range, trigger schedule_changed notification; log count of affected bookings for instructor to see in Dashboard

### Run tests
```
deno test supabase/functions/generate-slots/
```

**Checkpoint**: Rule change updates unbooked slots only. Affected students notified. Instructor sees affected booking count.

---

## Phase 9: Story 7 — Group Classes (P2/P3)

**Goal**: Slots with max_capacity > 1 accept multiple students until full. Full slots cannot be booked.

**Independent Test**: Capacity-5 slot accepts 5 confirmed bookings; 6th gets "slot is now full" error.

### Tests (write first)

- [ ] T065 [P] Extend `tests/db/book_slot.test.ts` — capacity-3 slot: 3 succeed, 4th fails; pending bookings don't count toward capacity; cancelled bookings free the seat
- [ ] T066 [P] Write `tests/e2e/group-class.spec.ts` (Playwright) — capacity-3 slot: shows "3 of 3 open", reduces with each booking, shows "Class full" at capacity, 4th student sees error, cancellation frees seat

### Implementation

- [ ] T067 [US7] Verify `book_slot()` DB function enforces max_capacity — confirmed count < capacity check with FOR UPDATE (should already be correct from T024; verify with concurrent test)
- [ ] T068 [US7] Update `SlotCard.tsx` and `Browse.tsx` — show "X of Y spots available"; hide [Request] when full; show "Class full" badge
- [ ] T069 [US7] Handle "slot full" error in `BookingRequestModal.tsx` — "This slot is now full" message with link to browse other slots

### Run tests
```
npx vitest run tests/db/book_slot.test.ts
npx playwright test tests/e2e/group-class.spec.ts
```

**Checkpoint**: No booking exceeds max_capacity. Concurrent race handled by DB transaction. UI reflects capacity correctly.

---

## Phase 10: Students Roster (Supporting)

**Goal**: Instructor views students, manages notification prefs, invites new students, retries failed notifications.

### Tests (write first)

- [ ] T070 Extend `tests/db/rls.test.ts` — instructor can toggle reminders_enabled for linked students; cannot modify prefs for unlinked students

### Implementation

- [ ] T071 Create `src/pages/instructor/Students.tsx` — linked students list (name, email, phone, reminders toggle); Failed Notifications section (notifications_log failed entries with Retry); [+ Invite student] sends one-time invite link via email/SMS

### Run tests
```
npx vitest run tests/db/rls.test.ts
```

**Checkpoint**: Instructor can manage all students. Failed notifications visible and retryable.

---

## Phase 11: Polish & Cross-Cutting

- [ ] T072 [P] Add loading states (skeleton loaders or spinners) to all async operations across all pages
- [ ] T073 [P] Add error boundaries and user-facing error messages on all pages
- [ ] T074 [P] Audit mobile layout at 375px — fix overflow, spacing, touch targets on every screen
- [ ] T075 Create `src/hooks/useSlots.ts`, `src/hooks/useBookings.ts`, `src/hooks/useNotifications.ts` — extract data fetching from pages
- [ ] T076 Verify `tsc -b && vite build` passes clean — no `any`, no type errors
- [ ] T077 Run full test suite end-to-end:
  ```
  npx vitest run src/__tests__/
  npx vitest run tests/db/
  deno test supabase/functions/
  npx playwright test
  ```
- [ ] T078 Run quickstart.md validation milestones (all 7 checkpoints)

**Checkpoint**: Clean build. All tests green. All quickstart milestones pass.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundation)**: Depends on Phase 1 — BLOCKS phases 3–11
- **Phase 3 (Story 1)**: Depends on Phase 2 — instructor must exist before student can browse
- **Phase 4 (Story 2)**: Depends on Phase 3 — slots must exist for student to request
- **Phase 5 (Story 3)**: Depends on Phase 4 — student roster must exist for direct-book
- **Phases 6–9 (P2)**: Depend on Phases 3–5 — can proceed in any order after MVP shipped
- **Phase 10**: Can run alongside Phase 7 (both touch students/notifications)
- **Phase 11 (Polish)**: After all desired stories complete

### Parallel Opportunities

- All Phase 1 tests (T001–T005) — parallel
- T009, T010, T011 (utils) — parallel
- T013, T014, T015 (components) — parallel
- T022–T026 (migrations) — write in parallel, apply sequentially with T027
- T034, T035 (Profile, GuestProfile) — parallel once Phase 2 done
- T040, T041 (modal test, notification test) — parallel
- Phase 11 tasks T072–T074 — parallel

---

## Implementation Strategy

### MVP First (Phases 1–5)

1. Phase 1: Setup + unit/component tests
2. Phase 2: Foundation + DB tests
3. Phase 3: Story 1 + E2E instructor setup
4. **Validate**: `/instructor/sarah` works for anonymous user
5. Phase 4: Story 2 + E2E booking round-trip
6. Phase 5: Story 3 (direct-book)
7. **SHIP MVP**

### Full v1 (Phases 6–11)

8. Phase 6: Cancellation flows
9. Phase 7: Reminders
10. Phase 8: Schedule changes
11. Phase 9: Group classes
12. Phase 10: Students roster
13. Phase 11: Polish + full test suite

---

## Notes

- [P] = can run in parallel with other [P] tasks in same section (different files, no deps)
- [US#] = maps to user story in spec.md for traceability
- **Write tests first, verify they fail, then implement** — this is the forcing function
- Commit after each phase checkpoint — include test results in commit message
- `tsc -b && vite build` must pass clean at every commit (Article XVII)
- Never commit `.env.local` or `.env.production` — only `.env.example`
- All timestamps stored UTC, displayed in America/New_York (Article III)
- Test at 375px on every UI task (Article II)
