import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Navbar } from '../../components/Navbar'
import { SlotCard } from '../../components/SlotCard'
import { BookingRequestModal } from '../../components/BookingRequestModal'
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
  const [bookingDone, setBookingDone] = useState<string | null>(null) // slot id just booked
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    setLoading(true)

    // 1. Get linked instructors
    const { data: links } = await supabase
      .from('instructor_students')
      .select('instructor_id, instructor:users!instructor_students_instructor_id_fkey(id, name)')
      .eq('student_id', user!.id)

    if (!links || links.length === 0) {
      setLoading(false)
      return
    }

    type LinkRow = { instructor_id: string; instructor: { id: string; name: string } | { id: string; name: string }[] | null }
    const instructorList = (links as LinkRow[]).map(l => {
      const instr = Array.isArray(l.instructor) ? l.instructor[0] : l.instructor
      return { id: l.instructor_id, name: instr?.name ?? 'Instructor' }
    })
    setInstructors(instructorList)
    const instructorIds = instructorList.map(i => i.id)

    // 2. Get upcoming available slots for those instructors
    const { data: slotsData } = await supabase
      .from('slots')
      .select('*, class:classes(*)')
      .in('instructor_id', instructorIds)
      .eq('status', 'available')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })

    if (!slotsData || slotsData.length === 0) {
      setLoading(false)
      return
    }

    // 3. Get confirmed_count per slot (non-cancelled bookings)
    const slotIds = slotsData.map(s => s.id)
    const { data: bookings } = await supabase
      .from('bookings')
      .select('slot_id, status')
      .in('slot_id', slotIds)
      .neq('status', 'cancelled')

    const confirmedCount: Record<string, number> = {}
    for (const b of bookings ?? []) {
      if (b.status === 'confirmed') {
        confirmedCount[b.slot_id] = (confirmedCount[b.slot_id] ?? 0) + 1
      }
    }

    // 4. Check which slots this student already has a booking for
    const { data: myBookings } = await supabase
      .from('bookings')
      .select('slot_id')
      .eq('student_id', user!.id)
      .in('slot_id', slotIds)
      .neq('status', 'cancelled')

    setMyBookedSlotIds(new Set((myBookings ?? []).map(b => b.slot_id)))

    const enriched: SlotWithClass[] = slotsData.map(s => ({
      ...s,
      confirmed_count: confirmedCount[s.id] ?? 0,
    }))

    // Filter out full slots
    setSlots(enriched.filter(s => s.confirmed_count < s.class.max_capacity))
    setLoading(false)
  }

  async function handleBook(slot: SlotWithClass) {
    const { data, error } = await supabase.rpc('book_slot', {
      p_slot_id: slot.id,
      p_student_id: user!.id,
      p_booked_by: 'student',
    })

    if (error) throw error
    // data is the booking UUID returned by book_slot()
    const bookingId = data as string

    // Fire-and-forget notification
    supabase.functions.invoke('send-notifications', {
      body: { booking_id: bookingId, type: 'booking_requested' },
    })

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

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : instructors.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-500 font-medium">No instructors yet</p>
            <p className="text-sm text-gray-400 mt-1">Visit an instructor's profile to get started.</p>
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
                ✓ Request sent! Your instructor will confirm shortly.
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
                      <p className="text-xs text-indigo-600 px-1">✓ Request sent</p>
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
          onConfirm={() => handleBook(selectedSlot.slot)}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </div>
  )
}
