import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const NY_TZ = 'America/New_York'

/**
 * Format a UTC date for display in America/New_York timezone.
 * @param date - UTC Date object or ISO string
 * @param fmt  - date-fns format string (e.g. 'h:mm a', 'EEE MMM d')
 */
export function formatInNY(date: Date | string, fmt: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const zoned = toZonedTime(d, NY_TZ)
  return format(zoned, fmt)
}

/**
 * Returns true if the given date is within 24 hours from now (inclusive of exactly 24h).
 * Returns false if the date is in the past.
 */
export function isWithin24h(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const ms = d.getTime() - now
  return ms >= 0 && ms <= 24 * 60 * 60 * 1000
}
