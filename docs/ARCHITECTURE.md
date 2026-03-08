# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BROWSER (React SPA)                         │
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │   Login /   │  │ Instructor │  │  Student    │  │    Guest     │  │
│  │   Signup    │  │  Pages (5) │  │  Pages (3)  │  │   Profile    │  │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └──────┬───────┘  │
│         └───────────────┼───────────────┼───────────────┘           │
│                         ▼                                            │
│              ┌────────────────────┐                                  │
│              │  Supabase JS SDK   │                                  │
│              │  (Auth, DB, Store) │                                  │
│              └─────────┬──────────┘                                  │
└────────────────────────┼─────────────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      SUPABASE CLOUD                                  │
│                                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌──────────────┐  │
│  │   Auth   │  │   Postgres   │  │  Storage   │  │    Edge      │  │
│  │ (magic   │  │  (16 tables  │  │ (instructor│  │  Functions   │  │
│  │  links)  │  │   + RLS)     │  │   photos)  │  │              │  │
│  └──────────┘  └──────────────┘  └───────────┘  │ ┌──────────┐ │  │
│                                                   │ │ generate │ │  │
│                                                   │ │  -slots  │ │  │
│                                                   │ └──────────┘ │  │
│                                                   │ ┌──────────┐ │  │
│                                                   │ │  send-   │ │  │
│                                                   │ │notific.  │ │  │
│                                                   │ └─────┬────┘ │  │
│                                                   └───────┼──────┘  │
└───────────────────────────────────────────────────────────┼──────────┘
                                                            │
                                              ┌─────────────┼──────────┐
                                              │             │          │
                                              ▼             ▼          │
                                        ┌──────────┐ ┌──────────┐     │
                                        │  Resend  │ │  Twilio  │     │
                                        │ (email)  │ │  (SMS)   │     │
                                        └──────────┘ └──────────┘     │
                                              External Services        │
                                        ┌──────────────────────────────┘
```

---

## Request Flow

### Student Books a Class

```
Student                   Supabase                   Instructor
  │                          │                           │
  │── Request booking ──────▶│                           │
  │   (book_slot RPC)        │── Insert booking ────────▶│
  │                          │   status: pending         │
  │                          │                           │
  │                          │── send-notifications ────▶│
  │                          │   (email + SMS)           │
  │                          │                           │
  │                          │◀── Confirm/Reject ────────│
  │                          │   update booking status   │
  │◀── Notification ─────────│                           │
  │   (confirmed/rejected)   │                           │
```

### Slot Generation

```
Instructor                Supabase
  │                          │
  │── Save availability ────▶│
  │   rules                  │
  │                          │
  │── Invoke generate-slots ▶│
  │                          │── Read availability_rules
  │                          │── Read existing slots
  │                          │── Generate missing slots
  │                          │   (rolling 2-month window)
  │◀── Slots created ────────│
```

---

## Data Model

```
┌──────────────┐       ┌───────────────────┐       ┌──────────────┐
│    users     │       │ instructor_       │       │    users     │
│ (instructor) │◄──────│   students        │──────▶│  (student)   │
│              │       │                   │       │              │
│ id           │       │ instructor_id(FK) │       │ id           │
│ name         │       │ student_id (FK)   │       │ name         │
│ email        │       │ linked_via        │       │ email        │
│ phone        │       │ linked_at         │       │ phone        │
│ role         │       └───────────────────┘       │ role         │
│ username     │                                    └──────┬───────┘
└──────┬───────┘                                           │
       │                                                    │
       │ 1:1                                               │
       ▼                                                    │
┌──────────────────┐                                       │
│ instructor_      │                                       │
│   profiles       │                                       │
│                  │                                       │
│ user_id (FK)     │                                       │
│ bio              │                                       │
│ passion          │                                       │
│ photo_urls[]     │                                       │
│ other_url        │                                       │
└──────────────────┘                                       │
       │                                                    │
       │ 1:N                                               │
       ▼                                                    │
