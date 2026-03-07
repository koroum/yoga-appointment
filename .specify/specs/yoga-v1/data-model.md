# Data Model — yoga-v1

**Status**: Draft
**Spec ref**: .specify/specs/yoga-v1/spec.md

---

## Entity Relationship Summary

```
users
 ├── instructor_profiles (1:1 for instructor role)
 ├── classes (1:many, via instructor_id)
 ├── availability_rules (1:many, via instructor_id)
 ├── slots (1:many, via instructor_id)
 ├── bookings (1:many, via student_id)
 └── student_notification_prefs (1:many, via instructor_id or student_id)

classes
 └── slots (1:many)

slots
 └── bookings (1:many for group, effectively 1:1 for private)
```

---

## Tables

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| email | text | nullable, unique |
| phone | text | nullable, unique |
| name | text | not null |
| role | text | 'instructor' or 'student' |
| username | text | nullable, unique — instructor only, used for profile URL |
| created_at | timestamptz | default now() |

**Constraint**: at least one of email or phone must be non-null (CHECK constraint).

---

### instructor_profiles
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| bio | text | |
| passion | text | |
| photo_urls | text[] | array of Supabase storage URLs |
| created_at | timestamptz | default now() |

---

### classes
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| instructor_id | uuid | FK → users.id |
| title | text | not null |
| description | text | |
| max_capacity | int | not null, default 1 |
| duration_minutes | int | not null |
| created_at | timestamptz | default now() |

---

### availability_rules
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| instructor_id | uuid | FK → users.id |
| day_of_week | int | 0=Sunday … 6=Saturday |
| start_time | time | e.g. 09:00:00 |
| class_id | uuid | FK → classes.id — which class runs at this time |
| is_active | boolean | default true |
| created_at | timestamptz | default now() |

---

### slots
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| class_id | uuid | FK → classes.id |
| instructor_id | uuid | FK → users.id |
| starts_at | timestamptz | not null |
| ends_at | timestamptz | not null |
| status | text | 'available', 'unavailable' |
| created_at | timestamptz | default now() |

**Note**: `status` reflects instructor-controlled state only. Booking state lives in bookings table. A slot is effectively "full" when confirmed booking count = class.max_capacity.

---

### bookings
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| slot_id | uuid | FK → slots.id |
| student_id | uuid | FK → users.id |
| status | text | 'pending', 'confirmed', 'cancelled', 'cancellation_requested' |
| booked_by | text | 'instructor' or 'student' |
| cancellation_requested_at | timestamptz | nullable |
| proposed_slot_id | uuid | nullable, FK → slots.id — alternative slot proposed by instructor |
| created_at | timestamptz | default now() |

---

### notifications_log
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| booking_id | uuid | nullable FK → bookings.id |
| recipient_id | uuid | FK → users.id |
| channel | text | 'email' or 'sms' |
| type | text | see notification types below |
| sent_at | timestamptz | default now() |

**Notification types**: `booking_requested`, `booking_confirmed`, `booking_rejected`, `booking_cancelled`, `cancellation_requested`, `alternative_proposed`, `alternative_confirmed`, `slot_cancelled`, `schedule_changed`, `reminder_28h`, `reminder_4h`

---

### student_notification_prefs
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| instructor_id | uuid | FK → users.id |
| student_id | uuid | FK → users.id |
| reminders_enabled | boolean | default true |
| updated_at | timestamptz | default now() |

---

## RLS Policies (planned)

| Table | Anon | Student | Instructor |
|---|---|---|---|
| users | SELECT own row only | SELECT own + instructor's row | SELECT all linked students |
| instructor_profiles | SELECT all (public) | SELECT | SELECT + UPDATE own |
| classes | SELECT all | SELECT | CRUD own |
| availability_rules | — | SELECT | CRUD own |
| slots | SELECT available | SELECT | CRUD own |
| bookings | — | SELECT own + INSERT | SELECT all + UPDATE |
| notifications_log | — | SELECT own | SELECT all |
| student_notification_prefs | — | SELECT own | CRUD for linked students |

---

## Migration Plan

| # | Description |
|---|---|
| 001 | Create users, instructor_profiles, classes |
| 002 | Create availability_rules, slots |
| 003 | Create bookings, notifications_log, student_notification_prefs |
| 004 | RLS policies — all tables |
| 005 | Indexes: slots(starts_at), bookings(slot_id, student_id, status) |
