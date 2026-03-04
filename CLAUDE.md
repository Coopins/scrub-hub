# Scrub Hub - Claude Context File

## Project Overview
Grooming salon management software. Built by Chris Cooper (tech) + Carly Curry (domain expert/groomer).
Live at: https://scrub-hub-ashy.vercel.app
GitHub: https://github.com/Coopins/scrub-hub

## Tech Stack
- Next.js 14 App Router
- TypeScript
- Supabase (auth + database + storage)
- Tailwind CSS
- shadcn/ui components
- Dev server: port 5500

## Project Path
/Users/coopins/scrub-hub

## Database Tables
- groomer_profiles
- clients
- pets
- appointments
(All with RLS policies in Supabase)

## What's Built
- Auth (signup/login/logout)
- Dashboard with live stats
- Clients page — list, search, status badges (Active, DNB, Deposit Required)
- Client detail page — contact info, alerts, pet management, appointment history
- Calendar page — month/week/day view, color-coded by service type, appointment booking, edit, mark complete, cancel, smart warning popups for DNB/deposit/no-text clients

## Current Polish Pass Priority
1. Calendar — cancel buttons should be red
2. Clients page improvements
3. Dashboard improvements

## Key Product Decisions
- Reliability-first (SMS delivery is #1 differentiator vs MoeGo)
- Smart popups warn groomers before scheduling problem clients
- Color coding is customizable (not hardcoded) — Carly's feedback
- Dark theme throughout (slate-900/800)

## Pricing Tiers
- Free, Basic $39.99, Advanced $59.99, Elite $99.99
