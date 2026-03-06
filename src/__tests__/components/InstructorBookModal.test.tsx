import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { InstructorBookModal } from '../../components/InstructorBookModal'
import type { SlotWithClass } from '../../types'

const makeSlot = (id: string, title: string): SlotWithClass => ({
  id,
  class_id: 'class-1',
  instructor_id: 'instructor-1',
  starts_at: '2026-03-15T14:00:00Z',
  ends_at: '2026-03-15T15:00:00Z',
  status: 'available',
  confirmed_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  class: {
    id: 'class-1',
    instructor_id: 'instructor-1',
    title,
    description: null,
    max_capacity: 5,
    duration_minutes: 60,
    created_at: '2026-01-01T00:00:00Z',
  },
})

describe('InstructorBookModal', () => {
  it('renders student name and available slots', () => {
    render(
      <InstructorBookModal
        studentName="Alex Johnson"
        slots={[makeSlot('s1', 'Morning Flow'), makeSlot('s2', 'Evening Stretch')]}
        onBook={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText(/Alex Johnson/)).toBeInTheDocument()
    expect(screen.getByText('Morning Flow')).toBeInTheDocument()
    expect(screen.getByText('Evening Stretch')).toBeInTheDocument()
  })

  it('shows empty state when no slots available', () => {
    render(
      <InstructorBookModal
        studentName="Alex Johnson"
        slots={[]}
        onBook={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText(/no upcoming slots/i)).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(
      <InstructorBookModal
        studentName="Alex Johnson"
        slots={[makeSlot('s1', 'Morning Flow')]}
        onBook={vi.fn().mockResolvedValue(undefined)}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onBook with selected slot when Book is clicked', async () => {
    const onBook = vi.fn().mockResolvedValue(undefined)
    render(
      <InstructorBookModal
        studentName="Alex Johnson"
        slots={[makeSlot('s1', 'Morning Flow')]}
        onBook={onBook}
        onClose={vi.fn()}
      />
    )
    // First slot auto-selected — click Book
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /book for/i }))
    })
    expect(onBook).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }))
  })

  it('disables Book button while loading', async () => {
    const onBook = vi.fn(() => new Promise<void>(() => {}))
    render(
      <InstructorBookModal
        studentName="Alex Johnson"
        slots={[makeSlot('s1', 'Morning Flow')]}
        onBook={onBook}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /book for/i }))
    expect(screen.getByRole('button', { name: /booking/i })).toBeDisabled()
  })
})
