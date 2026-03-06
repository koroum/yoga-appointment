import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Navbar } from '../../components/Navbar'
import { BookingStatusBadge } from '../../components/BookingStatusBadge'
import { formatInNY } from '../../utils/dates'
import type { BookingWithDetails } from '../../types'

export function InstructorRequests() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadBookings()
  }, [user])

  async function loadBookings() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, slot:slots(*, class:classes(*)), student:users!bookings_student_id_fkey(id, name, email, phone)')
      .eq('slot.instructor_id', user!.id)
      .in('status', ['pending', 'cancellation_requested'])
      .order('created_at', { ascending: true })

    if (data) {
      // Enrich with confirmed_count
      const slotIds = [...new Set(data.map(b => b.slot?.id).filter(Boolean))]
      const { data: confirmed } = await supabase
        .from('bookings')
        .select('slot_id')
        .in('slot_id', slotIds)
        .eq('status', 'confirmed')

      const confirmedCount: Record<string, number> = {}
      for (const b of confirmed ?? []) {
        confirmedCount[b.slot_id] = (confirmedCount[b.slot_id] ?? 0) + 1
      }

      setBookings(data.filter(b => b.slot).map(b => ({
        ...b,
        slot: { ...b.slot, confirmed_count: confirmedCount[b.slot.id] ?? 0 },
      })) as BookingWithDetails[])
    }
    setLoading(false)
  }

  async function handleAction(booking: BookingWithDetails, action: 'confirm' | 'decline' | 'approve_cancel') {
    setActing(booking.id)
    try {
      if (action === 'confirm') {
        await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id)
        supabase.functions.invoke('send-notifications', {
          body: { booking_id: booking.id, type: 'booking_confirmed' },
        })
      } else if (action === 'decline') {
        await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
        supabase.functions.invoke('send-notifications', {
          body: { booking_id: booking.id, type: 'booking_rejected' },
        })
      } else if (action === 'approve_cancel') {
        await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
        supabase.functions.invoke('send-notifications', {
          body: { booking_id: booking.id, type: 'booking_cancelled' },
        })
      }
      await loadBookings()
    } finally {
      setActing(null)
    }
  }

  const pending = bookings.filter(b => b.status === 'pending')
  const cancelRequests = bookings.filter(b => b.status === 'cancellation_requested')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/instructor/dashboard" className="text-sm text-indigo-600">← Dashboard</Link>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Booking Requests</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">
            No pending requests
          </div>
        ) : (
          <>
            {/* New booking requests */}
            {pending.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  New Requests
                  <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pending.length}</span>
                </h2>
                <div className="space-y-3">
                  {pending.map(booking => (
                    <div key={booking.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                      <div>
                        <p className="font-semibold text-gray-900">{booking.slot.class.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {formatInNY(booking.slot.starts_at, 'EEE, MMM d · h:mm a')}
                        </p>
                        <p className="text-sm text-gray-700 mt-1 font-medium">{booking.student.name}</p>
                        {booking.student.email && (
                          <p className="text-xs text-gray-400">{booking.student.email}</p>
                        )}
                        <BookingStatusBadge status="pending" className="mt-2" />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(booking, 'confirm')}
                          disabled={acting === booking.id}
                          className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                          {acting === booking.id ? 'Saving…' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => handleAction(booking, 'decline')}
                          disabled={acting === booking.id}
                          className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Cancellation requests */}
            {cancelRequests.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Cancellation Requests
                </h2>
                <div className="space-y-3">
                  {cancelRequests.map(booking => (
                    <div key={booking.id} className="bg-white rounded-xl border border-amber-100 p-4 space-y-3">
                      <div>
                        <p className="font-semibold text-gray-900">{booking.slot.class.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {formatInNY(booking.slot.starts_at, 'EEE, MMM d · h:mm a')}
                        </p>
                        <p className="text-sm text-gray-700 mt-1 font-medium">{booking.student.name}</p>
                        <BookingStatusBadge status="cancellation_requested" className="mt-2" />
                      </div>
                      <button
                        onClick={() => handleAction(booking, 'approve_cancel')}
                        disabled={acting === booking.id}
                        className="w-full border border-red-300 text-red-600 py-2 rounded-lg text-sm disabled:opacity-50"
                      >
                        {acting === booking.id ? 'Processing…' : 'Approve Cancellation'}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
