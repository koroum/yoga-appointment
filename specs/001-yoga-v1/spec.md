# Feature Specification: Yoga Appointment App — v1 Core

**Branch**: yoga-v1
**Date**: 2026-03-05
**Status**: Draft
**Reference**: docs/SPEC.md (plain English full spec)

---

## User Scenarios & Testing

### Story 1 (P1) — Instructor sets up her profile and availability

**Journey**: A yoga instructor signs up, creates her public profile, sets her recurring weekly availability, and shares her profile link so students can discover and book her.

**Priority justification**: Without this, no bookings can happen. It is the foundation of the entire app.

**Acceptance Scenarios**:

```
Given a new user signs up with the role "instructor"
When she completes her profile (name, bio, photos)
Then her public profile is accessible at /instructor/[username]

Given a instructor is on the availability screen
When she sets recurring slots (e.g. Mon/Wed/Fri 9am)
Then the system generates slots for a rolling 2-month window

Given a instructor has recurring slots generated
When she marks a specific date as unavailable (vacation)
Then that slot is blocked and students cannot book it
```

---

### Story 2 (P1) — Student discovers and books a class

**Journey**: A student visits the instructor's public profile link, signs up, browses available slots, and requests a booking. The instructor receives a notification and confirms.

**Priority justification**: Core booking flow — the primary value of the app.

**Acceptance Scenarios**:

```
Given a student visits /instructor/[username]
When she fills in her name, email, and phone
Then an account is created and linked to that instructor

Given a student is logged in and views available slots
When she selects a slot and requests a booking
Then the slot status becomes "pending"
And the instructor receives an email + SMS notification

Given a instructor receives a booking request
When she accepts it
Then the slot status becomes "confirmed"
And the student receives an email + SMS confirmation

Given a instructor receives a booking request
When she rejects it
Then the slot status becomes "cancelled"
And the student receives an email + SMS notification
```

---

### Story 3 (P1) — Instructor books a student directly

**Journey**: Instructor selects a student from her roster and assigns them to an available slot. The booking is confirmed immediately and the student is notified.

**Acceptance Scenarios**:

```
Given a instructor is viewing her calendar
When she selects an available slot and assigns a student
Then the booking is immediately "confirmed"
And the student receives an email + SMS notification
```

---

### Story 4 (P2) — Student cancellation flows

**Journey**: A student needs to cancel a booking. Behavior differs based on how close to the class time.

**Acceptance Scenarios**:

```
Given a student has a confirmed booking more than 24 hours away
When she cancels it
Then the booking is cancelled immediately
And the slot becomes available
And the instructor is notified

Given a student has a confirmed booking less than 24 hours away
When she requests cancellation
Then the slot status becomes "cancellation_requested"
And the instructor is notified

Given a instructor receives a late cancellation request
When she accepts it
Then the booking is cancelled and the student is notified

Given a instructor receives a late cancellation request
When she proposes an alternative slot
Then the student receives the alternative slot offer
And must confirm or decline it
```

---

### Story 5 (P2) — Reminders

**Journey**: Students receive automatic reminders before their class. Instructor can disable reminders per student.

**Acceptance Scenarios**:

```
Given a student has a confirmed booking
When 28 hours before the class time arrives
Then the student receives an email + SMS reminder

Given a student has a confirmed booking
When 4 hours before the class time arrives
Then the student receives an email + SMS reminder

Given a instructor has disabled reminders for a specific student
When reminder time arrives
Then that student receives no reminder notifications
```

---

### Story 6 (P2) — Instructor manages recurring schedule changes

**Journey**: Instructor changes her weekly recurring availability. The system updates future unbooked slots and notifies students with existing bookings in the affected range.

**Acceptance Scenarios**:

```
Given a instructor changes her recurring schedule
When future unbooked slots exist in the affected range
Then those slots are updated to match the new pattern

Given a instructor changes her recurring schedule
When students have confirmed bookings in the affected range
Then all affected students are notified automatically
And the instructor is shown a list of affected bookings
```

---

### Story 7 (P3) — Group classes

**Journey**: Instructor creates a class with max_capacity > 1. Multiple students can book the same slot until capacity is reached.

**Acceptance Scenarios**:

```
Given a slot has max_capacity = 10
When a student books it
Then one seat is consumed and 9 remain available

Given a slot is at full capacity
When another student tries to book
Then they are shown a "full" message and cannot book

Given a student cancels a group class booking
Then their seat is freed
And the instructor is notified
```

---

## Requirements

### Functional Requirements

**FR-001**: Users must verify at least one of email or phone during signup. Both can be verified.

**FR-002**: Instructor has a permanent public profile at `/instructor/[username]` with bio, photos, and a student signup link.

