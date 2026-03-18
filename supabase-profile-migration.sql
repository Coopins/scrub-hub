-- ============================================================
-- Scrub Hub: Groomer Profile Fields Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

alter table public.groomer_profiles
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists address    text,
  add column if not exists timezone   text default 'America/New_York';
