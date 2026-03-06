# Research — yoga-v1

**Date**: 2026-03-05
**Spec ref**: specs/001-yoga-v1/spec.md

---

## 1. Slot Generation Strategy

**Decision**: Edge function cron (daily) + rolling 2-month window, generating from `availability_rules`.

**Rationale**: Simple, auditable. Slots exist as real DB rows so RLS, bookings, and queries all work against concrete data. No on-the-fly generation needed at query time.

**Alternatives considered**:
- On-the-fly generation at browse time — rejected: complex to layer bookings/overrides on top; harder to enforce RLS
- Client-side generation — rejected: no server-side authority; violates Article XII

---

## 2. Concurrent Booking Safety

**Decision**: PostgreSQL function `book_slot()` with `SELECT ... FOR UPDATE` row-level lock inside a transaction.

**Rationale**: Supabase exposes `rpc()` for calling DB functions. A single transaction guarantees atomicity. No application-level queue needed. Aligns with Article X.

**Alternatives considered**:
- Optimistic locking with version column — rejected: requires client retry logic and more complex error handling
- Application-level mutex — rejected: doesn't work across multiple serverless instances

---

## 3. Notification Delivery

**Decision**: Resend (email) + Twilio (SMS), dispatched from a Supabase Edge Function triggered by DB webhook on `bookings` table + separate cron for reminders.

**Rationale**: Both SDKs are lightweight and work in Deno (Edge Function runtime). Resend free tier covers low volumes. Twilio SMS requires no pre-approval unlike WhatsApp.

**Retry strategy**: Single retry after 5 minutes, implemented via `pg_cron` scheduling a retry job or a second edge function invocation. Failure logged in `notifications_log`.

**Alternatives considered**:
- Email only — rejected: user decision to have SMS for time-sensitive notifications
- WhatsApp — rejected: requires Meta Business approval; deferred to v2
- Supabase Realtime for in-app notifications — rejected: out of scope v1

---

## 4. Auth Flow

**Decision**: Supabase Auth with PKCE flow. Email OTP + phone OTP. Role stored in `users` table.

**Rationale**: Supabase Auth handles token management, session refresh, and PKCE natively. Custom `users` table extends auth.users with role/username/phone.

**Key implementation detail**: `detectSessionInUrl: false` on Supabase client; `AuthCallback.tsx` manually handles all redirect patterns (`?code=`, `#access_token=`, `?token_hash=`). `useRef(false)` guard prevents React StrictMode double-exchange.

**Alternatives considered**:
- JWT-based custom auth — rejected: unnecessary complexity; Supabase Auth is sufficient
- Third-party auth (Auth0, Clerk) — rejected: adds cost and vendor dependency; Supabase is already the stack

---

## 5. Timezone Handling

**Decision**: All `timestamptz` columns stored as UTC in PostgreSQL. Display layer converts to `America/New_York` using `date-fns-tz`.

**Rationale**: UTC storage is the correct approach. Single timezone makes conversion trivial. `date-fns-tz` is lightweight and tree-shakeable.

**Alternatives considered**:
- Store as local time — rejected: breaks DST handling; incorrect approach
- Luxon — rejected: heavier than date-fns; not necessary for single-timezone app

---

## 6. Calendar UI

**Decision**: Build a lightweight custom calendar component using CSS Grid + date-fns. No heavy calendar library.

**Rationale**: The instructor's calendar view needs custom slot states (available, pending, confirmed, unavailable). Off-the-shelf libraries (FullCalendar, react-big-calendar) are heavy and hard to style with Tailwind v4.

**Alternatives considered**:
- FullCalendar — rejected: large bundle, difficult Tailwind integration
- react-big-calendar — rejected: same issue; opinionated styles conflict with Tailwind v4

---

## 7. Image Compression

**Decision**: `browser-image-compression` npm package, compress >5MB images to ≤4.5MB at max 1920px before upload to Supabase Storage.

**Rationale**: Same approach proven in rental-payment-system project. Works client-side in browser before upload. PDFs blocked at >5MB with user-facing error (cannot compress PDFs).

**Alternatives considered**:
- Server-side compression — rejected: adds latency and edge function complexity; browser-side is sufficient
- Sharp — rejected: Node.js only; not available in browser

---

## 8. Vite Config Optimisation

**Decision**: `manualChunks` splitting: `vendor-react` (react, react-dom, react-router-dom), `vendor-supabase` (@supabase/supabase-js), `vendor-utils` (date-fns, browser-image-compression).

**Rationale**: Prevents single large bundle. Caching: vendor chunks change rarely so users get long cache hits. Proven pattern from rental-payment-system.

---

## 9. instructor_students Many-to-Many

**Decision**: Explicit `instructor_students` join table with composite PK `(instructor_id, student_id)`.

**Rationale**: Clarification Q5 confirmed students can link to multiple instructors. The join table also stores `linked_via` (invite vs discovery) for analytics in v2.

**RLS**: Student can SELECT own rows; Instructor can SELECT + INSERT for students they invite; no DELETE in v1 (once linked, always linked).

---

## 10. Public Instructor Profile

**Decision**: Route `/instructor/:username` — publicly accessible (no auth required), fetches from `instructor_profiles` and `slots` (available only).

**Rationale**: Instructor shares this URL publicly. Anon RLS policy on `instructor_profiles` (SELECT all) and `slots` (SELECT where status = available). Student signup from this page auto-links to the instructor via `instructor_students`.

**Security**: Anon access is read-only. Write operations (signup, booking) require auth. RLS enforced at DB level.
