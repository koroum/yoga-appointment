import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../types'

type Step = 'form' | 'verify_email' | 'verify_phone' | 'done'

interface Props {
  // When reached via /instructor/:username, pre-fills instructor context
  instructorId?: string
  instructorName?: string
}

export function Signup({ instructorId, instructorName }: Props) {
  const [searchParams] = useSearchParams()
  const prefilledInstructorId = instructorId ?? searchParams.get('instructor') ?? undefined

  const [role, setRole] = useState<UserRole>('student')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasEmail = email.trim().length > 0
  const hasPhone = phone.trim().length > 0
  const canSubmit = name.trim() && (hasEmail || hasPhone)

  async function handleCreateAccount() {
    setError(null)
    if (!canSubmit) {
      setError('Please enter your name and at least one of email or phone.')
      return
    }
    setLoading(true)

    try {
      // Sign up with email or phone OTP
      if (hasEmail) {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true, data: { name, role } },
        })
        if (error) throw error
        setStep('verify_email')
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          phone: phone.trim(),
          options: { shouldCreateUser: true, data: { name, role } },
        })
        if (error) throw error
        setStep('verify_phone')
      }
    } catch (err: unknown) {
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
        const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp, type: 'email' })
        if (error) throw error
        authUserId = data.user?.id
      } else {
        const { data, error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: otp, type: 'sms' })
        if (error) throw error
        authUserId = data.user?.id
      }

      if (!authUserId) throw new Error('Could not get user ID after verification')

      // Upsert user row in public.users
      await supabase.from('users').upsert({
        id: authUserId,
        name: name.trim(),
        role,
        email: hasEmail ? email.trim() : null,
        phone: hasPhone ? phone.trim() : null,
        username: role === 'instructor' ? name.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now() : null,
      })

      // Link student to instructor if arriving via instructor profile
      if (role === 'student' && prefilledInstructorId) {
        await supabase.from('instructor_students').upsert({
          instructor_id: prefilledInstructorId,
          student_id: authUserId,
          linked_via: 'discovery',
        })
      }

      setStep('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-4">
        <div className="max-w-sm w-full mx-auto text-center">
          <div className="text-4xl mb-3">🧘</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">You're in!</h2>
          <p className="text-sm text-gray-500">Your account is set up. Redirecting…</p>
        </div>
      </div>
    )
  }

  if (step === 'verify_email' || step === 'verify_phone') {
    const contact = step === 'verify_email' ? email : phone
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-4">
        <div className="max-w-sm w-full mx-auto space-y-4">
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            onClick={handleVerifyOtp}
            disabled={loading || otp.length < 6}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify'}
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
            <h1 className="text-2xl font-bold text-gray-900 mb-1">YogaBook</h1>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-400 mt-1">Verify at least one of email or phone ↑</p>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={handleCreateAccount}
            disabled={loading || !canSubmit}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create Account'}
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
