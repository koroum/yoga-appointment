import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'
import { useAuth } from '../hooks/useAuth'

export function Login() {
  const { user, role } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Already logged in — redirect to appropriate dashboard
  if (user && role) {
    const dest = role === 'instructor' ? '/instructor/dashboard' : '/student/browse'
    return <Navigate to={dest} replace />
  }

  async function handleLogin() {
    setError(null)
    setLoading(true)
    try {
      logger.debug('Login: attempting sign-in for', email.trim())
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error

      // Fetch user role to determine redirect destination
      logger.info('Login: authenticated, fetching user role')
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error('Could not retrieve user after login')

      let { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .maybeSingle()

      // If no users row exists by ID, check if one exists by email (from a previous signup attempt)
      if (!userData) {
        const meta = authUser.user_metadata ?? {}
        const userRole = meta.role || 'student'
        const userName = meta.name || email.trim().split('@')[0]

        // Check if a row exists with this email but a different auth ID
        const { data: existingByEmail } = await supabase
          .from('users')
          .select('id, role')
          .eq('email', authUser.email!)
          .maybeSingle()

        if (existingByEmail) {
          // Update the existing row to use the current auth user ID
          logger.info('Login: found existing user by email, updating ID to', authUser.id)
          const { error: updateErr } = await supabase
            .from('users')
            .update({ id: authUser.id })
            .eq('email', authUser.email!)
          if (updateErr) {
            logger.error('Login: failed to update user ID', updateErr)
            throw new Error('Could not link your account. Please contact support.')
          }
          userData = { role: existingByEmail.role }
        } else {
          logger.info('Login: no users row found, creating one with role=', userRole)
          const { error: insertErr } = await supabase.from('users').upsert({
            id: authUser.id,
            name: userName,
            role: userRole,
            email: authUser.email ?? null,
            phone: authUser.phone ?? null,
          })
          if (insertErr) {
            logger.error('Login: failed to create user row', insertErr)
            throw new Error('Your account setup is incomplete. Please try signing up again.')
          }
          userData = { role: userRole }
        }
      }

      const dest = userData.role === 'instructor' ? '/instructor/dashboard' : '/student/browse'
      logger.info('Login: redirecting to', dest)
      window.location.href = dest
    } catch (err: unknown) {
      logger.error('Login: failed', err)
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && email.trim() && password) handleLogin()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-4">
      <div className="max-w-sm w-full mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Booking</h1>
        <p className="text-gray-500 mb-8 text-sm">Log in to your account</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading || !email.trim() || !password}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Logging in…' : 'Log In'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/signup" className="text-indigo-600 font-medium">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
