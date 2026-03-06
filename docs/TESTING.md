# Testing Strategy — Yoga Appointment App

**Applies to**: v1 and future enhancements
**Last updated**: 2026-03-05

---

## Philosophy

Test the things that break silently and cost users the most. For a booking app, that means:

1. **DB integrity** — RLS blocks wrong users; `book_slot()` never exceeds capacity
2. **Booking state machine** — every transition is legal; no double-confirm, no ghost bookings
3. **Notifications** — right message, right person, right channel, not sent twice
4. **Auth guards** — students can't see instructor pages; anon can't book

Unit-test pure logic cheaply. Integration-test the database thoroughly. E2E-test the full user journeys that matter most.

---

## Stack

| Layer | Tool | What it covers |
|---|---|---|
| Unit | Vitest | Pure functions — date utils, image compression, booking state logic |
| Component | Vitest + React Testing Library | UI components — status badge, slot card, empty state, modal |
| Database | Vitest + Supabase local | RLS policies, DB functions, migrations, concurrent booking |
| E2E | Playwright | Full user journeys — signup to confirmed booking, cancellation flows |
| Edge Functions | Deno.test (inline) | Notification dispatch, slot generation, retry logic — with mocked Resend/Twilio |

---

## Folder Structure

```
/
├── src/
│   ├── __tests__/
│   │   ├── unit/
│   │   │   ├── dates.test.ts
│   │   │   ├── imageCompression.test.ts
│   │   │   └── bookingState.test.ts
│   │   └── components/
│   │       ├── BookingStatusBadge.test.tsx
│   │       ├── SlotCard.test.tsx
│   │       ├── EmptyState.test.tsx
│   │       └── BookingRequestModal.test.tsx
├── tests/
│   ├── db/                       ← Supabase local integration tests
│   │   ├── rls.test.ts           ← RLS policy tests per table
│   │   ├── book_slot.test.ts     ← DB function + concurrency tests
│   │   └── migrations.test.ts    ← Schema shape validation
│   └── e2e/                      ← Playwright tests
│       ├── instructor-setup.spec.ts
│       ├── student-booking.spec.ts
│       ├── cancellation.spec.ts
│       ├── reminders.spec.ts
│       └── group-class.spec.ts
└── supabase/
    └── functions/
        ├── send-notifications/
        │   └── index.test.ts     ← Deno.test
        ├── send-reminders/
        │   └── index.test.ts
        └── generate-slots/
            └── index.test.ts
```

---

## Layer 1: Unit Tests (Vitest)

Run with: `npx vitest run src/__tests__/unit/`

Fast, no network, no DB. Test pure logic only.

### dates.test.ts
```
✓ formatInNY converts UTC timestamp to America/New_York
✓ formatInNY handles DST correctly (March and November boundaries)
✓ isWithin24h returns true when class is 23h away
✓ isWithin24h returns false when class is 25h away
✓ isWithin24h returns false when class is in the past
```

### imageCompression.test.ts
```
✓ compressImage passes through images under 5MB without compression
✓ compressImage compresses images over 5MB to ≤4.5MB
✓ compressImage rejects PDFs with user-facing error message
✓ compressImage caps resolution at 1920px
```

### bookingState.test.ts
```
✓ canCancelImmediately returns true for pending bookings (no 24h check)
✓ canCancelImmediately returns true for confirmed bookings >24h away
✓ canCancelImmediately returns false for confirmed bookings <24h away
✓ requiresInstructorApproval returns true for confirmed <24h cancellations
✓ requiresInstructorApproval returns false for pending cancellations
```

---

## Layer 2: Component Tests (Vitest + RTL)

Run with: `npx vitest run src/__tests__/components/`

Test rendering and user interaction. Mock Supabase client.

### BookingStatusBadge.test.tsx
```
✓ renders green ● for 'available'
✓ renders yellow ◌ for 'pending'
✓ renders blue ▪ for 'confirmed'
✓ renders gray ✕ for 'unavailable' / 'cancelled'
✓ renders orange ⚠ for 'cancellation_requested'
```

