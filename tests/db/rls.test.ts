import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''

// Service-role client — bypasses RLS (for setup/teardown)
const admin = createClient(SUPABASE_URL, SERVICE_KEY)

// Helper: create an authenticated client for a given user JWT
function clientAs(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { detectSessionInUrl: false, persistSession: false },
  })
}

// Anon client
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { detectSessionInUrl: false, persistSession: false },
})

// Test user IDs
let instructorId: string
let studentId: string
let student2Id: string
let instructorToken: string
let studentToken: string
let student2Token: string
let profileId: string
let slotId: string
let classId: string

beforeAll(async () => {
  const ts = Date.now()
  const iEmail = `rls-instructor-${ts}@test.com`
  const sEmail = `rls-student-${ts}@test.com`
  const s2Email = `rls-student2-${ts}@test.com`
  const password = 'Password123!'

  const { data: iAuth } = await admin.auth.admin.createUser({ email: iEmail, password, email_confirm: true })
  const { data: sAuth } = await admin.auth.admin.createUser({ email: sEmail, password, email_confirm: true })
  const { data: s2Auth } = await admin.auth.admin.createUser({ email: s2Email, password, email_confirm: true })

  instructorId = iAuth.user!.id
  studentId = sAuth.user!.id
  student2Id = s2Auth.user!.id

  // Insert public users rows
  await admin.from('users').insert([
    { id: instructorId, name: 'Instructor RLS', role: 'instructor', email: iEmail, username: `rls-inst-${ts}` },
    { id: studentId, name: 'Student RLS', role: 'student', email: sEmail },
    { id: student2Id, name: 'Student2 RLS', role: 'student', email: s2Email },
  ])

  // Sign in to get tokens
  const { data: iSession } = await createClient(SUPABASE_URL, ANON_KEY).auth.signInWithPassword({ email: iEmail, password })
  const { data: sSession } = await createClient(SUPABASE_URL, ANON_KEY).auth.signInWithPassword({ email: sEmail, password })
  const { data: s2Session } = await createClient(SUPABASE_URL, ANON_KEY).auth.signInWithPassword({ email: s2Email, password })

  instructorToken = iSession.session!.access_token
  studentToken = sSession.session!.access_token
  student2Token = s2Session.session!.access_token

  // Create instructor profile
  profileId = crypto.randomUUID()
  await admin.from('instructor_profiles').insert({ id: profileId, user_id: instructorId, bio: 'Test bio', photo_urls: [] })

  // Link student to instructor
  await admin.from('instructor_students').insert({ instructor_id: instructorId, student_id: studentId, linked_via: 'discovery' })

  // Create a class and slot
  classId = crypto.randomUUID()
  await admin.from('classes').insert({ id: classId, instructor_id: instructorId, title: 'RLS Test Class', max_capacity: 5, duration_minutes: 60 })

  slotId = crypto.randomUUID()
  await admin.from('slots').insert({
    id: slotId,
    class_id: classId,
    instructor_id: instructorId,
    starts_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString(),
    status: 'available',
  })
})

afterAll(async () => {
  await admin.from('bookings').delete().eq('slot_id', slotId)
  await admin.from('slots').delete().eq('id', slotId)
  await admin.from('classes').delete().eq('id', classId)
  await admin.from('instructor_students').delete().eq('instructor_id', instructorId)
  await admin.from('instructor_profiles').delete().eq('id', profileId)
  await admin.from('users').delete().in('id', [instructorId, studentId, student2Id])
  await admin.auth.admin.deleteUser(instructorId)
  await admin.auth.admin.deleteUser(studentId)
  await admin.auth.admin.deleteUser(student2Id)
})

describe('RLS: instructor_profiles', () => {
  it('anon can SELECT instructor_profiles', async () => {
    const { data, error } = await anon.from('instructor_profiles').select('id').eq('id', profileId)
    expect(error).toBeNull()
    expect(data?.length).toBe(1)
  })

  it('anon cannot INSERT instructor_profiles', async () => {
    const { error } = await anon.from('instructor_profiles').insert({ id: crypto.randomUUID(), user_id: crypto.randomUUID(), photo_urls: [] })
    expect(error).not.toBeNull()
  })

  it('instructor can UPDATE own profile', async () => {
    const client = clientAs(instructorToken)
    const { error } = await client.from('instructor_profiles').update({ bio: 'Updated bio' }).eq('id', profileId)
    expect(error).toBeNull()
  })

  it('student cannot UPDATE an instructor profile', async () => {
    const client = clientAs(studentToken)
    const { error } = await client.from('instructor_profiles').update({ bio: 'Hacked' }).eq('id', profileId)
    // RLS should prevent this — either error or 0 rows updated
    if (!error) {
      const { data } = await admin.from('instructor_profiles').select('bio').eq('id', profileId).single()
      expect(data?.bio).not.toBe('Hacked')
    } else {
      expect(error).not.toBeNull()
    }
  })
})

