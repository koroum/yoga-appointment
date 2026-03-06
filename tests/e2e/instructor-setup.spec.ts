import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const admin = createClient(SUPABASE_URL, SERVICE_KEY)

// Seed an instructor with a known username for E2E tests
const TEST_USERNAME = `e2e-instructor-${Date.now()}`
let instructorId: string
let classId: string
let slotId: string

test.beforeAll(async () => {
  const ts = Date.now()
  const email = `e2e-instructor-${ts}@test.com`

  const { data: auth } = await admin.auth.admin.createUser({ email, password: 'Password123!', email_confirm: true })
  instructorId = auth.user!.id

  await admin.from('users').insert({ id: instructorId, name: 'Sarah Johnson', role: 'instructor', email, username: TEST_USERNAME })
  await admin.from('instructor_profiles').insert({ user_id: instructorId, bio: 'I believe yoga is a journey for everyone.', passion: 'Helping students find balance.', photo_urls: [] })

  classId = crypto.randomUUID()
  await admin.from('classes').insert({ id: classId, instructor_id: instructorId, title: 'Morning Flow', max_capacity: 5, duration_minutes: 60 })

  slotId = crypto.randomUUID()
  const starts = new Date(Date.now() + 48 * 60 * 60 * 1000)
  const ends = new Date(starts.getTime() + 60 * 60 * 1000)
  await admin.from('slots').insert({ id: slotId, class_id: classId, instructor_id: instructorId, starts_at: starts.toISOString(), ends_at: ends.toISOString(), status: 'available' })
})

test.afterAll(async () => {
  await admin.from('slots').delete().eq('id', slotId)
  await admin.from('classes').delete().eq('id', classId)
  await admin.from('instructor_profiles').delete().eq('user_id', instructorId)
  await admin.from('users').delete().eq('id', instructorId)
  await admin.auth.admin.deleteUser(instructorId)
})

test('public profile is accessible at /instructor/:username without login', async ({ page }) => {
  await page.goto(`/instructor/${TEST_USERNAME}`)
  await expect(page.getByText('Sarah Johnson')).toBeVisible()
  await expect(page.getByText('I believe yoga is a journey for everyone')).toBeVisible()
})

test('upcoming class appears on public profile', async ({ page }) => {
  await page.goto(`/instructor/${TEST_USERNAME}`)
  await expect(page.getByText('Morning Flow')).toBeVisible()
  await expect(page.getByText(/5 spots/i).or(page.getByText(/of 5/i))).toBeVisible()
})

test('Book a Class CTA links to signup with instructor context', async ({ page }) => {
  await page.goto(`/instructor/${TEST_USERNAME}`)
  await page.getByRole('link', { name: /book a class|sign up/i }).click()
  await expect(page).toHaveURL(/\/signup/)
  // Should show "linked to Sarah Johnson" context
  await expect(page.getByText(/sarah johnson/i)).toBeVisible()
})

test('unavailable slot does not appear on public profile', async ({ page }) => {
  // Mark slot unavailable
  await admin.from('slots').update({ status: 'unavailable' }).eq('id', slotId)

  await page.goto(`/instructor/${TEST_USERNAME}`)
  await expect(page.getByText('Morning Flow')).not.toBeVisible()

  // Restore
  await admin.from('slots').update({ status: 'available' }).eq('id', slotId)
})
