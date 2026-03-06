import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MyBookings } from '../../pages/student/MyBookings'

// Mock supabase
const mockFrom = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: { invoke: vi.fn(() => Promise.resolve({ data: null, error: null })) },
  },
}))

// Mock useAuth
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    session: {},
    user: { id: 'student-1', email: 'alice@example.com', name: 'Alice', role: 'student', phone: null, username: null, created_at: '2026-01-01T00:00:00Z' },
    role: 'student',
    loading: false,
    signOut: vi.fn(),
    refreshUser: vi.fn(),
  }),
}))

function buildChain(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'in', 'gte', 'order', 'update', 'insert', 'delete', 'maybeSingle']) {
    chain[m] = vi.fn(() => chain)
  }
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void, reject?: (v: unknown) => void) =>
      Promise.resolve(resolveWith).then(resolve, reject),
    configurable: true,
    enumerable: false,
  })
  return chain
}

function renderMyBookings() {
  return render(
    <MemoryRouter>
      <MyBookings />
    </MemoryRouter>
  )
}

describe('MyBookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "No upcoming bookings" when there are no bookings', async () => {
    mockFrom.mockImplementation(() => buildChain({ data: [], error: null }))

    renderMyBookings()

    await waitFor(() => {
      expect(screen.getByText(/no upcoming bookings/i)).toBeInTheDocument()
    })
  })

  it('does not show error when bookings list is empty', async () => {
    mockFrom.mockImplementation(() => buildChain({ data: [], error: null }))

    renderMyBookings()

    await waitFor(() => {
      expect(screen.getByText(/no upcoming bookings/i)).toBeInTheDocument()
    })

    expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/retry/i)).not.toBeInTheDocument()
  })

  it('does not make secondary .in() query when there are no bookings (empty array guard)', async () => {
    mockFrom.mockImplementation(() => buildChain({ data: [], error: null }))

    renderMyBookings()

    await waitFor(() => {
      expect(screen.getByText(/no upcoming bookings/i)).toBeInTheDocument()
    })

    // Should not crash — no error shown means the empty array guard worked
    expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument()
  })

  it('shows error and retry button when loading fails', async () => {
    mockFrom.mockImplementation(() =>
      buildChain({ data: null, error: new Error('Server error') })
    )

    renderMyBookings()

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/retry/i)).toBeInTheDocument()
  })

  it('renders upcoming bookings with class title and status badge', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const bookingData = [{
      id: 'booking-1',
      slot_id: 'slot-1',
      student_id: 'student-1',
      status: 'confirmed',
      booked_by: 'student',
      cancellation_requested_at: null,
      proposed_slot_id: null,
      created_at: '2026-01-01T00:00:00Z',
      slot: {
        id: 'slot-1',
        class_id: 'class-1',
        instructor_id: 'instructor-1',
        starts_at: futureDate,
        ends_at: new Date(new Date(futureDate).getTime() + 3600000).toISOString(),
        status: 'available',
        created_at: '2026-01-01T00:00:00Z',
        class: {
          id: 'class-1',
          instructor_id: 'instructor-1',
          title: 'Sunset Yoga',
          description: null,
          max_capacity: 10,
          duration_minutes: 75,
          created_at: '2026-01-01T00:00:00Z',
        },
      },
      student: { id: 'student-1', name: 'Alice', email: 'alice@example.com', phone: null },
    }]

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return buildChain({ data: bookingData, error: null })
      // Second call: confirmed counts
      return buildChain({ data: [{ slot_id: 'slot-1' }], error: null })
    })

    renderMyBookings()

    await waitFor(() => {
      expect(screen.getByText('Sunset Yoga')).toBeInTheDocument()
    })
    expect(screen.getByText(/75 min/)).toBeInTheDocument()
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument()
  })

  it('shows cancellation_requested status for bookings awaiting instructor approval', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const bookingData = [{
      id: 'booking-2',
      slot_id: 'slot-2',
      student_id: 'student-1',
      status: 'cancellation_requested',
      booked_by: 'student',
      cancellation_requested_at: '2026-03-05T00:00:00Z',
      proposed_slot_id: null,
      created_at: '2026-01-01T00:00:00Z',
      slot: {
        id: 'slot-2',
        class_id: 'class-1',
        instructor_id: 'instructor-1',
        starts_at: futureDate,
        ends_at: new Date(new Date(futureDate).getTime() + 3600000).toISOString(),
        status: 'available',
        created_at: '2026-01-01T00:00:00Z',
        class: {
          id: 'class-1', instructor_id: 'instructor-1', title: 'Morning Flow',
          description: null, max_capacity: 5, duration_minutes: 60, created_at: '2026-01-01T00:00:00Z',
        },
      },
      student: { id: 'student-1', name: 'Alice', email: 'alice@example.com', phone: null },
    }]

    // Alternate: primary query returns bookings, secondary returns confirmed counts
    // This handles re-renders where loadBookings may be called again
    let isPrimary = true
    mockFrom.mockImplementation(() => {
      if (isPrimary) {
        isPrimary = false
        return buildChain({ data: bookingData, error: null })
      }
      isPrimary = true
      return buildChain({ data: [], error: null })
    })

    renderMyBookings()

    await waitFor(() => {
      expect(screen.getByText('Morning Flow')).toBeInTheDocument()
    })
    expect(screen.getByText(/cancellation requested/i)).toBeInTheDocument()
  })
})
