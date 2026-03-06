import { useState } from 'react'
import { addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, format, isSameDay, isSameMonth, isToday } from 'date-fns'

export type DayStatus = 'available' | 'pending' | 'confirmed' | 'unavailable' | 'mixed' | 'none'

interface Props {
  markedDays?: Record<string, DayStatus>   // ISO date string (YYYY-MM-DD) → status
  selectedDate?: Date | null
  onSelectDate?: (date: Date) => void
}

const STATUS_DOT: Record<DayStatus, string> = {
  available:   'bg-green-500',
  pending:     'bg-yellow-400',
  confirmed:   'bg-blue-500',
  unavailable: 'bg-gray-400',
  mixed:       'bg-indigo-400',
  none:        '',
}

export function Calendar({ markedDays = {}, selectedDate, onSelectDate }: Props) {
  const [month, setMonth] = useState(new Date())

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const firstDayOfWeek = getDay(startOfMonth(month)) // 0=Sun

  // Pad with empty cells before first day (week starts Monday: shift Sunday to end)
  const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth(subMonths(month, 1))} className="p-1 text-gray-400 hover:text-gray-700">◄</button>
        <span className="font-semibold text-gray-900">{format(month, 'MMMM yyyy')}</span>
        <button onClick={() => setMonth(addMonths(month, 1))} className="p-1 text-gray-400 hover:text-gray-700">►</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: paddingDays }).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const status = markedDays[key] ?? 'none'
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
          const isCurrentMonth = isSameMonth(day, month)

          return (
            <button
              key={key}
              onClick={() => onSelectDate?.(day)}
              className={`
                relative flex flex-col items-center py-1 rounded-lg transition-colors
                ${isSelected ? 'bg-indigo-600' : 'hover:bg-gray-50'}
                ${!isCurrentMonth ? 'opacity-30' : ''}
              `}
            >
              <span className={`text-sm ${isSelected ? 'text-white font-semibold' : isToday(day) ? 'text-indigo-600 font-semibold' : 'text-gray-700'}`}>
                {format(day, 'd')}
              </span>
              {status !== 'none' && (
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${STATUS_DOT[status]} ${isSelected ? 'opacity-70' : ''}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
        {([['available', 'Available'], ['pending', 'Pending'], ['confirmed', 'Confirmed'], ['unavailable', 'Unavailable']] as const).map(([s, label]) => (
          <span key={s} className="flex items-center gap-1 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} /> {label}
          </span>
        ))}
      </div>
    </div>
  )
}
