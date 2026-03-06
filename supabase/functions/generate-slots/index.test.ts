// Deno tests for generate-slots edge function
// Run with: deno test supabase/functions/generate-slots/index.test.ts --allow-env --allow-net
//
// NOTE: These tests require a running local Supabase instance.
// They are integration tests for the edge function logic.

import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { addMonths, startOfDay } from 'npm:date-fns@3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

Deno.test('generate-slots: creates slots for rolling 2-month window', async () => {
  const ts = Date.now()
  const email = `slot-gen-test-${ts}@test.com`

  const { data: auth } = await admin.auth.admin.createUser({ email, password: 'Password123!', email_confirm: true })
  const instructorId = auth.user!.id

  await admin.from('users').insert({ id: instructorId, name: 'Gen Test', role: 'instructor', email })

  const classId = crypto.randomUUID()
  await admin.from('classes').insert({ id: classId, instructor_id: instructorId, title: 'Test Class', max_capacity: 5, duration_minutes: 60 })

  // Set Monday 9am recurring rule
  const ruleId = crypto.randomUUID()
  await admin.from('availability_rules').insert({ id: ruleId, instructor_id: instructorId, day_of_week: 1, start_time: '09:00:00', class_id: classId, is_active: true })

  // Invoke the edge function
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-slots`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instructor_id: instructorId }),
  })

  assertEquals(res.status, 200)

  // Check slots were generated
  const twoMonthsOut = addMonths(startOfDay(new Date()), 2)
  const { data: slots } = await admin.from('slots').select('*').eq('instructor_id', instructorId).gte('starts_at', new Date().toISOString()).lte('starts_at', twoMonthsOut.toISOString())

  assertExists(slots)
  assertEquals(slots!.length > 0, true, 'Should have generated at least one slot in 2-month window')

  // All generated slots should be on Mondays (day_of_week = 1)
  for (const slot of slots!) {
    const day = new Date(slot.starts_at).getDay()
    assertEquals(day, 1, `Slot ${slot.id} should be on Monday (day 1), got day ${day}`)
  }

  // Cleanup
  await admin.from('slots').delete().eq('instructor_id', instructorId)
  await admin.from('availability_rules').delete().eq('id', ruleId)
  await admin.from('classes').delete().eq('id', classId)
  await admin.from('users').delete().eq('id', instructorId)
  await admin.auth.admin.deleteUser(instructorId)
})

Deno.test('generate-slots: idempotent — does not create duplicate slots', async () => {
  const ts = Date.now()
  const email = `slot-idem-test-${ts}@test.com`
  const { data: auth } = await admin.auth.admin.createUser({ email, password: 'Password123!', email_confirm: true })
  const instructorId = auth.user!.id
  await admin.from('users').insert({ id: instructorId, name: 'Idem Test', role: 'instructor', email })
  const classId = crypto.randomUUID()
  await admin.from('classes').insert({ id: classId, instructor_id: instructorId, title: 'Test', max_capacity: 1, duration_minutes: 60 })
  await admin.from('availability_rules').insert({ instructor_id: instructorId, day_of_week: 1, start_time: '09:00:00', class_id: classId, is_active: true })

  // Invoke twice
  for (let i = 0; i < 2; i++) {
    await fetch(`${SUPABASE_URL}/functions/v1/generate-slots`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructor_id: instructorId }),
    })
  }

  const { data: slots } = await admin.from('slots').select('*').eq('instructor_id', instructorId)
  const starts = slots!.map(s => s.starts_at)
  const unique = new Set(starts)
  assertEquals(starts.length, unique.size, 'No duplicate slots should be created')

  await admin.from('slots').delete().eq('instructor_id', instructorId)
  await admin.from('classes').delete().eq('id', classId)
  await admin.from('users').delete().eq('id', instructorId)
  await admin.auth.admin.deleteUser(instructorId)
})

Deno.test('generate-slots: skips dates marked unavailable', async () => {
  const ts = Date.now()
  const email = `slot-unavail-test-${ts}@test.com`
  const { data: auth } = await admin.auth.admin.createUser({ email, password: 'Password123!', email_confirm: true })
  const instructorId = auth.user!.id
  await admin.from('users').insert({ id: instructorId, name: 'Unavail Test', role: 'instructor', email })
  const classId = crypto.randomUUID()
  await admin.from('classes').insert({ id: classId, instructor_id: instructorId, title: 'Test', max_capacity: 1, duration_minutes: 60 })
  await admin.from('availability_rules').insert({ instructor_id: instructorId, day_of_week: 1, start_time: '09:00:00', class_id: classId, is_active: true })

  // Pre-create a slot marked unavailable for next Monday
  const nextMonday = getNextWeekday(1)
  const unavailSlotId = crypto.randomUUID()
  const ends = new Date(nextMonday.getTime() + 60 * 60 * 1000)
  await admin.from('slots').insert({ id: unavailSlotId, class_id: classId, instructor_id: instructorId, starts_at: nextMonday.toISOString(), ends_at: ends.toISOString(), status: 'unavailable' })

  await fetch(`${SUPABASE_URL}/functions/v1/generate-slots`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instructor_id: instructorId }),
  })

  // The unavailable slot should remain unavailable (not overwritten to available)
  const { data: slot } = await admin.from('slots').select('status').eq('id', unavailSlotId).single()
  assertEquals(slot!.status, 'unavailable', 'Pre-existing unavailable slot should not be overwritten')

  await admin.from('slots').delete().eq('instructor_id', instructorId)
  await admin.from('classes').delete().eq('id', classId)
  await admin.from('users').delete().eq('id', instructorId)
  await admin.auth.admin.deleteUser(instructorId)
})

function getNextWeekday(dayOfWeek: number): Date {
  const date = new Date()
  date.setHours(9, 0, 0, 0)
  const diff = (dayOfWeek - date.getDay() + 7) % 7 || 7
  date.setDate(date.getDate() + diff)
  return date
}