describe('RLS: slots', () => {
  it('anon can SELECT available slots', async () => {
    const { data, error } = await anon.from('slots').select('id').eq('id', slotId)
    expect(error).toBeNull()
    expect(data?.length).toBe(1)
  })

  it('anon cannot SELECT unavailable slots', async () => {
    await admin.from('slots').update({ status: 'unavailable' }).eq('id', slotId)
    const { data } = await anon.from('slots').select('id').eq('id', slotId)
    expect(data?.length ?? 0).toBe(0)
    await admin.from('slots').update({ status: 'available' }).eq('id', slotId)
  })

  it('instructor can UPDATE own slots', async () => {
    const client = clientAs(instructorToken)
    const { error } = await client.from('slots').update({ status: 'unavailable' }).eq('id', slotId)
    expect(error).toBeNull()
    await admin.from('slots').update({ status: 'available' }).eq('id', slotId)
  })
})

describe('RLS: bookings', () => {
  let bookingId: string

  it('student can INSERT a booking for themselves', async () => {
    const client = clientAs(studentToken)
    const { data, error } = await client.from('bookings').insert({
      id: crypto.randomUUID(),
      slot_id: slotId,
      student_id: studentId,
      status: 'pending',
      booked_by: 'student',
    }).select('id').single()
    expect(error).toBeNull()
    bookingId = data!.id
  })

  it('student can SELECT own bookings', async () => {
    const client = clientAs(studentToken)
    const { data, error } = await client.from('bookings').select('id').eq('id', bookingId)
    expect(error).toBeNull()
    expect(data?.length).toBe(1)
  })

  it('student2 cannot SELECT student1 bookings', async () => {
    const client = clientAs(student2Token)
    const { data } = await client.from('bookings').select('id').eq('id', bookingId)
    expect(data?.length ?? 0).toBe(0)
  })

  it('instructor can SELECT all bookings on their slots', async () => {
    const client = clientAs(instructorToken)
    const { data, error } = await client.from('bookings').select('id').eq('id', bookingId)
    expect(error).toBeNull()
    expect(data?.length).toBe(1)
  })

  it('instructor can UPDATE booking status', async () => {
    const client = clientAs(instructorToken)
    const { error } = await client.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId)
    expect(error).toBeNull()

    // cleanup
    await admin.from('bookings').delete().eq('id', bookingId)
  })
})

describe('RLS: notifications_log', () => {
  let notifId: string

  beforeAll(async () => {
    notifId = crypto.randomUUID()
    await admin.from('notifications_log').insert({
      id: notifId,
      recipient_id: studentId,
      channel: 'email',
      type: 'booking_confirmed',
      status: 'sent',
    })
  })

  afterAll(async () => {
    await admin.from('notifications_log').delete().eq('id', notifId)
  })

  it('student can SELECT own notification records', async () => {
    const client = clientAs(studentToken)
    const { data, error } = await client.from('notifications_log').select('id').eq('id', notifId)
    expect(error).toBeNull()
    expect(data?.length).toBe(1)
  })

  it('student2 cannot SELECT student1 notifications', async () => {
    const client = clientAs(student2Token)
    const { data } = await client.from('notifications_log').select('id').eq('id', notifId)
    expect(data?.length ?? 0).toBe(0)
  })

  it('instructor can SELECT notifications for their students', async () => {
    const client = clientAs(instructorToken)
    const { data, error } = await client.from('notifications_log').select('id').eq('id', notifId)
    expect(error).toBeNull()
    expect(data?.length).toBe(1)
  })
})

describe('RLS: student_notification_prefs', () => {
  let prefId: string

  beforeAll(async () => {
    prefId = crypto.randomUUID()
    await admin.from('student_notification_prefs').insert({
      id: prefId,
      instructor_id: instructorId,
      student_id: studentId,
      reminders_enabled: true,
    })
  })

  afterAll(async () => {
    await admin.from('student_notification_prefs').delete().eq('id', prefId)
  })

  it('instructor can UPDATE reminders_enabled for linked students', async () => {
    const client = clientAs(instructorToken)
    const { error } = await client.from('student_notification_prefs').update({ reminders_enabled: false }).eq('id', prefId)
    expect(error).toBeNull()
  })

  it('instructor cannot UPDATE prefs for unlinked students', async () => {
    const client = clientAs(instructorToken)
    // student2 is not linked to this instructor
    const fakeId = crypto.randomUUID()
    await admin.from('student_notification_prefs').insert({ id: fakeId, instructor_id: instructorId, student_id: student2Id, reminders_enabled: true })
    // remove the link to make student2 unlinked
    await admin.from('instructor_students').delete().eq('instructor_id', instructorId).eq('student_id', student2Id)

    const { data } = await client.from('student_notification_prefs').update({ reminders_enabled: false }).eq('id', fakeId).select()
    expect(data?.length ?? 0).toBe(0)

    await admin.from('student_notification_prefs').delete().eq('id', fakeId)
    // restore link for cleanup
    await admin.from('instructor_students').insert({ instructor_id: instructorId, student_id: studentId, linked_via: 'discovery' })
  })
})
