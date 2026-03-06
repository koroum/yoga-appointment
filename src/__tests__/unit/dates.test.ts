import { describe, it, expect } from 'vitest'
import { formatInNY, isWithin24h } from '../../utils/dates'

describe('formatInNY', () => {
  it('converts UTC timestamp to America/New_York display string', () => {
    // 2026-03-05T14:00:00Z = 9:00 AM EST (UTC-5, before DST on Mar 8)
    const result = formatInNY(new Date('2026-03-05T14:00:00Z'), 'h:mm a')
    expect(result).toBe('9:00 AM')
  })

  it('displays date in New York timezone', () => {
    // 2026-03-09T14:00:00Z = Mon Mar 9 in EST
    const result = formatInNY(new Date('2026-03-09T14:00:00Z'), 'EEE MMM d')
    expect(result).toBe('Mon Mar 9')
  })

  it('handles DST spring-forward: Mar 8 2026 2am clocks go forward to 3am', () => {
    // 2026-03-08T07:00:00Z = 2:00 AM EST, but after DST = 3:00 AM EDT
    // Just before DST: 2026-03-08T06:59:00Z = 1:59 AM EST
    const beforeDST = formatInNY(new Date('2026-03-08T06:59:00Z'), 'h:mm a')
    expect(beforeDST).toBe('1:59 AM')

    // After DST: 2026-03-08T07:00:00Z = 3:00 AM EDT (UTC-4)
    const afterDST = formatInNY(new Date('2026-03-08T07:00:00Z'), 'h:mm a')
    expect(afterDST).toBe('3:00 AM')
  })

  it('handles DST fall-back: Nov 1 2026 2am clocks go back to 1am', () => {
    // 2026-11-01T05:00:00Z = 1:00 AM EST (after fall-back, UTC-5)
    const result = formatInNY(new Date('2026-11-01T05:00:00Z'), 'h:mm a')
    expect(result).toBe('1:00 AM')
  })
})

describe('isWithin24h', () => {
  it('returns true when class is 23 hours away', () => {
    const future = new Date(Date.now() + 23 * 60 * 60 * 1000)
    expect(isWithin24h(future)).toBe(true)
  })

  it('returns true when class is exactly 1 hour away', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000)
    expect(isWithin24h(future)).toBe(true)
  })

  it('returns false when class is 25 hours away', () => {
    const future = new Date(Date.now() + 25 * 60 * 60 * 1000)
    expect(isWithin24h(future)).toBe(false)
  })

  it('returns false when class is in the past', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000)
    expect(isWithin24h(past)).toBe(false)
  })

  it('returns true when class is exactly 24h away (boundary: within = ≤24h)', () => {
    const exactly24h = new Date(Date.now() + 24 * 60 * 60 * 1000)
    expect(isWithin24h(exactly24h)).toBe(true)
  })
})
