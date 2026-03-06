import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    // Guard against React StrictMode double-invocation
    if (handled.current) return
    handled.current = true

    async function handleCallback() {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const tokenHash = url.searchParams.get('token_hash')
      const type = url.searchParams.get('type') as 'email' | 'recovery' | null
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      try {
        if (code) {
          // PKCE flow
          await supabase.auth.exchangeCodeForSession(code)
        } else if (tokenHash && type) {
          // Email OTP / magic link
          await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        } else if (accessToken && refreshToken) {
          // Implicit flow (legacy)
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No user after callback')

        // Get role from public users table
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        if (userData?.role === 'instructor') {
          navigate('/instructor/dashboard', { replace: true })
        } else {
          navigate('/student/browse', { replace: true })
        }
      } catch {
        navigate('/login?error=auth_failed', { replace: true })
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
