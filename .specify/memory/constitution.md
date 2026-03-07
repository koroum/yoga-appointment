# Yoga Appointment App — Project Constitution

**Version**: 1.1
**Ratified**: 2026-03-05
**Amended**: 2026-03-05

---

## Article I — Spec First, Always
No feature may be built without a written spec in `.specify/specs/`. The spec is the source of truth. When requirements change, the spec updates first — then the implementation.

## Article II — Mobile-First
Every screen must be designed and tested on mobile before desktop. Yoga bookings happen on phones.

## Article III — Single Timezone
All date/time handling uses New Jersey time (America/New_York). No timezone conversion logic unless explicitly added to spec.

## Article IV — Real Credentials, Right Environment per Stage
Use localhost in `.env.local` for local development and testing. Before the first production deploy, SITE_URL and all Supabase secrets must be updated to point to the production domain. Never deploy to production with localhost values.

## Article V — Migrations Are Numbered and Incremental
All database changes go through numbered migration files (001, 002, ...). No ad-hoc schema changes in the dashboard.

## Article VI — RLS on Every Table
Every Supabase table must have Row Level Security enabled. Anon access is explicitly defined — never left open by accident.

## Article VII — Two-Channel Notifications
All time-sensitive notifications go via both email (Resend) and SMS (Twilio). Do not add channels without updating the spec.

## Article VIII — Simplicity Over Cleverness
Build only what the current spec requires. No premature abstractions, no future-proofing, no feature flags for hypothetical v3 needs.

## Article IX — Document Every Env Variable
Every environment variable must exist in `.env.example` before it is used in code. No secrets live only in someone's head.

## Article X — Booking Integrity at the Database Level
Double-booking prevention must be enforced at the database level (unique constraints or DB functions), not just in the UI. The database is the last line of defense. `max_capacity` must be checked via a DB constraint or trigger, never trusted from the client.

## Article XI — Notification Idempotency
The reminder and notification system must never send the same notification twice. Deduplicate by `booking_id + type + date` in `notifications_log` before sending. Re-running a cron must be safe.

## Article XII — Validate at the Boundary
All user input must be validated server-side (Supabase RLS, edge functions, DB constraints). Client-side validation is for UX only — never the sole safeguard.

## Article XIII — Auth Guards Are Non-Negotiable
Every protected route must verify authentication before rendering. No protected page may flash unauthenticated content, even briefly. Use a loading state while auth is resolving.

## Article XIV — No `any` in TypeScript
All data shapes must be defined in `src/types/index.ts`. Using `any` is not permitted. If a type is unknown, define it explicitly or use `unknown` with a type guard.

## Article XV — Image Compression Before Upload
Profile photos and any user-uploaded images over 5MB must be compressed client-side before uploading to Supabase Storage. Use `browser-image-compression`. PDFs over 5MB are blocked with a user-facing error.

## Article XVI — Loading and Error States Are Required
Every async operation must have a visible loading state and a user-facing error message. Silent failures are not acceptable. No spinner-less fetches, no uncaught promise rejections swallowed silently.

## Article XVII — Clean Build Before Every Deploy
`tsc -b && vite build` must pass with zero errors and zero type errors before any production deploy. "We'll fix types later" is not acceptable.

## Article XVIII — Three Environment Files
- `.env.local` — local dev values (not committed)
- `.env.production` — production values (not committed)
- `.env.example` — all keys with empty values (committed)

No other env file patterns are permitted.

---

## Constraints

- **Stack**: React 19 + Vite + TypeScript + Tailwind v4 + Supabase
- **Hosting**: Vercel (frontend) + Supabase (backend/edge functions)
- **Auth**: Supabase Auth — email + phone validation
- **Payments**: Out of scope for v1
- **Multi-tenancy**: Out of scope for v1 (single instructor)

## Governance

This constitution is amended only when a new architectural principle is established and agreed upon. All PRs must comply with these articles. Violations must be documented with explicit justification.
