import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Navbar } from '../../components/Navbar'
import { InstructorBookModal } from '../../components/InstructorBookModal'
import type { SlotWithClass, StudentNotificationPref } from '../../types'

interface StudentRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  linked_via: 'invite' | 'discovery'
  linked_at: string
  reminders_enabled: boolean
  pref_id: string | null
}

export function InstructorStudents() {
  const { user } = useAuth()
  const [students, setStudents] = useState<StudentRow[]>([])
  const [availableSlots, setAvailableSlots] = useState<SlotWithClass[]>([])
  const [bookingFor, setBookingFor] = useState<StudentRow | null>(null)
  const [togglingPref, setTogglingPref] = useState<string | null>(null)
  const [bookingDone, setBookingDone] = useState<string | null>(null) // student id
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    setLoading(true)

    const [{ data: links }, { data: prefs }, { data: slotsData }] = await Promise.all([
      supabase
        .from('instructor_students')
        .select('student_id, linked_via, linked_at, student:users!instructor_students_student_id_fkey(id, name, email, phone)')
        .eq('instructor_id', user!.id)
        .order('linked_at', { ascending: false }),
      supabase
        .from('student_notification_prefs')
        .select('*')
        .eq('instructor_id', user!.id),
      supabase
        .from('slots')
        .select('*, class:classes(*)')
        .eq('instructor_id', user!.id)
        .eq('status', 'available')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true }),
    ])

    const prefsMap: Record<string, StudentNotificationPref> = {}
    for (const p of prefs ?? []) {
      prefsMap[p.student_id] = p
    }

    type LinkRow = {
      student_id: string
      linked_via: string
      linked_at: string
      student: { id: string; name: string; email: string | null; phone: string | null } | { id: string; name: string; email: string | null; phone: string | null }[] | null
    }

    const studentList: StudentRow[] = (links as LinkRow[] ?? []).map(l => {
      const s = Array.isArray(l.student) ? l.student[0] : l.student
      const pref = prefsMap[l.student_id]
      return {
        id: l.student_id,
        name: s?.name ?? 'Unknown',
        email: s?.email ?? null,
        phone: s?.phone ?? null,
        linked_via: l.linked_via as 'invite' | 'discovery',
        linked_at: l.linked_at,
        reminders_enabled: pref?.reminders_enabled ?? true,
        pref_id: pref?.id ?? null,
      }
    })

    setStudents(studentList)

    // Enrich slots with confirmed_count
    if (slotsData && slotsData.length > 0) {
      const slotIds = slotsData.map(s => s.id)
      const { data: confirmed } = await supabase
        .from('bookings')
        .select('slot_id')
        .in('slot_id', slotIds)
        .eq('status', 'confirmed')

      const confirmedCount: Record<string, number> = {}
      for (const b of confirmed ?? []) {
        confirmedCount[b.slot_id] = (confirmedCount[b.slot_id] ?? 0) + 1
      }

      setAvailableSlots(
        (slotsData as SlotWithClass[])
          .map(s => ({ ...s, confirmed_count: confirmedCount[s.id] ?? 0 }))
          .filter(s => s.confirmed_count < s.class.max_capacity)
      )
    } else {
      setAvailableSlots([])
    }

    setLoading(false)
  }

  async function handleToggleReminders(student: StudentRow) {
    setTogglingPref(student.id)
    const newValue = !student.reminders_enabled
    if (student.pref_id) {
      await supabase.from('student_notification_prefs')
        .update({ reminders_enabled: newValue, updated_at: new Date().toISOString() })
        .eq('id', student.pref_id)
    } else {
      await supabase.from('student_notification_prefs').insert({
        instructor_id: user!.id,
        student_id: student.id,
        reminders_enabled: newValue,
      })
    }
    setStudents(prev => prev.map(s =>
      s.id === student.id ? { ...s, reminders_enabled: newValue } : s
    ))
    setTogglingPref(null)
  }

  async function handleDirectBook(slot: SlotWithClass) {
    if (!bookingFor) return
    const { data, error } = await supabase.rpc('book_slot', {
      p_slot_id: slot.id,
      p_student_id: bookingFor.id,
      p_booked_by: 'instructor',
    })
    if (error) throw error
    const bookingId = data as string
    supabase.functions.invoke('send-notifications', {
      body: { booking_id: bookingId, type: 'booking_confirmed' },
    })
    setBookingDone(bookingFor.id)
    setBookingFor(null)
    await loadData()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/instructor/dashboard" className="text-sm text-indigo-600">← Dashboard</Link>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Students</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-500 font-medium">No students yet</p>
            <p className="text-sm text-gray-400 mt-1">Share your profile link to get started.</p>
          </div>
        ) : (
          <>
            {bookingDone && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
                ✓ Booking confirmed and student notified.
              </div>
            )}

            <div className="space-y-3">
              {students.map(student => (
                <div key={student.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{student.name}</p>
                      {student.email && (
                        <p className="text-sm text-gray-500 truncate">{student.email}</p>
                      )}
                      {student.phone && (
                        <p className="text-sm text-gray-500">{student.phone}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-400">
                          Joined {format(new Date(student.linked_at), 'MMM d, yyyy')} · {student.linked_via}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => { setBookingFor(student); setBookingDone(null) }}
                      className="shrink-0 text-sm text-indigo-600 font-medium hover:text-indigo-700"
                    >
                      Book →
                    </button>
                  </div>

                  {/* Reminder toggle */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <span className="text-xs text-gray-500">Class reminders</span>
                    <button
                      onClick={() => handleToggleReminders(student)}
                      disabled={togglingPref === student.id}
                      className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                        student.reminders_enabled ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                        student.reminders_enabled ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 text-center">{students.length} student{students.length !== 1 ? 's' : ''}</p>
          </>
        )}
      </div>

      {bookingFor && (
        <InstructorBookModal
          studentName={bookingFor.name}
          slots={availableSlots}
          onBook={handleDirectBook}
          onClose={() => setBookingFor(null)}
        />
      )}
    </div>
  )
}
