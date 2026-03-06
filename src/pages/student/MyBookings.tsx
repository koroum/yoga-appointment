import { useEffect, useState } from 'react'
import { format, isPast } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Navbar } from '../../components/Navbar'
import { BookingStatusBadge } from '../../components/BookingStatusBadge'
import { canCancelImmediately, requiresInstructorApproval } from '../../utils/bookingState'
import { formatInNY } from '../../utils/dates'
import { logger } from '../../utils/logger'
import type { BookingWithDetails } from '../../types'

export function MyBookings() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<BookingWithDetails | null>(null)
  const [cancelNote, setCancelNote] = useState('')

  useEffect(() => {
    if (user) loadBookings()
  }, [user])

  async function loadBookings() {
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, slot:slots!bookings_slot_id_fkey(*, class:classes(*)), student:users!bookings_student_id_fkey(id, name, email, phone)')
        .eq('student_id', user!.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })

      if (error) throw error
      logger.info('MyBookings: loaded', data?.length, 'bookings')

      const slotIds = (data ?? []).map(b => b.slot.id)

      const confirmedCount: Record<string, number> = {}
      if (slotIds.length > 0) {
        const { data: confirmedBookings, error: confirmedError } = await supabase
          .from('bookings')
          .select('slot_id')
          .in('slot_id', slotIds)
          .eq('status', 'confirmed')

        if (confirmedError) logger.warn('MyBookings: failed to load confirmed counts', confirmedError)

        for (const b of confirmedBookings ?? []) {
          confirmedCount[b.slot_id] = (confirmedCount[b.slot_id] ?? 0) + 1
        }
      }

      setBookings((data ?? []).map(b => ({
        ...b,
        slot: { ...b.slot, confirmed_count: confirmedCount[b.slot.id] ?? 0 },
      })) as BookingWithDetails[])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to load bookings'
      logger.error('MyBookings loadBookings:', msg, err)
      setLoadError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel(booking: BookingWithDetails, note: string) {
    setCancelling(booking.id)
    setCancelError(null)
    setCancelTarget(null)
    setCancelNote('')
    try {
      const slotStartsAt = booking.slot.starts_at
      const noteUpdate = note ? { student_note: note } : {}
      if (canCancelImmediately(booking.status, slotStartsAt)) {
        const { error } = await supabase.from('bookings').update({ status: 'cancelled', ...noteUpdate }).eq('id', booking.id)
        if (error) throw error
        logger.info('MyBookings: cancelled booking', booking.id)
        supabase.functions.invoke('send-notifications', { body: { booking_id: booking.id, type: 'booking_cancelled' } })
          .then(({ error: e }) => { if (e) logger.warn('send-notifications failed:', e) })
      } else if (requiresInstructorApproval(booking.status, slotStartsAt)) {
        const { error } = await supabase.from('bookings').update({
          status: 'cancellation_requested',
          cancellation_requested_at: new Date().toISOString(),
          ...noteUpdate,
        }).eq('id', booking.id)
        if (error) throw error
        logger.info('MyBookings: cancellation requested for booking', booking.id)
        supabase.functions.invoke('send-notifications', { body: { booking_id: booking.id, type: 'cancellation_requested' } })
          .then(({ error: e }) => { if (e) logger.warn('send-notifications failed:', e) })
      }
      await loadBookings()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cancellation failed'
      logger.error('MyBookings handleCancel:', err)
      setCancelError(msg)
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
        onClick={() => { setCancelTarget(booking); setCancelNote('') }}
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

        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {loadError} — <button onClick={loadBookings} className="underline">Retry</button>
          </div>
        )}
        {cancelError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {cancelError}
          </div>
        )}

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
                          {booking.student_note && (
                            <p className="text-xs text-gray-500 mt-1.5 italic">You: {booking.student_note}</p>
                          )}
                          {booking.instructor_note && (
                            <p className="text-xs text-indigo-600 mt-1 italic">Instructor: {booking.instructor_note}</p>
                          )}
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

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCancelTarget(null)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-xl">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Cancel booking</h2>
              <p className="text-sm text-gray-500 mt-0.5">{cancelTarget.slot.class.title} — {formatInNY(cancelTarget.slot.starts_at, 'EEE, MMM d · h:mm a')}</p>
            </div>
            <textarea
              value={cancelNote}
              onChange={e => setCancelNote(e.target.value)}
              placeholder="Reason for cancellation (optional)"
              rows={2}
              maxLength={500}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium"
              >
                Keep booking
              </button>
              <button
                onClick={() => handleCancel(cancelTarget, cancelNote.trim())}
                disabled={cancelling === cancelTarget.id}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {cancelling === cancelTarget.id ? 'Cancelling…' : requiresInstructorApproval(cancelTarget.status, cancelTarget.slot.starts_at) ? 'Request cancel' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
