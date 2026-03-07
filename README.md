# Yoga Booking App

A simple, mobile-friendly booking platform connecting yoga instructors with their students — no spreadsheets, no back-and-forth messages.

---

## For Instructors

**Set up your profile once. Share your link. Take bookings.**

- **Public profile** — share `/instructor/your-name`; students see your bio, photos, upcoming classes, and any additional link (Google Reviews, website, etc.)
- **Recurring availability** — define your weekly schedule (e.g. Mon/Wed/Fri 9am); the system auto-generates a rolling 2-month calendar
- **One-off slots** — add extra classes or cancel empty slots anytime without notifying anyone
- **Accept or decline requests** — students request a booking; you confirm or reject from your dashboard with one click
- **Direct booking** — assign a student to a slot yourself; it's confirmed immediately with automatic notification to them
- **Email + SMS notifications** — students are notified on every status change: confirmed, rejected, or cancelled
- **Student roster** — see all students linked to you; manage reminder preferences per student (some prefer reminders, some don't)
- **Optional profile link** — add a URL to your profile—Google Reviews, your website, or anything else you want to share

---

## For Students

**Find your instructor. Book a class. Show up.**

- **Discover via profile link** — visit your instructor's public link to see their bio, available classes, and sign up directly
- **Browse your instructors' classes** — view upcoming slots for all instructors you're linked to in one place
- **Request a booking** — pick a class time and submit your request; your instructor confirms it (usually within minutes)
- **My bookings** — see all your upcoming and past bookings organized by date
- **Smart cancellations** — cancel instantly if you're more than 24 hours out; within 24 hours a cancellation request goes to your instructor (they might suggest an alternative)
- **Automatic reminders** — get email + SMS reminders at 28 hours and 4 hours before your class so you never miss it
- **Link more instructors** — paste an instructor's profile link in your profile settings to add them and see their classes

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **Backend**: Supabase (Postgres, Auth, Row-Level Security, Storage, Edge Functions)
- **Notifications**: Resend (email), Twilio (SMS)
- **Routing**: react-router-dom v7

---

## Local Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in your Supabase credentials.

```bash
supabase start
supabase db reset   # applies all migrations + seed data
```

---

## Testing

```bash
npm test
```
