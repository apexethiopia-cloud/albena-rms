-- 0011: receipt footer hotfix and Phase 5/6 function privileges
--
-- 1. The version of 20261118001000 applied on the live project predates the
--    receipt_footer snapshot, so public.receipts has no receipt_footer column
--    and close_order() does not copy the footer from business_settings.
--    The block below only adds the column when it is missing and re-creates
--    close_order() with the footer column, so it is safe to run more than once.
-- 2. PostgreSQL grants EXECUTE on new functions to PUBLIC by default. The
--    earlier migrations revoked only from PUBLIC, which left helper functions
--    such as occupy_table(), free_table_if_idle(), next_document_number() and
--    insert_recipe_version_lines() callable with the anonymous key. Revoke
--    those privileges explicitly from anon; authenticated keeps its grants.

-- ---------------------------------------------------------------------------
-- 1. Receipt footer (RCT-01, RCT-03)
-- ---------------------------------------------------------------------------
alter table public.receipts
  add column if not exists receipt_footer text;

create or replace function public.close_order(
  p_order_id uuid,
  p_expected_revision integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_settings public.business_settings%rowtype;
  v_total numeric(14, 2);
  v_vat numeric(14, 2);
  v_subtotal numeric(14, 2);
  v_line_count integer;
  v_table_code text;
  v_receipt_id uuid;
  v_receipt_number text;
begin
  if not public.can_close_orders() then
    raise exception 'You do not have permission to close orders' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'That order no longer exists' using errcode = 'P0002';
  end if;

  if v_order.status = 'closed' then
    raise exception 'This order is already closed' using errcode = '23505';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'A cancelled order cannot be closed' using errcode = '23514';
  end if;
  if v_order.revision <> p_expected_revision then
    raise exception 'This order was changed by someone else. Refresh and try again.'
      using errcode = '40001';
  end if;
  if v_order.status <> 'served' then
    raise exception 'Serve the order before closing it' using errcode = '23514';
  end if;

  select coalesce(sum(line_total), 0), count(*)
  into v_total, v_line_count
  from public.order_lines
  where order_id = p_order_id;

  if v_line_count = 0 then
    raise exception 'An order needs at least one line before it can be closed'
      using errcode = '23514';
  end if;

  select * into v_settings from public.business_settings where id = true;
  if not found then
    insert into public.business_settings (id) values (true) returning * into v_settings;
  end if;

  v_vat := round(v_total * v_settings.vat_rate / (100 + v_settings.vat_rate), 2);
  v_subtotal := round(v_total - v_vat, 2);

  if v_order.table_id is not null then
    select code into v_table_code from public.restaurant_tables where id = v_order.table_id;
  end if;

  v_receipt_number := public.next_document_number(v_order.outlet_id, 'receipt', '');

  insert into public.receipts (
    receipt_number, order_id, outlet_id, issued_by, business_name, business_tin,
    business_address, business_phone, vat_rate, subtotal, vat_amount, total,
    table_code, waiter_name, receipt_footer, line_count
  )
  values (
    v_receipt_number,
    p_order_id,
    v_order.outlet_id,
    auth.uid(),
    v_settings.business_name,
    v_settings.tin,
    v_settings.address,
    v_settings.phone,
    v_settings.vat_rate,
    v_subtotal,
    v_vat,
    v_total,
    v_table_code,
    v_order.waiter_name,
    v_settings.receipt_footer,
    v_line_count
  )
  returning id into v_receipt_id;

  update public.orders
  set status = 'closed',
      subtotal = v_subtotal,
      vat_amount = v_vat,
      total = v_total,
      closed_at = now(),
      closed_by = auth.uid(),
      revision = revision + 1,
      updated_at = now()
  where id = p_order_id;

  if v_order.table_id is not null then
    perform public.free_table_if_idle(v_order.table_id);
  end if;

  return v_receipt_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Remove anonymous EXECUTE from Phase 5 helpers and RPCs
-- ---------------------------------------------------------------------------
-- post_stock_in/post_stock_out are internal ledger helpers (0008). They have
-- no role gate of their own and must never be reachable with the anon key.
revoke execute on function public.post_stock_in(
  public.stock_transaction_type, uuid, uuid, numeric, numeric, text, uuid, uuid, text
) from anon;
revoke execute on function public.post_stock_out(
  public.stock_transaction_type, uuid, uuid, numeric, text, uuid, uuid, text
) from anon;


revoke execute on function public.can_manage_recipes() from anon;
revoke execute on function public.can_manage_production() from anon;
revoke execute on function public.insert_recipe_version_lines(uuid, jsonb) from anon;
revoke execute on function public.create_recipe(text, text, text, text, numeric, numeric, jsonb) from anon;
revoke execute on function public.create_recipe_version(uuid, text, numeric, numeric, jsonb) from anon;
revoke execute on function public.update_recipe(uuid, text, text, text) from anon;
revoke execute on function public.publish_recipe_version(uuid) from anon;
revoke execute on function public.create_production_order(
  text, date, uuid, uuid, uuid, numeric, numeric, text, text, jsonb
) from anon;
revoke execute on function public.post_production_order(uuid) from anon;

-- ---------------------------------------------------------------------------
-- 3. Remove anonymous EXECUTE from Phase 6 helpers and RPCs
-- ---------------------------------------------------------------------------
revoke execute on function public.business_today() from anon;
revoke execute on function public.next_document_number(uuid, text, text) from anon;
revoke execute on function public.occupy_table(uuid) from anon;
revoke execute on function public.free_table_if_idle(uuid) from anon;
revoke execute on function public.can_manage_menu() from anon;
revoke execute on function public.can_manage_table_layout() from anon;
revoke execute on function public.can_set_table_status() from anon;
revoke execute on function public.can_manage_reservations() from anon;
revoke execute on function public.can_take_orders() from anon;
revoke execute on function public.can_update_kitchen_status() from anon;
revoke execute on function public.can_close_orders() from anon;
revoke execute on function public.can_manage_business_settings() from anon;
revoke execute on function public.set_table_status(uuid, public.table_status) from anon;
revoke execute on function public.create_reservation(uuid, text, text, date, time, integer, uuid, text) from anon;
revoke execute on function public.assign_reservation_table(uuid, uuid) from anon;
revoke execute on function public.set_reservation_status(uuid, public.reservation_status) from anon;
revoke execute on function public.create_order(uuid, uuid, text, jsonb) from anon;
revoke execute on function public.update_order(uuid, integer, uuid, text, jsonb) from anon;
revoke execute on function public.set_order_status(uuid, public.order_status, integer) from anon;
revoke execute on function public.cancel_order(uuid, text, integer) from anon;
revoke execute on function public.transfer_order(uuid, uuid, integer) from anon;
revoke execute on function public.split_order(uuid, jsonb, uuid, integer) from anon;
revoke execute on function public.merge_orders(uuid, uuid, integer, integer) from anon;
revoke execute on function public.close_order(uuid, integer) from anon;

-- Make the new column visible to PostgREST immediately.
notify pgrst, 'reload schema';
