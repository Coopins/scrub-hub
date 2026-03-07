-- ============================================================
-- Scrub Hub: SMS Reminders Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. notifications table
create table if not exists public.notifications (
  id              uuid default gen_random_uuid() primary key,
  appointment_id  uuid references public.appointments(id) on delete cascade,
  groomer_id      uuid references auth.users(id) on delete cascade,
  type            text not null default 'sms_reminder',
  scheduled_for   timestamptz not null,
  sent_at         timestamptz,
  status          text not null default 'pending',  -- pending | sent | failed | skipped
  message_body    text,
  created_at      timestamptz default now()
);

-- 2. RLS — groomers see and manage only their own notifications
alter table public.notifications enable row level security;

drop policy if exists "groomers manage own notifications" on public.notifications;
create policy "groomers manage own notifications"
  on public.notifications
  for all
  using (auth.uid() = groomer_id)
  with check (auth.uid() = groomer_id);

-- 3. Add reminder_preferences JSONB to groomer_profiles
--    Defaults: 24h reminder ON, 1-week and 2-hour OFF
alter table public.groomer_profiles
  add column if not exists reminder_preferences jsonb
  default '{"reminder_1week": false, "reminder_24h": true, "reminder_2h": false}'::jsonb;

-- 4. Helpful index for the cron query
create index if not exists notifications_status_scheduled_for_idx
  on public.notifications (status, scheduled_for)
  where status = 'pending';
