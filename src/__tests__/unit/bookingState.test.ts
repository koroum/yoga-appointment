import { describe, it, expect } from 'vitest'
import { canCancelImmediately, requiresInstructorApproval } from '../../utils/bookingState'

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString()
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString()
}

describe('canCancelImmediately', () => {
  it('returns true for pending bookings regardless of time', () => {
    expect(canCancelImmediately('pending', hoursFromNow(1))).toBe(true)
    expect(canCancelImmediately('pending', hoursFromNow(100))).toBe(true)
  })

  it('returns true for confirmed bookings more than 24h away', () => {
    expect(canCancelImmediately('confirmed', hoursFromNow(25))).toBe(true)
    expect(canCancelImmediately('confirmed', hoursFromNow(48))).toBe(true)
  })

  it('returns false for confirmed bookings exactly 24h away (spec: must be >24h)', () => {
    expect(canCancelImmediately('confirmed', hoursFromNow(24))).toBe(false)
  })

  it('returns false for confirmed bookings less than 24h away', () => {
    expect(canCancelImmediately('confirmed', hoursFromNow(23))).toBe(false)
    expect(canCancelImmediately('confirmed', hoursFromNow(1))).toBe(false)
  })

  it('returns false for confirmed bookings in the past', () => {
    expect(canCancelImmediately('confirmed', hoursAgo(1))).toBe(false)
  })

  it('returns false for already cancelled bookings', () => {
    expect(canCancelImmediately('cancelled', hoursFromNow(25))).toBe(false)
  })

  it('returns false for cancellation_requested bookings', () => {
    expect(canCancelImmediately('cancellation_requested', hoursFromNow(25))).toBe(false)
  })
})

describe('requiresInstructorApproval', () => {
  it('returns true for confirmed bookings less than 24h away', () => {
    expect(requiresInstructorApproval('confirmed', hoursFromNow(1))).toBe(true)
    expect(requiresInstructorApproval('confirmed', hoursFromNow(23))).toBe(true)
  })

  it('returns false for confirmed bookings more than 24h away', () => {
    expect(requiresInstructorApproval('confirmed', hoursFromNow(25))).toBe(false)
  })

  it('returns false for pending bookings (no approval needed — immediate cancel)', () => {
    expect(requiresInstructorApproval('pending', hoursFromNow(1))).toBe(false)
  })

  it('returns false for already cancelled or cancellation_requested bookings', () => {
    expect(requiresInstructorApproval('cancelled', hoursFromNow(1))).toBe(false)
    expect(requiresInstructorApproval('cancellation_requested', hoursFromNow(1))).toBe(false)
  })
})
