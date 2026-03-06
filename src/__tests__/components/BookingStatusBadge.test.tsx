import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BookingStatusBadge } from '../../components/BookingStatusBadge'

describe('BookingStatusBadge', () => {
  it('renders AVAILABLE with green styling', () => {
    render(<BookingStatusBadge status="available" />)
    const badge = screen.getByText(/available/i)
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/green/)
  })

  it('renders PENDING with yellow styling', () => {
    render(<BookingStatusBadge status="pending" />)
    const badge = screen.getByText(/pending/i)
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/yellow/)
  })

  it('renders CONFIRMED with blue styling', () => {
    render(<BookingStatusBadge status="confirmed" />)
    const badge = screen.getByText(/confirmed/i)
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/blue/)
  })

  it('renders CANCELLED with red/muted styling', () => {
    render(<BookingStatusBadge status="cancelled" />)
    const badge = screen.getByText(/cancelled/i)
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/red/)
  })

  it('renders UNAVAILABLE with gray styling', () => {
    render(<BookingStatusBadge status="unavailable" />)
    const badge = screen.getByText(/unavailable/i)
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/gray/)
  })

  it('renders CANCELLATION REQUESTED with orange styling', () => {
    render(<BookingStatusBadge status="cancellation_requested" />)
    const badge = screen.getByText(/cancel/i)
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/orange/)
  })

  it('renders the correct symbol for each status', () => {
    const { rerender } = render(<BookingStatusBadge status="available" />)
    expect(screen.getByText(/●/)).toBeInTheDocument()

    rerender(<BookingStatusBadge status="pending" />)
    expect(screen.getByText(/◌/)).toBeInTheDocument()

    rerender(<BookingStatusBadge status="confirmed" />)
    expect(screen.getByText(/▪/)).toBeInTheDocument()

    rerender(<BookingStatusBadge status="cancelled" />)
    expect(screen.getByText(/✓/)).toBeInTheDocument()

    rerender(<BookingStatusBadge status="unavailable" />)
    expect(screen.getByText(/✕/)).toBeInTheDocument()

    rerender(<BookingStatusBadge status="cancellation_requested" />)
    expect(screen.getByText(/⚠/)).toBeInTheDocument()
  })
})
