-- ============================================================
-- Scrub Hub: Payment Tracking Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

alter table public.appointments
  add column if not exists payment_status  text    default 'unpaid' check (payment_status in ('unpaid', 'paid', 'partial')),
  add column if not exists payment_method  text    check (payment_method in ('cash', 'card', 'venmo', 'zelle', 'other')),
  add column if not exists amount_paid     numeric,
  add column if not exists deposit_amount  numeric,
  add column if not exists payment_note   text,
  add column if not exists paid_at        timestamptz;
