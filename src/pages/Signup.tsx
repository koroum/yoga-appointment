import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types'

type Step = 'form' | 'verify_email' | 'verify_phone'

interface Props {
  instructorId?: string
  instructorName?: string
}

export function Signup({ instructorId, instructorName }: Props) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const prefilledInstructorId = instructorId ?? searchParams.get('instructor') ?? undefined

  const [role, setRole] = useState<UserRole>('student')
  const [availableInstructors, setAvailableInstructors] = useState<{ id: string; name: string }[]>([])
  const [selectedInstructorIds, setSelectedInstructorIds] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (role === 'student' && !prefilledInstructorId) {
      supabase.from('users').select('id, name').eq('role', 'instructor').order('name').then(({ data }) => {
        setAvailableInstructors(data ?? [])
      })
    }
  }, [role, prefilledInstructorId])

  function toggleInstructor(id: string) {
    setSelectedInstructorIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasEmail = email.trim().length > 0
  const hasPhone = phone.trim().length > 0
  const passwordsMatch = password === confirmPassword
  const needsInstructorPick = role === 'student' && !prefilledInstructorId && availableInstructors.length > 0
  const canSubmit = name.trim() && (hasEmail || hasPhone) && password.length >= 8 && passwordsMatch && (!needsInstructorPick || selectedInstructorIds.size > 0)

  function validateForm(): string | null {
    if (!name.trim()) return 'Please enter your name.'
    if (!hasEmail && !hasPhone) return 'Please enter at least your email or phone number.'
    if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.'
    if (hasPhone && !/^\+?[0-9\s\-().]{7,}$/.test(phone.trim())) return 'Please enter a valid phone number (e.g. +1 555 000 0000).'
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (!passwordsMatch) return 'Passwords do not match.'
    return null
  }

  async function handleCreateAccount() {
    const validationError = validateForm()
    if (validationError) { setError(validationError); return }
    setError(null)
    setLoading(true)

    try {
      if (hasEmail) {
        logger.debug('Signup: sending OTP to email', email.trim())
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true, data: { name: name.trim(), role } },
        })
        if (error) throw error
        logger.info('Signup: OTP sent to email')
        setStep('verify_email')
      } else {
        logger.debug('Signup: sending OTP to phone', phone.trim())
        const { error } = await supabase.auth.signInWithOtp({
          phone: phone.trim(),
          options: { shouldCreateUser: true, data: { name: name.trim(), role } },
        })
        if (error) throw error
        logger.info('Signup: OTP sent to phone')
        setStep('verify_phone')
      }
    } catch (err: unknown) {
      logger.error('Signup: failed to send OTP', err)
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    setError(null)
    setLoading(true)
    try {
      let authUserId: string | undefined

      if (step === 'verify_email') {
        logger.debug('Signup: verifying email OTP')
        const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp, type: 'email' })
        if (error) throw error
        authUserId = data.user?.id
      } else {
        logger.debug('Signup: verifying phone OTP')
        const { data, error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: otp, type: 'sms' })
        if (error) throw error
        authUserId = data.user?.id
      }

      if (!authUserId) throw new Error('Could not get user ID after verification')
      logger.info('Signup: OTP verified, user', authUserId)

      // Set password so user can log in with email+password from now on
      logger.debug('Signup: setting password for user', authUserId)
      const { error: pwErr } = await supabase.auth.updateUser({ password })
      if (pwErr) throw pwErr

      // Upsert user row in public.users
      const userRow = {
        id: authUserId,
        name: name.trim(),
        role,
        email: hasEmail ? email.trim() : null,
        phone: hasPhone ? phone.trim() : null,
        username: role === 'instructor'
          ? name.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
          : null,
      }
      logger.debug('Signup: upserting user row', userRow)
      const { error: upsertErr } = await supabase.from('users').upsert(userRow)
      if (upsertErr) {
        logger.error('Signup: failed to create user profile', upsertErr)
        if (upsertErr.message.includes('users_phone_key')) {
          throw new Error('This phone number is already in use. Try a different number or log in to your existing account.')
        }
        throw new Error(`Failed to create your profile: ${upsertErr.message}`)
      }
      logger.info('Signup: user row created for', authUserId, 'role=', role)

      // Link student to instructor(s)
      if (role === 'student') {
        const instructorIds = prefilledInstructorId
          ? [prefilledInstructorId]
          : [...selectedInstructorIds]

        if (instructorIds.length > 0) {
          logger.debug('Signup: linking student to', instructorIds.length, 'instructor(s)')
          const rows = instructorIds.map(id => ({
            instructor_id: id,
            student_id: authUserId,
            linked_via: 'discovery' as const,
          }))
          const { error: linkErr } = await supabase.from('instructor_students').upsert(rows)
          if (linkErr) logger.warn('Signup: failed to link student to instructor(s)', linkErr)
        }
      }

      // Re-fetch user in AuthContext so ProtectedRoute sees the new role
      await refreshUser()

      const destination = role === 'instructor' ? '/instructor/dashboard' : '/student/browse'
      logger.info('Signup: complete, redirecting to', destination)
      navigate(destination, { replace: true })
    } catch (err: unknown) {
      logger.error('Signup: verification/setup failed', err)
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'verify_email' || step === 'verify_phone') {
    const contact = step === 'verify_email' ? email : phone
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-4">
        <div className="max-w-sm w-full mx-auto space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Verify your {step === 'verify_email' ? 'email' : 'phone'}</h1>
          <p className="text-sm text-gray-600">
            We sent a 6-digit code to <strong>{contact}</strong>.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            onClick={handleVerifyOtp}
            disabled={loading || otp.length < 6}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify & Create Account'}
          </button>
          <button onClick={() => { setStep('form'); setOtp('') }} className="w-full text-sm text-gray-500">
            ← Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-4">
      <div className="max-w-sm w-full mx-auto">
        {prefilledInstructorId ? (
          <>
            <Link to={`/instructor/${searchParams.get('username') ?? ''}`} className="text-sm text-indigo-600 mb-4 block">
              ← Back to {instructorName ?? 'instructor'}'s profile
            </Link>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Create your account</h1>
            <p className="text-sm text-gray-500 mb-6">You'll be linked to {instructorName ?? 'this instructor'}.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Yoga Booking</h1>
            <p className="text-gray-500 mb-6 text-sm">Create your account</p>

            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-4">
              <button
                onClick={() => setRole('student')}
                className={`flex-1 py-2 text-sm font-medium ${role === 'student' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
              >
                I'm a student
              </button>
              <button
                onClick={() => setRole('instructor')}
                className={`flex-1 py-2 text-sm font-medium ${role === 'instructor' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
              >
                I'm an instructor
              </button>
            </div>
          </>
        )}

        <div className="space-y-4">
          {needsInstructorPick && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select your instructor{availableInstructors.length > 1 ? '(s)' : ''}
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {availableInstructors.map(i => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => toggleInstructor(i.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedInstructorIds.has(i.id)
                        ? 'bg-indigo-50 border border-indigo-300 text-indigo-700 font-medium'
                        : 'border border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {i.name}
                  </button>
                ))}
              </div>
              {selectedInstructorIds.size === 0 && (
                <p className="text-xs text-gray-400 mt-1">Select at least one instructor to continue</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-gray-400 font-normal">(required for login)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
              autoComplete="tel"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                confirmPassword && !passwordsMatch ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {confirmPassword && !passwordsMatch && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          <p className="text-xs text-gray-400">
            You'll receive a verification code to confirm your email or phone.
          </p>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={handleCreateAccount}
            disabled={loading || !canSubmit}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Sending code…' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 font-medium">Log in →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
