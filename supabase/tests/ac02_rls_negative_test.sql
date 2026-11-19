-- AC-02 — Role and outlet permissions enforced by the database
-- SRS v3.0: "Role and outlet permissions enforced by DB/server; unauthorized
-- access attempts fail."  TESTING.md: cross-role and cross-outlet access must
-- return denied with no data leaked.
--
-- HOW TO RUN
--   Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
--   Run it as the project owner/postgres (the SQL editor default). The script
--   opens a transaction, switches to anon/authenticated with SET LOCAL ROLE,
--   and ROLLBACKs at the end. It never changes persistent data.
--
--   Set a session user id for the authenticated checks below, or let the
--   script discover one automatically. No passwords or keys are required.
--
-- EXPECTED RESULT
--   All checks marked PASS are enforced by the current migrations.
--   The final "AC-02 GAP" checks are expected to FAIL against the current
--   schema: no RLS policy or helper filters outlet-linked rows by the
--   caller's user_outlet_scopes. That gap must be fixed in a migration before
--   AC-02 can be marked complete. See docs/TESTING.md section 10.
--
-- NEVER commit real credentials or personal data here.

begin;

-- Make sure nothing we do below can leak into the database.
set local statement_timeout = '60s';
set local lock_timeout = '5s';

do $$
declare
  v_total          integer := 0;
  v_failed         integer := 0;
  v_label          text;
  v_state          text;
  v_message        text;
  v_table          text;
  v_call           text;
  v_count          bigint;
  v_uid            uuid;
  v_seen_uid       uuid;

  v_business_tables text[] := array[
    'public.roles', 'public.user_profiles', 'public.user_roles',
    'public.outlets', 'public.user_outlet_scopes', 'public.audit_logs',
    'public.stock_locations', 'public.item_categories', 'public.units',
    'public.item_unit_conversions', 'public.suppliers', 'public.items',
    'public.grns', 'public.grn_lines', 'public.sivs', 'public.siv_lines',
    'public.stock_transactions', 'public.stock_layers',
    'public.stock_layer_consumptions',
    'public.purchase_requests', 'public.purchase_request_lines',
    'public.purchase_orders', 'public.purchase_order_lines',
    'public.inventory_adjustments', 'public.inventory_adjustment_lines',
    'public.inventory_counts', 'public.inventory_count_lines',
    'public.recipes', 'public.recipe_versions', 'public.recipe_version_lines',
    'public.production_orders', 'public.production_inputs',
    'public.business_settings', 'public.menu_categories', 'public.menu_items',
    'public.restaurant_tables', 'public.reservations', 'public.orders',
    'public.order_lines', 'public.receipts',
    'public.company_document_sequences', 'public.master_code_sequences',
    'public.document_sequences'
  ];

  v_anon_rpcs text[] := array[
    'public.admin_assign_role(null::uuid, null::text)',
    'public.admin_set_user_status(null::uuid, null::public.user_status)',
    'public.admin_revoke_role(null::uuid, null::text)',
    'public.create_purchase_request(null::date, null::text, null::jsonb)',
    'public.create_purchase_order(null::uuid, null::uuid, null::date, null::date, null::text, null::jsonb)',
    'public.create_grn(null::uuid, null::text, null::date, null::uuid, null::text, null::jsonb, null::uuid)',
    'public.create_siv(null::date, null::uuid, null::uuid, null::text, null::jsonb)',
    'public.create_inventory_adjustment(null::text, null::date, null::uuid, null::text, null::text, null::jsonb)',
    'public.create_inventory_count(null::date, null::uuid, null::text, null::text, null::jsonb)',
    'public.create_production_order(null::date, null::uuid, null::uuid, null::uuid, null::numeric, null::numeric, null::text, null::text, null::jsonb)',
    'public.create_recipe(null::text, null::text, null::text, null::numeric, null::numeric, null::jsonb)',
    'public.create_order(null::uuid, null::uuid, null::text, null::jsonb)',
    'public.update_purchase_request(null::uuid, null::date, null::text, null::jsonb)',
    'public.delete_purchase_request(null::uuid)',
    'public.next_company_document_number(null::text)',
    'public.next_master_code(null::text)',
    'public.next_document_number(null::uuid, null::text, null::text)',
    'public.business_today()',
    'public.occupy_table(null::uuid)',
    'public.free_table_if_idle(null::uuid)',
    'public.insert_recipe_version_lines(null::uuid, null::jsonb)',
    'public.post_stock_in(null::public.stock_transaction_type, null::uuid, null::uuid, null::numeric, null::numeric, null::text, null::uuid, null::uuid, null::text)',
    'public.post_stock_out(null::public.stock_transaction_type, null::uuid, null::uuid, null::numeric, null::text, null::uuid, null::uuid, null::text)'
  ];

  v_internal_rpcs text[] := array[
    'public.next_company_document_number(null::text)',
    'public.next_master_code(null::text)',
    'public.next_document_number(null::uuid, null::text, null::text)',
    'public.business_today()',
    'public.occupy_table(null::uuid)',
    'public.free_table_if_idle(null::uuid)',
    'public.insert_recipe_version_lines(null::uuid, null::jsonb)',
    'public.post_stock_in(null::public.stock_transaction_type, null::uuid, null::uuid, null::numeric, null::numeric, null::text, null::uuid, null::uuid, null::text)',
    'public.post_stock_out(null::public.stock_transaction_type, null::uuid, null::uuid, null::numeric, null::text, null::uuid, null::uuid, null::text)'
  ];

  v_admin_rpcs text[] := array[
    'public.admin_assign_role(null::uuid, null::text)',
    'public.admin_set_user_status(null::uuid, null::public.user_status)',
    'public.admin_revoke_role(null::uuid, null::text)'
  ];

  v_select_only_tables text[] := array[
    'public.audit_logs', 'public.user_roles',
    'public.company_document_sequences', 'public.master_code_sequences',
    'public.document_sequences',
    'public.grns', 'public.sivs', 'public.stock_transactions',
    'public.purchase_requests', 'public.purchase_orders',
    'public.inventory_adjustments', 'public.inventory_counts',
    'public.recipes', 'public.recipe_versions', 'public.production_orders',
    'public.reservations', 'public.orders', 'public.receipts'
  ];

  v_role_gated_tables text[] := array[
    'public.roles', 'public.outlets', 'public.user_outlet_scopes',
    'public.business_settings', 'public.menu_categories',
    'public.menu_items', 'public.restaurant_tables'
  ];

