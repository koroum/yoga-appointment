import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, isSameDay } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Navbar } from '../../components/Navbar'
import { BookingStatusBadge } from '../../components/BookingStatusBadge'
import { Calendar, type DayStatus } from '../../components/Calendar'
import { formatInNY } from '../../utils/dates'
import { logger } from '../../utils/logger'
import type { SlotWithClass } from '../../types'

interface BookingWithStudent {
  id: string
  status: string
  student_note: string | null
  student: { name: string; email: string | null } | null
}

interface SlotWithBookings extends SlotWithClass {
  bookings: BookingWithStudent[]
}

export function Dashboard() {
  const { user } = useAuth()
  const [slots, setSlots] = useState<SlotWithBookings[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deletingSlot, setDeletingSlot] = useState<string | null>(null)
  const [notifySlot, setNotifySlot] = useState<string | null>(null)
  const [notifying, setNotifying] = useState<string | null>(null)
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadSlots()
  }, [user])

  async function loadSlots() {
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('slots')
        .select('*, class:classes(*)')
        .eq('instructor_id', user!.id)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })

      if (error) throw error
      logger.info('Dashboard: loaded', data?.length, 'slots')

      const slotIds = (data ?? []).map(s => s.id)

      const bookingMap: Record<string, BookingWithStudent[]> = {}
      if (slotIds.length > 0) {
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select('id, slot_id, status, student_note, student:users!bookings_student_id_fkey(name, email)')
          .in('slot_id', slotIds)
          .neq('status', 'cancelled')

        if (bookingsError) throw bookingsError

        for (const b of bookings ?? []) {
          if (!bookingMap[b.slot_id]) bookingMap[b.slot_id] = []
          const student = Array.isArray(b.student) ? b.student[0] : b.student
          bookingMap[b.slot_id].push({ id: b.id, status: b.status, student_note: b.student_note ?? null, student: student ?? null })
        }
      }

      const enriched = (data ?? []).map(s => ({
        ...s,
        confirmed_count: (bookingMap[s.id] ?? []).filter(b => b.status === 'confirmed').length,
        bookings: bookingMap[s.id] ?? [],
      }))

      setSlots(enriched)
      const allBookings = Object.values(bookingMap).flat()
      setPendingCount(allBookings.filter(b => b.status === 'pending').length)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard'
      logger.error('Dashboard loadSlots:', err)
      setLoadError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteSlot(slotId: string) {
    setDeletingSlot(slotId)
    try {
      const { error } = await supabase.from('slots').delete().eq('id', slotId)
      if (error) {
        logger.error('Dashboard: failed to delete slot', error)
        setLoadError(error.message)
      } else {
        logger.info('Dashboard: deleted slot', slotId)
        setSlots(prev => prev.filter(s => s.id !== slotId))
      }
    } finally {
      setDeletingSlot(null)
    }
  }

  async function handleNotify(slotId: string, channel: 'email' | 'sms' | 'both') {
    setNotifying(slotId)
    try {
      const slot = slots.find(s => s.id === slotId)
      if (!slot) return
      const confirmedBookings = slot.bookings.filter(b => b.status === 'confirmed')
      const channels = channel === 'both' ? ['email', 'sms'] : [channel]

      await Promise.all(
        confirmedBookings.map(b =>
          Promise.all(
            channels.map(ch =>
              supabase.functions.invoke('send-notifications', {
                body: { booking_id: b.id, type: 'reminder_manual', channel: ch },
              })
            )
          )
        )
      )

      logger.info('Dashboard: sent notifications for slot', slotId, 'via', channel)
      setNotifySuccess(slotId)
      setTimeout(() => setNotifySuccess(null), 3000)
    } catch (err) {
      logger.error('Dashboard: notify failed', err)
      setLoadError('Failed to send notifications')
    } finally {
      setNotifying(null)
      setNotifySlot(null)
    }
  }

  // Build calendar markers
  const markedDays: Record<string, DayStatus> = {}
  for (const slot of slots) {
    const key = format(new Date(slot.starts_at), 'yyyy-MM-dd')
    const confirmed = slot.bookings.some(b => b.status === 'confirmed')
    const pending = slot.bookings.some(b => b.status === 'pending')
    const full = slot.confirmed_count >= slot.class.max_capacity
    if (slot.status === 'unavailable') {
      markedDays[key] = 'unavailable'
    } else if (full) {
      markedDays[key] = 'confirmed'
    } else if (confirmed && pending) {
      markedDays[key] = 'mixed'
    } else if (pending) {
      markedDays[key] = 'pending'
    } else if (confirmed) {
      markedDays[key] = 'confirmed'
    } else {
      markedDays[key] = 'available'
    }
  }

  const daySlots = slots.filter(s => isSameDay(new Date(s.starts_at), selectedDate))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>

        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {loadError} — <button onClick={loadSlots} className="underline">Retry</button>
          </div>
        )}

        <Calendar markedDays={markedDays} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        {/* Selected day slots */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {format(selectedDate, 'EEE MMM d')}
          </h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : daySlots.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center text-sm text-gray-400">
              No classes on this day
            </div>
          ) : (
            <div className="space-y-2">
              {daySlots.map(slot => {
                const confirmed = slot.bookings.filter(b => b.status === 'confirmed').length
                const pending = slot.bookings.filter(b => b.status === 'pending').length
                const open = slot.class.max_capacity - confirmed
                return (
                  <div key={slot.id} className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{formatInNY(slot.starts_at, 'h:mm a')} · {slot.class.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {confirmed} confirmed{pending > 0 ? ` · ${pending} pending` : ''} · {open} open of {slot.class.max_capacity}
                        </p>
                        <BookingStatusBadge status={slot.status === 'unavailable' ? 'unavailable' : open === 0 ? 'confirmed' : 'available'} className="mt-2" />
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {pending > 0 && (
                          <Link to="/instructor/requests" className="text-sm text-indigo-600 font-medium">Review →</Link>
                        )}
                        {confirmed > 0 && (
                          notifySuccess === slot.id ? (
                            <span className="text-xs text-green-600 font-medium">Sent!</span>
                          ) : notifying === slot.id ? (
                            <span className="text-xs text-gray-400">Sending…</span>
                          ) : (
                            <div className="relative">
                              <button
                                onClick={() => setNotifySlot(notifySlot === slot.id ? null : slot.id)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                Notify ▾
                              </button>
                              {notifySlot === slot.id && (
                                <div className="absolute right-0 mt-1 w-28 bg-white border border-gray-200 rounded-lg shadow-md py-1 z-50">
                                  <button onClick={() => handleNotify(slot.id, 'email')} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">Email</button>
                                  <button onClick={() => handleNotify(slot.id, 'sms')} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">SMS</button>
                                  <button onClick={() => handleNotify(slot.id, 'both')} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">Both</button>
                                </div>
                              )}
                            </div>
                          )
                        )}
                        {slot.bookings.length === 0 && (
                          <button
                            onClick={() => handleDeleteSlot(slot.id)}
                            disabled={deletingSlot === slot.id}
                            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                          >
                            {deletingSlot === slot.id ? 'Removing…' : 'Remove slot'}
                          </button>
                        )}
                      </div>
                    </div>
                    {slot.bookings.filter(b => b.status === 'confirmed').length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        <p className="text-xs text-gray-400 mb-1.5">Confirmed students</p>
                        <div className="space-y-1">
                          {slot.bookings.filter(b => b.status === 'confirmed').map(b => (
                            <div key={b.id}>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-700">{b.student?.name ?? 'Unknown'}</span>
                                {b.student?.email && <span className="text-xs text-gray-400">{b.student.email}</span>}
                              </div>
                              {b.student_note && <p className="text-xs text-gray-400 italic ml-0.5">"{b.student_note}"</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <Link to="/instructor/availability" className="mt-2 flex items-center justify-center gap-1 w-full border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-600">
            + Add slot
          </Link>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/instructor/requests" className="bg-white rounded-xl border border-gray-100 p-4 text-center hover:border-indigo-200">
              <p className="font-semibold text-gray-900">
                Requests{pendingCount > 0 && <span className="ml-1 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Booking requests</p>
            </Link>
            <Link to="/instructor/availability" className="bg-white rounded-xl border border-gray-100 p-4 text-center hover:border-indigo-200">
              <p className="font-semibold text-gray-900">Availability</p>
              <p className="text-xs text-gray-400 mt-0.5">Manage schedule</p>
            </Link>
            <Link to="/instructor/students" className="bg-white rounded-xl border border-gray-100 p-4 text-center hover:border-indigo-200">
              <p className="font-semibold text-gray-900">Students</p>
              <p className="text-xs text-gray-400 mt-0.5">Your roster</p>
            </Link>
            <Link to="/instructor/profile" className="bg-white rounded-xl border border-gray-100 p-4 text-center hover:border-indigo-200">
              <p className="font-semibold text-gray-900">Profile</p>
              <p className="text-xs text-gray-400 mt-0.5">Edit public page</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
