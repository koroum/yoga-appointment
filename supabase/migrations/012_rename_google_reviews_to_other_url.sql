-- Rename google_reviews_url to other_url for more flexibility
ALTER TABLE public.instructor_profiles
  RENAME COLUMN google_reviews_url TO other_url;
