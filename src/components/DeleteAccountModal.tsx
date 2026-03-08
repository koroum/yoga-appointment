import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'

interface ActiveBooking {
  booking_id: string
  class_title: string
  starts_at: string
  student_name?: string
  instructor_name?: string
}

interface Props {
  userId: string
  role: 'instructor' | 'student'
  onClose: () => void
}

export function DeleteAccountModal({ userId, role, onClose }: Props) {
  const [activeBookings, setActiveBookings] = useState<ActiveBooking[] | null>(null)
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load active bookings on mount
  useState(() => {
    loadActiveBookings()
  })

  async function loadActiveBookings() {
    try {
      if (role === 'instructor') {
        const { data, error } = await supabase
          .from('bookings')
          .select('id, status, student:users!bookings_student_id_fkey(name), slot:slots(starts_at, instructor_id, class:classes(title))')
          .eq('slot.instructor_id', userId)
          .in('status', ['pending', 'confirmed', 'cancellation_requested'])

        if (error) throw error
        const bookings: ActiveBooking[] = (data ?? [])
          .filter((b: Record<string, unknown>) => b.slot !== null)
          .filter((b: Record<string, unknown>) => {
            const slot = b.slot as { starts_at: string }
            return new Date(slot.starts_at) > new Date()
          })
          .map((b: Record<string, unknown>) => {
            const slot = b.slot as { starts_at: string; class: { title: string } }
            const student = b.student as { name: string }
            return {
              booking_id: b.id as string,
              class_title: slot.class?.title ?? 'Class',
              starts_at: slot.starts_at,
              student_name: student?.name,
            }
          })
        setActiveBookings(bookings)
      } else {
        const { data, error } = await supabase
          .from('bookings')
          .select('id, status, slot:slots(starts_at, class:classes(title), instructor:users!slots_instructor_id_fkey(name))')
          .eq('student_id', userId)
          .in('status', ['pending', 'confirmed', 'cancellation_requested'])

        if (error) throw error
        const bookings: ActiveBooking[] = (data ?? [])
          .filter((b: Record<string, unknown>) => b.slot !== null)
          .filter((b: Record<string, unknown>) => {
            const slot = b.slot as { starts_at: string }
            return new Date(slot.starts_at) > new Date()
          })
          .map((b: Record<string, unknown>) => {
            const slot = b.slot as { starts_at: string; class: { title: string }; instructor: { name: string } }
            return {
              booking_id: b.id as string,
              class_title: slot.class?.title ?? 'Class',
              starts_at: slot.starts_at,
              instructor_name: slot.instructor?.name,
            }
          })
        setActiveBookings(bookings)
      }
    } catch (err) {
      logger.error('DeleteAccountModal: failed to load bookings', err)
      setActiveBookings([])
    } finally {
      setLoadingBookings(false)
    }
  }

  async function handleDelete() {
    setError(null)
    setDeleting(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('delete_user_account', { p_user_id: userId })
      if (rpcErr) throw rpcErr

      const result = data as { deleted: boolean; cancelled_bookings: ActiveBooking[]; error?: string }
      if (!result.deleted) throw new Error(result.error ?? 'Deletion failed')

      logger.info('DeleteAccountModal: account deleted, cancelled', result.cancelled_bookings?.length ?? 0, 'bookings')

      // Send notifications for cancelled bookings (best-effort, don't block on failures)
      for (const booking of result.cancelled_bookings ?? []) {
        supabase.functions.invoke('send-notifications', {
          body: { booking_id: booking.booking_id, type: 'booking_cancelled' },
        }).catch(err => logger.warn('DeleteAccountModal: notification failed for', booking.booking_id, err))
      }

      // Sign out and redirect
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch (err) {
      logger.error('DeleteAccountModal: deletion failed', err)
      setError(err instanceof Error ? err.message : 'Failed to delete account')
      setDeleting(false)
    }
  }

  const bookingCount = activeBookings?.length ?? 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900">Delete Account</h2>

        {loadingBookings ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
              <p className="text-sm text-red-800 font-medium">This action is permanent and cannot be undone.</p>
              <p className="text-sm text-red-700">
                {role === 'instructor'
                  ? 'Your profile, classes, availability, all slots, and booking history will be permanently deleted.'
                  : 'Your profile, booking history, and instructor links will be permanently deleted.'}
              </p>
            </div>

            {bookingCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                <p className="text-sm text-amber-800 font-semibold">
                  {bookingCount} upcoming booking{bookingCount > 1 ? 's' : ''} will be cancelled:
                </p>
                <ul className="space-y-1">
                  {activeBookings!.slice(0, 5).map(b => (
                    <li key={b.booking_id} className="text-xs text-amber-700">
                      {b.class_title} — {new Date(b.starts_at).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        timeZone: 'America/New_York',
                      })}
                      {b.student_name && ` (${b.student_name})`}
                      {b.instructor_name && ` with ${b.instructor_name}`}
                    </li>
                  ))}
                  {bookingCount > 5 && (
                    <li className="text-xs text-amber-600">...and {bookingCount - 5} more</li>
                  )}
                </ul>
                <p className="text-xs text-amber-700">
                  {role === 'instructor'
                    ? 'All affected students will be notified.'
                    : 'All affected instructors will be notified.'}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Type <span className="font-bold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || confirmText !== 'DELETE'}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-red-600 text-white disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
