# Yoga Appointment App — One-Page Spec

## App Purpose
A booking platform connecting yoga students with their instructor (referred to as "Instructor"). Students can discover, book, and manage yoga sessions. The Instructor manages her schedule, student roster, and communications.

---

## User Types

### v1
- **Instructor (Instructor)** — manages her profile, availability, classes, and student bookings
- **Student** — discovers instructor, books classes, manages their appointments

### v2 (future)
- **Studio Owner / Admin** — manages multiple instructors, studio-wide settings

---

## Auth & Onboarding

### Instructor
- Self-signup via email or phone
- Validation: must verify at least one of email or phone (or both)
- Creates her own account — no admin needed in v1

### Student — Direct Invite
- Instructor sends a one-time invite link to a specific student (via email or SMS)
- Student clicks link, fills in their details, account is linked to that Instructor automatically

### Student — Discovery
- Instructor has a permanent public profile page: `yogaapp.com/instructor/[username]`
- Instructor shares this link on Instagram, WhatsApp, word of mouth, etc.
- Student visits the page, fills in their info, and is linked to that Instructor
- No expiry — link is permanent and always shareable

---

## Instructor Profile Page (Public)
- Name, bio, passion/story
- Photos (multiple uploads)
- Link to book / sign up as a student
- Permanent URL: `yogaapp.com/instructor/[username]`

---

## Screens

### Instructor
1. **Login / Signup**
2. **Dashboard / Calendar** — visual calendar showing:
   - Available slots (open for booking)
   - Unavailable slots (blocked)
   - Pending bookings (awaiting her approval)
   - Confirmed bookings (with student name, headcount for group classes, spots remaining)
3. **Manage Availability** — set recurring schedule + override specific days
4. **Class Management** — create/edit classes (title, description, capacity, duration)
5. **Student Roster** — list of linked students, per-student notification preferences
6. **Profile Editor** — edit public profile, upload photos
7. **Booking Requests** — accept / reject pending student bookings, propose alternative slot

### Student
1. **Login / Signup** (via invite link or public profile)
2. **Browse Classes** — available slots/classes they can book
3. **Book a Class** — select slot, confirm booking
4. **My Bookings** — list + calendar toggle of upcoming and past bookings
5. **Booking Detail** — view status, cancel, or request cancellation

---

## Class & Slot Model

- Instructor creates **Classes** (e.g. "Morning Flow", "Private Session")
- Each class has: title, description, duration, `max_capacity`
  - `max_capacity = 1` = one-on-one / private session
  - `max_capacity > 1` = group class
- Instructor creates **Slots** — specific date/time instances of a class
- Slots are generated via recurring availability rules (rolling 2 months ahead)

---

## Booking Flows

### Student books a slot
1. Student selects an available slot and requests a booking
2. Slot status → **Pending**
3. Instructor receives notification (email + SMS)
4. Instructor accepts → status → **Confirmed** → student notified
5. Instructor rejects → status → **Cancelled** → student notified

### Instructor books a student
1. Instructor selects a slot and assigns a student
2. Booking → **Confirmed** immediately
3. Student receives notification (email + SMS)

---

## Slot States
- `available` — open for student booking
- `unavailable` — blocked by instructor (vacation, personal)
- `pending` — student has requested, awaiting instructor approval
- `confirmed` — booking accepted
- `cancelled` — booking cancelled or rejected

---

## Scheduling & Recurring Availability

- Instructor sets recurring availability (e.g. every Mon / Wed / Fri at 9am and 6pm)
- System auto-generates slots for a **rolling 2-month window**
- Instructor can override any specific slot as `unavailable` (e.g. vacation days)

### Changing Recurring Pattern
- Changes apply to future unbooked slots
- Already-booked slots in the affected range are shown to Instructor
- All affected students are notified automatically of the schedule change

---

## Cancellations

### Student cancels — more than 24 hours before class
- Cancellation is immediate
- Slot becomes available again
- Instructor is notified

### Student cancels — less than 24 hours before class
- Student submits a **cancellation request**
- Instructor is notified
- Instructor can: accept cancellation OR propose an alternative slot
- If alternative proposed: student receives the new slot offer and must confirm

### Instructor cancels a slot with confirmed bookings
- All affected students notified automatically
- Instructor can add a personal message to the notification (e.g. "feeling unwell, so sorry!")
- Slot marked `unavailable`

### Group class cancellation
- Student cancels → their spot is freed (another student can take it)
- Instructor is notified regardless

---

## Notifications

### Channels
- **Email** (Resend)
- **SMS** (Twilio)
- Both sent by default for all time-sensitive events

### Triggers
| Event | Who is notified |
|---|---|
| Student requests booking | Instructor |
| Instructor confirms booking | Student |
| Instructor rejects booking | Student |
| Instructor books student directly | Student |
| Student cancels (>24hrs) | Instructor |
| Student requests cancellation (<24hrs) | Instructor |
| Instructor accepts late cancellation | Student |
| Instructor proposes alternative slot | Student |
| Student confirms alternative slot | Instructor |
| Instructor cancels slot with bookings | All affected students |
| Recurring schedule change affects bookings | All affected students |
| Reminder — 28 hours before class | Student |
| Reminder — 4 hours before class | Student |

### Notification Preferences (per student, set by Instructor)
- Instructor can disable reminders for individual students (e.g. regulars who find it annoying)
- Override is per student globally (not per class)

---

## Data Model (Draft)

### users
`id, email, phone, name, role (instructor | student), username (instructor only), created_at`

### instructor_profiles
`id, user_id, bio, passion, photo_urls[], created_at`

### classes
`id, instructor_id, title, description, max_capacity, duration_minutes, created_at`

### availability_rules
`id, instructor_id, day_of_week, start_time, is_active, created_at`

### slots
`id, class_id, instructor_id, starts_at, ends_at, status (available | unavailable), created_at`

### bookings
`id, slot_id, student_id, status (pending | confirmed | cancelled), booked_by (instructor | student), cancellation_requested_at, created_at`

### notifications_log
`id, booking_id, recipient_id, channel (email | sms), type, sent_at`

### student_notification_prefs
`id, instructor_id, student_id, reminders_enabled (default true), updated_at`

---

## External Services
- **Supabase** — auth, database, storage (profile photos), edge functions
- **Resend** — email notifications
- **Twilio** — SMS notifications

---

## Out of Scope — v1
- Payments (future: token/deposit to reserve a slot)
- Studio owner / admin role
- Multiple timezones (all sessions in New Jersey)
- Waitlist for full group classes
- In-app messaging

---

## Location
- All sessions in **New Jersey** — single timezone, no conversion needed

---

## Deployment
- Frontend: **Vercel**
- Domain: TBD — decide before starting build so SITE_URL is set correctly from day one
