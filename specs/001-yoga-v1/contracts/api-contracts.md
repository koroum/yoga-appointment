# API Contracts — yoga-v1

All data access goes through Supabase client SDK (RLS-enforced). Edge functions handle notifications and slot generation. This document defines the key contracts.

---

## Supabase RPC Functions

### `book_slot(slot_id uuid, student_id uuid)`
Atomically books a slot, enforcing max_capacity at DB level.

**Returns**:
```json
{ "booking_id": "uuid", "status": "pending" }
```
**Errors**:
- `SLOT_FULL` — confirmed booking count = max_capacity
- `SLOT_UNAVAILABLE` — slot status is not 'available'
- `ALREADY_BOOKED` — student already has an active booking for this slot

---

### `cancel_booking(booking_id uuid, student_id uuid)`
Cancels a booking. Behaviour depends on time-to-class.

**Returns**:
```json
{ "status": "cancelled" | "cancellation_requested" }
```
**Errors**:
- `NOT_FOUND` — booking not found or not owned by student
- `ALREADY_CANCELLED` — booking already cancelled

---

### `generate_slots_for_instructor(instructor_id uuid)`
Manually trigger slot generation for rolling 2-month window. Also called by cron.

**Returns**:
```json
{ "slots_created": 12, "slots_skipped": 3 }
```

---

## Edge Functions

### `POST /functions/v1/send-notification`
Dispatches email + SMS for a booking event.

**Request body**:
```json
{
  "booking_id": "uuid",
  "type": "booking_confirmed | booking_rejected | booking_cancelled | ...",
  "recipient_id": "uuid"
}
```
**Response**:
```json
{ "email_status": "sent | failed", "sms_status": "sent | failed" }
```
Deployed with `--no-verify-jwt`.

---

### `POST /functions/v1/send-reminders`
Called by cron. Finds bookings with class starting in 28h or 4h, sends reminders (respecting per-student prefs).

**Request body**: `{}` (no params — finds due reminders automatically)

**Response**:
```json
{ "reminders_sent": 5, "reminders_skipped": 2, "failures": 0 }
```
Deployed with `--no-verify-jwt`.

---

### `POST /functions/v1/generate-slots`
Called by daily cron. Generates slots for rolling 2-month window from availability_rules.

**Request body**: `{}` (processes all active instructors)

**Response**:
```json
{ "slots_created": 24, "instructors_processed": 1 }
```
Deployed with `--no-verify-jwt`.

---

## Supabase Storage

**Bucket**: `instructor-photos` (public read, auth write)

**Upload path**: `instructor-photos/{instructor_id}/{filename}`

**Constraints**:
- Max size after compression: 4.5MB
- Accepted types: image/jpeg, image/png, image/webp
- PDFs: blocked client-side before upload attempt
