import type { BookingStatus } from '../types'
import { isWithin24h } from './dates'

/**
 * Returns true if this booking can be cancelled immediately without instructor approval.
 * - Pending bookings: always immediate (no approval needed)
 * - Confirmed bookings >24h away: immediate
 * - Confirmed bookings ≤24h away: requires instructor approval
 * - Cancelled / cancellation_requested: cannot cancel again
 */
export function canCancelImmediately(status: BookingStatus, startsAt: string): boolean {
  if (status === 'pending') return true
  if (status !== 'confirmed') return false
  // Confirmed: immediate only if >24h away (not within 24h, not in past)
  const d = new Date(startsAt)
  const msUntil = d.getTime() - Date.now()
  return msUntil > 24 * 60 * 60 * 1000
}

/**
 * Returns true if a cancellation request requires instructor approval.
 * This is the case for confirmed bookings within 24h of the class start.
 */
export function requiresInstructorApproval(status: BookingStatus, startsAt: string): boolean {
  if (status !== 'confirmed') return false
  return isWithin24h(startsAt)
}