begin
  raise notice '=== AC-02 RLS negative tests ===';

  -- -------------------------------------------------------------------------
  -- 1. Static schema checks (run as the owner).
  -- -------------------------------------------------------------------------
  v_total := v_total + 1;
  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname::text = any(v_business_tables)
    and c.relkind in ('r', 'p', 'v')
    and c.relrowsecurity;
  if v_count = array_length(v_business_tables, 1) then
    raise notice 'PASS RLS enabled on all % business tables', v_count;
  else
    v_failed := v_failed + 1;
    raise notice 'FAIL RLS enabled on only % of % business tables', v_count, array_length(v_business_tables, 1);
  end if;

  -- -------------------------------------------------------------------------
  -- 2. anon must never see a business row, and must never call a privileged RPC.
  -- -------------------------------------------------------------------------
  foreach v_table in array v_business_tables loop
    v_total := v_total + 1;
    v_label := 'anon SELECT ' || v_table;
    begin
      execute 'set local role anon';
      execute format('select count(*) from %s', v_table) into v_count;
      if v_count = 0 then
        raise notice 'PASS % (RLS returned 0 rows)', v_label;
      else
        v_failed := v_failed + 1;
        raise notice 'FAIL % (LEAK: % rows visible)', v_label, v_count;
      end if;
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      if v_state = '42501' then
        raise notice 'PASS % (denied %)', v_label, v_state;
      else
        v_failed := v_failed + 1;
        raise notice 'FAIL % (unexpected %: %)', v_label, v_state, v_message;
      end if;
    end;
    execute 'reset role';
  end loop;

  foreach v_call in array v_anon_rpcs loop
    v_total := v_total + 1;
    v_label := 'anon RPC ' || split_part(v_call, '(', 1);
    begin
      execute 'set local role anon';
      execute 'select ' || v_call;
      v_failed := v_failed + 1;
      raise notice 'FAIL % (call succeeded)', v_label;
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      if v_state = '42501' then
        raise notice 'PASS % (denied %)', v_label, v_state;
      else
        v_failed := v_failed + 1;
        raise notice 'FAIL % (unexpected %: %)', v_label, v_state, v_message;
      end if;
    end;
    execute 'reset role';
  end loop;

  -- -------------------------------------------------------------------------
  -- 3. authenticated without a JWT subject must see nothing either.
  -- -------------------------------------------------------------------------
  foreach v_table in array v_business_tables loop
    v_total := v_total + 1;
    v_label := 'authenticated (no jwt sub) SELECT ' || v_table;
    begin
      perform set_config('request.jwt.claim.sub', '', true);
      execute 'set local role authenticated';
      execute format('select count(*) from %s', v_table) into v_count;
      if v_count = 0 then
        raise notice 'PASS % (RLS returned 0 rows)', v_label;
      else
        v_failed := v_failed + 1;
        raise notice 'FAIL % (LEAK: % rows visible)', v_label, v_count;
      end if;
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      if v_state = '42501' then
        raise notice 'PASS % (denied %)', v_label, v_state;
      else
        v_failed := v_failed + 1;
        raise notice 'FAIL % (unexpected %: %)', v_label, v_state, v_message;
      end if;
    end;
    execute 'reset role';
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);

  -- -------------------------------------------------------------------------
  -- 4. Discover a non-admin active user for the cross-role checks.
  -- -------------------------------------------------------------------------
  select p.id into v_uid
  from public.user_profiles p
  where p.status = 'active'
    and not exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = p.id and r.code = 'system_admin'
    )
  order by p.created_at
  limit 1;

  if v_uid is null then
    raise notice 'SKIP cross-role authenticated checks: no active non-admin profile found';
  else
    raise notice 'Using non-admin profile % for authenticated checks', v_uid;
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    execute 'set local role authenticated';
    execute 'select auth.uid()' into v_seen_uid;
    execute 'reset role';
    v_total := v_total + 1;
    if v_seen_uid = v_uid then
      raise notice 'PASS auth.uid() resolves the test JWT subject';
    else
      v_failed := v_failed + 1;
      raise notice 'FAIL auth.uid() did not resolve the test JWT subject (%)', coalesce(v_seen_uid::text, 'null');
    end if;

    -- Internal-only functions must remain uncallable even when signed in.
    foreach v_call in array v_internal_rpcs loop
      v_total := v_total + 1;
      v_label := 'authenticated internal RPC ' || split_part(v_call, '(', 1);
      begin
        execute 'set local role authenticated';
        execute 'select ' || v_call;
        v_failed := v_failed + 1;
        raise notice 'FAIL % (call succeeded)', v_label;
      exception when others then
        get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
        if v_state = '42501' then
          raise notice 'PASS % (denied %)', v_label, v_state;
        else
          v_failed := v_failed + 1;
          raise notice 'FAIL % (unexpected %: %)', v_label, v_state, v_message;
        end if;
      end;
      execute 'reset role';
    end loop;

    -- Admin RPCs must reject a signed-in non-admin.
    foreach v_call in array v_admin_rpcs loop
      v_total := v_total + 1;
      v_label := 'non-admin RPC ' || split_part(v_call, '(', 1);
      begin
        execute 'set local role authenticated';
        execute 'select ' || v_call;
        v_failed := v_failed + 1;
        raise notice 'FAIL % (call succeeded)', v_label;
      exception when others then
        get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
        if v_state in ('42501', 'P0001') then
          raise notice 'PASS % (denied %)', v_label, v_state;
        else
          v_failed := v_failed + 1;
          raise notice 'FAIL % (unexpected %: %)', v_label, v_state, v_message;
        end if;
      end;
      execute 'reset role';
    end loop;

    -- Direct writes on append-only / RPC-only tables must be denied.
    foreach v_table in array v_select_only_tables loop
      v_total := v_total + 1;
      v_label := 'non-admin INSERT ' || v_table;
      begin
        execute 'set local role authenticated';
        execute 'insert into ' || v_table || ' default values';
        v_failed := v_failed + 1;
        raise notice 'FAIL % (insert succeeded)', v_label;
      exception when others then
        get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
        if v_state = '42501' then
          raise notice 'PASS % (denied %)', v_label, v_state;
        else
          v_failed := v_failed + 1;
          raise notice 'FAIL % (unexpected %: %)', v_label, v_state, v_message;
        end if;
      end;
      execute 'reset role';
    end loop;

    -- Tables with write grants are still protected by role-gated RLS policies.
    foreach v_table in array v_role_gated_tables loop
      v_total := v_total + 1;
      v_label := 'non-admin INSERT ' || v_table || ' (RLS)';
      begin
        execute 'set local role authenticated';
        execute 'insert into ' || v_table || ' default values';
        v_failed := v_failed + 1;
        raise notice 'FAIL % (insert succeeded)', v_label;
      exception when others then
        get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
        if v_state = '42501' then
          raise notice 'PASS % (denied %)', v_label, v_state;
        else
          v_failed := v_failed + 1;
          raise notice 'FAIL % (unexpected %: %)', v_label, v_state, v_message;
        end if;
      end;
      execute 'reset role';
    end loop;

    -- A signed-in user must only see their own outlet-scope rows.
    v_total := v_total + 1;
    v_label := 'non-admin cannot read other user_outlet_scopes';
    begin
      execute 'set local role authenticated';
      execute 'select count(*) from public.user_outlet_scopes where user_id <> auth.uid()' into v_count;
      if v_count = 0 then
        raise notice 'PASS %', v_label;
      else
        v_failed := v_failed + 1;
        raise notice 'FAIL % (% rows leaked)', v_label, v_count;
      end if;
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      if v_state = '42501' then
        raise notice 'PASS % (denied %)', v_label, v_state;
      else
        v_failed := v_failed + 1;
        raise notice 'FAIL % (unexpected %: %)', v_label, v_state, v_message;
      end if;
    end;
    execute 'reset role';

    -- Append-only audit log must not be readable by a non-auditor.
    v_total := v_total + 1;
    v_label := 'non-admin SELECT audit_logs';
    begin
      execute 'set local role authenticated';
      execute 'select count(*) from public.audit_logs' into v_count;
      if v_count = 0 then
        raise notice 'PASS % (RLS returned 0 rows)', v_label;
      else
        v_failed := v_failed + 1;
        raise notice 'FAIL % (% rows visible)', v_label, v_count;
      end if;
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      if v_state = '42501' then
        raise notice 'PASS % (denied %)', v_label, v_state;
      else
        v_failed := v_failed + 1;
        raise notice 'FAIL % (unexpected %: %)', v_label, v_state, v_message;
      end if;
    end;
    execute 'reset role';
  end if;

  -- -------------------------------------------------------------------------
  -- 5. AC-02 GAP: outlet scoping is claimed in the docs but not implemented.
  --    These checks are expected to FAIL until a migration adds an outlet
  --    helper and outlet predicates on the five outlet-linked tables.
  -- -------------------------------------------------------------------------
  v_total := v_total + 1;
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'can_access_outlet';
  if v_count > 0 then
    raise notice 'PASS outlet-scope helper public.can_access_outlet() exists';
  else
    v_failed := v_failed + 1;
    raise notice 'FAIL AC-02 GAP: public.can_access_outlet() is missing';
  end if;

  v_total := v_total + 1;
  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('restaurant_tables', 'reservations', 'orders', 'order_lines', 'receipts')
    and polcmd::text in ('SELECT', 'ALL')
    and (pg_get_expr(polqual, polrelid) ilike '%outlet%' or pg_get_expr(polqual, polrelid) ilike '%scope%');
  if v_count >= 5 then
    raise notice 'PASS outlet-scope predicates found on all 5 outlet-linked tables';
  else
    v_failed := v_failed + 1;
    raise notice 'FAIL AC-02 GAP: only % of 5 outlet-linked tables have an outlet/scope predicate', v_count;
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  raise notice '=== AC-02 SUMMARY: % checks, % passed, % failed ===', v_total, v_total - v_failed, v_failed;
  if v_failed = 0 then
    raise notice 'AC-02 RESULT: PASS';
  else
    raise notice 'AC-02 RESULT: NOT MET — see FAIL lines above (known outlet-scope gap)';
  end if;
end $$;

-- Never persist anything this script created or changed.
rollback;
