import { useEffect, useState } from 'react'
import { format, isPast } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Navbar } from '../../components/Navbar'
import { BookingStatusBadge } from '../../components/BookingStatusBadge'
import { canCancelImmediately, requiresInstructorApproval } from '../../utils/bookingState'
import { formatInNY } from '../../utils/dates'
import type { BookingWithDetails } from '../../types'

export function MyBookings() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadBookings()
  }, [user])

  async function loadBookings() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, slot:slots(*, class:classes(*)), student:users!bookings_student_id_fkey(id, name, email, phone)')
      .eq('student_id', user!.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })

    if (data) {
      // Enrich slots with confirmed_count
      const slotIds = data.map(b => b.slot.id)
      const { data: confirmedBookings } = await supabase
        .from('bookings')
        .select('slot_id')
        .in('slot_id', slotIds)
        .eq('status', 'confirmed')

      const confirmedCount: Record<string, number> = {}
      for (const b of confirmedBookings ?? []) {
        confirmedCount[b.slot_id] = (confirmedCount[b.slot_id] ?? 0) + 1
      }

      setBookings(data.map(b => ({
        ...b,
        slot: { ...b.slot, confirmed_count: confirmedCount[b.slot.id] ?? 0 },
      })) as BookingWithDetails[])
    }
    setLoading(false)
  }

  async function handleCancel(booking: BookingWithDetails) {
    setCancelling(booking.id)
    try {
      const slotStartsAt = booking.slot.starts_at
      if (canCancelImmediately(booking.status, slotStartsAt)) {
        await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
        supabase.functions.invoke('send-notifications', {
          body: { booking_id: booking.id, type: 'booking_cancelled' },
        })
      } else if (requiresInstructorApproval(booking.status, slotStartsAt)) {
        await supabase.from('bookings').update({
          status: 'cancellation_requested',
          cancellation_requested_at: new Date().toISOString(),
        }).eq('id', booking.id)
        supabase.functions.invoke('send-notifications', {
          body: { booking_id: booking.id, type: 'cancellation_requested' },
        })
      }
      await loadBookings()
    } finally {
      setCancelling(null)
    }
  }

  const upcoming = bookings.filter(b => !isPast(new Date(b.slot.starts_at)))
  const past = bookings.filter(b => isPast(new Date(b.slot.starts_at)))

  function CancelButton({ booking }: { booking: BookingWithDetails }) {
    const slotStartsAt = booking.slot.starts_at
    const canCancel = canCancelImmediately(booking.status, slotStartsAt)
    const needsApproval = requiresInstructorApproval(booking.status, slotStartsAt)
    const isCancelRequested = booking.status === 'cancellation_requested'

    if (isCancelRequested) {
      return <span className="text-xs text-amber-600">Cancellation requested</span>
    }
    if (!canCancel && !needsApproval) return null

    return (
      <button
        onClick={() => handleCancel(booking)}
        disabled={cancelling === booking.id}
        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
      >
        {cancelling === booking.id
          ? 'Cancelling…'
          : needsApproval
          ? 'Request cancel'
          : 'Cancel'}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <h1 className="text-xl font-bold text-gray-900">My Bookings</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Upcoming */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming</h2>
              {upcoming.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-sm text-gray-400">
                  No upcoming bookings
                </div>
              ) : (
                <div className="space-y-2">
                  {upcoming.map(booking => (
                    <div key={booking.id} className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{booking.slot.class.title}</p>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {formatInNY(booking.slot.starts_at, 'EEE, MMM d · h:mm a')}
                          </p>
                          <p className="text-sm text-gray-400">{booking.slot.class.duration_minutes} min</p>
                          <BookingStatusBadge status={booking.status} className="mt-2" />
                        </div>
                        <CancelButton booking={booking} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Past */}
            {past.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Past</h2>
                <div className="space-y-2">
                  {past.map(booking => (
                    <div key={booking.id} className="bg-white rounded-xl border border-gray-100 p-4 opacity-60">
                      <p className="font-semibold text-gray-900">{booking.slot.class.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {format(new Date(booking.slot.starts_at), 'EEE, MMM d, yyyy')}
                      </p>
                      <BookingStatusBadge status={booking.status} className="mt-2" />
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
