-- Add optional note fields for student and instructor on bookings
ALTER TABLE public.bookings ADD COLUMN student_note text;
ALTER TABLE public.bookings ADD COLUMN instructor_note text;