### SlotCard.test.tsx
```
✓ displays class title, date, time, duration
✓ shows "X of Y spots available" for group classes
✓ shows [Request] button when slot is available
✓ shows "Class full" when confirmed count = max_capacity
✓ hides [Request] when slot is unavailable
```

### EmptyState.test.tsx
```
✓ shows next upcoming slot date when one exists
✓ shows "no classes scheduled yet — check back soon" when none exist
```

### BookingRequestModal.test.tsx
```
✓ shows slot details (title, date, time, instructor, spots)
✓ optional note field is present and editable
✓ [Send Request] calls book_slot RPC with correct args
✓ shows "This slot is now full" error on capacity exceeded response
✓ closes on [Cancel] click
✓ closes on ✕ click
```

---

## Layer 3: Database Integration Tests (Supabase Local)

Run with: `npx vitest run tests/db/` (requires `supabase start`)

These tests connect to the local Supabase instance, sign in as different users, and verify RLS + DB functions. **Most critical layer** for this app.

### Setup pattern

```typescript
// tests/db/helpers.ts
export async function signInAs(role: 'instructor' | 'student', userId: string) { ... }
export async function signInAsAnon() { ... }
export async function createTestInstructor() { ... }
export async function createTestStudent(instructorId: string) { ... }
export async function createTestSlot(instructorId: string, classId: string) { ... }
```

---

### rls.test.ts

**instructor_profiles**
```
✓ anon can SELECT all instructor_profiles
✓ anon cannot INSERT instructor_profiles
✓ instructor can UPDATE own profile
✓ instructor cannot UPDATE another instructor's profile
✓ student can SELECT any instructor_profile
✓ student cannot UPDATE any instructor_profile
```

**slots**
```
✓ anon can SELECT slots where status = 'available'
✓ anon cannot SELECT slots where status = 'unavailable'
✓ student can SELECT available slots
✓ instructor can CRUD own slots
✓ instructor cannot UPDATE another instructor's slots
```

**bookings**
```
✓ student can SELECT own bookings
✓ student cannot SELECT another student's bookings
✓ student can INSERT a booking for themselves
✓ student cannot INSERT a booking for another student
✓ instructor can SELECT all bookings on their slots
✓ instructor cannot SELECT bookings on another instructor's slots
✓ instructor can UPDATE booking status (accept/reject)
✓ student cannot UPDATE booking status (no accept/reject)
```

**notifications_log**
```
✓ student can SELECT own notification records
✓ student cannot SELECT another student's notifications
✓ instructor can SELECT all notifications for their students
```

**student_notification_prefs**
```
✓ instructor can UPDATE reminders_enabled for their linked students
✓ student cannot UPDATE their own notification prefs directly (instructor-controlled)
✓ instructor cannot UPDATE prefs for students not linked to them
```

---

### book_slot.test.ts

**Happy path**
```
✓ book_slot inserts a booking with status 'pending' when called by student
✓ book_slot inserts a booking with status 'confirmed' when booked_by = 'instructor'
✓ book_slot returns the new booking id on success
✓ confirmed booking count increases by 1 after confirmed booking
```

**Capacity enforcement**
```
✓ book_slot succeeds when confirmed count < max_capacity
✓ book_slot returns error when confirmed count = max_capacity (slot full)
✓ pending bookings do NOT count toward capacity (only confirmed)
✓ cancelled bookings do NOT count toward capacity
```

**Concurrent booking (race condition)**
```
✓ two simultaneous book_slot calls on last seat: exactly one succeeds, one gets "slot full" error
  (run both calls without awaiting, then await both — check one booking created)
```

**Slot status**
```
✓ book_slot rejects booking on unavailable slot
✓ book_slot rejects booking if slot.starts_at is in the past
```

---

### migrations.test.ts

Validates that the schema matches expectations after all migrations run.

