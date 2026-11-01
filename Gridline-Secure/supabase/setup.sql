-- GRIDLINE DIGITAL: hardened database setup (replaces the earlier setup.sql files)
-- BEFORE RUNNING:
--   1) Create your admin user in Supabase > Authentication > Users (Add user, auto-confirm).
--   2) Replace OWNER_EMAIL_REPLACE_ME below with that exact email.
--   3) Paste the whole file into SQL Editor and run it once. It is safe to re-run.

-- 0) CLEAN-UP of weaker designs from earlier versions (safe if they never existed) --------------
drop policy if exists "Admin reads leads" on public.leads;
drop policy if exists "Admin updates leads" on public.leads;
drop policy if exists "Admin deletes leads" on public.leads;
drop policy if exists "Anyone can submit an enquiry" on public.leads;
drop function if exists public.is_admin_email();

-- 1) WHO IS AN ADMIN: bound to the immutable account ID, not to an email address -------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

insert into public.admin_users(user_id)
select id from auth.users where lower(email) = lower('OWNER_EMAIL_REPLACE_ME')
on conflict do nothing;

-- Is this logged-in account an approved admin? (used by the login page)
create or replace function public.is_admin_account()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.admin_users where user_id = auth.uid()); $$;

-- Admin AND signed in with the 6-digit code (AAL2). Every protected function requires this.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(auth.jwt()->>'aal','') = 'aal2'
          and exists(select 1 from public.admin_users where user_id = auth.uid()); $$;

-- 2) PROFILE TABLE for registered users -------------------------------------------------------------
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);
alter table public.app_users enable row level security;
revoke all on public.app_users from anon, authenticated;

create or replace function public.handle_new_app_user()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin
  insert into public.app_users(id, display_name)
  values (new.id, left(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 80))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created_gridline on auth.users;
create trigger on_auth_user_created_gridline after insert on auth.users
  for each row execute procedure public.handle_new_app_user();

-- 3) WHATSAPP CONNECTION METADATA (never store passwords, codes or tokens here) ----------------------
create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.app_users(id) on delete cascade,
  provider text not null default 'meta_whatsapp_business',
  business_account_id text,
  phone_number_id text,
  masked_phone text,
  status text not null default 'pending' check (status in ('pending','connected','disconnected','revoked','error')),
  consent_at timestamptz,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_connections enable row level security;
revoke all on public.whatsapp_connections from anon, authenticated;

-- 4) WEBSITE ENQUIRIES: the public can ADD one, and can never read, change or delete anything --------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  service text not null check (service in ('Digital branding','UI/UX design','Website development','Web application','Mobile application','Ongoing support','Not sure yet')),
  budget text check (budget is null or budget in ('$1,000–$3,000','$3,000–$7,500','$7,500–$15,000','$15,000–$20,000','Need guidance')),
  details text not null check (char_length(details) between 1 and 3000)
);
-- If you rename a service or budget option on the website, update the two lists above to match.
alter table public.leads enable row level security;
revoke all on public.leads from anon, authenticated;
grant insert (name, email, service, budget, details) on public.leads to anon;   -- only these 5 columns
create policy "Public can submit an enquiry" on public.leads for insert to anon with check (true);

-- Flood brake: at most 20 enquiries per minute site-wide, so a bot cannot fill your database.
create or replace function public.leads_flood_brake()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin
  if (select count(*) from public.leads where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Too many enquiries right now. Please try again shortly.';
  end if;
  return new;
end; $$;
drop trigger if exists leads_flood_brake on public.leads;
create trigger leads_flood_brake before insert on public.leads
  for each row execute procedure public.leads_flood_brake();

-- 5) ADMIN-ONLY DASHBOARD FUNCTIONS (each one re-checks admin + 6-digit code on the server) ----------
create or replace function public.admin_dashboard_stats()
returns table(total_users bigint, whatsapp_connected_users bigint, users_without_whatsapp bigint, active_whatsapp_connections bigint)
language plpgsql stable security definer set search_path = ''
as $$ begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  return query
  select count(distinct u.id),
    count(distinct u.id) filter (where w.status = 'connected'),
    count(distinct u.id) filter (where w.id is null or w.status <> 'connected'),
    count(w.id) filter (where w.status = 'connected')
  from public.app_users u left join public.whatsapp_connections w on w.user_id = u.id;
end; $$;

create or replace function public.admin_recent_users(row_limit integer default 12)
returns table(user_id uuid, email text, display_name text, created_at timestamptz, whatsapp_status text)
language plpgsql stable security definer set search_path = ''
as $$ begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  return query select u.id, au.email::text, u.display_name, u.created_at, coalesce(w.status, 'not connected')
  from public.app_users u join auth.users au on au.id = u.id
  left join public.whatsapp_connections w on w.user_id = u.id
  order by u.created_at desc limit greatest(1, least(coalesce(row_limit, 12), 50));
end; $$;

create or replace function public.admin_recent_whatsapp_connections(row_limit integer default 12)
returns table(connection_id uuid, email text, display_name text, masked_phone text, status text, connected_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$ begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  return query select w.id, au.email::text, u.display_name, w.masked_phone, w.status, w.connected_at
  from public.whatsapp_connections w join public.app_users u on u.id = w.user_id join auth.users au on au.id = u.id
  order by w.updated_at desc limit greatest(1, least(coalesce(row_limit, 12), 50));
end; $$;

create or replace function public.admin_recent_leads(row_limit integer default 25)
returns table(id uuid, created_at timestamptz, name text, email text, service text, budget text, details text)
language plpgsql stable security definer set search_path = ''
as $$ begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  return query select l.id, l.created_at, l.name, l.email, l.service, l.budget, l.details
  from public.leads l order by l.created_at desc limit greatest(1, least(coalesce(row_limit, 25), 100));
end; $$;

-- 6) LOCK THE DOORS: functions are callable only by signed-in accounts (never by anonymous visitors) -----
revoke all on function public.is_admin_account() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.admin_dashboard_stats() from public, anon;
revoke all on function public.admin_recent_users(integer) from public, anon;
revoke all on function public.admin_recent_whatsapp_connections(integer) from public, anon;
revoke all on function public.admin_recent_leads(integer) from public, anon;
revoke all on function public.leads_flood_brake() from public, anon, authenticated;
revoke all on function public.handle_new_app_user() from public, anon, authenticated;
grant execute on function public.is_admin_account() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_recent_users(integer) to authenticated;
grant execute on function public.admin_recent_whatsapp_connections(integer) to authenticated;
grant execute on function public.admin_recent_leads(integer) to authenticated;

-- 7) SELF-CHECK: this must return exactly 1 row (your admin). If it returns 0, the email did not match a user.
select u.email as approved_admin from public.admin_users a join auth.users u on u.id = a.user_id;
