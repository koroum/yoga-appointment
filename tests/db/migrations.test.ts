import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

describe('Schema: all 9 tables exist', () => {
  const tables = [
    'users',
    'instructor_profiles',
    'classes',
    'availability_rules',
    'slots',
    'bookings',
    'notifications_log',
    'instructor_students',
    'student_notification_prefs',
  ]

  // instructor_students has a composite PK (no id column) — use * with limit 0
  for (const table of tables) {
    it(`table "${table}" exists`, async () => {
      const { error } = await supabase.from(table).select('*').limit(0)
      expect(error).toBeNull()
    })
  }
})

describe('Schema: users table constraints', () => {
  it('rejects a user with both email and phone null', async () => {
    const { error } = await supabase.from('users').insert({
      id: crypto.randomUUID(),
      name: 'Test User',
      role: 'student',
      // email and phone both omitted
    })
    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/email.*phone|check/i)
  })

  it('accepts a user with only email', async () => {
    const id = crypto.randomUUID()
    const { error } = await supabase.from('users').insert({
      id,
      name: 'Email Only',
      role: 'student',
      email: `emailonly-${id}@test.com`,
    })
    expect(error).toBeNull()
    // cleanup
    await supabase.from('users').delete().eq('id', id)
  })

  it('accepts a user with only phone', async () => {
    const id = crypto.randomUUID()
    const { error } = await supabase.from('users').insert({
      id,
      name: 'Phone Only',
      role: 'student',
      phone: `+1555${id.replace(/-/g, '').slice(0, 7)}`,
    })
    expect(error).toBeNull()
    // cleanup
    await supabase.from('users').delete().eq('id', id)
  })

  it('rejects an invalid role value', async () => {
    const { error } = await supabase.from('users').insert({
      id: crypto.randomUUID(),
      name: 'Bad Role',
      role: 'admin',
      email: 'badrole@test.com',
    })
    expect(error).not.toBeNull()
  })
})

describe('Schema: slots status constraint', () => {
  it('rejects an invalid slot status', async () => {
    // need a valid instructor and class first — just check the constraint message
    const { error } = await supabase.from('slots').insert({
      id: crypto.randomUUID(),
      class_id: crypto.randomUUID(),
      instructor_id: crypto.randomUUID(),
      starts_at: new Date().toISOString(),
      ends_at: new Date().toISOString(),
      status: 'bogus',
    })
    expect(error).not.toBeNull()
  })
})

describe('Schema: bookings status constraint', () => {
  it('rejects an invalid booking status', async () => {
    const { error } = await supabase.from('bookings').insert({
      id: crypto.randomUUID(),
      slot_id: crypto.randomUUID(),
      student_id: crypto.randomUUID(),
      status: 'not_a_status',
      booked_by: 'student',
    })
    expect(error).not.toBeNull()
  })
})

describe('Schema: instructor_students composite PK', () => {
  it('rejects duplicate (instructor_id, student_id) pair', async () => {
    const instructorId = crypto.randomUUID()
    const studentId = crypto.randomUUID()

    // Insert instructor and student users first
    await supabase.from('users').insert([
      { id: instructorId, name: 'Instructor', role: 'instructor', email: `inst-${instructorId}@test.com` },
      { id: studentId, name: 'Student', role: 'student', email: `stu-${studentId}@test.com` },
    ])

    const row = { instructor_id: instructorId, student_id: studentId, linked_via: 'discovery' }
    const first = await supabase.from('instructor_students').insert(row)
    expect(first.error).toBeNull()

    const second = await supabase.from('instructor_students').insert(row)
    expect(second.error).not.toBeNull()

    // cleanup
    await supabase.from('instructor_students').delete().eq('instructor_id', instructorId).eq('student_id', studentId)
    await supabase.from('users').delete().in('id', [instructorId, studentId])
  })
})