**FR-003**: Instructor can set recurring weekly availability. System generates slots for a rolling 2-month window.

**FR-004**: Instructor can override any specific slot as unavailable (e.g. vacation days).

**FR-005**: Slot statuses: `available`, `unavailable`, `pending`, `confirmed`, `cancelled`, `cancellation_requested`.

**FR-006**: Student booking creates a `pending` booking; instructor must accept or reject.

**FR-007**: Instructor direct-booking creates a `confirmed` booking immediately.

**FR-008**: Cancellation >24hrs before class: immediate. Cancellation <24hrs: request flow with instructor acceptance or alternative slot proposal. Cancellation of a **pending** (unconfirmed) booking: always immediate — slot freed, instructor notified.

**FR-009**: Reminders sent at 28hrs and 4hrs before class via email + SMS. Instructor can disable per student.

**FR-010**: When instructor changes recurring schedule, unbooked future slots update and all affected students with bookings are notified.

**FR-011**: Group classes: `max_capacity` field on class. Booking counts tracked per slot. Full slots are not bookable.

**FR-012**: Instructor can invite a specific student via a one-time email/SMS link.

**FR-016**: A student account can be linked to multiple instructors (many-to-many via `instructor_students` join table). Signing up via a instructor's profile or invite link links the student to that instructor. A student can discover and book with additional instructors independently.

**FR-013**: All notifications (booking events, reminders, cancellations) sent via email (Resend) + SMS (Twilio). On delivery failure, log the error and retry once after 5 minutes. If retry fails, mark as `failed` in notifications_log. Instructor can view failed notifications.

**FR-014**: Instructor profile supports multiple photo uploads (stored in Supabase Storage).

**FR-015**: When a student browses classes and no available slots exist, display a friendly empty state showing: the next upcoming slot date (if one is scheduled), or a "no classes scheduled yet — check back soon" message if none exist.

---

### Data Entities

| Entity | Key Fields |
|---|---|
| users | id, email, phone, name, role, username, created_at |
| instructor_profiles | id, user_id, bio, passion, photo_urls[], created_at |
| classes | id, instructor_id, title, description, max_capacity, duration_minutes |
| availability_rules | id, instructor_id, day_of_week, start_time, is_active |
| slots | id, class_id, instructor_id, starts_at, ends_at, status |
| bookings | id, slot_id, student_id, status, booked_by, cancellation_requested_at |
| notifications_log | id, booking_id, recipient_id, channel, type, status (sent\|failed\|retrying), sent_at, failed_at, error_message |
| instructor_students | instructor_id, student_id, linked_at (join table — many-to-many) |
| student_notification_prefs | id, instructor_id, student_id, reminders_enabled |

---

## Success Criteria

**User Experience**
- Instructor can go from signup to sharing her profile link in under 10 minutes
- Student can discover, sign up, and request a booking in under 5 minutes
- All screens are fully functional on mobile (375px viewport)

**System**
- Reminders fire within 5 minutes of their scheduled time
- Slot generation completes within 2 seconds of a schedule change
- No booking can exceed `max_capacity`

**Business**
- Instructor can manage her full schedule without any manual messages or spreadsheets
- Every booking state change generates the appropriate notification to both parties

---

## Edge Cases

- Student tries to book an already-full group class → blocked with "full" message
- Two students simultaneously book the last seat → DB transaction with capacity check enforces first-write-wins; second student receives "slot is now full" error and is shown other available slots
- Instructor changes schedule while student is mid-booking → booking proceeds, schedule change applies to remaining unbooked slots
- Student has no phone number → email-only notifications
- Student has no email → SMS-only notifications
- Instructor cancels a slot that has both confirmed and pending bookings → all are cancelled and notified
- Student cancels a **pending** booking → immediate cancellation, slot returns to available, instructor is notified (no approval needed)

---

## Clarifications

### Session 2026-03-05
- Q: What happens when a student cancels a pending booking (not yet accepted by instructor)? → A: Immediate cancellation — slot returns to available, instructor is notified.
- Q: If email/SMS delivery fails, what should the system do? → A: Log failure, retry once after 5 minutes, then mark as failed; instructor can see failed notifications.
- Q: Two students simultaneously book the last seat in a group class — how is this handled? → A: DB transaction with capacity check, first-write-wins; second student gets immediate "full" error.
- Q: What does a student see when there are no available slots? → A: Friendly message with next upcoming slot date if any, or "no classes scheduled yet — check back soon" if none.
- Q: Can a student be linked to more than one instructor? → A: Yes — many-to-many via instructor_students join table; one account can book with multiple instructors.

---

## Out of Scope (v1)

- Payments / deposits
- Studio owner / admin role
- Multiple instructors
- Waitlist for full classes
- In-app chat
- Multiple timezones
