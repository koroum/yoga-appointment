# Prerequisites for yoga-appointment

## 1. Write a One-Page Spec First

The single biggest lesson. Before any code:

- Who are the user types? (studio owner, student, instructor?)
- What are the screens?
- What is the data model? (appointments, classes, users, payments?)
- What external services? (email, SMS, payments?)

Do this first — today if possible.

## 2. Define Messaging Strategy Upfront

Don't start with sandbox and figure it out later. Decide now:

- **Email only?** (simplest — Resend, free)
- **SMS?** (Twilio, no approval needed)
- **WhatsApp?** (needs Meta Business approval — start that process early)

## 3. Create .env.example from Day One

Document every environment variable before you need it:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SITE_URL=
RESEND_API_KEY=
```

So nothing gets forgotten in production.

## 4. Set SITE_URL to Production URL Immediately

Even before the domain is live — put the intended production URL in from the start. Never use localhost in secrets.

## 5. Create the Supabase Project Now

Get real credentials immediately — not halfway through. This also means:

- DB schema designed upfront (from the spec)
- Migrations written from the start, not retrofitted

## 6. Decide Domain / Hosting Now

- Where will it live? (Vercel — same as rental-payment-system)
- What domain? Buy it now if needed
- So SITE_URL is known from day one

## 7. Mobile-First from Day One

Yoga bookings happen on phones. Test every screen on mobile as you build it, not at the end.

---

## Suggested Order

1. Write spec (user types, screens, data model, services)
2. Decide messaging channel
3. Buy domain (if needed)
4. Create Supabase project → get real keys
5. Create `.env.example`
6. Set SITE_URL to production URL
7. Start building — mobile-first

---

Want to start with the spec right now? Even 10 minutes of defining what the app does will save hours later.
