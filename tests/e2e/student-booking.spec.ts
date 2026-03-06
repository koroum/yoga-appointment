import { test, expect } from '@playwright/test'

// These E2E tests validate the student discovery and booking flow.
// They require the dev server + Supabase local to be running with seed data.

test.describe('Student Browse & Booking', () => {
  test('browse page shows empty state when no instructors linked', async ({ page }) => {
    // A logged-in student with no linked instructors sees the empty state
    // In a real E2E run this would require auth setup — skipping here as it
    // requires seeded user credentials. Mark as conditional.
    test.skip(true, 'Requires seeded auth credentials for student with no links')
  })

  test('booking modal opens on Request click', async ({ page }) => {
    test.skip(true, 'Requires seeded auth credentials')
  })
})

test.describe('Instructor Requests', () => {
  test('instructor sees pending booking and can confirm', async ({ page }) => {
    test.skip(true, 'Requires seeded auth credentials')
  })
})

// Smoke test: key routes return 200 (redirects for protected routes are expected)
test('browse route redirects unauthenticated user to login', async ({ page }) => {
  const res = await page.goto('/student/browse')
  // ProtectedRoute redirects to /login
  expect(page.url()).toContain('/login')
  expect(res?.status()).toBeLessThan(500)
})

test('my bookings route redirects unauthenticated user to login', async ({ page }) => {
  await page.goto('/student/bookings')
  expect(page.url()).toContain('/login')
})

test('instructor requests route redirects unauthenticated user to login', async ({ page }) => {
  await page.goto('/instructor/requests')
  expect(page.url()).toContain('/login')
})
