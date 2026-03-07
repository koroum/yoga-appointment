# Production Deployment Guide

This guide covers deploying the Booking App to production using **Supabase Cloud** (backend) and **Vercel** (frontend).

---

## Prerequisites

- Supabase account (supabase.com)
- Vercel account (vercel.com)
- Supabase CLI: `npm install -g supabase`
- Vercel CLI: `npm install -g vercel`
- API keys for:
  - **Resend** (email service)
  - **Twilio** (SMS service)

---

## Step 1: Supabase Cloud Setup

### 1a. Create a new project on Supabase
1. Go to [supabase.com](https://supabase.com)
2. Click **New Project**
3. Fill in project name, database password, region
4. Wait for project initialization (~2 min)
5. Save the following from **Settings → API**:
   - **Project Ref** (e.g., `abc123xyz`)
   - **Project URL** (e.g., `https://abc123xyz.supabase.co`)
   - **Anon Public Key**
   - **Service Role Key** (keep this secret!)

### 1b. Link your local Supabase project to cloud

```bash
supabase login
# Follow the browser prompt to authenticate

supabase link --project-ref <your-project-ref>
# Confirm when prompted
```

### 1c. Push all migrations to cloud

```bash
supabase db push
```

This runs all 12 migrations on your cloud Postgres instance. Verify success in the Supabase Dashboard → SQL Editor.

### 1d. Create Storage bucket for instructor photos

1. Supabase Dashboard → **Storage**
2. Click **Create bucket**
3. Name: `instructor-photos`
4. Enable **Public bucket** (✅)
5. Create

This bucket stores instructor profile photos.

### 1e. Deploy Supabase Edge Functions

```bash
supabase functions deploy generate-slots --no-verify-jwt
supabase functions deploy send-notifications --no-verify-jwt
```

Verify in Supabase Dashboard → **Edge Functions** — both should show "Deployed".

### 1f. Set edge function secrets

Store your API keys securely so edge functions can access them:

```bash
supabase secrets set \
  RESEND_API_KEY=<your-resend-api-key> \
  TWILIO_ACCOUNT_SID=<your-twilio-account-sid> \
  TWILIO_AUTH_TOKEN=<your-twilio-auth-token> \
  TWILIO_PHONE_FROM=<your-twilio-phone-number> \
  APP_EMAIL_FROM=no-reply@yourdomain.com
```

**Where to get these:**
- **RESEND_API_KEY**: [resend.com/api-keys](https://resend.com/api-keys) — starts with `re_`
- **TWILIO_ACCOUNT_SID**: [twilio.com/console](https://www.twilio.com/console) — Account SID
- **TWILIO_AUTH_TOKEN**: Same page as Account SID
- **TWILIO_PHONE_FROM**: Your Twilio phone number (e.g., `+1234567890`)
- **APP_EMAIL_FROM**: Your domain email (e.g., `no-reply@bookingapp.com`)

Verify in Supabase Dashboard → **Edge Functions** → click function → **Secrets** tab.

### 1g. Update Supabase Auth configuration

1. Supabase Dashboard → **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel deployment URL
   - Once you deploy to Vercel, you'll get a URL like `https://booking-app-abc123.vercel.app`
   - Use that here
3. Add **Redirect URLs**:
   - `https://booking-app-abc123.vercel.app/**`
   - `https://yourdomain.com/**` (if using a custom domain)

### 1h. Configure email (optional but recommended)

To avoid the 2/hr free-tier cap on auth emails:

1. Supabase Dashboard → **Authentication → Email**
2. Scroll to **SMTP Settings**
3. Enable **Custom SMTP** and configure with **Resend**:
   - **Sender email**: `no-reply@yourdomain.com`
   - **SMTP Host**: `smtp.resend.com`
   - **SMTP Port**: `465`
   - **Username**: `default`
   - **Password**: Your Resend API key (`re_...`)

---

## Step 2: Deploy Frontend to Vercel

### 2a. Deploy with Vercel CLI

```bash
npx vercel --prod
```

Follow the prompts:
- Link to an existing Vercel project or create a new one
- Confirm build settings (should auto-detect Vite)
- Wait for deployment to complete

You'll get a URL like: `https://booking-app-abc123.vercel.app`

### 2b. Set environment variables in Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click your project
3. **Settings → Environment Variables**
4. Add the following:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | From Supabase Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | From Supabase Settings → API → Anon Public Key |

**Example:**
```
VITE_SUPABASE_URL = https://abc123xyz.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2c. Redeploy after setting env vars

1. Vercel Dashboard → Your project
2. **Deployments** tab
3. Click the latest deployment
4. Click **Redeploy** button

Wait for the new deployment to complete.

### 2d. Update Supabase Auth with your Vercel URL

Go back to **Supabase Dashboard → Authentication → URL Configuration** and set:
- **Site URL**: Your new Vercel URL (e.g., `https://booking-app-abc123.vercel.app`)
- **Redirect URLs**: Add the same URL with `/**` (e.g., `https://booking-app-abc123.vercel.app/**`)

---

## Step 3: Verification

Test that everything is working:

### 3a. Frontend loads
```
Visit: https://booking-app-abc123.vercel.app
Expected: App loads, navbar visible
```

### 3b. React Router works
```
Visit: https://booking-app-abc123.vercel.app/instructor/yogini-shweta
Expected: Profile page loads (no 404 error)
```

### 3c. Authentication works
```
1. Click "Log in" or "Sign up"
2. Use an email address
3. Check your email for the magic link
Expected: Email arrives within 30 seconds
```

### 3d. Backend works
```
1. Log in as instructor
2. Edit profile (add bio, save)
3. Refresh page
Expected: Changes persist
```

### 3e. Photos work
```
1. Log in as instructor
2. Edit profile → Photos section → click +
3. Upload an image
Expected: Photo thumbnail appears and is saved
```

### 3f. Notifications work
```
1. Log in as instructor
2. Have a confirmed booking
3. Click "Send Notification"
4. Select "Email & SMS"
Expected: Email arrives in inbox; SMS arrives on phone
```

---

## Common Issues

### "404 Not Found" on non-root routes
**Cause**: `vercel.json` rewrites not applied
**Fix**: Check that `vercel.json` exists in project root with SPA rewrite rule, then redeploy

### "Invalid API key" or auth errors
**Cause**: Env vars not set or incorrect
**Fix**: Double-check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel env vars match Supabase

### Photo uploads fail
**Cause**: Storage bucket doesn't exist or isn't public
**Fix**: Create `instructor-photos` bucket in Supabase Dashboard → Storage, set to public

### Emails/SMS not sending
**Cause**: Edge function secrets not set, or API keys invalid
**Fix**: Verify secrets in Supabase Dashboard → Edge Functions → Secrets tab, test API keys on Resend/Twilio dashboards

### Auth emails hit rate limit (2/hr)
**Cause**: Using Supabase's default email provider
**Fix**: Configure custom SMTP with Resend (see Step 1h)

---

## Rollback / Redeploy

To redeploy after code changes:

```bash
# Push new code to git
git push origin main

# Vercel auto-deploys on push, OR manually:
npx vercel --prod
```

To rollback to a previous deployment:
1. Vercel Dashboard → **Deployments**
2. Click the previous deployment
3. Click **Redeploy**

---

## Next Steps

- Set up a custom domain (Vercel → Settings → Domains)
- Enable monitoring (Vercel Analytics, Supabase Postgres stats)
- Set up CI/CD (automatic deployments on git push)
- Configure email templates (Supabase Dashboard → Email Templates)

---

**Questions?** Check the `.env.example` file for all available environment variables, or see `README.md` for project overview.
