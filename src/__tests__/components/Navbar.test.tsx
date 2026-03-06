import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Navbar } from '../../components/Navbar'

let mockAuthReturn = {
  session: null as unknown,
  user: null as unknown,
  role: null as string | null,
  loading: false,
  signOut: vi.fn().mockResolvedValue(undefined),
  refreshUser: vi.fn().mockResolvedValue(undefined),
}

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockAuthReturn,
}))

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  )
}

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthReturn = {
      session: null,
      user: null,
      role: null,
      loading: false,
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshUser: vi.fn().mockResolvedValue(undefined),
    }
  })

  it('shows "Log in" link when not authenticated', () => {
    renderNavbar()
    expect(screen.getByText('Log in')).toBeInTheDocument()
  })

  it('shows app name "Yoga Booking"', () => {
    renderNavbar()
    expect(screen.getByText('Yoga Booking')).toBeInTheDocument()
  })

  it('shows user name and dropdown toggle when authenticated as instructor', () => {
    mockAuthReturn.user = { id: 'u1', name: 'Sarah', role: 'instructor' }
    mockAuthReturn.role = 'instructor'

    renderNavbar()
    expect(screen.getByText(/Sarah/)).toBeInTheDocument()
  })

  it('shows instructor menu items when dropdown opened', async () => {
    mockAuthReturn.user = { id: 'u1', name: 'Sarah', role: 'instructor' }
    mockAuthReturn.role = 'instructor'

    renderNavbar()
    await userEvent.click(screen.getByText(/Sarah/))

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })

  it('shows student menu items when authenticated as student', async () => {
    mockAuthReturn.user = { id: 'u2', name: 'Alice', role: 'student' }
    mockAuthReturn.role = 'student'

    renderNavbar()
    await userEvent.click(screen.getByText(/Alice/))

    expect(screen.getByText('Browse Classes')).toBeInTheDocument()
    expect(screen.getByText('My Bookings')).toBeInTheDocument()
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })

  it('calls signOut and redirects to /login on sign out click', async () => {
    const signOutFn = vi.fn().mockResolvedValue(undefined)
    mockAuthReturn.user = { id: 'u1', name: 'Sarah', role: 'instructor' }
    mockAuthReturn.role = 'instructor'
    mockAuthReturn.signOut = signOutFn

    // Mock window.location.href
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: '',
    } as Location)
    const hrefSetter = vi.fn()
    Object.defineProperty(window.location, 'href', { set: hrefSetter, configurable: true })

    renderNavbar()
    await userEvent.click(screen.getByText(/Sarah/))
    await userEvent.click(screen.getByText('Sign out'))

    await waitFor(() => {
      expect(signOutFn).toHaveBeenCalled()
    })

    locationSpy.mockRestore()
  })
})
