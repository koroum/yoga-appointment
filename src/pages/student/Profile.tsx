import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Navbar } from '../../components/Navbar'
import { DeleteAccountModal } from '../../components/DeleteAccountModal'
import { logger } from '../../utils/logger'

interface LinkedInstructor {
  id: string
  name: string
  linked_at: string
}

export function StudentProfile() {
  const { user } = useAuth()
  const [phone, setPhone] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneSaved, setPhoneSaved] = useState(false)
  const [linked, setLinked] = useState<LinkedInstructor[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [linkInput, setLinkInput] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [unlinkBlockedBookings, setUnlinkBlockedBookings] = useState<{ instructorId: string; instructorName: string; bookings: { class_title: string; starts_at: string }[] } | null>(null)

  useEffect(() => {
    if (user) {
      setPhone(user.phone ?? '')
      loadData()
    }
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      const { data: links, error: linksErr } = await supabase
        .from('instructor_students')
        .select('instructor_id, linked_at, instructor:users!instructor_students_instructor_id_fkey(id, name)')
        .eq('student_id', user!.id)
        .order('linked_at', { ascending: false })

      if (linksErr) logger.error('StudentProfile: failed to load links', linksErr)

      type LinkRow = {
        instructor_id: string
        linked_at: string
        instructor: { id: string; name: string } | { id: string; name: string }[] | null
      }

      const linkedList: LinkedInstructor[] = (links as LinkRow[] ?? []).map(l => {
        const i = Array.isArray(l.instructor) ? l.instructor[0] : l.instructor
        return { id: l.instructor_id, name: i?.name ?? 'Instructor', linked_at: l.linked_at }
      })
      setLinked(linkedList)
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePhone() {
    setPhoneSaving(true)
    try {
      const { error } = await supabase.from('users').update({ phone: phone || null }).eq('id', user!.id)
      if (error) logger.error('StudentProfile: phone save failed', error)
      else {
        setPhoneSaved(true)
        setTimeout(() => setPhoneSaved(false), 2000)
      }
    } finally {
      setPhoneSaving(false)
    }
  }

  async function handleLinkByUrl() {
    setLinkError(null)
    const trimmed = linkInput.trim()
    if (!trimmed) return

    // Extract username from URL like /instructor/yogini-shweta or full URL
    const match = trimmed.match(/\/instructor\/([^/?#]+)/) ?? trimmed.match(/^([a-z0-9-]+)$/i)
    if (!match) {
      setLinkError('Please paste an instructor profile link (e.g. /instructor/yogini-shweta)')
      return
    }
    const username = match[1]

    setLinking(true)
    try {
      const { data: instructor, error: lookupErr } = await supabase
        .from('users')
        .select('id, name')
        .eq('username', username)
        .eq('role', 'instructor')
        .maybeSingle()

      if (lookupErr) {
        logger.error('StudentProfile: instructor lookup failed', lookupErr)
        setLinkError('Something went wrong. Please try again.')
        return
      }
      if (!instructor) {
        setLinkError('No instructor found for that link. Please check and try again.')
        return
      }

      if (linked.some(l => l.id === instructor.id)) {
        setLinkError(`You're already linked to ${instructor.name}.`)
        return
      }

      const { error } = await supabase.from('instructor_students').upsert({
        instructor_id: instructor.id,
        student_id: user!.id,
        linked_via: 'discovery',
      })
      if (error) {
        logger.error('StudentProfile: link failed', error)
        setLinkError('Failed to link. Please try again.')
        return
      }

      logger.info('StudentProfile: linked to', instructor.id)
      setLinkInput('')
      await loadData()
    } finally {
      setLinking(false)
    }
  }

  async function handleUnlink(instructorId: string) {
    setActing(instructorId)
    try {
      // Check for active bookings with this instructor
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, slot_id')
        .eq('student_id', user!.id)
        .in('status', ['pending', 'confirmed', 'cancellation_requested'])

      if (bookings && bookings.length > 0) {
        const slotIds = bookings.map(b => b.slot_id)
        const { data: slots } = await supabase
          .from('slots')
          .select('id, starts_at, instructor_id, class:classes(title)')
          .in('id', slotIds)
          .eq('instructor_id', instructorId)
          .gt('starts_at', new Date().toISOString())

        if (slots && slots.length > 0) {
          const instructor = linked.find(l => l.id === instructorId)
          setUnlinkBlockedBookings({
            instructorId,
            instructorName: instructor?.name ?? 'this instructor',
            bookings: slots.map(s => {
              const cls = Array.isArray(s.class) ? s.class[0] as { title: string } | undefined : s.class as { title: string } | null
              return { class_title: cls?.title ?? 'Class', starts_at: s.starts_at }
            }),
          })
          return
        }
      }

      // No active bookings — proceed with unlink
      const { error } = await supabase
        .from('instructor_students')
        .delete()
        .eq('instructor_id', instructorId)
        .eq('student_id', user!.id)
      if (error) logger.error('StudentProfile: unlink failed', error)
      else logger.info('StudentProfile: unlinked from', instructorId)
      await loadData()
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>

        {/* User info */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div>
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-400 font-light">Student</p>
            {user?.email && <p className="text-sm text-gray-500 mt-1">{user.email}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleSavePhone}
                disabled={phoneSaving}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {phoneSaving ? 'Saving…' : phoneSaved ? '✓' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Linked instructors */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">My Instructors</h2>
              {linked.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-sm text-gray-400">
                  No instructors linked yet
                </div>
              ) : (
                <div className="space-y-2">
                  {linked.map(i => (
                    <div key={i.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                      <p className="font-medium text-gray-900">{i.name}</p>
                      <button
                        onClick={() => handleUnlink(i.id)}
                        disabled={acting === i.id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {acting === i.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Link to instructor by URL */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Link to Instructor</h2>
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                <p className="text-sm text-gray-500">Paste your instructor's profile link to connect with them.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={linkInput}
                    onChange={e => { setLinkInput(e.target.value); setLinkError(null) }}
                    placeholder="e.g. /instructor/yogini-shweta"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleLinkByUrl}
                    disabled={linking || !linkInput.trim()}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {linking ? 'Linking…' : 'Link'}
                  </button>
                </div>
                {linkError && <p className="text-xs text-red-500">{linkError}</p>}
              </div>
            </section>
          </>
        )}

        {/* Delete Account */}
        <div className="pt-2 border-t border-gray-200">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
          >
            Delete Account
          </button>
        </div>

        {showDeleteModal && (
          <DeleteAccountModal
            userId={user!.id}
            role="student"
            onClose={() => setShowDeleteModal(false)}
          />
        )}

        {unlinkBlockedBookings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Cannot Remove Instructor</h2>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                <p className="text-sm text-amber-800 font-semibold">
                  You have {unlinkBlockedBookings.bookings.length} upcoming booking{unlinkBlockedBookings.bookings.length > 1 ? 's' : ''} with {unlinkBlockedBookings.instructorName}:
                </p>
                <ul className="space-y-1">
                  {unlinkBlockedBookings.bookings.map((b, idx) => (
                    <li key={idx} className="text-xs text-amber-700">
                      {b.class_title} — {new Date(b.starts_at).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        timeZone: 'America/New_York',
                      })}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-amber-700 mt-2">
                  Please cancel your booking{unlinkBlockedBookings.bookings.length > 1 ? 's' : ''} first before removing this instructor.
                </p>
              </div>
              <button
                onClick={() => setUnlinkBlockedBookings(null)}
                className="w-full py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