┌──────────────┐                                           │
│   classes    │                                           │
│              │                                           │
│ id           │                                           │
│ instructor_id│                                           │
│ title        │                                           │
│ description  │                                           │
│ max_capacity │                                           │
│ duration_min │                                           │
└──────┬───────┘                                           │
       │                                                    │
       │ 1:N                                               │
       ▼                                                    │
┌──────────────┐       ┌──────────────┐                    │
│    slots     │       │   bookings   │                    │
│              │◄──────│              │────────────────────┘
│ id           │       │ id           │
│ class_id(FK) │       │ slot_id (FK) │
│ instructor_id│       │ student_id   │
│ starts_at    │       │ status       │  pending | confirmed |
│ ends_at      │       │ booked_by    │  cancelled | cancellation_requested
│ status       │       │ student_note │
│ is_recurring │       │ instructor_  │
└──────────────┘       │   note       │
       ▲               └──────────────┘
       │                      │
       │                      │ 1:N
       │                      ▼
┌──────────────────┐  ┌─────────────────┐
│ availability_    │  │ notification_   │
│   rules          │  │   log           │
│                  │  │                 │
│ instructor_id    │  │ booking_id      │
│ class_id (FK)    │  │ recipient_id    │
│ day_of_week      │  │ channel         │  email | sms
│ start_time       │  │ type            │
│ is_active        │  │ status          │  sent | failed
└──────────────────┘  │ sent_at         │
                      └─────────────────┘

┌───────────────────────┐   ┌──────────────────┐
│ student_notification_ │   │  reminder_logs   │
│   prefs               │   │                  │
│                       │   │ booking_id       │
│ instructor_id (FK)    │   │ reminder_type    │
│ student_id (FK)       │   │ sent_at          │
│ reminders_enabled     │   └──────────────────┘
└───────────────────────┘
```

### Key Relationships

- All foreign keys use `ON DELETE CASCADE` — deleting a `users` row cascades to all related data
- `slots` are generated from `availability_rules` by the `generate-slots` edge function
- `bookings` track the lifecycle: pending → confirmed → completed (or cancelled at any stage)
- `instructor_students` is the many-to-many link between instructors and students

---

## Security Model

### Row-Level Security (RLS)

Every table has RLS enabled. Key policies:

| Table | Read | Write |
|---|---|---|
| `users` | Own row; instructors see linked students | Own row only |
| `classes` | Linked students + public via instructor profile | Instructor only |
| `slots` | Linked students + public via instructor profile | Instructor only |
| `bookings` | Own bookings; instructor sees bookings on their slots | Student creates; instructor updates status |
| `instructor_profiles` | Public (for guest profile page) | Instructor only |

### Security Definer Functions

- `book_slot(slot_id, student_id)` — validates capacity, creates booking atomically
- `delete_user_account(user_id)` — cancels bookings, deletes user + auth entry
- `ensure_user_profile(user_id, metadata)` — creates user row on first login (auth callback)

### Storage (instructor-photos bucket)

- Public read (photos shown on public profile)
- Authenticated users can upload/update/delete their own photos

---

## Auth Flow

```
User                     Browser                    Supabase Auth
 │                          │                           │
 │── Enter email + pwd ────▶│                           │
 │                          │── signUp() ──────────────▶│
 │                          │                           │── Send magic link email
 │                          │                           │
 │── Click email link ─────▶│                           │
 │                          │── /auth/callback ────────▶│
 │                          │   exchange code for       │
 │                          │   session                 │
 │                          │                           │
 │                          │── ensure_user_profile ───▶│  (creates users row
 │                          │   RPC                     │   from metadata)
 │                          │                           │
 │                          │── set password ──────────▶│  (from metadata)
 │                          │                           │
 │◀── Redirect to dashboard─│                           │
