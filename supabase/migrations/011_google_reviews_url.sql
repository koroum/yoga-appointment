-- Add optional Google Reviews URL to instructor profiles
ALTER TABLE public.instructor_profiles
  ADD COLUMN google_reviews_url text;
