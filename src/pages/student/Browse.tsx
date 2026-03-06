import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Navbar } from '../../components/Navbar'
import { SlotCard } from '../../components/SlotCard'
import { BookingRequestModal } from '../../components/BookingRequestModal'
import { logger } from '../../utils/logger'
import type { SlotWithClass } from '../../types'

interface InstructorEntry {
  id: string
  name: string
}

export function Browse() {
  const { user } = useAuth()
  const [instructors, setInstructors] = useState<InstructorEntry[]>([])
  const [slots, setSlots] = useState<SlotWithClass[]>([])
  const [myBookedSlotIds, setMyBookedSlotIds] = useState<Set<string>>(new Set())
  const [selectedSlot, setSelectedSlot] = useState<{ slot: SlotWithClass; instructorName: string } | null>(null)
  const [bookingDone, setBookingDone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    setLoadError(null)
    try {
      const { data: links, error: linksError } = await supabase
        .from('instructor_students')
        .select('instructor_id, instructor:users!instructor_students_instructor_id_fkey(id, name)')
        .eq('student_id', user!.id)

      if (linksError) throw linksError
      logger.info('Browse: found', links?.length, 'linked instructors')

      type LinkRow = { instructor_id: string; instructor: { id: string; name: string } | { id: string; name: string }[] | null }
      const instructorList = (links as LinkRow[] ?? []).map(l => {
        const instr = Array.isArray(l.instructor) ? l.instructor[0] : l.instructor
        return { id: l.instructor_id, name: instr?.name ?? 'Instructor' }
      })
      setInstructors(instructorList)

      if (instructorList.length === 0) {
        setSlots([])
        setLoading(false)
        return
      }

      const { data: slotsData, error: slotsError } = await supabase
        .from('slots')
        .select('*, class:classes(*)')
        .eq('status', 'available')
        .gte('starts_at', new Date().toISOString())
        .in('instructor_id', instructorList.map(i => i.id))
        .order('starts_at', { ascending: true })

      if (slotsError) throw slotsError
      logger.info('Browse: found', slotsData?.length, 'available slots')

      if (!slotsData || slotsData.length === 0) {
        setSlots([])
        setLoading(false)
        return
      }

      const slotIds = slotsData.map(s => s.id)
      const [{ data: bookings, error: bookingsError }, { data: myBookings, error: myBookingsError }] = await Promise.all([
        supabase.from('bookings').select('slot_id, status').in('slot_id', slotIds).neq('status', 'cancelled'),
        supabase.from('bookings').select('slot_id').eq('student_id', user!.id).in('slot_id', slotIds).neq('status', 'cancelled'),
      ])

      if (bookingsError) logger.warn('Browse: failed to load booking counts', bookingsError)
      if (myBookingsError) logger.warn('Browse: failed to load my bookings', myBookingsError)

      const confirmedCount: Record<string, number> = {}
      for (const b of bookings ?? []) {
        if (b.status === 'confirmed') confirmedCount[b.slot_id] = (confirmedCount[b.slot_id] ?? 0) + 1
      }

      setMyBookedSlotIds(new Set((myBookings ?? []).map(b => b.slot_id)))
      const enriched: SlotWithClass[] = slotsData.map(s => ({ ...s, confirmed_count: confirmedCount[s.id] ?? 0 }))
      setSlots(enriched.filter(s => s.confirmed_count < s.class.max_capacity))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load classes'
      logger.error('Browse loadData:', err)
      setLoadError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleBook(slot: SlotWithClass, note: string) {
    logger.info('Browse: booking slot', slot.id)
    const { data, error } = await supabase.rpc('book_slot', {
      p_slot_id: slot.id,
      p_student_id: user!.id,
      p_booked_by: 'student',
    })

    if (error) {
      logger.error('Browse book_slot error:', error)
      throw error
    }
    const bookingId = data as string
    logger.info('Browse: booking created', bookingId)

    if (note) {
      await supabase.from('bookings').update({ student_note: note }).eq('id', bookingId)
    }

    supabase.functions.invoke('send-notifications', { body: { booking_id: bookingId, type: 'booking_requested' } })
      .then(({ error: e }) => { if (e) logger.warn('send-notifications failed:', e) })

    setBookingDone(slot.id)
    setSelectedSlot(null)
    await loadData()
  }

  function getInstructorName(instructorId: string) {
    return instructors.find(i => i.id === instructorId)?.name ?? 'Instructor'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Upcoming Classes</h1>

        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {loadError} — <button onClick={loadData} className="underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : instructors.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-500 font-medium">No linked instructors yet</p>
            <p className="text-sm text-gray-400 mt-1">Add an instructor from your profile to see their classes.</p>
            <Link to="/student/profile" className="mt-3 inline-block text-sm text-indigo-600 font-medium">
              Go to Profile
            </Link>
          </div>
        ) : slots.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-500 font-medium">No upcoming classes</p>
            <p className="text-sm text-gray-400 mt-1">Check back soon — your instructor will add new slots.</p>
          </div>
        ) : (
          <>
            {bookingDone && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
                Request sent! Your instructor will confirm shortly.
              </div>
            )}
            <div className="space-y-3">
              {slots.map(slot => {
                const alreadyBooked = myBookedSlotIds.has(slot.id)
                const instructorName = getInstructorName(slot.instructor_id)
                return (
                  <div key={slot.id} className="space-y-0.5">
                    <p className="text-xs text-gray-400 px-1">{instructorName}</p>
                    <SlotCard
                      slot={slot}
                      showRequestButton={!alreadyBooked}
                      onRequest={() => setSelectedSlot({ slot, instructorName })}
                    />
                    {alreadyBooked && (
                      <p className="text-xs text-indigo-600 px-1">Request sent</p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {selectedSlot && (
        <BookingRequestModal
          slot={selectedSlot.slot}
          instructorName={selectedSlot.instructorName}
          onConfirm={(note: string) => handleBook(selectedSlot.slot, note)}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </div>
  )
}
