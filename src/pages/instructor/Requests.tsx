import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Navbar } from '../../components/Navbar'
import { BookingStatusBadge } from '../../components/BookingStatusBadge'
import { formatInNY } from '../../utils/dates'
import { logger } from '../../utils/logger'
import type { BookingWithDetails } from '../../types'

export function InstructorRequests() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [noteTarget, setNoteTarget] = useState<{ booking: BookingWithDetails; action: 'confirm' | 'decline' | 'approve_cancel' } | null>(null)
  const [instructorNote, setInstructorNote] = useState('')

  useEffect(() => {
    if (user) loadBookings()
  }, [user])

  async function loadBookings() {
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, slot:slots!bookings_slot_id_fkey!inner(*, class:classes(*)), student:users!bookings_student_id_fkey(id, name, email, phone)')
        .eq('slot.instructor_id', user!.id)
        .in('status', ['pending', 'cancellation_requested'])
        .order('created_at', { ascending: true })

      if (error) throw error
      logger.info('Requests: loaded', data?.length, 'bookings')

      const slotIds = [...new Set((data ?? []).map(b => b.slot?.id).filter(Boolean))]

      const confirmedCount: Record<string, number> = {}
      if (slotIds.length > 0) {
        const { data: confirmed, error: confirmedError } = await supabase
          .from('bookings')
          .select('slot_id')
          .in('slot_id', slotIds)
          .eq('status', 'confirmed')

        if (confirmedError) logger.warn('Requests: failed to load confirmed counts', confirmedError)

        for (const b of confirmed ?? []) {
          confirmedCount[b.slot_id] = (confirmedCount[b.slot_id] ?? 0) + 1
        }
      }

      setBookings((data ?? []).filter(b => b.slot).map(b => ({
        ...b,
        slot: { ...b.slot, confirmed_count: confirmedCount[b.slot.id] ?? 0 },
      })) as BookingWithDetails[])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load booking requests'
      logger.error('Requests loadBookings:', err)
      setLoadError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(booking: BookingWithDetails, action: 'confirm' | 'decline' | 'approve_cancel', note?: string) {
    setActing(booking.id)
    setActionError(null)
    setNoteTarget(null)
    setInstructorNote('')
    try {
      const noteUpdate = note ? { instructor_note: note } : {}
      if (action === 'confirm') {
        const { error } = await supabase.from('bookings').update({ status: 'confirmed', ...noteUpdate }).eq('id', booking.id)
        if (error) throw error
        logger.info('Requests: confirmed booking', booking.id)
        // Auto-link student to instructor
        const { error: linkErr } = await supabase.from('instructor_students').upsert({
          instructor_id: user!.id,
          student_id: booking.student_id,
          linked_via: 'booking',
        }, { onConflict: 'instructor_id,student_id' })
        if (linkErr) logger.warn('Requests: failed to link student', linkErr)
        else logger.info('Requests: linked student', booking.student_id)
        supabase.functions.invoke('send-notifications', { body: { booking_id: booking.id, type: 'booking_confirmed' } })
          .then(({ error: e }) => { if (e) logger.warn('send-notifications failed:', e) })
      } else if (action === 'decline') {
        const { error } = await supabase.from('bookings').update({ status: 'cancelled', ...noteUpdate }).eq('id', booking.id)
        if (error) throw error
        logger.info('Requests: declined booking', booking.id)
        supabase.functions.invoke('send-notifications', { body: { booking_id: booking.id, type: 'booking_rejected' } })
          .then(({ error: e }) => { if (e) logger.warn('send-notifications failed:', e) })
      } else if (action === 'approve_cancel') {
        const { error } = await supabase.from('bookings').update({ status: 'cancelled', ...noteUpdate }).eq('id', booking.id)
        if (error) throw error
        logger.info('Requests: approved cancellation for booking', booking.id)
        supabase.functions.invoke('send-notifications', { body: { booking_id: booking.id, type: 'booking_cancelled' } })
          .then(({ error: e }) => { if (e) logger.warn('send-notifications failed:', e) })
      }
      await loadBookings()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed'
      logger.error('Requests handleAction:', action, booking.id, err)
      setActionError(msg)
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

        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {loadError} — <button onClick={loadBookings} className="underline">Retry</button>
          </div>
        )}

        {actionError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {actionError}
          </div>
        )}

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
                        {booking.student_note && (
                          <p className="text-xs text-gray-500 mt-1.5 italic">"{booking.student_note}"</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setNoteTarget({ booking, action: 'confirm' }); setInstructorNote('') }}
                          disabled={acting === booking.id}
                          className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                          {acting === booking.id ? 'Saving…' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => { setNoteTarget({ booking, action: 'decline' }); setInstructorNote('') }}
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
                        {booking.student_note && (
                          <p className="text-xs text-gray-500 mt-1.5 italic">"{booking.student_note}"</p>
                        )}
                      </div>
                      <button
                        onClick={() => { setNoteTarget({ booking, action: 'approve_cancel' }); setInstructorNote('') }}
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

      {noteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNoteTarget(null)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-xl">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {noteTarget.action === 'confirm' ? 'Confirm booking' : noteTarget.action === 'decline' ? 'Decline booking' : 'Approve cancellation'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {noteTarget.booking.slot.class.title} — {noteTarget.booking.student.name}
              </p>
            </div>
            <textarea
              value={instructorNote}
              onChange={e => setInstructorNote(e.target.value)}
              placeholder="Add a message for the student (optional)"
              rows={2}
              maxLength={500}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setNoteTarget(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={() => handleAction(noteTarget.booking, noteTarget.action, instructorNote.trim())}
                disabled={acting === noteTarget.booking.id}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 ${
                  noteTarget.action === 'confirm'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-red-600 text-white'
                }`}
              >
                {acting === noteTarget.booking.id
                  ? 'Processing…'
                  : noteTarget.action === 'confirm' ? 'Confirm' : noteTarget.action === 'decline' ? 'Decline' : 'Approve cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
