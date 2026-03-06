import { useState } from 'react'
import type { SlotWithClass } from '../types'
import { formatInNY } from '../utils/dates'

interface Props {
  slot: SlotWithClass
  instructorName: string
  onConfirm: () => Promise<void>
  onClose: () => void
}

export function BookingRequestModal({ slot, instructorName, onConfirm, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const spotsLeft = slot.class.max_capacity - slot.confirmed_count
  const isGroup = slot.class.max_capacity > 1

  async function handleConfirm() {
    setError(null)
    setLoading(true)
    try {
      await onConfirm()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send request')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={!loading ? onClose : undefined} />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-5 shadow-xl">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Request a class</p>
          <h2 className="text-lg font-bold text-gray-900">{slot.class.title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">with {instructorName}</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Date & time</span>
            <span className="font-medium text-gray-900">{formatInNY(slot.starts_at, 'EEE, MMM d · h:mm a')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Duration</span>
            <span className="font-medium text-gray-900">{slot.class.duration_minutes} min</span>
          </div>
          {isGroup && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Spots left</span>
              <span className="font-medium text-gray-900">{spotsLeft} of {slot.class.max_capacity}</span>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400">
          Your request will be sent to the instructor for approval.
        </p>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Requesting…' : 'Confirm Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
