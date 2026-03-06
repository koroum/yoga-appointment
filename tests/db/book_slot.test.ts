import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

// Test fixtures
let instructorId: string
let studentId: string
let student2Id: string
let classId: string
let slotId: string

async function createSlot(maxCapacity = 1): Promise<string> {
  const cls = crypto.randomUUID()
  await supabase.from('classes').insert({
    id: cls,
    instructor_id: instructorId,
    title: 'Test Class',
    max_capacity: maxCapacity,
    duration_minutes: 60,
  })
  const sid = crypto.randomUUID()
  const starts = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const ends = new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString()
  await supabase.from('slots').insert({
    id: sid,
    class_id: cls,
    instructor_id: instructorId,
    starts_at: starts,
    ends_at: ends,
    status: 'available',
  })
  return sid
}

beforeAll(async () => {
  instructorId = crypto.randomUUID()
  studentId = crypto.randomUUID()
  student2Id = crypto.randomUUID()

  await supabase.from('users').insert([
    { id: instructorId, name: 'Instructor', role: 'instructor', email: `inst-${instructorId}@test.com` },
    { id: studentId, name: 'Student 1', role: 'student', email: `stu1-${studentId}@test.com` },
    { id: student2Id, name: 'Student 2', role: 'student', email: `stu2-${student2Id}@test.com` },
  ])

  classId = crypto.randomUUID()
  await supabase.from('classes').insert({
    id: classId,
    instructor_id: instructorId,
    title: 'Morning Flow',
    max_capacity: 1,
    duration_minutes: 60,
  })

  slotId = await createSlot(1)
})

afterAll(async () => {
  await supabase.from('bookings').delete().eq('slot_id', slotId)
  await supabase.from('slots').delete().eq('instructor_id', instructorId)
  await supabase.from('classes').delete().eq('instructor_id', instructorId)
  await supabase.from('users').delete().in('id', [instructorId, studentId, student2Id])
})

describe('book_slot() — happy path', () => {
  it('creates a pending booking when booked_by student', async () => {
    const sid = await createSlot(5)
    const { data, error } = await supabase.rpc('book_slot', {
      p_slot_id: sid,
      p_student_id: studentId,
      p_booked_by: 'student',
    })
    expect(error).toBeNull()
    expect(data).toBeTruthy()

    const { data: booking } = await supabase.from('bookings').select('status, booked_by').eq('id', data).single()
    expect(booking?.status).toBe('pending')
    expect(booking?.booked_by).toBe('student')
    await supabase.from('bookings').delete().eq('id', data)
    await supabase.from('slots').delete().eq('id', sid)
  })

  it('creates a confirmed booking when booked_by instructor', async () => {
    const sid = await createSlot(5)
    const { data, error } = await supabase.rpc('book_slot', {
      p_slot_id: sid,
      p_student_id: studentId,
      p_booked_by: 'instructor',
    })
    expect(error).toBeNull()
    const { data: booking } = await supabase.from('bookings').select('status').eq('id', data).single()
    expect(booking?.status).toBe('confirmed')
    await supabase.from('bookings').delete().eq('id', data)
    await supabase.from('slots').delete().eq('id', sid)
  })
})

describe('book_slot() — capacity enforcement', () => {
  it('blocks booking when slot is at full capacity', async () => {
    const sid = await createSlot(1)
    // Fill the slot
    const { data: b1, error: e1 } = await supabase.rpc('book_slot', {
      p_slot_id: sid,
      p_student_id: studentId,
      p_booked_by: 'instructor', // confirmed immediately
    })
    expect(e1).toBeNull()

    // Second student should be blocked
    const { error: e2 } = await supabase.rpc('book_slot', {
      p_slot_id: sid,
      p_student_id: student2Id,
      p_booked_by: 'student',
    })
    expect(e2).not.toBeNull()
    expect(e2?.message).toMatch(/full|capacity/i)

    await supabase.from('bookings').delete().eq('id', b1)
    await supabase.from('slots').delete().eq('id', sid)
  })

  it('pending bookings do NOT count toward capacity', async () => {
    const sid = await createSlot(1)
    // Add a pending booking
    await supabase.rpc('book_slot', {
      p_slot_id: sid,
      p_student_id: studentId,
      p_booked_by: 'student', // pending
    })

    // Slot still bookable since no confirmed bookings yet
    const { error } = await supabase.rpc('book_slot', {
      p_slot_id: sid,
      p_student_id: student2Id,
      p_booked_by: 'student',
    })
    expect(error).toBeNull()

    await supabase.from('bookings').delete().eq('slot_id', sid)
    await supabase.from('slots').delete().eq('id', sid)
  })

  it('cancelled bookings free the seat', async () => {
    const sid = await createSlot(1)
    const { data: b1 } = await supabase.rpc('book_slot', {
      p_slot_id: sid,
      p_student_id: studentId,
      p_booked_by: 'instructor',
    })

    // Cancel it
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', b1)

    // Should be bookable again
    const { error } = await supabase.rpc('book_slot', {
      p_slot_id: sid,
      p_student_id: student2Id,
      p_booked_by: 'instructor',
    })
    expect(error).toBeNull()

    await supabase.from('bookings').delete().eq('slot_id', sid)
    await supabase.from('slots').delete().eq('id', sid)
  })

  it('rejects booking on unavailable slot', async () => {
    const sid = await createSlot(5)
    await supabase.from('slots').update({ status: 'unavailable' }).eq('id', sid)

    const { error } = await supabase.rpc('book_slot', {
      p_slot_id: sid,
      p_student_id: studentId,
      p_booked_by: 'student',
    })
    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/unavailable/i)

    await supabase.from('slots').delete().eq('id', sid)
  })
})

describe('book_slot() — concurrent booking (last seat)', () => {
  it('exactly one booking succeeds when two students race for the last seat', async () => {
    const sid = await createSlot(1)

    // Fire both simultaneously without awaiting
    const [r1, r2] = await Promise.all([
      supabase.rpc('book_slot', { p_slot_id: sid, p_student_id: studentId, p_booked_by: 'instructor' }),
      supabase.rpc('book_slot', { p_slot_id: sid, p_student_id: student2Id, p_booked_by: 'instructor' }),
    ])

    const successes = [r1, r2].filter(r => r.error === null).length
    const failures = [r1, r2].filter(r => r.error !== null).length
    expect(successes).toBe(1)
    expect(failures).toBe(1)

    await supabase.from('bookings').delete().eq('slot_id', sid)
    await supabase.from('slots').delete().eq('id', sid)
  })
})
