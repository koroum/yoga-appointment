# Notification Contracts — yoga-v1

Defines every notification type, who receives it, what triggers it, and the message content contract.

---

## Notification Types

| Type | Trigger | Recipient | Channel |
|---|---|---|---|
| `booking_requested` | Student submits booking request | Instructor | Email + SMS |
| `booking_confirmed` | Instructor accepts a booking | Student | Email + SMS |
| `booking_rejected` | Instructor rejects a booking | Student | Email + SMS |
| `booking_confirmed_direct` | Instructor books student directly | Student | Email + SMS |
| `booking_cancelled_student` | Student cancels >24h before | Instructor | Email + SMS |
| `cancellation_requested` | Student requests cancellation <24h | Instructor | Email + SMS |
| `cancellation_accepted` | Instructor accepts late cancellation | Student | Email + SMS |
| `alternative_proposed` | Instructor proposes new slot | Student | Email + SMS |
| `alternative_confirmed` | Student confirms alternative | Instructor | Email + SMS |
| `alternative_declined` | Student declines alternative | Instructor | Email + SMS |
| `slot_cancelled` | Instructor cancels a slot with bookings | All affected students | Email + SMS |
| `schedule_changed` | Instructor changes recurring pattern + bookings affected | All affected students | Email + SMS |
| `reminder_28h` | 28 hours before class | Student (if reminders enabled) | Email + SMS |
| `reminder_4h` | 4 hours before class | Student (if reminders enabled) | Email + SMS |

---

## Idempotency Rule

Before sending any notification, query `notifications_log`:
```sql
SELECT id FROM notifications_log
WHERE booking_id = $1
  AND type = $2
  AND sent_at::date = CURRENT_DATE
  AND status = 'sent'
```
If a row exists → skip sending. This makes re-running crons safe.

---

## Failure & Retry

1. Attempt send (email + SMS in parallel)
2. On failure: insert row with `status = 'retrying'`, schedule retry in 5 minutes
3. On retry failure: update row to `status = 'failed'`, log `error_message`
4. Instructor can see failed notifications (filtered view in Students screen)

---

## Message Content Guidelines

- **SMS**: max 160 chars. Include: what happened, class time, student/instructor name.
- **Email**: plain text + minimal HTML. Include: full details, class name, time, date, action link if needed.
- Instructor cancellation messages include instructor's custom message if provided.
- All times displayed in America/New_York timezone.
