import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Step = 'input' | 'otp_sent'
type Method = 'email' | 'phone'

export function Login() {
  const [method, setMethod] = useState<Method>('email')
  const [value, setValue] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<Step>('input')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSendOtp() {
    setError(null)
    setLoading(true)
    try {
      if (method === 'email') {
        const { error } = await supabase.auth.signInWithOtp({
          email: value,
          options: { shouldCreateUser: false },
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          phone: value,
          options: { shouldCreateUser: false },
        })
        if (error) throw error
      }
      setStep('otp_sent')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    setError(null)
    setLoading(true)
    try {
      if (method === 'email') {
        const { error } = await supabase.auth.verifyOtp({ email: value, token: otp, type: 'email' })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.verifyOtp({ phone: value, token: otp, type: 'sms' })
        if (error) throw error
      }
      // Auth state change in useAuth will redirect via ProtectedRoute
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-4">
      <div className="max-w-sm w-full mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">YogaBook</h1>
        <p className="text-gray-500 mb-8 text-sm">Log in to your account</p>

        {step === 'input' ? (
          <div className="space-y-4">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setMethod('email')}
                className={`flex-1 py-2 text-sm font-medium ${method === 'email' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
              >
                Email
              </button>
              <button
                onClick={() => setMethod('phone')}
                className={`flex-1 py-2 text-sm font-medium ${method === 'phone' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
              >
                Phone
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {method === 'email' ? 'Email address' : 'Phone number'}
              </label>
              <input
                type={method === 'email' ? 'email' : 'tel'}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={method === 'email' ? 'you@example.com' : '+1 555 000 0000'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              onClick={handleSendOtp}
              disabled={loading || !value.trim()}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send code'}
            </button>

            <p className="text-center text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/signup" className="text-indigo-600 font-medium">Sign up</Link>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              We sent a 6-digit code to <strong>{value}</strong>.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 6}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>

            <button
              onClick={() => { setStep('input'); setOtp(''); setError(null) }}
              className="w-full text-sm text-gray-500"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
