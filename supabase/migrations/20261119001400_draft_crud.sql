-- Albena RMS — draft document CRUD (edit + delete)
-- Apply after 20261119001300_auto_numbering.sql.
-- Idempotent: every function is dropped by exact signature before creation.
--
-- The create RPCs in 0005-0009 are intentionally insert-only. This migration
-- adds role-gated UPDATE/DELETE counterparts for DRAFT/UNPOSTED documents only.
-- It never weakens immutability of posted/final records:
--   * PR / PO          -> status = 'draft'
--   * GRN / SIV        -> posted_at is null (plus an explicit ledger guard)
--   * counts / adj/waste -> status = 'draft'
--   * production order  -> status = 'draft'
-- Document numbers, ids, created_at, posted/submitted/decided/approved metadata,
-- PO/PR links and all ledger references are preserved. No approval rules,
-- thresholds or statuses are introduced; audit_logs and posted ledger rows are
-- never written by these functions (existing audit triggers still fire).

-- ---------------------------------------------------------------------------
-- 1. Purchase request (create in 0006: create_purchase_request, can_manage_purchasing)
-- ---------------------------------------------------------------------------
drop function if exists public.update_purchase_request(uuid, date, text, jsonb);

create or replace function public.update_purchase_request(
  p_pr_id uuid,
  p_request_date date,
  p_notes text,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.purchase_request_status;
  v_line jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_quantity numeric;
  v_count integer := 0;
begin
  if not public.can_manage_purchasing() then
    raise exception 'You do not have permission to edit purchase requests'
      using errcode = '42501';
  end if;

  select pr.status into v_status
  from public.purchase_requests pr
  where pr.id = p_pr_id
  for update;
  if not found then
    raise exception 'Purchase request % not found', p_pr_id using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft purchase request can be edited' using errcode = '23514';
  end if;

  if p_request_date is null then
    raise exception 'A request date is required' using errcode = '23514';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A purchase request needs at least one line' using errcode = '23514';
  end if;

  delete from public.purchase_request_lines where pr_id = p_pr_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_item_id := nullif(v_line ->> 'item_id', '')::uuid;
    v_unit_id := nullif(v_line ->> 'unit_id', '')::uuid;
    v_quantity := nullif(v_line ->> 'quantity', '')::numeric;

    if v_item_id is null or not exists (
      select 1 from public.items i where i.id = v_item_id and i.is_active
    ) then
      raise exception 'Every line needs an active item' using errcode = '23514';
    end if;
    if v_unit_id is null then
      raise exception 'Every line needs a unit' using errcode = '23514';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Every line needs a quantity greater than zero' using errcode = '23514';
    end if;

    perform public.stock_unit_factor(v_item_id, v_unit_id);

    insert into public.purchase_request_lines (pr_id, item_id, unit_id, quantity)
    values (p_pr_id, v_item_id, v_unit_id, v_quantity);

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A purchase request needs at least one line' using errcode = '23514';
  end if;

  -- pr_number, id, requested_by, requester_name, created_at, submitted_at and
  -- the decision metadata are deliberately not touched.
  update public.purchase_requests
     set request_date = p_request_date,
         notes = nullif(btrim(coalesce(p_notes, '')), ''),
         updated_at = now()
   where id = p_pr_id
     and status = 'draft';
  if not found then
    raise exception 'Purchase request % changed while it was being edited', p_pr_id
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.update_purchase_request(uuid, date, text, jsonb) from public, anon;
grant execute on function public.update_purchase_request(uuid, date, text, jsonb) to authenticated;

drop function if exists public.delete_purchase_request(uuid);

create or replace function public.delete_purchase_request(p_pr_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.purchase_request_status;
begin
  if not public.can_manage_purchasing() then
    raise exception 'You do not have permission to delete purchase requests'
      using errcode = '42501';
  end if;

  select pr.status into v_status
  from public.purchase_requests pr
  where pr.id = p_pr_id
  for update;
  if not found then
    raise exception 'Purchase request % not found', p_pr_id using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft purchase request can be deleted' using errcode = '23514';
  end if;

  delete from public.purchase_request_lines where pr_id = p_pr_id;

  delete from public.purchase_requests where id = p_pr_id and status = 'draft';
  if not found then
    raise exception 'Purchase request % changed while it was being deleted', p_pr_id
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.delete_purchase_request(uuid) from public, anon;
grant execute on function public.delete_purchase_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Purchase order (create in 0006: create_purchase_order, can_manage_purchasing)
--    pr_id stays whatever the stored row links to.
-- ---------------------------------------------------------------------------
drop function if exists public.update_purchase_order(uuid, uuid, date, date, text, jsonb);

create or replace function public.update_purchase_order(
  p_po_id uuid,
  p_supplier_id uuid,
  p_order_date date,
  p_expected_date date,
  p_notes text,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.purchase_order_status;
  v_line jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_quantity numeric;
  v_unit_cost numeric;
  v_count integer := 0;
begin
  if not public.can_manage_purchasing() then
    raise exception 'You do not have permission to edit purchase orders'
      using errcode = '42501';
  end if;

  select po.status into v_status
  from public.purchase_orders po
  where po.id = p_po_id
  for update;
  if not found then
    raise exception 'Purchase order % not found', p_po_id using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft purchase order can be edited' using errcode = '23514';
  end if;

  if p_order_date is null then
    raise exception 'An order date is required' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.suppliers s where s.id = p_supplier_id and s.is_active
  ) then
    raise exception 'Choose an active supplier' using errcode = '23514';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A purchase order needs at least one line' using errcode = '23514';
  end if;

  delete from public.purchase_order_lines where po_id = p_po_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_item_id := nullif(v_line ->> 'item_id', '')::uuid;
    v_unit_id := nullif(v_line ->> 'unit_id', '')::uuid;
    v_quantity := nullif(v_line ->> 'quantity', '')::numeric;
    v_unit_cost := nullif(v_line ->> 'unit_cost', '')::numeric;

    if v_item_id is null or not exists (
      select 1 from public.items i where i.id = v_item_id and i.is_active
    ) then
      raise exception 'Every line needs an active item' using errcode = '23514';
    end if;
    if v_unit_id is null then
      raise exception 'Every line needs a unit' using errcode = '23514';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Every line needs a quantity greater than zero' using errcode = '23514';
    end if;
    if v_unit_cost is null or v_unit_cost <= 0 then
      raise exception 'Every line needs a unit cost greater than zero' using errcode = '23514';
    end if;

    perform public.stock_unit_factor(v_item_id, v_unit_id);

    insert into public.purchase_order_lines (po_id, item_id, unit_id, quantity, unit_cost)
    values (p_po_id, v_item_id, v_unit_id, v_quantity, round(v_unit_cost, 2));

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A purchase order needs at least one line' using errcode = '23514';
  end if;

  -- po_number, pr_id, created_by, created_at and approval/order/close metadata
  -- are immutable; only the editable header fields are written here.
  update public.purchase_orders
     set supplier_id = p_supplier_id,
         order_date = p_order_date,
         expected_date = p_expected_date,
         notes = nullif(btrim(coalesce(p_notes, '')), ''),
         updated_at = now()
   where id = p_po_id
     and status = 'draft';
  if not found then
    raise exception 'Purchase order % changed while it was being edited', p_po_id
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.update_purchase_order(uuid, uuid, date, date, text, jsonb) from public, anon;
grant execute on function public.update_purchase_order(uuid, uuid, date, date, text, jsonb) to authenticated;

drop function if exists public.delete_purchase_order(uuid);

create or replace function public.delete_purchase_order(p_po_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.purchase_order_status;
begin
  if not public.can_manage_purchasing() then
    raise exception 'You do not have permission to delete purchase orders'
      using errcode = '42501';
  end if;

  select po.status into v_status
  from public.purchase_orders po
  where po.id = p_po_id
  for update;
  if not found then
    raise exception 'Purchase order % not found', p_po_id using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft purchase order can be deleted' using errcode = '23514';
  end if;

  delete from public.purchase_order_lines where po_id = p_po_id;

  delete from public.purchase_orders where id = p_po_id and status = 'draft';
  if not found then
    raise exception 'Purchase order % changed while it was being deleted', p_po_id
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.delete_purchase_order(uuid) from public, anon;
grant execute on function public.delete_purchase_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. GRN (latest create signature in 0007: create_grn(..., p_po_id), can_post_grn)
--    po_id is read from the stored row, never accepted from the caller.
-- ---------------------------------------------------------------------------
drop function if exists public.update_grn(uuid, uuid, text, date, uuid, text, jsonb);

create or replace function public.update_grn(
  p_grn_id uuid,
  p_supplier_id uuid,
  p_invoice_number text,
  p_received_date date,
  p_location_id uuid,
  p_notes text,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_posted_at timestamptz;
  v_po_id uuid;
  v_po_supplier_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_quantity numeric;
  v_unit_cost numeric;
  v_po_line_id uuid;
  v_po_line_item_id uuid;
  v_count integer := 0;
begin
  if not public.can_post_grn() then
    raise exception 'You do not have permission to edit goods receiving notes'
      using errcode = '42501';
  end if;

  select g.posted_at, g.po_id into v_posted_at, v_po_id
  from public.grns g
  where g.id = p_grn_id
  for update;
  if not found then
    raise exception 'GRN % not found', p_grn_id using errcode = 'P0002';
  end if;
  if v_posted_at is not null then
    raise exception 'Only an unposted goods receiving note can be edited'
      using errcode = '23514';
  end if;
  if exists (
    select 1 from public.stock_transactions st
    where st.reference_type = 'grn' and st.reference_id = p_grn_id
  ) then
    raise exception 'GRN % is already linked to the stock ledger', p_grn_id
      using errcode = '23514';
  end if;

  if nullif(btrim(p_invoice_number), '') is null then
    raise exception 'An invoice number is required' using errcode = '23514';
  end if;
  if p_received_date is null then
    raise exception 'A received date is required' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.suppliers s where s.id = p_supplier_id and s.is_active
  ) then
    raise exception 'Choose an active supplier' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.stock_locations l where l.id = p_location_id and l.is_active
  ) then
    raise exception 'Choose an active stock location' using errcode = '23514';
  end if;

  -- Supplier lock from the stored PO link (0007): the supplier cannot be changed
  -- to one that does not own the linked purchase order.
  if v_po_id is not null then
    select po.supplier_id into v_po_supplier_id
    from public.purchase_orders po
    where po.id = v_po_id;

    if v_po_supplier_id is null then
      raise exception 'Choose an existing purchase order' using errcode = '23514';
    end if;
    if v_po_supplier_id <> p_supplier_id then
      raise exception 'The purchase order belongs to a different supplier'
        using errcode = '23514';
    end if;
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A GRN needs at least one line' using errcode = '23514';
  end if;

  delete from public.grn_lines where grn_id = p_grn_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_item_id := nullif(v_line ->> 'item_id', '')::uuid;
    v_unit_id := nullif(v_line ->> 'unit_id', '')::uuid;
    v_quantity := nullif(v_line ->> 'quantity', '')::numeric;
    v_unit_cost := nullif(v_line ->> 'unit_cost', '')::numeric;
    v_po_line_id := nullif(v_line ->> 'po_line_id', '')::uuid;

    if v_item_id is null or not exists (
      select 1 from public.items i where i.id = v_item_id and i.is_active
    ) then
      raise exception 'Every line needs an active item' using errcode = '23514';
    end if;
    if v_unit_id is null then
      raise exception 'Every line needs a unit' using errcode = '23514';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Every line needs a quantity greater than zero' using errcode = '23514';
    end if;
    if v_unit_cost is null or v_unit_cost <= 0 then
      raise exception 'Every line needs a unit cost greater than zero' using errcode = '23514';
    end if;

    perform public.stock_unit_factor(v_item_id, v_unit_id);

    if v_po_line_id is not null then
      if v_po_id is null then
        raise exception 'Link the GRN to a purchase order before adding its lines'
          using errcode = '23514';
      end if;

      select pol.item_id into v_po_line_item_id
      from public.purchase_order_lines pol
      where pol.id = v_po_line_id
        and pol.po_id = v_po_id;

      if v_po_line_item_id is null then
        raise exception 'That line does not belong to the selected purchase order'
          using errcode = '23514';
      end if;
      if v_po_line_item_id <> v_item_id then
        raise exception 'The line item does not match the selected purchase order line'
          using errcode = '23514';
      end if;
    end if;

    insert into public.grn_lines (grn_id, item_id, unit_id, quantity, unit_cost, po_line_id)
    values (p_grn_id, v_item_id, v_unit_id, v_quantity, round(v_unit_cost, 2), v_po_line_id);

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A GRN needs at least one line' using errcode = '23514';
  end if;

  -- grn_number, po_id, created_by, created_at, posted_by and posted_at are immutable.
  update public.grns
     set supplier_id = p_supplier_id,
         invoice_number = btrim(p_invoice_number),
         received_date = p_received_date,
         location_id = p_location_id,
         notes = nullif(btrim(coalesce(p_notes, '')), '')
   where id = p_grn_id
     and posted_at is null;
  if not found then
    raise exception 'GRN % changed while it was being edited', p_grn_id using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.update_grn(uuid, uuid, text, date, uuid, text, jsonb) from public, anon;
grant execute on function public.update_grn(uuid, uuid, text, date, uuid, text, jsonb) to authenticated;

drop function if exists public.delete_grn(uuid);

create or replace function public.delete_grn(p_grn_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_posted_at timestamptz;
begin
  if not public.can_post_grn() then
    raise exception 'You do not have permission to delete goods receiving notes'
      using errcode = '42501';
  end if;

  select g.posted_at into v_posted_at
  from public.grns g
  where g.id = p_grn_id
  for update;
  if not found then
    raise exception 'GRN % not found', p_grn_id using errcode = 'P0002';
  end if;
  if v_posted_at is not null then
    raise exception 'Only an unposted goods receiving note can be deleted'
      using errcode = '23514';
  end if;
  if exists (
    select 1 from public.stock_transactions st
    where st.reference_type = 'grn' and st.reference_id = p_grn_id
  ) then
    raise exception 'GRN % is already linked to the stock ledger', p_grn_id
      using errcode = '23514';
  end if;

  delete from public.grn_lines where grn_id = p_grn_id;

  delete from public.grns where id = p_grn_id and posted_at is null;
  if not found then
    raise exception 'GRN % changed while it was being deleted', p_grn_id using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.delete_grn(uuid) from public, anon;
grant execute on function public.delete_grn(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. SIV (create in 0005: create_siv, can_post_siv)
-- ---------------------------------------------------------------------------
drop function if exists public.update_siv(uuid, date, uuid, uuid, text, jsonb);

create or replace function public.update_siv(
  p_siv_id uuid,
  p_issue_date date,
  p_source_location_id uuid,
  p_destination_location_id uuid,
  p_notes text,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_posted_at timestamptz;
  v_line jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_quantity numeric;
  v_count integer := 0;
begin
  if not public.can_post_siv() then
    raise exception 'You do not have permission to edit store issue vouchers'
      using errcode = '42501';
  end if;

  select s.posted_at into v_posted_at
  from public.sivs s
  where s.id = p_siv_id
  for update;
  if not found then
    raise exception 'SIV % not found', p_siv_id using errcode = 'P0002';
  end if;
  if v_posted_at is not null then
    raise exception 'Only an unposted store issue voucher can be edited'
      using errcode = '23514';
  end if;
  if exists (
    select 1 from public.stock_transactions st
    where st.reference_type = 'siv' and st.reference_id = p_siv_id
  ) then
    raise exception 'SIV % is already linked to the stock ledger', p_siv_id
      using errcode = '23514';
  end if;

  if p_issue_date is null then
    raise exception 'An issue date is required' using errcode = '23514';
  end if;
  if p_source_location_id = p_destination_location_id then
    raise exception 'Source and destination locations must be different'
      using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.stock_locations l where l.id = p_source_location_id and l.is_active
  ) then
    raise exception 'Choose an active source location' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.stock_locations l where l.id = p_destination_location_id and l.is_active
  ) then
    raise exception 'Choose an active destination location' using errcode = '23514';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A SIV needs at least one line' using errcode = '23514';
  end if;

  delete from public.siv_lines where siv_id = p_siv_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_item_id := nullif(v_line ->> 'item_id', '')::uuid;
    v_unit_id := nullif(v_line ->> 'unit_id', '')::uuid;
    v_quantity := nullif(v_line ->> 'quantity', '')::numeric;

    -- create_siv checks item existence (not the is_active flag); mirror it exactly.
    if v_item_id is null or not exists (
      select 1 from public.items i where i.id = v_item_id
    ) then
      raise exception 'Every line needs an item' using errcode = '23514';
    end if;
    if v_unit_id is null then
      raise exception 'Every line needs a unit' using errcode = '23514';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Every line needs a quantity greater than zero' using errcode = '23514';
    end if;

    perform public.stock_unit_factor(v_item_id, v_unit_id);

    insert into public.siv_lines (siv_id, item_id, unit_id, quantity)
    values (p_siv_id, v_item_id, v_unit_id, v_quantity);

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A SIV needs at least one line' using errcode = '23514';
  end if;

  -- siv_number, requested_by, created_at, posted_by and posted_at are immutable.
  update public.sivs
     set issue_date = p_issue_date,
         source_location_id = p_source_location_id,
         destination_location_id = p_destination_location_id,
         notes = nullif(btrim(coalesce(p_notes, '')), '')
   where id = p_siv_id
     and posted_at is null;
  if not found then
    raise exception 'SIV % changed while it was being edited', p_siv_id using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.update_siv(uuid, date, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.update_siv(uuid, date, uuid, uuid, text, jsonb) to authenticated;

drop function if exists public.delete_siv(uuid);

create or replace function public.delete_siv(p_siv_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_posted_at timestamptz;
begin
  if not public.can_post_siv() then
    raise exception 'You do not have permission to delete store issue vouchers'
      using errcode = '42501';
  end if;

  select s.posted_at into v_posted_at
  from public.sivs s
  where s.id = p_siv_id
  for update;
  if not found then
    raise exception 'SIV % not found', p_siv_id using errcode = 'P0002';
  end if;
  if v_posted_at is not null then
    raise exception 'Only an unposted store issue voucher can be deleted'
      using errcode = '23514';
  end if;
  if exists (
    select 1 from public.stock_transactions st
    where st.reference_type = 'siv' and st.reference_id = p_siv_id
  ) then
    raise exception 'SIV % is already linked to the stock ledger', p_siv_id
      using errcode = '23514';
  end if;

  delete from public.siv_lines where siv_id = p_siv_id;

  delete from public.sivs where id = p_siv_id and posted_at is null;
  if not found then
    raise exception 'SIV % changed while it was being deleted', p_siv_id using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.delete_siv(uuid) from public, anon;
grant execute on function public.delete_siv(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Inventory count (create in 0008: create_inventory_count, can_manage_inventory)
--    system_quantity is re-snapshotted from the current ledger for every line.
-- ---------------------------------------------------------------------------
drop function if exists public.update_inventory_count(uuid, date, uuid, text, text, jsonb);

create or replace function public.update_inventory_count(
  p_count_id uuid,
  p_count_date date,
  p_location_id uuid,
  p_counter_name text,
  p_notes text,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.inventory_document_status;
  v_line jsonb;
  v_item_id uuid;
  v_physical numeric;
  v_system numeric;
  v_seen uuid[] := '{}';
  v_count integer := 0;
begin
  if not public.can_manage_inventory() then
    raise exception 'You do not have permission to edit inventory counts'
      using errcode = '42501';
  end if;

  select c.status into v_status
  from public.inventory_counts c
  where c.id = p_count_id
  for update;
  if not found then
    raise exception 'Inventory count % not found', p_count_id using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft inventory count can be edited' using errcode = '23514';
  end if;

  if p_count_date is null then
    raise exception 'A count date is required' using errcode = '23514';
  end if;
  if nullif(btrim(p_counter_name), '') is null then
    raise exception 'A counter name is required' using errcode = '23514';
  end if;
  if length(btrim(p_counter_name)) > 120 then
    raise exception 'Use 120 characters or fewer for the counter name' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.stock_locations l where l.id = p_location_id and l.is_active
  ) then
    raise exception 'Choose an active stock location' using errcode = '23514';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A count sheet needs at least one line' using errcode = '23514';
  end if;

  delete from public.inventory_count_lines where count_id = p_count_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_item_id := nullif(v_line ->> 'item_id', '')::uuid;
    v_physical := nullif(v_line ->> 'physical_quantity', '')::numeric;

    if v_item_id is null or not exists (
      select 1 from public.items i where i.id = v_item_id and i.is_active
    ) then
      raise exception 'Every line needs an active item' using errcode = '23514';
    end if;
    if v_physical is null or v_physical < 0 then
      raise exception 'Every line needs a physical quantity of zero or more'
        using errcode = '23514';
    end if;
    if v_item_id = any (v_seen) then
      raise exception 'Each item can appear only once on a count sheet' using errcode = '23514';
    end if;
    v_seen := array_append(v_seen, v_item_id);

    select round(coalesce(sum(
      case when t.direction = 'in' then t.quantity else -t.quantity end
    ), 0), 6)
      into v_system
    from public.stock_transactions t
    where t.item_id = v_item_id
      and t.location_id = p_location_id;

    insert into public.inventory_count_lines (
      count_id, item_id, system_quantity, physical_quantity
    )
    values (p_count_id, v_item_id, v_system, v_physical);

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A count sheet needs at least one line' using errcode = '23514';
  end if;

  -- count_number, created_by, created_at, submitted_at, decision, posting
  -- metadata and status are immutable; only draft header fields are written.
  update public.inventory_counts
     set count_date = p_count_date,
         location_id = p_location_id,
         counter_name = btrim(p_counter_name),
         notes = nullif(btrim(coalesce(p_notes, '')), ''),
         updated_at = now()
   where id = p_count_id
     and status = 'draft';
  if not found then
    raise exception 'Inventory count % changed while it was being edited', p_count_id
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.update_inventory_count(uuid, date, uuid, text, text, jsonb) from public, anon;
grant execute on function public.update_inventory_count(uuid, date, uuid, text, text, jsonb) to authenticated;

drop function if exists public.delete_inventory_count(uuid);

create or replace function public.delete_inventory_count(p_count_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.inventory_document_status;
begin
  if not public.can_manage_inventory() then
    raise exception 'You do not have permission to delete inventory counts'
      using errcode = '42501';
  end if;

  select c.status into v_status
  from public.inventory_counts c
  where c.id = p_count_id
  for update;
  if not found then
    raise exception 'Inventory count % not found', p_count_id using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft inventory count can be deleted' using errcode = '23514';
  end if;

  delete from public.inventory_count_lines where count_id = p_count_id;

  delete from public.inventory_counts where id = p_count_id and status = 'draft';
  if not found then
    raise exception 'Inventory count % changed while it was being deleted', p_count_id
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.delete_inventory_count(uuid) from public, anon;
grant execute on function public.delete_inventory_count(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Inventory adjustment / waste (shared table; create in 0008:
--    create_inventory_adjustment, can_manage_inventory).
--    One pair of RPCs only: kind is read from the stored row and cannot change.
-- ---------------------------------------------------------------------------
drop function if exists public.update_inventory_adjustment(uuid, date, uuid, text, text, jsonb);

create or replace function public.update_inventory_adjustment(
  p_adjustment_id uuid,
  p_adjustment_date date,
  p_location_id uuid,
  p_reason text,
  p_notes text,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.inventory_document_status;
  v_kind public.stock_adjustment_kind;
  v_line jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_direction public.stock_direction;
  v_quantity numeric;
  v_unit_cost numeric;
  v_count integer := 0;
begin
  if not public.can_manage_inventory() then
    raise exception 'You do not have permission to edit inventory adjustments or waste'
      using errcode = '42501';
  end if;

  select a.status, a.kind into v_status, v_kind
  from public.inventory_adjustments a
  where a.id = p_adjustment_id
  for update;
  if not found then
    raise exception 'Inventory document % not found', p_adjustment_id using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft inventory document can be edited' using errcode = '23514';
  end if;

  if p_adjustment_date is null then
    raise exception 'A document date is required' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.stock_locations l where l.id = p_location_id and l.is_active
  ) then
    raise exception 'Choose an active stock location' using errcode = '23514';
  end if;

  -- Reason must remain valid for the stored kind; kind itself is not editable.
  if v_kind = 'adjustment' and p_reason not in (
    'damage', 'spoilage', 'theft', 'expired', 'operational_loss'
  ) then
    raise exception 'Choose an adjustment reason' using errcode = '23514';
  end if;
  if v_kind = 'waste' and p_reason not in (
    'kitchen_waste', 'burnt_food', 'returned_food', 'expired', 'spoilage'
  ) then
    raise exception 'Choose a waste reason' using errcode = '23514';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A document needs at least one line' using errcode = '23514';
  end if;

  delete from public.inventory_adjustment_lines where adjustment_id = p_adjustment_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_item_id := nullif(v_line ->> 'item_id', '')::uuid;
    v_unit_id := nullif(v_line ->> 'unit_id', '')::uuid;
    v_direction := nullif(v_line ->> 'direction', '')::public.stock_direction;
    v_quantity := nullif(v_line ->> 'quantity', '')::numeric;
    v_unit_cost := nullif(v_line ->> 'unit_cost', '')::numeric;

    if v_item_id is null or not exists (
      select 1 from public.items i where i.id = v_item_id and i.is_active
    ) then
      raise exception 'Every line needs an active item' using errcode = '23514';
    end if;
    if v_unit_id is null then
      raise exception 'Every line needs a unit' using errcode = '23514';
    end if;
    if v_direction is null then
      raise exception 'Every line needs a direction' using errcode = '23514';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Every line needs a quantity greater than zero' using errcode = '23514';
    end if;
    if v_direction = 'in' and (v_unit_cost is null or v_unit_cost <= 0) then
      raise exception 'An increase needs a unit cost greater than zero' using errcode = '23514';
    end if;
    if v_direction = 'out' then
      v_unit_cost := null;
    end if;
    if v_kind = 'waste' and v_direction <> 'out' then
      raise exception 'Waste can only decrease stock' using errcode = '23514';
    end if;

    perform public.stock_unit_factor(v_item_id, v_unit_id);

    insert into public.inventory_adjustment_lines (
      adjustment_id, item_id, unit_id, direction, quantity, unit_cost
    )
    values (p_adjustment_id, v_item_id, v_unit_id, v_direction, v_quantity,
      case when v_direction = 'in' then round(v_unit_cost, 6) else null end);

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A document needs at least one line' using errcode = '23514';
  end if;

  -- adjustment_number, kind, created_by, created_at, submitted_at, decision,
  -- posting metadata and status are immutable.
  update public.inventory_adjustments
     set adjustment_date = p_adjustment_date,
         location_id = p_location_id,
         reason = p_reason,
         notes = nullif(btrim(coalesce(p_notes, '')), ''),
         updated_at = now()
   where id = p_adjustment_id
     and status = 'draft';
  if not found then
    raise exception 'Inventory document % changed while it was being edited', p_adjustment_id
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.update_inventory_adjustment(uuid, date, uuid, text, text, jsonb) from public, anon;
grant execute on function public.update_inventory_adjustment(uuid, date, uuid, text, text, jsonb) to authenticated;

drop function if exists public.delete_inventory_adjustment(uuid);

create or replace function public.delete_inventory_adjustment(p_adjustment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.inventory_document_status;
begin
  if not public.can_manage_inventory() then
    raise exception 'You do not have permission to delete inventory adjustments or waste'
      using errcode = '42501';
  end if;

  select a.status into v_status
  from public.inventory_adjustments a
  where a.id = p_adjustment_id
  for update;
  if not found then
    raise exception 'Inventory document % not found', p_adjustment_id using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft inventory document can be deleted' using errcode = '23514';
  end if;

  delete from public.inventory_adjustment_lines where adjustment_id = p_adjustment_id;

  delete from public.inventory_adjustments where id = p_adjustment_id and status = 'draft';
  if not found then
    raise exception 'Inventory document % changed while it was being deleted', p_adjustment_id
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.delete_inventory_adjustment(uuid) from public, anon;
grant execute on function public.delete_inventory_adjustment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Production order (create in 0009: create_production_order, can_manage_production)
--    The line parameter is named p_inputs to match the create RPC exactly.
-- ---------------------------------------------------------------------------
drop function if exists public.update_production_order(uuid, date, uuid, uuid, uuid, numeric, numeric, text, text, jsonb);

create or replace function public.update_production_order(
  p_production_id uuid,
  p_production_date date,
  p_location_id uuid,
  p_output_item_id uuid,
  p_output_unit_id uuid,
  p_output_quantity numeric,
  p_expected_output_quantity numeric,
  p_responsible_name text,
  p_notes text,
  p_inputs jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.production_status;
  v_line jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_quantity numeric;
  v_factor numeric(18, 6);
  v_output_base_quantity numeric(18, 6);
  v_item_ids uuid[] := '{}';
  v_count integer := 0;
begin
  if not public.can_manage_production() then
    raise exception 'You do not have permission to edit production orders'
      using errcode = '42501';
  end if;

  select po.status into v_status
  from public.production_orders po
  where po.id = p_production_id
  for update;
  if not found then
    raise exception 'Production order % does not exist', p_production_id using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft production order can be edited' using errcode = '23514';
  end if;

  if p_production_date is null then
    raise exception 'A production date is required' using errcode = '23514';
  end if;
  if nullif(btrim(p_responsible_name), '') is null then
    raise exception 'A responsible user is required' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.stock_locations l where l.id = p_location_id and l.is_active
  ) then
    raise exception 'Choose an active stock location' using errcode = '23514';
  end if;
  if p_output_item_id is null or not exists (
    select 1 from public.items i where i.id = p_output_item_id and i.is_active
  ) then
    raise exception 'Choose an active output item' using errcode = '23514';
  end if;
  if p_output_unit_id is null then
    raise exception 'Choose an output unit' using errcode = '23514';
  end if;
  if p_output_quantity is null or p_output_quantity <= 0 then
    raise exception 'The output quantity must be greater than zero' using errcode = '23514';
  end if;
  if p_expected_output_quantity is not null and p_expected_output_quantity <= 0 then
    raise exception 'The expected output must be greater than zero' using errcode = '23514';
  end if;

  v_factor := public.stock_unit_factor(p_output_item_id, p_output_unit_id);
  v_output_base_quantity := round(p_output_quantity * v_factor, 6);
  if v_output_base_quantity <= 0 then
    raise exception 'The converted output quantity must be greater than zero'
      using errcode = '23514';
  end if;

  if p_inputs is null or jsonb_typeof(p_inputs) <> 'array' or jsonb_array_length(p_inputs) = 0 then
    raise exception 'A production order needs at least one input' using errcode = '23514';
  end if;

  delete from public.production_inputs where production_id = p_production_id;

  for v_line in select * from jsonb_array_elements(p_inputs)
  loop
    v_item_id := nullif(v_line ->> 'item_id', '')::uuid;
    v_unit_id := nullif(v_line ->> 'unit_id', '')::uuid;
    v_quantity := nullif(v_line ->> 'quantity', '')::numeric;

    if v_item_id is null or not exists (
      select 1 from public.items i where i.id = v_item_id and i.is_active
    ) then
      raise exception 'Every input needs an active item' using errcode = '23514';
    end if;
    if v_unit_id is null then
      raise exception 'Every input needs a unit' using errcode = '23514';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Every input needs a quantity greater than zero' using errcode = '23514';
    end if;
    if v_item_id = any (v_item_ids) then
      raise exception 'An input item can only appear once' using errcode = '23514';
    end if;

    v_factor := public.stock_unit_factor(v_item_id, v_unit_id);
    v_item_ids := array_append(v_item_ids, v_item_id);

    insert into public.production_inputs (
      production_id, item_id, unit_id, quantity, base_quantity
    )
    values (p_production_id, v_item_id, v_unit_id, v_quantity, round(v_quantity * v_factor, 6));

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A production order needs at least one input' using errcode = '23514';
  end if;

  -- order_number, created_by, created_at, posted_by, posted_at, status and
  -- generated yield_percentage are immutable.
  update public.production_orders
     set production_date = p_production_date,
         location_id = p_location_id,
         output_item_id = p_output_item_id,
         output_unit_id = p_output_unit_id,
         output_quantity = p_output_quantity,
         output_base_quantity = v_output_base_quantity,
         expected_output_quantity = p_expected_output_quantity,
         responsible_name = btrim(p_responsible_name),
         notes = nullif(btrim(coalesce(p_notes, '')), ''),
         updated_at = now()
   where id = p_production_id
     and status = 'draft';
  if not found then
    raise exception 'Production order % changed while it was being edited', p_production_id
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.update_production_order(uuid, date, uuid, uuid, uuid, numeric, numeric, text, text, jsonb) from public, anon;
grant execute on function public.update_production_order(uuid, date, uuid, uuid, uuid, numeric, numeric, text, text, jsonb) to authenticated;

drop function if exists public.delete_production_order(uuid);

create or replace function public.delete_production_order(p_production_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.production_status;
begin
  if not public.can_manage_production() then
    raise exception 'You do not have permission to delete production orders'
      using errcode = '42501';
  end if;

  select po.status into v_status
  from public.production_orders po
  where po.id = p_production_id
  for update;
  if not found then
    raise exception 'Production order % does not exist', p_production_id using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft production order can be deleted' using errcode = '23514';
  end if;

  delete from public.production_inputs where production_id = p_production_id;

  delete from public.production_orders where id = p_production_id and status = 'draft';
  if not found then
    raise exception 'Production order % changed while it was being deleted', p_production_id
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.delete_production_order(uuid) from public, anon;
grant execute on function public.delete_production_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Ensure update_recipe keeps the intended grants (do not recreate it).
-- ---------------------------------------------------------------------------
revoke all on function public.update_recipe(uuid, text, text, text) from public, anon;
grant execute on function public.update_recipe(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
