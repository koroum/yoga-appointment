export type UserRole = 'instructor' | 'student'

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'cancellation_requested'

export type SlotStatus = 'available' | 'unavailable'

export type NotificationChannel = 'email' | 'sms'

export type NotificationStatus = 'sent' | 'retrying' | 'failed'

export type NotificationType =
  | 'booking_requested'
  | 'booking_confirmed'
  | 'booking_rejected'
  | 'booking_cancelled'
  | 'cancellation_requested'
  | 'alternative_proposed'
  | 'alternative_confirmed'
  | 'slot_cancelled'
  | 'schedule_changed'
  | 'reminder_28h'
  | 'reminder_4h'

export type LinkedVia = 'invite' | 'discovery'

export interface User {
  id: string
  email: string | null
  phone: string | null
  name: string
  role: UserRole
  username: string | null
  created_at: string
}

export interface InstructorProfile {
  id: string
  user_id: string
  bio: string | null
  passion: string | null
  photo_urls: string[]
  created_at: string
}

export interface Class {
  id: string
  instructor_id: string
  title: string
  description: string | null
  max_capacity: number
  duration_minutes: number
  created_at: string
}

export interface AvailabilityRule {
  id: string
  instructor_id: string
  day_of_week: number // 0=Sunday … 6=Saturday
  start_time: string  // e.g. "09:00:00"
  class_id: string
  is_active: boolean
  created_at: string
}

export interface Slot {
  id: string
  class_id: string
  instructor_id: string
  starts_at: string
  ends_at: string
  status: SlotStatus
  created_at: string
}

// Slot with joined class data — used in browse/dashboard views
export interface SlotWithClass extends Slot {
  class: Class
  confirmed_count: number
}

export interface Booking {
  id: string
  slot_id: string
  student_id: string
  status: BookingStatus
  booked_by: 'instructor' | 'student'
  cancellation_requested_at: string | null
  proposed_slot_id: string | null
  student_note: string | null
  instructor_note: string | null
  created_at: string
}

// Booking with joined slot + class + student data — used in dashboard/my-bookings views
export interface BookingWithDetails extends Booking {
  slot: SlotWithClass
  student: Pick<User, 'id' | 'name' | 'email' | 'phone'>
}

export interface NotificationsLog {
  id: string
  booking_id: string | null
  recipient_id: string
  channel: NotificationChannel
  type: NotificationType
  status: NotificationStatus
  sent_at: string | null
  failed_at: string | null
  error_message: string | null
}

export interface InstructorStudent {
  instructor_id: string
  student_id: string
  linked_via: LinkedVia
  linked_at: string
}

export interface StudentNotificationPref {
  id: string
  instructor_id: string
  student_id: string
  reminders_enabled: boolean
  updated_at: string
}

// Composite type used in Students roster page
export interface StudentWithPrefs {
  user: Pick<User, 'id' | 'name' | 'email' | 'phone'>
  prefs: StudentNotificationPref
  linked_via: LinkedVia
}
