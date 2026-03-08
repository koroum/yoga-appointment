# Booking App

A responsive web app for booking yoga classes — connecting instructors with their students without spreadsheets or back-and-forth messages. Designed for phones and tablets, works on any device.

**Live**: [yoga-appointment.vercel.app](https://yoga-appointment.vercel.app)

---

## For Instructors

**Set up your profile once. Share your link. Take bookings.**

- **Public profile** — share `/instructor/your-name`; students see your bio, photos, upcoming classes, and any additional link (Google Reviews, website, etc.)
- **Recurring availability** — define your weekly schedule (e.g. Mon/Wed/Fri 9am); the system auto-generates a rolling 2-month calendar
- **One-off slots** — add extra classes or cancel empty slots anytime without notifying anyone
- **Accept or decline requests** — students request a booking; you confirm or reject from your dashboard with one click
- **Direct booking** — assign a student to a slot yourself; it's confirmed immediately with automatic notification
- **Email + SMS notifications** — students are notified on every status change: confirmed, rejected, or cancelled
- **Student roster** — see all students linked to you; manage reminder preferences per student
- **Profile link** — add a URL to your profile (Google Reviews, your website, etc.)
- **Account deletion** — delete your account anytime; confirmed bookings are auto-cancelled and students notified

---

## For Students

**Find your instructor. Book a class. Show up.**

- **Discover via profile link** — visit your instructor's public link to see their bio, available classes, and sign up directly
- **Browse your instructors' classes** — view upcoming slots for all instructors you're linked to
- **Request a booking** — pick a class time and submit your request; your instructor confirms it
- **My bookings** — see all your upcoming and past bookings organized by date
- **Smart cancellations** — cancel instantly if you're more than 24 hours out; within 24 hours a cancellation request goes to your instructor
- **Automatic reminders** — get email + SMS reminders at 28 hours and 4 hours before your class
- **Link more instructors** — paste an instructor's profile link in your profile settings to add them
- **Unlink instructors** — remove an instructor link (must cancel active bookings first)
- **Account deletion** — delete your account anytime; confirmed bookings are auto-cancelled and instructors notified

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4 |
| Backend | Supabase (Postgres, Auth, RLS, Storage, Edge Functions) |
| Notifications | Resend (email), Twilio (SMS) |
| Routing | react-router-dom v7 |
| Deployment | Vercel (frontend), Supabase Cloud (backend) |

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design, data model, and project structure.

---

## Local Development

```bash
npm install
cp .env.example .env.local   # fill in Supabase credentials
```

Start Supabase locally:

```bash
supabase start
supabase db reset   # applies all migrations + seed data
```

Start the dev server:

```bash
npm run dev
```

---

## Testing

```bash
npm test            # run all tests
npm run lint        # lint check
```

90 tests across 14 test files covering components, pages, and utilities.

---

## Deployment

```bash
# Frontend
npx vercel --prod

# Database migrations
npx supabase db push

# Edge functions
supabase functions deploy generate-slots --no-verify-jwt
supabase functions deploy send-notifications --no-verify-jwt
```

---

## Project Structure

```
src/
  pages/              # route-level components
    instructor/       #   Dashboard, Availability, Requests, Students, Profile
    student/          #   Browse, MyBookings, Profile
    Login, Signup, AuthCallback, GuestProfile
  components/         # shared UI (Navbar, Calendar, Modals, SlotCard, etc.)
  hooks/              # useAuth
  lib/                # Supabase client
  utils/              # dates, booking state, image compression, logger
  types/              # TypeScript interfaces
  __tests__/          # 14 test files
supabase/
  migrations/         # 16 numbered SQL migrations
  functions/          # Edge functions (generate-slots, send-notifications)
docs/
  ARCHITECTURE.md     # system design + data model + wireframes
  SPEC.md             # feature specification
  WIREFRAMES.md       # ASCII wireframes for all screens
  PREREQUISITES.md    # lessons learned from prior projects
  TESTING.md          # test documentation
```
