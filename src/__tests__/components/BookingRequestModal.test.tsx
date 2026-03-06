import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BookingRequestModal } from '../../components/BookingRequestModal'
import type { SlotWithClass } from '../../types'

const mockSlot: SlotWithClass = {
  id: 'slot-1',
  class_id: 'class-1',
  instructor_id: 'instructor-1',
  starts_at: '2026-03-10T14:00:00Z',
  ends_at: '2026-03-10T15:00:00Z',
  status: 'available',
  confirmed_count: 2,
  created_at: '2026-01-01T00:00:00Z',
  class: {
    id: 'class-1',
    instructor_id: 'instructor-1',
    title: 'Morning Flow',
    description: null,
    max_capacity: 5,
    duration_minutes: 60,
    created_at: '2026-01-01T00:00:00Z',
  },
}

describe('BookingRequestModal', () => {
  it('renders slot details and instructor name', () => {
    render(
      <BookingRequestModal
        slot={mockSlot}
        instructorName="Jane Smith"
        onConfirm={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Morning Flow')).toBeInTheDocument()
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument()
    expect(screen.getByText(/60 min/)).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(
      <BookingRequestModal
        slot={mockSlot}
        instructorName="Jane Smith"
        onConfirm={vi.fn().mockResolvedValue(undefined)}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onConfirm when Confirm Request is clicked', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <BookingRequestModal
        slot={mockSlot}
        instructorName="Jane Smith"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /confirm request/i }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('disables buttons while request is in-flight', async () => {
    let resolve!: () => void
    const onConfirm = vi.fn(() => new Promise<void>(r => { resolve = r }))
    render(
      <BookingRequestModal
        slot={mockSlot}
        instructorName="Jane Smith"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /confirm request/i }))
    expect(screen.getByRole('button', { name: /requesting/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
    await act(async () => { resolve() })
  })

  it('shows error message if onConfirm rejects', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Slot is full'))
    render(
      <BookingRequestModal
        slot={mockSlot}
        instructorName="Jane Smith"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm request/i }))
    })
    expect(screen.getByText(/slot is full/i)).toBeInTheDocument()
  })
})
