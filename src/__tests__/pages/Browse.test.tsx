import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Browse } from '../../pages/student/Browse'

// Mock supabase
const mockFrom = vi.fn()
const mockRpc = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
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

function renderBrowse() {
  return render(
    <MemoryRouter>
      <Browse />
    </MemoryRouter>
  )
}

describe('Browse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "No linked instructors yet" when no linked instructors', async () => {
    mockFrom.mockImplementation(() => buildChain({ data: [], error: null }))

    renderBrowse()

    await waitFor(() => {
      expect(screen.getByText(/no linked instructors yet/i)).toBeInTheDocument()
    })
  })

  it('does not show error when no linked instructors', async () => {
    mockFrom.mockImplementation(() => buildChain({ data: [], error: null }))

    renderBrowse()

    await waitFor(() => {
      expect(screen.getByText(/no linked instructors yet/i)).toBeInTheDocument()
    })

    expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument()
  })

  it('shows "No upcoming classes" when linked instructors have no available slots', async () => {
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      callCount++
      if (callCount === 1 && table === 'instructor_students') {
        return buildChain({
          data: [{ instructor_id: 'inst-1', instructor: { id: 'inst-1', name: 'Jane Yoga' } }],
          error: null,
        })
      }
      // slots query returns empty
      return buildChain({ data: [], error: null })
    })

    renderBrowse()

    await waitFor(() => {
      expect(screen.getByText(/no upcoming classes/i)).toBeInTheDocument()
    })
  })

  it('shows error and retry button when loading fails', async () => {
    mockFrom.mockImplementation(() =>
      buildChain({ data: null, error: new Error('Timeout') })
    )

    renderBrowse()

    await waitFor(() => {
      expect(screen.getByText(/timeout/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/retry/i)).toBeInTheDocument()
  })

  it('renders available slots with instructor name', async () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'instructor_students') {
        return buildChain({
          data: [{ instructor_id: 'inst-1', instructor: { id: 'inst-1', name: 'Jane Yoga' } }],
          error: null,
        })
      }
      if (table === 'slots') {
        return buildChain({
          data: [{
            id: 'slot-1', class_id: 'c-1', instructor_id: 'inst-1',
            starts_at: futureDate,
            ends_at: new Date(new Date(futureDate).getTime() + 3600000).toISOString(),
            status: 'available', confirmed_count: 0, created_at: '2026-01-01T00:00:00Z',
            class: { id: 'c-1', instructor_id: 'inst-1', title: 'Vinyasa Flow', description: null, max_capacity: 8, duration_minutes: 60, created_at: '2026-01-01T00:00:00Z' },
          }],
          error: null,
        })
      }
      // bookings queries
      return buildChain({ data: [], error: null })
    })

    renderBrowse()

    await waitFor(() => {
      expect(screen.getByText('Vinyasa Flow')).toBeInTheDocument()
    })
    expect(screen.getByText('Jane Yoga')).toBeInTheDocument()
  })
})
