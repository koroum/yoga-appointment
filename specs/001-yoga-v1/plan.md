# Implementation Plan: Yoga Appointment App — v1 Core

**Branch**: `001-yoga-v1` | **Date**: 2026-03-05 | **Spec**: specs/001-yoga-v1/spec.md

## Summary

Build a yoga booking platform for a single instructor ("Instructor") and her students. Students discover the instructor via a permanent public profile, sign up, and book available class slots. The instructor manages her schedule, approves bookings, and communicates with students via email and SMS. Core technical approach: React 19 SPA on Vercel, Supabase for auth/database/storage, Resend for email, Twilio for SMS, Supabase Edge Functions for notification dispatch and slot generation cron.

---

## Technical Context

**Language/Version**: TypeScript 5.9, React 19
**Primary Dependencies**: Vite 7, Tailwind v4, Supabase JS v2, react-router-dom v7, Resend SDK, Twilio SDK, browser-image-compression, date-fns
**Storage**: PostgreSQL via Supabase (relational data), Supabase Storage (profile photos)
**Testing**: Vitest + React Testing Library (unit/component), Supabase local (integration)
**Target Platform**: Web — mobile-first (375px viewport), Vercel deployment
**Project Type**: Web application (SPA frontend + Supabase backend)
**Performance Goals**: Slot generation <2s on schedule change; booking confirmation round-trip <1s; reminders fire within 5 minutes of scheduled time
**Constraints**: Single timezone (America/New_York); no payments in v1; mobile-first; `tsc -b && vite build` must be clean
**Scale/Scope**: Single instructor, ~10–100 students, ~50–200 active slots/month

---

## Constitution Check

| Article | Status | Notes |
|---|---|---|
| I — Spec First | PASS | spec.md complete and clarified |
| II — Mobile-First | PASS | 375px viewport enforced in all screen designs |
| III — Single Timezone | PASS | All timestamps stored as UTC, displayed in America/New_York |
| IV — Right Environment per Stage | PASS | .env.local for dev, .env.production for prod |
| V — Numbered Migrations | PASS | 5 migrations planned (001–005) |
| VI — RLS on Every Table | PASS | RLS defined for all 9 tables in data-model.md |
| VII — Two-Channel Notifications | PASS | Email (Resend) + SMS (Twilio) for all time-sensitive events |
| VIII — Simplicity | PASS | No payments, no multi-tenancy, no waitlist |
| IX — .env.example | PASS | Will be created before first line of code |
| X — DB-Level Booking Integrity | PASS | DB function enforces max_capacity on INSERT |
| XI — Notification Idempotency | PASS | Dedup by booking_id + type + sent_date in notifications_log |
| XII — Validate at Boundary | PASS | RLS + DB constraints + edge function validation |
| XIII — Auth Guards | PASS | ProtectedRoute component with loading state |
| XIV — No `any` | PASS | All types in src/types/index.ts |
| XV — Image Compression | PASS | browser-image-compression on all photo uploads |
| XVI — Loading + Error States | PASS | Every async op has loading + error UI |
| XVII — Clean Build | PASS | CI check: tsc -b && vite build |
| XVIII — Three Env Files | PASS | .env.local, .env.production, .env.example |

**Gate: PASSED — proceed to Phase 0**

---

## Project Structure

### Documentation (this feature)

```
specs/001-yoga-v1/
├── plan.md          ← this file
├── research.md      ← Phase 0 output
├── data-model.md    ← Phase 1 output (already exists, updated)
├── quickstart.md    ← Phase 1 output
├── contracts/       ← Phase 1 output
│   ├── api-contracts.md
│   └── notification-contracts.md
└── tasks.md         ← /speckit.tasks output (not yet created)
```

### Source Code

