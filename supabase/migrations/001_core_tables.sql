-- 001: users, instructor_profiles, classes

create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique,
  phone       text unique,
  name        text not null,
  role        text not null check (role in ('instructor', 'student')),
  username    text unique,
  created_at  timestamptz not null default now(),
  constraint users_contact_check check (email is not null or phone is not null)
);

create table if not exists public.instructor_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  bio         text,
  passion     text,
  photo_urls  text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists public.classes (
  id                uuid primary key default gen_random_uuid(),
  instructor_id     uuid not null references public.users(id) on delete cascade,
  title             text not null,
  description       text,
  max_capacity      int not null default 1 check (max_capacity >= 1),
  duration_minutes  int not null check (duration_minutes > 0),
  created_at        timestamptz not null default now()
);
