-- Run this in your Supabase SQL Editor

-- Groomer profiles (extends auth.users)
create table public.groomer_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  business_name text not null,
  phone text,
  created_at timestamptz default now()
);

-- Clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  groomer_id uuid references auth.users(id) on delete cascade not null,
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text,
  address text,
  status text default 'active' check (status in ('active', 'inactive', 'do_not_book', 'deposit_required')),
  no_text_messages boolean default false,
  deposit_required boolean default false,
  notes text,
  created_at timestamptz default now()
);

-- Pets
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade not null,
  name text not null,
  species text default 'dog',
  breed text,
  age integer,
  weight numeric,
  photo_url text,
  temperament_notes text,
  medical_notes text,
  created_at timestamptz default now()
);

-- Appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  groomer_id uuid references auth.users(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  pet_id uuid references public.pets(id) on delete cascade not null,
  service_type text not null check (service_type in ('bath', 'groom', 'deluxe', 'nail_trim', 'other')),
  scheduled_datetime timestamptz not null,
  duration_minutes integer default 90,
  status text default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'no_show', 'cancelled')),
  price numeric,
  notes text,
  service_notes text,
  color_code text,
  reminder_sent boolean default false,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.groomer_profiles enable row level security;
alter table public.clients enable row level security;
alter table public.pets enable row level security;
alter table public.appointments enable row level security;

-- RLS Policies: Groomers can only see their own data

-- Groomer profiles
create policy "Groomers can view own profile"
  on public.groomer_profiles for select
  using (auth.uid() = id);

create policy "Groomers can update own profile"
  on public.groomer_profiles for update
  using (auth.uid() = id);

create policy "Groomers can insert own profile"
  on public.groomer_profiles for insert
  with check (auth.uid() = id);

-- Clients
create policy "Groomers can CRUD own clients"
  on public.clients for all
  using (auth.uid() = groomer_id);

-- Pets (via client ownership)
create policy "Groomers can CRUD own pets"
  on public.pets for all
  using (
    exists (
      select 1 from public.clients
      where clients.id = pets.client_id
      and clients.groomer_id = auth.uid()
    )
  );

-- Appointments
create policy "Groomers can CRUD own appointments"
  on public.appointments for all
  using (auth.uid() = groomer_id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.groomer_profiles (id, email, business_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'business_name', 'My Grooming Business'));
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
