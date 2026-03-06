// Deno tests for send-notifications edge function HTTP interface
// Run with: deno test --allow-net --allow-env supabase/functions/send-notifications/index.test.ts

import { assertEquals } from 'jsr:@std/assert'
import { createClient } from 'npm:@supabase/supabase-js@2'

const BASE_URL = Deno.env.get('SUPABASE_FUNCTIONS_URL') ?? 'http://localhost:54321/functions/v1'
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ANON_KEY}`,
  }
}

Deno.test('send-notifications: returns 400 if booking_id missing', async () => {
  const res = await fetch(`${BASE_URL}/send-notifications`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ type: 'booking_requested' }),
  })
  assertEquals(res.status, 400)
  const data = await res.json()
  assertEquals(data.ok, false)
})

Deno.test('send-notifications: returns 400 if type missing', async () => {
  const res = await fetch(`${BASE_URL}/send-notifications`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ booking_id: 'some-id' }),
  })
  assertEquals(res.status, 400)
  const data = await res.json()
  assertEquals(data.ok, false)
})

Deno.test('send-notifications: returns 404 for non-existent booking', async () => {
  const res = await fetch(`${BASE_URL}/send-notifications`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ booking_id: '00000000-0000-0000-0000-000000000000', type: 'booking_confirmed' }),
  })
  assertEquals(res.status, 404)
  const data = await res.json()
  assertEquals(data.ok, false)
})

Deno.test('send-notifications: deduplicates — skips if already sent today', async () => {
  // Create minimal test data using service role
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? 'http://localhost:54321',
    SERVICE_KEY,
  )

  // Create instructor user
  const { data: iAuth } = await supabase.auth.admin.createUser({
    email: `notif-instr-${Date.now()}@test.com`,
    password: 'test1234',
    email_confirm: true,
  })
  const instructorId = iAuth.user!.id
  await supabase.from('users').insert({ id: instructorId, name: 'Notif Instructor', role: 'instructor' })
  await supabase.from('instructor_profiles').insert({ user_id: instructorId })

  // Create student user
  const { data: sAuth } = await supabase.auth.admin.createUser({
    email: `notif-student-${Date.now()}@test.com`,
    password: 'test1234',
    email_confirm: true,
  })
  const studentId = sAuth.user!.id
  await supabase.from('users').insert({ id: studentId, name: 'Notif Student', role: 'student' })

  // Create class + slot + booking
  const { data: cls } = await supabase.from('classes').insert({
    instructor_id: instructorId, title: 'Notif Test Class', max_capacity: 5, duration_minutes: 60,
  }).select('id').single()

  const starts = new Date(Date.now() + 86400000).toISOString()
  const ends = new Date(Date.now() + 86400000 + 3600000).toISOString()
  const { data: slot } = await supabase.from('slots').insert({
    class_id: cls!.id, instructor_id: instructorId, starts_at: starts, ends_at: ends, status: 'available',
  }).select('id').single()

  const { data: booking } = await supabase.from('bookings').insert({
    slot_id: slot!.id, student_id: studentId, status: 'pending', booked_by: 'student',
  }).select('id').single()

  const bookingId = booking!.id

  // Pre-insert a notification log for today (simulating already sent)
  await supabase.from('notifications_log').insert({
    booking_id: bookingId,
    recipient_id: instructorId,
    channel: 'email',
    type: 'booking_requested',
    status: 'sent',
    sent_at: new Date().toISOString(),
  })

  // Call the function — should be deduped
  const res = await fetch(`${BASE_URL}/send-notifications`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ booking_id: bookingId, type: 'booking_requested' }),
  })
  const data = await res.json()
  assertEquals(res.status, 200)
  assertEquals(data.ok, true)
  assertEquals(data.skipped, true)

  // Cleanup
  await supabase.from('bookings').delete().eq('id', bookingId)
  await supabase.from('slots').delete().eq('id', slot!.id)
  await supabase.from('classes').delete().eq('id', cls!.id)
  await supabase.auth.admin.deleteUser(instructorId)
  await supabase.auth.admin.deleteUser(studentId)
})
