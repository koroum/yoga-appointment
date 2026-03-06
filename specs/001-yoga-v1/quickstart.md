# Quickstart — yoga-v1

Key validation scenarios to verify the build is working correctly at each milestone.

---

## Milestone 1 — Instructor signup + profile
1. Sign up as instructor with email
2. Verify email via OTP
3. Fill in profile (name, bio, passion, upload 1 photo)
4. Visit `/instructor/[username]` — profile loads publicly without login
5. Confirm photo displays correctly

**Pass criteria**: Public profile accessible at correct URL; photo visible; no auth required.

---

## Milestone 2 — Availability + slot generation
1. Log in as instructor
2. Set recurring availability: Mon/Wed/Fri at 9am, class "Morning Flow" (60 min, capacity 5)
3. Trigger slot generation (or wait for cron)
4. Visit calendar — slots appear for next 2 months on Mon/Wed/Fri
5. Mark next Monday as unavailable (vacation)
6. Confirm that Monday slot disappears or shows as unavailable

**Pass criteria**: Slots generated correctly; override works; calendar reflects state.

---

## Milestone 3 — Student signup + booking request
1. Visit `/instructor/[username]` as unauthenticated user
2. Sign up as student (name, email, phone)
3. Confirm linked to instructor (check `instructor_students` table)
4. Browse available slots — see Morning Flow slots
5. Request a booking for Wednesday 9am
6. Confirm slot status changes to `pending`
7. Confirm instructor receives email + SMS notification

**Pass criteria**: Student linked to instructor; booking in pending state; both notifications sent.

---

## Milestone 4 — Instructor accepts booking
1. Log in as instructor
2. See pending booking request in BookingRequests screen
3. Accept the booking
4. Confirm booking status → `confirmed`
5. Confirm student receives email + SMS confirmation

**Pass criteria**: Status updated; student notified on both channels.

---

## Milestone 5 — Reminders
1. Manually set a booking's `starts_at` to 27 hours from now
2. Trigger the `send-reminders` edge function
3. Confirm student receives 28h reminder via email + SMS
4. Set `starts_at` to 3.5 hours from now, trigger again
5. Confirm 4h reminder sent

**Pass criteria**: Both reminders fire; `notifications_log` shows `sent` status; no duplicates on re-run.

---

## Milestone 6 — Cancellation flows
1. Student cancels a confirmed booking >24h before class → immediate, slot freed, instructor notified
2. Student cancels a confirmed booking <24h before class → status = `cancellation_requested`, instructor notified
3. Instructor accepts late cancellation → `cancelled`, student notified
4. Instructor proposes alternative slot → student receives offer, confirms → new booking confirmed

**Pass criteria**: All state transitions correct; correct notifications sent at each step.

---

## Milestone 7 — Group class + concurrent booking
1. Create a class with `max_capacity = 2`
2. Book with Student A → 1 seat taken
3. Book with Student B → 1 seat taken, slot now full
4. Attempt to book with Student C → "slot is now full" error
5. Student A cancels → slot has 1 seat again → Student C can book

**Pass criteria**: DB-level capacity enforced; concurrent requests handled correctly.
