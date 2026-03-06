import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '../../components/EmptyState'

describe('EmptyState', () => {
  it('shows the next upcoming slot date when one is provided', () => {
    render(<EmptyState nextSlotDate={new Date('2026-03-16T14:00:00Z')} />)
    expect(screen.getByText(/next class/i)).toBeInTheDocument()
    expect(screen.getByText(/mar 16/i)).toBeInTheDocument()
  })

  it('shows fallback message when no next slot exists', () => {
    render(<EmptyState nextSlotDate={null} />)
    expect(screen.getByText(/no classes scheduled yet/i)).toBeInTheDocument()
    expect(screen.getByText(/check back soon/i)).toBeInTheDocument()
  })

  it('shows fallback message when nextSlotDate is undefined', () => {
    render(<EmptyState />)
    expect(screen.getByText(/no classes scheduled yet/i)).toBeInTheDocument()
  })
})