```
✓ users table has columns: id, email, phone, name, role, username, created_at
✓ users CHECK constraint rejects row with both email and phone null
✓ users accepts row with only email
✓ users accepts row with only phone
✓ slots.status is constrained to 'available' | 'unavailable'
✓ bookings.status is constrained to known values
✓ instructor_students has composite PK (instructor_id, student_id)
✓ all 9 tables exist after migrations
✓ all foreign keys reference correct parent tables
```

---

## Layer 4: E2E Tests (Playwright)

Run with: `npx playwright test`

Full browser tests against local dev server + local Supabase. Slow but catch integration gaps.

### instructor-setup.spec.ts — Story 1

```
✓ Instructor signs up with email, lands on dashboard
✓ Instructor completes profile (name, bio, photo upload)
✓ Public profile is accessible at /instructor/[username] without login
✓ Instructor sets recurring Monday 9am slot (Morning Flow, 60 min, max 5)
✓ Slot appears on public profile page within 2 seconds of creation
✓ Instructor marks a specific date as unavailable — slot disappears from public profile
✓ Instructor copies profile link from Edit Profile page
```

### student-booking.spec.ts — Story 2 + 3

```
✓ Student visits /instructor/sarah, sees upcoming classes
✓ Student clicks "Book a Class / Sign Up", fills form, creates account
✓ Student account is linked to instructor (row exists in instructor_students)
✓ Student browses available slots — sees capacity indicator
✓ Student clicks [Request] on Morning Flow, sees booking modal
✓ Student sends request — booking status is 'pending'
✓ Student sees booking as PENDING in My Bookings
✓ Instructor sees request in Booking Requests page
✓ Instructor clicks [Accept] — booking status becomes 'confirmed'
✓ Student sees booking as CONFIRMED in My Bookings
✓ Instructor direct-books a student — booking is immediately CONFIRMED (no pending step)
```

### cancellation.spec.ts — Story 4

```
✓ Student cancels a PENDING booking — immediately cancelled, slot freed
✓ Student cancels a confirmed booking >24h away — immediately cancelled, slot freed
✓ Student cancels a confirmed booking <24h away — status becomes 'cancellation_requested'
✓ Instructor sees late cancellation in Cancellation Requests section
✓ Instructor accepts late cancellation — booking cancelled
✓ Instructor proposes alternate slot — student sees offer in My Bookings
✓ Student accepts alternate — booking moves to new slot with confirmed status
✓ Student declines alternate — original booking cancelled
```

### group-class.spec.ts — Story 7

```
✓ Slot with max_capacity 3 shows "3 of 3 spots available" initially
✓ After 2 confirmed bookings shows "1 of 3 spots available"
✓ After 3 confirmed bookings shows "Class full" — [Request] hidden
✓ 4th student sees "Class full" message
✓ Cancelled booking frees a seat — slot shows "1 of 3 spots available" again
```

### reminders.spec.ts — Story 5

```
✓ Confirmed booking exists; manually invoke reminder edge function for 28h window
  → notifications_log has 'reminder_28h' entry with status 'sent'
✓ Student with reminders_enabled = false: reminder edge function skips them
  → no notifications_log entry created
✓ Reminder not sent twice: invoking cron again for same window does not create duplicate entry
  (dedup by booking_id + type + sent_date)
```

---

## Layer 5: Edge Function Tests (Deno.test)

Each edge function has an `index.test.ts` alongside it. Run with: `deno test supabase/functions/`

Uses mocked Resend and Twilio SDKs (dependency injection pattern).

### send-notifications/index.test.ts

```
✓ booking_requested event: sends email to instructor, SMS to instructor
✓ booking_confirmed event: sends email to student, SMS to student
✓ booking_rejected event: sends email to student, SMS to student
✓ student with no phone: skips SMS, sends email only
✓ student with no email: skips email, sends SMS only
✓ dedup: does not send if notifications_log already has matching booking_id + type + sent_date
✓ on Resend failure: logs status 'retrying', schedules retry
✓ on Twilio failure: logs status 'retrying', schedules retry
✓ on retry failure: marks notification as 'failed'
✓ on retry success: marks notification as 'sent'
```

