import type { BookingStatus, SlotStatus } from '../types'

type Status = BookingStatus | SlotStatus | 'cancellation_requested'

const CONFIG: Record<Status, { symbol: string; label: string; className: string }> = {
  available:               { symbol: '●', label: 'Available',            className: 'text-green-700 bg-green-50 border-green-200' },
  pending:                 { symbol: '◌', label: 'Pending',              className: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  confirmed:               { symbol: '▪', label: 'Confirmed',            className: 'text-blue-700 bg-blue-50 border-blue-200' },
  unavailable:             { symbol: '✕', label: 'Unavailable',          className: 'text-gray-600 bg-gray-50 border-gray-200' },
  cancellation_requested:  { symbol: '⚠', label: 'Cancel Requested',    className: 'text-orange-700 bg-orange-50 border-orange-200' },
  cancelled:               { symbol: '✓', label: 'Cancelled',            className: 'text-red-600 bg-red-50 border-red-200' },
}

interface Props {
  status: Status
  className?: string
}

export function BookingStatusBadge({ status, className = '' }: Props) {
  const cfg = CONFIG[status]
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${cfg.className} ${className}`}
    >
      {cfg.symbol} {cfg.label}
    </span>
  )
}
