-- Albena RMS — 0015: admin-controlled role revocation
-- Apply after 20261119001400_draft_crud.sql.
-- Idempotent: safe to re-run.
--
-- Adds a guarded, audited RPC so a system administrator can remove one assigned
-- role from a user without removing the others (e.g. revoke `cashier` while
-- keeping `restaurant_manager`). All role writes are routed through RPCs;
-- direct INSERT/UPDATE/DELETE on user_roles is revoked from application roles.
--
-- Decisions confirmed by the owner on 2026-11-19:
--   * a user may never be left with zero roles;
--   * at least one active system_admin must remain in the system;
--   * self-revocation is allowed only when another active admin remains;
--   * direct table writes are disabled in favour of the guarded RPCs.

-- ---------------------------------------------------------------------------
-- 1. Audit reference for join tables without an `id` column
-- ---------------------------------------------------------------------------
-- user_roles has a composite key (user_id, role_id), so the existing audit
-- trigger wrote a NULL entity_id for role grants/revocations. Fall back to the
-- user_id for those tables while leaving id-bearing tables unchanged.
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
  v_row jsonb;
begin
  select email into v_email from auth.users where id = v_actor;

  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_entity_id := v_row ->> 'id';

  if v_entity_id is null then
    v_entity_id := v_row ->> 'user_id';
  end if;

  if v_entity_id is null then
    v_entity_id := v_row ->> 'role_id';
  end if;

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

-- ---------------------------------------------------------------------------
-- 2. Guarded revoke RPC
-- ---------------------------------------------------------------------------
create or replace function public.admin_revoke_role(
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
  v_role_count integer;
  v_active_admin_count integer;
  v_target_active boolean;
begin
  if not public.is_admin() then
    raise exception 'Only a system administrator may revoke roles'
      using errcode = '42501';
  end if;

  -- Serialize revocations so two admins cannot race past the last-role and
  -- last-admin guards. Assignment is additive and needs no lock.
  perform pg_advisory_xact_lock(hashtext('public.admin_revoke_role')::bigint);

  select id into v_role_id from public.roles where code = p_role_code;
  if v_role_id is null then
    raise exception 'Unknown role code %.', p_role_code using errcode = 'P0002';
  end if;

  select status = 'active' into v_target_active
    from public.user_profiles
   where id = p_user_id;

  if v_target_active is null then
    raise exception 'User profile % not found.', p_user_id using errcode = 'P0002';
  end if;

  if not exists (
    select 1
      from public.user_roles
     where user_id = p_user_id
       and role_id = v_role_id
  ) then
    raise exception 'Role % is not assigned to this account.', p_role_code
      using errcode = 'P0002';
  end if;

  select count(*) into v_role_count
    from public.user_roles
   where user_id = p_user_id;

  if v_role_count <= 1 then
    raise exception 'An account must keep at least one role.';
  end if;

  if p_role_code = 'system_admin' and v_target_active then
    select count(distinct ur.user_id) into v_active_admin_count
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.user_profiles p on p.id = ur.user_id
     where r.code = 'system_admin'
       and p.status = 'active';

    if v_active_admin_count <= 1 then
      raise exception 'At least one active System Administrator must remain.';
    end if;
  end if;

  delete from public.user_roles
   where user_id = p_user_id
     and role_id = v_role_id;
end;
$$;

revoke all on function public.admin_revoke_role(uuid, text) from public, anon;
grant execute on function public.admin_revoke_role(uuid, text) to authenticated;

-- Harden the existing admin RPCs with the same anon boundary used above.
revoke all on function public.admin_assign_role(uuid, text) from public, anon;
revoke all on function public.admin_set_user_status(uuid, public.user_status) from public, anon;
grant execute on function public.admin_assign_role(uuid, text) to authenticated;
grant execute on function public.admin_set_user_status(uuid, public.user_status) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Close direct table writes
-- ---------------------------------------------------------------------------
-- RLS policies are permissive ORs. Dropping the old `for all` admin write
-- policy removes the RLS write path; the select policy still allows own/admin/
-- GM reads. Table privileges are revoked as a second layer. SECURITY DEFINER
-- RPCs and the service-role seed script keep their owner/service privileges.
drop policy if exists user_roles_admin_write on public.user_roles;
revoke insert, update, delete on public.user_roles from anon, authenticated;

notify pgrst, 'reload schema';
