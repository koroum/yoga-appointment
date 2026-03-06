-- Fix: instructor_profiles had no unique constraint on user_id,
-- so upsert kept inserting duplicate rows on every profile save.

-- Remove duplicates first (keep the earliest row per user_id)
DELETE FROM public.instructor_profiles a
  USING public.instructor_profiles b
  WHERE a.user_id = b.user_id
    AND a.created_at > b.created_at;

-- Add unique constraint so upsert works correctly
ALTER TABLE public.instructor_profiles
  ADD CONSTRAINT instructor_profiles_user_id_key UNIQUE (user_id);
