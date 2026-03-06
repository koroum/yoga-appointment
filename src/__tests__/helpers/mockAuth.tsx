import { vi } from 'vitest'
import type { User, UserRole } from '../../types'

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    phone: null,
    name: 'Test User',
    role: 'instructor' as UserRole,
    username: 'testuser',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export function createMockAuthValue(overrides: Partial<{
  user: User | null
  role: UserRole | null
  session: unknown
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}> = {}) {
  return {
    session: {},
    user: createMockUser(),
    role: 'instructor' as UserRole,
    loading: false,
    signOut: vi.fn().mockResolvedValue(undefined),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

// For vi.mock of useAuth
export function mockUseAuth(value: ReturnType<typeof createMockAuthValue>) {
  return { useAuth: () => value, AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }
}
