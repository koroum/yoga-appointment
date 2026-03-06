-- 002: availability_rules, slots

create table if not exists public.availability_rules (
  id             uuid primary key default gen_random_uuid(),
  instructor_id  uuid not null references public.users(id) on delete cascade,
  day_of_week    int not null check (day_of_week between 0 and 6),
  start_time     time not null,
  class_id       uuid not null references public.classes(id) on delete cascade,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.slots (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references public.classes(id) on delete cascade,
  instructor_id  uuid not null references public.users(id) on delete cascade,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         text not null default 'available' check (status in ('available', 'unavailable')),
  created_at     timestamptz not null default now(),
  constraint slots_time_check check (ends_at > starts_at)
);
