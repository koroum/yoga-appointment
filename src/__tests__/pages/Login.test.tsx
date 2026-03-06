import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Login } from '../../pages/Login'

// Mock supabase
const mockSignIn = vi.fn()
const mockGetUser = vi.fn()
const mockSelect = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => mockSelect(),
        }),
      }),
    }),
  },
}))

// Mock useAuth — start logged out
const mockRefreshUser = vi.fn()
const mockAuthValue = {
  session: null as unknown,
  user: null as unknown,
  role: null as string | null,
  loading: false,
  signOut: vi.fn(),
  refreshUser: mockRefreshUser,
}
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockAuthValue,
}))

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Login />
    </MemoryRouter>
  )
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthValue.user = null
    mockAuthValue.role = null
    mockRefreshUser.mockResolvedValue(undefined)
  })

  it('renders login form with email, password, and submit button', () => {
    renderLogin()

    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
  })

  it('shows link to signup page', () => {
    renderLogin()

    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
  })

  it('disables button when email or password is empty', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled()
  })

  it('shows error message when login fails', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('Invalid login credentials'),
    })

    renderLogin()

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'wrong@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'badpassword')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid login credentials/i)).toBeInTheDocument()
    })
  })

  it('fetches user role and redirects after successful auth', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: { id: 'user-123' }, session: {} },
      error: null,
    })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    mockSelect.mockResolvedValue({ data: { role: 'student' }, error: null })

    renderLogin()

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'jane@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled()
    })
  })

  it('shows button as "Logging in..." while authenticating', async () => {
    // Never resolve signIn
    mockSignIn.mockReturnValue(new Promise(() => {}))

    renderLogin()

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'test@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'password')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled()
    })
  })
})
