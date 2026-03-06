import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'

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

      logger.debug('AuthCallback: url', window.location.href)
      try {
        if (code) {
          logger.debug('AuthCallback: exchanging PKCE code')
          await supabase.auth.exchangeCodeForSession(code)
        } else if (tokenHash && type) {
          logger.debug('AuthCallback: verifying OTP token_hash type=', type)
          await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        } else if (accessToken && refreshToken) {
          logger.debug('AuthCallback: setting session from hash tokens')
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        } else {
          logger.warn('AuthCallback: no recognized auth params in URL')
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No user after callback')
        logger.info('AuthCallback: user', user.id, 'authenticated')

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (userError) logger.warn('AuthCallback: could not fetch role', userError)
        logger.info('AuthCallback: role =', userData?.role, '→ redirecting')

        if (userData?.role === 'instructor') {
          navigate('/instructor/dashboard', { replace: true })
        } else {
          navigate('/student/browse', { replace: true })
        }
      } catch (err: unknown) {
        logger.error('AuthCallback: failed', err)
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
