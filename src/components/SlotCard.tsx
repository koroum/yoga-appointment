import type { SlotWithClass } from '../types'
import { formatInNY } from '../utils/dates'

interface Props {
  slot: SlotWithClass
  onRequest?: () => void
  showRequestButton?: boolean
}

export function SlotCard({ slot, onRequest, showRequestButton = true }: Props) {
  const isFull = slot.confirmed_count >= slot.class.max_capacity
  const spotsLeft = slot.class.max_capacity - slot.confirmed_count
  const isGroup = slot.class.max_capacity > 1

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{slot.class.title}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatInNY(slot.starts_at, 'EEE MMM d · h:mm a')}
          </p>
          <p className="text-sm text-gray-500">
            {slot.class.duration_minutes} min
            {isGroup && (
              <span className={`ml-2 ${isFull ? 'text-red-600' : 'text-gray-500'}`}>
                · {isFull ? 'Class full' : `● ${spotsLeft} of ${slot.class.max_capacity} open`}
              </span>
            )}
          </p>
        </div>

        {showRequestButton && !isFull && slot.status === 'available' && onRequest && (
          <button
            onClick={onRequest}
            className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Request →
          </button>
        )}

        {isFull && (
          <span className="shrink-0 text-xs text-red-600 font-medium">Full</span>
        )}
      </div>
    </div>
  )
}
