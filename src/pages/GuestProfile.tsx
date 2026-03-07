import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatInNY } from '../utils/dates'
import { logger } from '../utils/logger'
import type { SlotWithClass } from '../types'

interface InstructorData {
  id: string
  name: string
  username: string
  profile: {
    bio: string | null
    passion: string | null
    photo_urls: string[]
    other_url: string | null
  } | null
}

export function GuestProfile() {
  const { username } = useParams<{ username: string }>()
  const [instructor, setInstructor] = useState<InstructorData | null>(null)
  const [slots, setSlots] = useState<SlotWithClass[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!username) return
    loadProfile(username)
  }, [username])

  async function loadProfile(uname: string) {
    setLoading(true)
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, username, instructor_profiles(bio, passion, photo_urls, other_url)')
        .eq('username', uname)
        .eq('role', 'instructor')
        .single()

      if (error || !user) {
        logger.info('GuestProfile: instructor not found for username', uname, error?.message)
        setNotFound(true)
        return
      }

      logger.info('GuestProfile: loaded instructor', user.id, user.name)
      const profile = Array.isArray(user.instructor_profiles)
        ? user.instructor_profiles[0] ?? null
        : user.instructor_profiles ?? null

      setInstructor({ id: user.id, name: user.name, username: user.username!, profile })

      const { data: slotRows, error: slotsError } = await supabase
        .from('slots')
        .select('*, class:classes(*)')
        .eq('instructor_id', user.id)
        .eq('status', 'available')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(10)

      if (slotsError) logger.warn('GuestProfile: failed to load slots', slotsError)

      if (slotRows && slotRows.length > 0) {
        const slotIds = slotRows.map(s => s.id)
        const { data: bookingCounts, error: countsError } = await supabase
          .from('bookings')
          .select('slot_id')
          .in('slot_id', slotIds)
          .eq('status', 'confirmed')

        if (countsError) logger.warn('GuestProfile: failed to load booking counts', countsError)

        const countMap: Record<string, number> = {}
        for (const b of bookingCounts ?? []) {
          countMap[b.slot_id] = (countMap[b.slot_id] ?? 0) + 1
        }

        setSlots(slotRows.map(s => ({ ...s, confirmed_count: countMap[s.id] ?? 0 })))
        logger.info('GuestProfile: loaded', slotRows.length, 'slots')
      }
    } catch (err: unknown) {
      logger.error('GuestProfile loadProfile:', err)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <p className="text-xl font-semibold text-gray-700 mb-2">Instructor not found</p>
        <p className="text-gray-500 text-sm">This profile link may be incorrect.</p>
      </div>
    )
  }

  const photos = instructor?.profile?.photo_urls ?? []
  const availableSlots = slots.filter(s => s.confirmed_count < s.class.max_capacity)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-4 h-14 flex items-center">
        <span className="font-bold text-indigo-600 text-lg">Yoga Booking</span>
      </nav>

      <div className="max-w-lg mx-auto pb-16">
        {/* Cover + Avatar */}
        <div className="relative">
          <div className="h-40 bg-gradient-to-br from-indigo-400 to-purple-500" />
          <div className="absolute -bottom-10 left-4">
            <div className="w-20 h-20 rounded-full bg-indigo-100 border-4 border-white flex items-center justify-center text-2xl font-bold text-indigo-600">
              {instructor?.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="mt-14 px-4">
          {/* Name + badge */}
          <h1 className="text-xl font-bold text-gray-900">{instructor?.name}</h1>
          <p className="text-xs text-gray-400 font-light">Instructor</p>
          <p className="text-sm text-indigo-600 mt-1">✦ Certified Yoga Instructor</p>

          {/* CTA - moved to top */}
          <Link
            to={`/signup?instructor=${instructor?.id}&username=${username}`}
            className="block w-full bg-indigo-600 text-white text-center py-3 rounded-xl font-medium text-sm mt-4"
          >
            Book a Class / Sign Up
          </Link>

          {/* Other URL */}
          {instructor?.profile?.other_url && (
            <a
              href={instructor.profile.other_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-white border border-gray-200 text-gray-700 text-center py-3 rounded-xl font-medium text-sm mt-2 hover:bg-gray-50"
            >
              → Visit Link
            </a>
          )}

          {/* Bio */}
          {instructor?.profile?.bio && (
            <div className="mt-4 bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-sm text-gray-700 leading-relaxed italic">"{instructor.profile.bio}"</p>
              {instructor.profile.passion && (
                <p className="text-sm text-gray-500 mt-2">{instructor.profile.passion}</p>
              )}
            </div>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Photos</h2>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Classes */}
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming Classes</h2>
            {availableSlots.length === 0 ? (
              <div className="bg-white rounded-xl p-4 border border-gray-100 text-center text-sm text-gray-500">
                No classes scheduled yet — check back soon
              </div>
            ) : (
              <div className="space-y-2">
                {availableSlots.map(slot => {
                  const spotsLeft = slot.class.max_capacity - slot.confirmed_count
                  const isGroup = slot.class.max_capacity > 1
                  return (
                    <div key={slot.id} className="bg-white rounded-xl p-4 border border-gray-100">
                      <p className="font-semibold text-gray-900">{slot.class.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {formatInNY(slot.starts_at, 'EEE MMM d · h:mm a')}
                      </p>
                      <p className="text-sm text-gray-400">
                        {slot.class.duration_minutes} min
                        {isGroup && ` · ${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
