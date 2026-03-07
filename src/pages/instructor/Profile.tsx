import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Navbar } from '../../components/Navbar'
import { compressImage } from '../../utils/imageCompression'
import { logger } from '../../utils/logger'

export function InstructorProfile() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [passion, setPassion] = useState('')
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [otherUrl, setOtherUrl] = useState('')
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (user) loadProfile()
  }, [user])

  async function loadProfile() {
    try {
      const [{ data: userData, error: userError }, { data: profile, error: profileError }] = await Promise.all([
        supabase.from('users').select('name, username, phone').eq('id', user!.id).single(),
        supabase.from('instructor_profiles').select('bio, passion, photo_urls, other_url').eq('user_id', user!.id).single(),
      ])
      if (userError) logger.error('Profile: failed to load user data', userError)
      if (profileError && profileError.code !== 'PGRST116') logger.warn('Profile: no profile row yet', profileError)
      logger.info('Profile: loaded for user', user!.id)
      setName(userData?.name ?? '')
      setPhone(userData?.phone ?? '')
      setUsername(userData?.username ?? '')
      setBio(profile?.bio ?? '')
      setPassion(profile?.passion ?? '')
      setPhotoUrls(profile?.photo_urls ?? [])
      setOtherUrl((profile?.other_url as string | null) ?? '')
    } catch (err: unknown) {
      logger.error('Profile loadProfile:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const { error: userError } = await supabase.from('users').update({ name, phone: phone || null }).eq('id', user!.id)
      if (userError) throw userError
      const { error: profileError } = await supabase.from('instructor_profiles').upsert({ user_id: user!.id, bio, passion, photo_urls: photoUrls, other_url: otherUrl || null }, { onConflict: 'user_id' })
      if (profileError) throw profileError
      logger.info('Profile: saved successfully')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)

    try {
      const compressed = await compressImage(file)
      const path = `${user!.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('instructor-photos').upload(path, compressed)
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('instructor-photos').getPublicUrl(path)
      setPhotoUrls(prev => [...prev, data.publicUrl])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDeletePhoto(url: string) {
    const path = url.split('/instructor-photos/')[1]
    await supabase.storage.from('instructor-photos').remove([path])
    setPhotoUrls(prev => prev.filter(u => u !== url))
  }

  const profileUrl = `${window.location.origin}/instructor/${username}`

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/instructor/dashboard" className="text-sm text-indigo-600">← Dashboard</Link>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Profile</h1>
          <p className="text-xs text-gray-400 font-light mt-1">Instructor</p>
        </div>

        {/* Profile URL */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">Your profile URL</p>
          <p className="text-sm text-gray-700 break-all">{profileUrl}</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(profileUrl).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              })
            }}
            className="mt-2 text-xs text-indigo-600 font-medium"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={4}
              placeholder="Tell students about yourself..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">My Passion</label>
            <input
              type="text"
              value={passion}
              onChange={e => setPassion(e.target.value)}
              placeholder="What drives your teaching..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Other URL (Optional)</label>
            <input
              type="url"
              value={otherUrl}
              onChange={e => setOtherUrl(e.target.value)}
              placeholder="https://share.google/..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-400 mt-1">Paste any link (Google Reviews, website, etc.)</p>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Photos</label>
            <div className="flex flex-wrap gap-2">
              {photoUrls.map(url => (
                <div key={url} className="relative w-20 h-20">
                  <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button
                    onClick={() => handleDeletePhoto(url)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {photoUrls.length < 5 && (
                <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-indigo-400 text-gray-400 text-2xl">
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  ) : '+'}
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Max 5MB · auto-compressed · up to 5 photos</p>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