```

---

## Edge Functions

### generate-slots (Deno)

- Triggered by instructor after saving availability rules
- Reads `availability_rules` for the instructor
- Generates `slots` for the next 2 months (rolling window)
- Skips dates that already have slots (idempotent)
- CORS-enabled for browser invocation

### send-notifications (Deno)

- Triggered by frontend after booking status changes
- Looks up booking details, recipient preferences
- Sends email via Resend and/or SMS via Twilio
- Logs results to `notification_log`
- Respects `student_notification_prefs.reminders_enabled`
- CORS-enabled for browser invocation

---

## Account Deletion Flow

```
User                     Frontend                   Supabase
 │                          │                          │
 │── Click Delete Account ─▶│                          │
 │                          │── Query active bookings ▶│
 │                          │◀── Booking list ─────────│
 │                          │                          │
 │◀── Show warning modal ──│  (confirmed bookings     │
 │    (if confirmed         │   shown; pending         │
 │     bookings exist)      │   bookings ignored)      │
 │                          │                          │
 │── Type "DELETE" ────────▶│                          │
 │                          │── delete_user_account ──▶│
 │                          │   RPC                    │
 │                          │   • cancel pending       │
 │                          │     (silent)             │
 │                          │   • cancel confirmed     │
 │                          │     (return list)        │
 │                          │   • DELETE users row     │
 │                          │     (CASCADE)            │
 │                          │   • DELETE auth.users    │
 │                          │◀── cancelled list ───────│
 │                          │                          │
 │                          │── send-notifications ───▶│  (for each confirmed
 │                          │   (best-effort)          │   booking cancelled)
 │                          │                          │
 │                          │── signOut() ────────────▶│
 │◀── Redirect to /login ──│                          │
```

---

## Migrations

| # | File | Purpose |
|---|---|---|
| 001 | `core_tables.sql` | users, instructor_profiles, classes, availability_rules, slots, bookings |
| 002 | `rls_policies.sql` | Row-level security for all tables |
| 003 | `book_slot_rpc.sql` | Atomic booking RPC with capacity check |
| 004 | `notification_tables.sql` | notification_log, student_notification_prefs |
| 005 | `instructor_students.sql` | Many-to-many instructor-student linking |
| 006 | `ensure_user_profile.sql` | Auth callback RPC to create user row |
| 007 | `booking_policies.sql` | Additional booking RLS policies |
| 008 | `slot_policies.sql` | Slot visibility policies |
| 009 | `direct_book.sql` | Instructor direct-booking RPC |
| 010 | `reminder_logs.sql` | Dedup table for automated reminders |
| 011 | `booking_notes.sql` | Student/instructor notes on bookings |
| 012 | `one_off_slots.sql` | is_recurring flag for manual slots |
| 013 | `student_linking.sql` | linked_via tracking for instructor_students |
| 014 | `storage_policies.sql` | RLS for instructor-photos storage bucket |
| 015 | `delete_user_account.sql` | Account deletion RPC (SECURITY DEFINER) |
| 016 | `update_delete_user_account.sql` | Updated deletion: skip pending bookings silently |

---

## Wireframes

All screens are designed for small screens first (375px) and scale up to desktop. The app is a responsive web app — no native mobile app.

### Public Instructor Profile (`/instructor/:username`)

```
┌─────────────────────────────────┐
│  Booking                        │
├─────────────────────────────────┤
│                                 │
│     ┌─────────────────────┐     │
│     │    [cover photo]    │     │
│     └─────────────────────┘     │
│                                 │
│     Sarah Johnson               │
│     "I believe yoga is..."      │
│                                 │
│  ── Photos ──────────────────   │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │ img1 │ │ img2 │ │ img3 │    │
│  └──────┘ └──────┘ └──────┘    │
│                                 │
│  ── Upcoming Classes ────────   │
│  ┌─────────────────────────┐   │
│  │ Morning Flow            │   │
│  │ Mon Mar 9 · 9:00 AM     │   │
│  │ 60 min · 4 spots left   │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Evening Restore         │   │
│  │ Wed Mar 11 · 6:00 PM    │   │
│  │ 60 min · 1 spot left    │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │   Book a Class / Sign Up│   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

### Instructor Dashboard

