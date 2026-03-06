import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { InstructorRequests } from '../../pages/instructor/Requests'
import { mockBookingWithDetails, makeBookingWithDetails } from '../helpers/testFixtures'

// Mock supabase
const mockFrom = vi.fn()
const mockFunctionsInvoke = vi.fn((_name?: string, _opts?: unknown) => Promise.resolve({ data: null, error: null }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    functions: { invoke: (name: string, opts?: unknown) => mockFunctionsInvoke(name, opts) },
  },
}))

// Mock useAuth
const mockUser = { id: 'instructor-1', email: 'test@example.com', name: 'Test Instructor', role: 'instructor' as const, phone: null, username: 'testinstructor', created_at: '2026-01-01T00:00:00Z' }
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    session: {},
    user: mockUser,
    role: 'instructor',
    loading: false,
    signOut: vi.fn(),
    refreshUser: vi.fn(),
  }),
}))

function buildChain(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'in', 'gte', 'order', 'update', 'insert', 'delete', 'maybeSingle', 'single']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  // Make thenable
  ;(chain as { then: unknown }).then = undefined
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void, reject?: (v: unknown) => void) =>
      Promise.resolve(resolveWith).then(resolve, reject),
    configurable: true,
    enumerable: false,
  })
  return chain
}

function setupFromMock(responses: Record<string, { data: unknown; error: unknown }>) {
  let callIndex = 0
  const callOrder: string[] = []

  mockFrom.mockImplementation((table: string) => {
    callOrder.push(table)
    // Use callIndex for sequential responses from same table
    const key = `${table}:${callIndex++}`
    const response = responses[key] ?? responses[table] ?? { data: [], error: null }
    return buildChain(response)
  })

  return callOrder
}

function renderRequests() {
  return render(
    <MemoryRouter>
      <InstructorRequests />
    </MemoryRouter>
  )
}

describe('InstructorRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "No pending requests" when there are no bookings', async () => {
    setupFromMock({
      bookings: { data: [], error: null },
    })

    renderRequests()

    await waitFor(() => {
      expect(screen.getByText(/no pending requests/i)).toBeInTheDocument()
    })
  })

  it('does not show error when there are zero bookings', async () => {
    setupFromMock({
      bookings: { data: [], error: null },
    })

    renderRequests()

    await waitFor(() => {
      expect(screen.getByText(/no pending requests/i)).toBeInTheDocument()
    })

    // Should NOT show error state
    expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/retry/i)).not.toBeInTheDocument()
  })

  it('shows loading spinner initially', () => {
    // Never resolve the query
    mockFrom.mockImplementation(() => {
      const chain: Record<string, unknown> = {}
      const methods = ['select', 'eq', 'neq', 'in', 'gte', 'order']
      for (const m of methods) {
        chain[m] = vi.fn(() => chain)
      }
      Object.defineProperty(chain, 'then', {
        value: () => new Promise(() => {}), // never resolves
        configurable: true,
      })
      return chain
    })

    const { container } = renderRequests()
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders pending bookings with student name and class title', async () => {
    const booking = makeBookingWithDetails({
      status: 'pending',
      student: { id: 'student-1', name: 'Alice Student', email: 'alice@test.com', phone: null },
      slot: {
        ...mockBookingWithDetails.slot,
        class: { ...mockBookingWithDetails.slot.class, title: 'Evening Yoga' },
      },
    })

    setupFromMock({
      bookings: { data: [booking], error: null },
    })

    renderRequests()

    await waitFor(() => {
      expect(screen.getByText('Evening Yoga')).toBeInTheDocument()
      expect(screen.getByText('Alice Student')).toBeInTheDocument()
    })

    // Should show Confirm and Decline buttons
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument()
  })

  it('renders cancellation requests section separately', async () => {
    const cancelBooking = makeBookingWithDetails({
      id: 'booking-cancel-1',
      status: 'cancellation_requested',
    })

    setupFromMock({
      bookings: { data: [cancelBooking], error: null },
    })

    renderRequests()

    await waitFor(() => {
      expect(screen.getByText(/cancellation requests/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /approve cancellation/i })).toBeInTheDocument()
    })
  })

  it('shows error message when loading fails', async () => {
    setupFromMock({
      bookings: { data: null, error: new Error('Network error') },
    })

    renderRequests()

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/retry/i)).toBeInTheDocument()
  })

  it('does not make secondary .in() query when no slotIds exist', async () => {
    // Bookings exist but have null slots (filtered out by .eq on embedded resource)
    setupFromMock({
      bookings: { data: [], error: null },
    })

    renderRequests()

    await waitFor(() => {
      expect(screen.getByText(/no pending requests/i)).toBeInTheDocument()
    })

    // Should only have called from('bookings') once (the primary query), not a second time
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })
})