```
/                          ← repo root
├── src/
│   ├── pages/             ← route-level components
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── AuthCallback.tsx
│   │   ├── GuestProfile.tsx        ← public /instructor/:username
│   │   ├── instructor/
│   │   │   ├── Dashboard.tsx       ← calendar view
│   │   │   ├── Availability.tsx    ← recurring rules + overrides
│   │   │   ├── Students.tsx        ← roster + notification prefs
│   │   │   ├── BookingRequests.tsx ← accept/reject/propose
│   │   │   └── Profile.tsx         ← edit public profile + photos
│   │   └── student/
│   │       ├── Browse.tsx          ← available slots
│   │       └── MyBookings.tsx      ← upcoming + past
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── Calendar.tsx            ← shared calendar widget
│   │   ├── SlotCard.tsx
│   │   ├── BookingStatusBadge.tsx
│   │   └── EmptyState.tsx
│   ├── hooks/
│   │   ├── useAuth.tsx             ← auth context
│   │   ├── useSlots.ts
│   │   ├── useBookings.ts
│   │   └── useNotifications.ts
│   ├── lib/
│   │   └── supabase.ts             ← client (detectSessionInUrl: false)
│   ├── types/
│   │   └── index.ts                ← all TypeScript types
│   └── utils/
│       ├── dates.ts                ← date-fns helpers, NJ timezone
│       └── imageCompression.ts     ← browser-image-compression wrapper
├── supabase/
│   ├── migrations/
│   │   ├── 001_core_tables.sql
│   │   ├── 002_scheduling.sql
│   │   ├── 003_bookings_notifications.sql
│   │   ├── 004_rls_policies.sql
│   │   └── 005_indexes.sql
│   └── functions/
│       ├── send-notifications/     ← triggered by booking events
│       │   └── index.ts
│       └── generate-slots/         ← cron: rolling 2-month window
│           └── index.ts
├── .env.example
├── .env.local                      ← not committed
├── .env.production                 ← not committed
└── vite.config.ts
```

---

## Architecture Decisions

### Auth Strategy
- Supabase Auth for all users (instructor + student)
- Email/phone OTP verification on signup
- PKCE flow for email confirmation links
- `AuthCallback.tsx` handles `?code=`, `#access_token=`, `?token_hash=` patterns
- `useRef(false)` guard prevents React StrictMode double-exchange
- Role stored in `users.role` column, read on login to route instructor vs student

### Routing
| Path | Component | Access |
|---|---|---|
| `/` | redirect | public |
| `/login` | Login | public |
| `/signup` | Signup | public |
| `/auth/callback` | AuthCallback | public |
| `/instructor/:username` | GuestProfile | public |
| `/instructor/dashboard` | Dashboard | instructor only |
| `/instructor/availability` | Availability | instructor only |
| `/instructor/students` | Students | instructor only |
| `/instructor/requests` | BookingRequests | instructor only |
| `/instructor/profile` | Profile | instructor only |
| `/student/browse` | Browse | student only |
| `/student/bookings` | MyBookings | student only |

### Booking State Machine
```
available slot
    └── student requests → pending
        ├── instructor accepts → confirmed
        │   ├── student cancels >24h → cancelled (slot freed)
        │   ├── student cancels <24h → cancellation_requested
        │   │   ├── instructor accepts → cancelled
        │   │   └── instructor proposes → [new slot offered] → confirmed (new) or declined
        │   └── instructor cancels slot → cancelled (all bookings on slot)
        └── instructor rejects → cancelled
        └── student cancels pending → cancelled (immediate)

instructor direct-books → confirmed (skip pending)
```

### Slot Generation (Edge Function Cron)
- Runs daily, generates slots for rolling 2-month window
- Reads `availability_rules` for each active instructor
- Creates `slots` rows for dates not yet generated
- Skips dates where instructor has manually set status = `unavailable`
- On rule change: deletes unbooked future slots, regenerates; leaves booked slots intact and notifies affected students

### Notification System (Edge Function)
- Triggered by DB webhooks on `bookings` table INSERT/UPDATE
- Also triggered by cron for reminders (28h and 4h before slot)
- Sends via Resend (email) + Twilio (SMS) in parallel
- On failure: logs to `notifications_log` with status `retrying`, retries once after 5 min
- Deduplication: checks `notifications_log` for existing `booking_id + type + sent_date` before sending
- `--no-verify-jwt` flag on all edge functions

### Image Upload
- `browser-image-compression` compresses images >5MB to ≤4.5MB before upload
- Max resolution: 1920px
- PDFs blocked with user-facing error
- Stored in Supabase Storage bucket: `instructor-photos`

### Concurrent Booking (DB-Level)
- PostgreSQL function `book_slot(slot_id, student_id)` wraps INSERT in a transaction
- Checks `confirmed booking count < max_capacity` inside the transaction with `FOR UPDATE` row lock
- Returns error if full — UI surfaces "This slot is now full"

---

## Complexity Tracking

No constitution violations. All decisions use the simplest available approach.

---
