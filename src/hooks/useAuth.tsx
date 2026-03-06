import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'
import type { User, UserRole } from '../types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  role: UserRole | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // Guard against React StrictMode double-invocation
  const initialised = useRef(false)

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true

    // Fetch initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        logger.debug('useAuth: restoring session for', data.session.user.id)
        fetchUser(data.session.user.id)
      } else {
        logger.debug('useAuth: no session found')
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      logger.debug('useAuth: auth event', event, newSession?.user?.id)
      setSession(newSession)
      if (newSession) {
        fetchUser(newSession.user.id)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUser(userId: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      logger.error('useAuth fetchUser: failed to load user profile', userId, error)
    } else {
      logger.debug('useAuth: loaded user', data?.id, 'role=', data?.role)
    }
    setUser(data ?? null)
    setLoading(false)
  }

  async function signOut() {
    logger.debug('useAuth: signing out')
    const { error } = await supabase.auth.signOut()
    if (error) {
      logger.error('useAuth: signOut failed', error)
    } else {
      logger.debug('useAuth: signed out successfully')
    }
  }

  async function refreshUser() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      logger.debug('useAuth: refreshUser for', authUser.id)
      await fetchUser(authUser.id)
    }
  }

  const role = user?.role ?? null

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