```
┌─────────────────────────────────┐
│  Booking               [Nav ▾] │
├─────────────────────────────────┤
│                                 │
│  Dashboard                      │
│  [◄ Feb]  March 2026  [Apr ►]  │
│                                 │
│  Mo Tu We Th Fr Sa Su           │
│   2  3  4  5  6  7  8           │
│   9 10 11 12 13 14 15           │
│  16 17 18 19 20 21 22           │
│                                 │
│  ── Mon Mar 9 ───────────────   │
│  ┌─────────────────────────┐   │
│  │ 9:00 AM · Morning Flow  │   │
│  │ 3 confirmed · 1 pending │   │
│  │ 1 open of 5             │   │
│  │                [View] → │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ + Add slot              │   │
│  └─────────────────────────┘   │
│                                 │
│  ── Quick Actions ───────────   │
│  [Requests (2)] [Availability]  │
│  [Students]     [Profile]       │
└─────────────────────────────────┘
```

### Student — Browse Classes

```
┌─────────────────────────────────┐
│  Booking               [Nav ▾] │
├─────────────────────────────────┤
│                                 │
│  Browse Classes                 │
│  With Sarah Johnson             │
│                                 │
│  ── This Week ───────────────   │
│  ┌─────────────────────────┐   │
│  │ Morning Flow            │   │
│  │ Mon Mar 9 · 9:00 AM     │   │
│  │ 60 min · 4 of 5 open    │   │
│  │              [Request] →│   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Evening Restore         │   │
│  │ Wed Mar 11 · 6:00 PM    │   │
│  │ 60 min · 8 of 10 open   │   │
│  │              [Request] →│   │
│  └─────────────────────────┘   │
│                                 │
│  ── Next Week ───────────────   │
│  ┌─────────────────────────┐   │
│  │ Morning Flow            │   │
│  │ Mon Mar 16 · 9:00 AM    │   │
│  │ 60 min · 5 of 5 open    │   │
│  │              [Request] →│   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

### Student — My Bookings

```
┌─────────────────────────────────┐
│  Booking               [Nav ▾] │
├─────────────────────────────────┤
│                                 │
│  My Bookings                    │
│  [Upcoming] [Past]              │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Morning Flow            │   │
│  │ Mon Mar 9 · 9:00 AM     │   │
│  │ ● CONFIRMED             │   │
│  │              [Cancel] ↓ │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Evening Restore         │   │
│  │ Wed Mar 11 · 6:00 PM    │   │
│  │ ◌ PENDING               │   │
│  │     Awaiting instructor │   │
│  │              [Cancel] ↓ │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Private Session         │   │
│  │ Fri Mar 6 · 10:00 AM    │   │
│  │ ✕ CANCELLED             │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

### Booking Request Modal

```
┌─────────────────────────────────┐
│  Request Booking             ✕  │
├─────────────────────────────────┤
│                                 │
│  Morning Flow                   │
│  Monday, Mar 9 · 9:00 AM       │
│  60 min · with Sarah Johnson    │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 4 of 5 spots available  │   │
│  └─────────────────────────┘   │
│                                 │
│  Note to instructor (optional)  │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │   Send Request          │   │
│  └─────────────────────────┘   │
│  [Cancel]                       │
└─────────────────────────────────┘
```

### Delete Account Modal

```
┌─────────────────────────────────┐
│  Delete Account                 │
├─────────────────────────────────┤
│                                 │
│  ⚠ This action is permanent    │
│  and cannot be undone.          │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 2 upcoming bookings     │   │
│  │ will be cancelled:      │   │
│  │                         │   │
│  │ • Morning Flow          │   │
│  │   Mon Mar 9, 9:00 AM    │   │
│  │ • Evening Restore       │   │
│  │   Wed Mar 11, 6:00 PM   │   │
│  │                         │   │
│  │ Affected parties will   │   │
│  │ be notified.            │   │
│  └─────────────────────────┘   │
│                                 │
│  Type DELETE to confirm:        │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  [Cancel]  [Delete My Account]  │
└─────────────────────────────────┘
```

### Status Badge Legend

```
● AVAILABLE      green
◌ PENDING        yellow
▪ CONFIRMED      blue
✕ UNAVAILABLE    gray
⚠ CANCEL REQ     orange
✓ CANCELLED      red (muted)
```
