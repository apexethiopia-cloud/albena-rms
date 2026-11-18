-- Albena RMS — Phase 2 foundation: identity, roles, outlets, audit
-- Apply with: supabase db push  (or paste into the Supabase SQL editor)
-- Idempotent: safe to re-run.
--
-- Design notes
--  * ADR-003: authorization is enforced by RLS, never by the UI.
--  * Roles are the permission unit for the prototype (no separate permissions table).
--  * audit_logs is append-only: no UPDATE/DELETE policy exists.
--  * Helper functions are SECURITY DEFINER so RLS policies can read role data
--    without recursing into the policies they are evaluating.

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.user_status as enum ('active', 'disabled');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  status     public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id    uuid not null references public.user_profiles (id) on delete cascade,
  role_id    uuid not null references public.roles (id) on delete restrict,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id),
  primary key (user_id, role_id)
);

create table if not exists public.outlets (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_outlet_scopes (
  user_id    uuid not null references public.user_profiles (id) on delete cascade,
  outlet_id  uuid not null references public.outlets (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id),
  primary key (user_id, outlet_id)
);

create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,
  actor_email text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb
);

create index if not exists audit_logs_occurred_at_idx on public.audit_logs (occurred_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index if not exists user_roles_user_idx on public.user_roles (user_id);
create index if not exists user_outlet_scopes_user_idx on public.user_outlet_scopes (user_id);

-- ---------------------------------------------------------------------------
-- 3. Helper functions (SECURITY DEFINER: bypass RLS internally)
-- ---------------------------------------------------------------------------
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid()
      and p.status = 'active'
  );
$$;

create or replace function public.has_role(role_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = role_code
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('system_admin') and public.is_active_user();
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. New auth user -> profile row
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists outlets_set_updated_at on public.outlets;
create trigger outlets_set_updated_at
  before update on public.outlets
  for each row execute function public.set_updated_at();

-- Backfill profiles for accounts that existed before this migration.
insert into public.user_profiles (id, full_name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(u.email, ''), '@', 1)
  )
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Append-only audit trail
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_entity_id text;
begin
  select email into v_email from auth.users where id = v_actor;

  v_entity_id := case
    when tg_op = 'DELETE' then to_jsonb(old) ->> 'id'
    else to_jsonb(new) ->> 'id'
  end;

  insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, before, after)
  values (
    v_actor,
    v_email,
    lower(tg_table_name) || '.' || lower(tg_op),
    tg_table_name,
    v_entity_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists roles_audit on public.roles;
create trigger roles_audit
  after insert or update or delete on public.roles
  for each row execute function public.write_audit_log();

drop trigger if exists user_profiles_audit on public.user_profiles;
create trigger user_profiles_audit
  after insert or update or delete on public.user_profiles
  for each row execute function public.write_audit_log();

drop trigger if exists user_roles_audit on public.user_roles;
create trigger user_roles_audit
  after insert or update or delete on public.user_roles
  for each row execute function public.write_audit_log();

drop trigger if exists outlets_audit on public.outlets;
create trigger outlets_audit
  after insert or update or delete on public.outlets
  for each row execute function public.write_audit_log();

drop trigger if exists user_outlet_scopes_audit on public.user_outlet_scopes;
create trigger user_outlet_scopes_audit
  after insert or update or delete on public.user_outlet_scopes
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- 6. Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.roles               enable row level security;
alter table public.user_profiles       enable row level security;
alter table public.user_roles          enable row level security;
alter table public.outlets             enable row level security;
alter table public.user_outlet_scopes  enable row level security;
alter table public.audit_logs          enable row level security;

-- roles: every active user can read; only admins can change.
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated
  using (public.is_active_user());

drop policy if exists roles_admin_insert on public.roles;
create policy roles_admin_insert on public.roles
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists roles_admin_update on public.roles;
create policy roles_admin_update on public.roles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists roles_admin_delete on public.roles;
create policy roles_admin_delete on public.roles
  for delete to authenticated
  using (public.is_admin());

-- user_profiles: read own or management; self may edit full_name only;
-- status changes go through admin_set_user_status() below.
drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.has_role('general_manager')
    or public.has_role('restaurant_manager')
  );

drop policy if exists user_profiles_insert_self on public.user_profiles;
create policy user_profiles_insert_self on public.user_profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists user_profiles_update_self on public.user_profiles;
create policy user_profiles_update_self on public.user_profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists user_profiles_admin_update on public.user_profiles;
create policy user_profiles_admin_update on public.user_profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke update on public.user_profiles from authenticated;
grant update (full_name) on public.user_profiles to authenticated;

-- user_roles: read own or management; write admins only.
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_role('general_manager')
  );

drop policy if exists user_roles_admin_write on public.user_roles;
create policy user_roles_admin_write on public.user_roles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- outlets: active users can read; only admins manage.
drop policy if exists outlets_select on public.outlets;
create policy outlets_select on public.outlets
  for select to authenticated
  using (public.is_active_user());

drop policy if exists outlets_admin_write on public.outlets;
create policy outlets_admin_write on public.outlets
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- user_outlet_scopes: read own or admin; write admin.
drop policy if exists user_outlet_scopes_select on public.user_outlet_scopes;
create policy user_outlet_scopes_select on public.user_outlet_scopes
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_outlet_scopes_admin_write on public.user_outlet_scopes;
create policy user_outlet_scopes_admin_write on public.user_outlet_scopes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- audit_logs: append-only. Read for admins, GMs and auditors. No write policy.
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    public.is_admin()
    or public.has_role('general_manager')
    or public.has_role('auditor')
  );

revoke insert, update, delete on public.audit_logs from authenticated;
revoke all on public.audit_logs from anon;

-- ---------------------------------------------------------------------------
-- 7. Admin RPCs (audited via triggers)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_status(
  p_user_id uuid,
  p_status public.user_status
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only a system administrator may change account status'
      using errcode = '42501';
  end if;

  update public.user_profiles
     set status = p_status
   where id = p_user_id;

  if not found then
    raise exception 'User profile % not found', p_user_id using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_assign_role(
  p_user_id uuid,
  p_role_code text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only a system administrator may assign roles'
      using errcode = '42501';
  end if;

  select id into v_role_id from public.roles where code = p_role_code;
  if v_role_id is null then
    raise exception 'Unknown role code %', p_role_code using errcode = 'P0002';
  end if;

  insert into public.user_roles (user_id, role_id, granted_by)
  values (p_user_id, v_role_id, auth.uid())
  on conflict (user_id, role_id) do nothing;
end;
$$;

revoke all on function public.admin_set_user_status(uuid, public.user_status) from public;
revoke all on function public.admin_assign_role(uuid, text) from public;
grant execute on function public.admin_set_user_status(uuid, public.user_status) to authenticated;
grant execute on function public.admin_assign_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Comments
-- ---------------------------------------------------------------------------
comment on table public.user_profiles is 'Business profile for each Supabase Auth user (SEC-ROLE-02, USR-04).';
comment on table public.roles is 'Role catalogue (SRS section 3). Role codes are the permission unit.';
comment on table public.user_roles is 'Role assignment per user (SEC-ROLE-02, USR-02).';
comment on table public.outlets is 'Outlets of the single business entity (OD-02, OUT-01).';
comment on table public.user_outlet_scopes is 'Outlet access scope per user (SEC-ROLE-03, OUT-03).';
comment on table public.audit_logs is 'Append-only audit trail (AUD-01..05). No UPDATE/DELETE policy.';
