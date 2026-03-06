import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from '../../pages/instructor/Dashboard'

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
    user: { id: 'instructor-1', email: 'test@example.com', name: 'Test Instructor', role: 'instructor', phone: null, username: 'testinstructor', created_at: '2026-01-01T00:00:00Z' },
    role: 'instructor',
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

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "No classes on this day" when there are no slots', async () => {
    mockFrom.mockImplementation(() => buildChain({ data: [], error: null }))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/no classes on this day/i)).toBeInTheDocument()
    })
  })

  it('does not show error when there are zero slots', async () => {
    mockFrom.mockImplementation(() => buildChain({ data: [], error: null }))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/no classes on this day/i)).toBeInTheDocument()
    })

    expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/retry/i)).not.toBeInTheDocument()
  })

  it('does not query bookings when there are zero slots (empty array guard)', async () => {
    mockFrom.mockImplementation(() => buildChain({ data: [], error: null }))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/no classes on this day/i)).toBeInTheDocument()
    })

    // Should only call from('slots'), never from('bookings') since slotIds is empty
    const calls = mockFrom.mock.calls.map(c => c[0])
    expect(calls.every((t: string) => t === 'slots')).toBe(true)
    expect(calls).not.toContain('bookings')
  })

  it('shows error and retry button when loading fails', async () => {
    mockFrom.mockImplementation(() =>
      buildChain({ data: null, error: new Error('Connection lost') })
    )

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/connection lost/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/retry/i)).toBeInTheDocument()
  })

  it('renders slots with booking counts', async () => {
    const now = new Date()
    const slotStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0)
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000)

    const slotData = [{
      id: 'slot-1',
      class_id: 'class-1',
      instructor_id: 'instructor-1',
      starts_at: slotStart.toISOString(),
      ends_at: slotEnd.toISOString(),
      status: 'available',
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
    }]

    const bookingData = [
      { id: 'b1', slot_id: 'slot-1', status: 'confirmed', student_note: null, student: { name: 'Alice', email: 'alice@test.com' } },
      { id: 'b2', slot_id: 'slot-1', status: 'pending', student_note: null, student: { name: 'Bob', email: 'bob@test.com' } },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'slots') return buildChain({ data: slotData, error: null })
      return buildChain({ data: bookingData, error: null })
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/Morning Flow/)).toBeInTheDocument()
    })

    // Should show "1 confirmed · 1 pending · 4 open of 5"
    expect(screen.getByText(/1 confirmed/)).toBeInTheDocument()
    expect(screen.getByText(/1 pending/)).toBeInTheDocument()
  })

  it('shows quick action links', async () => {
    mockFrom.mockImplementation(() => buildChain({ data: [], error: null }))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/no classes on this day/i)).toBeInTheDocument()
    })

    expect(screen.getByText('Requests')).toBeInTheDocument()
    expect(screen.getByText('Availability')).toBeInTheDocument()
    expect(screen.getByText('Students')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
  })
})
