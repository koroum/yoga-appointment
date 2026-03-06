import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, isSameDay } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Navbar } from '../../components/Navbar'
import { BookingStatusBadge } from '../../components/BookingStatusBadge'
import { Calendar, type DayStatus } from '../../components/Calendar'
import { formatInNY } from '../../utils/dates'
import type { SlotWithClass, Booking } from '../../types'

interface SlotWithBookings extends SlotWithClass {
  bookings: Pick<Booking, 'id' | 'status'>[]
}

export function Dashboard() {
  const { user } = useAuth()
  const [slots, setSlots] = useState<SlotWithBookings[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadSlots()
  }, [user])

  async function loadSlots() {
    setLoading(true)
    const { data } = await supabase
      .from('slots')
      .select('*, class:classes(*)')
      .eq('instructor_id', user!.id)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })

    if (data) {
      const slotIds = data.map(s => s.id)
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, slot_id, status')
        .in('slot_id', slotIds)
        .neq('status', 'cancelled')

      const bookingMap: Record<string, Pick<Booking, 'id' | 'status'>[]> = {}
      for (const b of bookings ?? []) {
        if (!bookingMap[b.slot_id]) bookingMap[b.slot_id] = []
        bookingMap[b.slot_id].push({ id: b.id, status: b.status })
      }

      const enriched = data.map(s => ({
        ...s,
        confirmed_count: (bookingMap[s.id] ?? []).filter(b => b.status === 'confirmed').length,
        bookings: bookingMap[s.id] ?? [],
      }))

      setSlots(enriched)
      setPendingCount(bookings?.filter(b => b.status === 'pending').length ?? 0)
    }
    setLoading(false)
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
                      <Link to="/instructor/requests" className="text-sm text-indigo-600 font-medium shrink-0">View →</Link>
                    </div>
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
