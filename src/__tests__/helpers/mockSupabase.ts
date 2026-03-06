import { vi } from 'vitest'

// Chainable query builder mock
export function createQueryMock(resolveWith: { data: unknown; error: unknown } = { data: [], error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt',
    'order', 'limit', 'single', 'maybeSingle',
    'filter', 'match', 'not', 'or', 'is',
  ]

  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }

  // Terminal: returns promise-like
  chain.then = vi.fn((resolve: (v: unknown) => void) => {
    resolve(resolveWith)
    return chain
  })

  // Make it thenable (so await works)
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      return Promise.resolve(resolveWith).then(resolve, reject)
    },
    configurable: true,
  })

  return chain
}

type QuerySetup = { data?: unknown; error?: unknown }

interface MockSupabaseConfig {
  queries?: Record<string, QuerySetup> // table name → response
  rpcResults?: Record<string, { data?: unknown; error?: unknown }>
  functionsResults?: Record<string, { data?: unknown; error?: unknown }>
  authUser?: { id: string; email: string } | null
}

export function createMockSupabase(config: MockSupabaseConfig = {}) {
  const { queries = {}, rpcResults = {}, authUser = null } = config

  const from = vi.fn((table: string) => {
    const setup = queries[table] ?? {}
    return createQueryMock({ data: setup.data ?? [], error: setup.error ?? null })
  })

  const rpc = vi.fn((fnName: string, _params?: unknown) => {
    const result = rpcResults[fnName] ?? { data: null, error: null }
    return Promise.resolve(result)
  })

  const functions = {
    invoke: vi.fn((_name: string, _opts?: unknown) => {
      return Promise.resolve({ data: null, error: null })
    }),
  }

  const auth = {
    signInWithPassword: vi.fn(() => Promise.resolve({
      data: authUser ? { user: authUser, session: {} } : { user: null, session: null },
      error: authUser ? null : { message: 'Invalid credentials' },
    })),
    signUp: vi.fn(() => Promise.resolve({ data: { user: authUser }, error: null })),
    verifyOtp: vi.fn(() => Promise.resolve({ data: { user: authUser, session: {} }, error: null })),
    getUser: vi.fn(() => Promise.resolve({ data: { user: authUser } })),
    getSession: vi.fn(() => Promise.resolve({ data: { session: authUser ? { user: authUser } : null } })),
    onAuthStateChange: vi.fn((_cb: unknown) => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signOut: vi.fn(() => Promise.resolve()),
    admin: { createUser: vi.fn(), deleteUser: vi.fn() },
  }

  return { from, rpc, functions, auth }
}
