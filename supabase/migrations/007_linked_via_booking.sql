-- Allow 'booking' as a linked_via value for auto-linking on booking confirmation
ALTER TABLE public.instructor_students DROP CONSTRAINT instructor_students_linked_via_check;
ALTER TABLE public.instructor_students ADD CONSTRAINT instructor_students_linked_via_check
  CHECK (linked_via = ANY (ARRAY['invite'::text, 'discovery'::text, 'booking'::text]));
