import type { BookingWithDetails, SlotWithClass, Class, Booking } from '../../types'

export const mockClass: Class = {
  id: 'class-1',
  instructor_id: 'instructor-1',
  title: 'Morning Flow',
  description: null,
  max_capacity: 5,
  duration_minutes: 60,
  created_at: '2026-01-01T00:00:00Z',
}

export const mockSlot: SlotWithClass = {
  id: 'slot-1',
  class_id: 'class-1',
  instructor_id: 'instructor-1',
  starts_at: '2026-04-10T14:00:00Z',
  ends_at: '2026-04-10T15:00:00Z',
  status: 'available',
  confirmed_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  class: mockClass,
}

export const mockBooking: Booking = {
  id: 'booking-1',
  slot_id: 'slot-1',
  student_id: 'student-1',
  status: 'pending',
  booked_by: 'student',
  cancellation_requested_at: null,
  proposed_slot_id: null,
  student_note: null,
  instructor_note: null,
  created_at: '2026-01-01T00:00:00Z',
}

export const mockBookingWithDetails: BookingWithDetails = {
  ...mockBooking,
  slot: mockSlot,
  student: {
    id: 'student-1',
    name: 'Alice Student',
    email: 'alice@example.com',
    phone: null,
  },
}

export function makeBookingWithDetails(overrides: Partial<BookingWithDetails> = {}): BookingWithDetails {
  return { ...mockBookingWithDetails, ...overrides }
}

export function makeSlot(overrides: Partial<SlotWithClass> = {}): SlotWithClass {
  return { ...mockSlot, ...overrides }
}
