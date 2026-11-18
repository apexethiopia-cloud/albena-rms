-- Albena RMS — Phase 4 GRN ↔ PO linkage and receipt variance (GRN-04)
-- Apply after 20261118000600_purchase_requests_orders.sql.
-- Idempotent: safe to re-run.
--
-- GRN-04: a GRN can optionally be linked to one purchase order, and each line
-- can point at one purchase order line. Ordered vs received quantities are
-- derived from posted GRNs only; nothing is written back onto the order, so the
-- order lines stay as agreed and every receipt remains traceable.
--
-- Shortages and over-receipts are recorded for review through the
-- purchase_order_receipts view (`pending`, `partial`, `complete`, `over`).
-- Over-receipts are NOT blocked: the SRS requires them to be recorded for
-- review but does not define a tolerance, and CON-07 forbids inventing one.
-- A GRN that is still a draft does not count until it is posted.

-- ---------------------------------------------------------------------------
-- 1. Link columns
-- ---------------------------------------------------------------------------
alter table public.grns
  add column if not exists po_id uuid
  references public.purchase_orders (id) on delete restrict;

alter table public.grn_lines
  add column if not exists po_line_id uuid
  references public.purchase_order_lines (id) on delete restrict;

create index if not exists grns_po_idx on public.grns (po_id);
create index if not exists grn_lines_po_line_idx on public.grn_lines (po_line_id);

-- ---------------------------------------------------------------------------
-- 2. Recreate create_grn with the optional purchase order
--    The old 7-argument signature is dropped so PostgREST has exactly one
--    function to resolve.
-- ---------------------------------------------------------------------------
drop function if exists public.create_grn(text, uuid, text, date, uuid, text, jsonb);

create or replace function public.create_grn(
  p_grn_number text,
  p_supplier_id uuid,
  p_invoice_number text,
  p_received_date date,
  p_location_id uuid,
  p_notes text,
  p_lines jsonb,
  p_po_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grn_id uuid;
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
    raise exception 'You do not have permission to create goods receiving notes'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_grn_number), '') is null then
    raise exception 'A GRN number is required' using errcode = '23514';
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

  if p_po_id is not null then
    select po.supplier_id
      into v_po_supplier_id
    from public.purchase_orders po
    where po.id = p_po_id;

    if v_po_supplier_id is null then
      raise exception 'Choose an existing purchase order' using errcode = '23514';
    end if;
    if v_po_supplier_id <> p_supplier_id then
      raise exception 'The purchase order belongs to a different supplier' using errcode = '23514';
    end if;
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A GRN needs at least one line' using errcode = '23514';
  end if;

  insert into public.grns (
    grn_number, supplier_id, invoice_number, received_date, location_id, notes, po_id, created_by
  )
  values (
    upper(btrim(p_grn_number)),
    p_supplier_id,
    btrim(p_invoice_number),
    p_received_date,
    p_location_id,
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_po_id,
    auth.uid()
  )
  returning id into v_grn_id;

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

    -- Rejects a unit with no conversion to this item's base unit.
    perform public.stock_unit_factor(v_item_id, v_unit_id);

    if v_po_line_id is not null then
      if p_po_id is null then
        raise exception 'Link the GRN to a purchase order before adding its lines'
          using errcode = '23514';
      end if;

      select pol.item_id
        into v_po_line_item_id
      from public.purchase_order_lines pol
      where pol.id = v_po_line_id
        and pol.po_id = p_po_id;

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
    values (v_grn_id, v_item_id, v_unit_id, v_quantity, round(v_unit_cost, 2), v_po_line_id);

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A GRN needs at least one line' using errcode = '23514';
  end if;

  return v_grn_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Ordered vs received per purchase order line (GRN-04)
--    security_invoker keeps RLS in force for the caller.
-- ---------------------------------------------------------------------------
create or replace view public.purchase_order_receipts
with (security_invoker = true)
as
with ordered as (
  select
    pol.id as po_line_id,
    pol.po_id,
    pol.item_id,
    pol.unit_id,
    pol.quantity,
    pol.unit_cost,
    round(pol.quantity * public.stock_unit_factor(pol.item_id, pol.unit_id), 6)
      as ordered_base_quantity
  from public.purchase_order_lines pol
), received as (
  select
    gl.po_line_id,
    round(sum(gl.base_quantity), 6) as received_base_quantity
  from public.grn_lines gl
  join public.grns g on g.id = gl.grn_id
  where g.posted_at is not null
    and gl.po_line_id is not null
    and gl.base_quantity is not null
  group by gl.po_line_id
)
select
  o.po_id,
  po.po_number,
  po.status as po_status,
  o.po_line_id,
  o.item_id,
  i.code as item_code,
  i.name as item_name,
  o.unit_id as ordered_unit_id,
  u.code as ordered_unit_code,
  o.quantity as ordered_quantity,
  o.unit_cost,
  o.ordered_base_quantity,
  coalesce(r.received_base_quantity, 0) as received_base_quantity,
  greatest(o.ordered_base_quantity - coalesce(r.received_base_quantity, 0), 0)
    as outstanding_base_quantity,
  case
    when coalesce(r.received_base_quantity, 0) = 0 then 'pending'
    when r.received_base_quantity < o.ordered_base_quantity then 'partial'
    when r.received_base_quantity = o.ordered_base_quantity then 'complete'
    else 'over'
  end as receipt_status
from ordered o
join public.purchase_orders po on po.id = o.po_id
join public.items i on i.id = o.item_id
join public.units u on u.id = o.unit_id
left join received r on r.po_line_id = o.po_line_id;

-- ---------------------------------------------------------------------------
-- 4. Function and view privileges
-- ---------------------------------------------------------------------------
revoke all on function public.create_grn(text, uuid, text, date, uuid, text, jsonb, uuid) from public;
grant execute on function public.create_grn(text, uuid, text, date, uuid, text, jsonb, uuid) to authenticated;

revoke all on public.purchase_order_receipts from anon, authenticated;
grant select on public.purchase_order_receipts to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Comments
-- ---------------------------------------------------------------------------
comment on column public.grns.po_id is 'Optional purchase order this delivery fulfils (GRN-04).';
comment on column public.grn_lines.po_line_id is 'Optional purchase order line this receipt applies to; the item must match (GRN-04).';
comment on view public.purchase_order_receipts is 'Derived ordered/received/outstanding quantities and receipt status per purchase order line, from posted GRNs only (GRN-04).';
comment on function public.create_grn(text, uuid, text, date, uuid, text, jsonb, uuid) is 'Creates a draft GRN and lines atomically, optionally linked to one purchase order (GRN-01..04). Role-gated; OD-06 approval steps are not implemented yet.';