### generate-slots/index.test.ts

```
✓ generates slots for rolling 2-month window from availability_rules
✓ skips dates already in slots table (idempotent)
✓ skips dates where instructor has set status = 'unavailable'
✓ completes within 2 seconds for standard 2-month window
✓ on rule change: deletes unbooked future slots and regenerates
✓ on rule change: leaves confirmed bookings intact
✓ on rule change: triggers schedule_changed notification for affected students
```

### send-reminders/index.test.ts

```
✓ finds confirmed bookings in 28h–27h window and sends reminder_28h
✓ finds confirmed bookings in 4h–3h window and sends reminder_4h
✓ skips students where reminders_enabled = false
✓ dedup: does not send reminder twice for same booking + window
```

---

## Phase-by-Phase Testing Checklist

As each implementation phase completes, run the corresponding test group:

| Phase | Implementation | Tests to run |
|---|---|---|
| Phase 1 (Setup) | Types, utils, components | Unit tests + Component tests (all) |
| Phase 2 (Foundation) | Migrations, auth pages | `tests/db/migrations.test.ts`, auth E2E (signup/login) |
| Phase 3 (Story 1) | Profile, availability, slot gen | `tests/db/rls.test.ts` (profiles/slots), `instructor-setup.spec.ts`, `generate-slots/index.test.ts` |
| Phase 4 (Story 2) | Browse, booking, notifications | `tests/db/book_slot.test.ts`, `student-booking.spec.ts`, `send-notifications/index.test.ts` |
| Phase 5 (Story 3) | Direct-book | `student-booking.spec.ts` (direct-book section) |
| Phase 6 (Story 4) | Cancellation flows | `cancellation.spec.ts` |
| Phase 7 (Story 5) | Reminders | `reminders.spec.ts`, `send-reminders/index.test.ts` |
| Phase 8 (Story 6) | Schedule changes | `generate-slots/index.test.ts` (rule change section) |
| Phase 9 (Story 7) | Group classes | `group-class.spec.ts`, `tests/db/book_slot.test.ts` (capacity section) |

---

## CI Pipeline

Add to GitHub Actions (or Vercel CI):

```yaml
# .github/workflows/ci.yml
steps:
  - name: Type check + build
    run: tsc -b && vite build

  - name: Unit + Component tests
    run: npx vitest run src/__tests__/

  - name: Start local Supabase
    run: supabase start

  - name: DB integration tests
    run: npx vitest run tests/db/

  - name: Edge function tests
    run: deno test supabase/functions/

  - name: E2E tests
    run: npx playwright test
```

**Gate**: PR cannot merge if any layer fails.

---

## Test Data Strategy

- Use **seed scripts** (`supabase/seed.sql`) for consistent test data in local env
- E2E tests **create and clean up their own data** — never rely on pre-existing DB state
- DB integration tests run inside **transactions that roll back** after each test where possible
- **Never use production credentials** in tests — `.env.test.local` with local Supabase only

---

## What NOT to Test

- Tailwind CSS class names (visual regression is handled by reviewing the app)
- Supabase Auth internals (it's a third-party service — trust it)
- Resend/Twilio delivery (they have their own uptime guarantees — test that we call them correctly, not that they succeed)
- React Router redirects (covered by E2E; no value in unit-testing route config)

---

## Extending for Future Enhancements

When adding a new feature (v2+), follow this pattern:

1. **New DB table or column** → add cases to `migrations.test.ts` and `rls.test.ts`
2. **New booking state** → add cases to `bookingState.test.ts` and `book_slot.test.ts`
3. **New notification type** → add cases to `send-notifications/index.test.ts`
4. **New user journey** → add a new `*.spec.ts` file in `tests/e2e/`
5. **New edge function** → add `index.test.ts` alongside it

The test structure mirrors the feature structure — one test file per feature area, not one massive file.
