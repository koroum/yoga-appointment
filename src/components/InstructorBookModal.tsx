import { useState } from 'react'
import type { SlotWithClass } from '../types'
import { formatInNY } from '../utils/dates'

interface Props {
  studentName: string
  slots: SlotWithClass[]
  onBook: (slot: SlotWithClass) => Promise<void>
  onClose: () => void
}

export function InstructorBookModal({ studentName, slots, onBook, onClose }: Props) {
  const [selectedSlotId, setSelectedSlotId] = useState<string>(slots[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedSlot = slots.find(s => s.id === selectedSlotId) ?? null

  async function handleBook() {
    if (!selectedSlot) return
    setError(null)
    setLoading(true)
    try {
      await onBook(selectedSlot)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Booking failed')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={!loading ? onClose : undefined} />

      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-xl">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Direct book</p>
          <h2 className="text-lg font-bold text-gray-900">Book a class for {studentName}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Confirmed immediately — no approval needed</p>
        </div>

        {slots.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-400">
            No upcoming slots available
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {slots.map(slot => {
              const spotsLeft = slot.class.max_capacity - slot.confirmed_count
              return (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  className={`w-full text-left border rounded-xl px-4 py-3 transition-colors ${
                    selectedSlotId === slot.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-sm text-gray-900">{slot.class.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatInNY(slot.starts_at, 'EEE, MMM d · h:mm a')} · {slot.class.duration_minutes} min
                  </p>
                  {slot.class.max_capacity > 1 && (
                    <p className="text-xs text-gray-400">{spotsLeft} of {slot.class.max_capacity} spots left</p>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
          >
            Cancel
          </button>
          {slots.length > 0 && (
            <button
              onClick={handleBook}
              disabled={loading || !selectedSlot}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Booking…' : `Book for ${studentName.split(' ')[0]}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
