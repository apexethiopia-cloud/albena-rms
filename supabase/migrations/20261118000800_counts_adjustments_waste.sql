-- Albena RMS — Phase 4 inventory counts, adjustments and waste
-- Apply after 20261118000700_grn_po_linkage.sql.
-- Idempotent: safe to re-run.
--
-- CNT-01..05: count sheets with a location and counter, system/physical
--            quantities and calculated variance, review and approval before
--            posting, preserved count and approval history.
-- ADJ-01..03: positive and negative adjustments with an SRS reason, approval,
--            and posting to the append-only ledger (never a balance update).
-- WST-01..04: waste records with item, quantity, location, date, user, reason
--            and FIFO cost, posted as an inventory decrease.
-- STK-04:     approved count variances post as adjustment transactions.
-- INV-06:     reorder status derived from item reorder levels and the ledger.
--
-- OD-06 (approval thresholds and separation of duties) is still open. This
-- migration therefore uses the role table only: Storekeepers, General Managers
-- and System Administrators manage inventory documents; approval is limited to
-- General Managers and System Administrators, who hold approval authority in
-- the SRS role table. No monetary thresholds or no-self-approval rule are
-- invented; every action records who did it and when.

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.stock_adjustment_kind as enum ('adjustment', 'waste');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.inventory_document_status as enum (
    'draft',
    'submitted',
    'approved',
    'rejected',
    'posted'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Adjustments and waste (ADJ-01..03, WST-01..04)
--    One table holds both document kinds so the approval and posting logic is
--    identical. The ledger transaction type still distinguishes them.
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_adjustments (
  id               uuid primary key default gen_random_uuid(),
  adjustment_number text not null unique,
  kind             public.stock_adjustment_kind not null,
  adjustment_date  date not null,
  location_id      uuid not null references public.stock_locations (id) on delete restrict,
  reason           text not null,
  notes            text,
  status           public.inventory_document_status not null default 'draft',
  created_by       uuid references auth.users (id) on delete restrict,
  created_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  decided_by       uuid references auth.users (id) on delete restrict,
  decided_by_name  text,
  decided_at       timestamptz,
  decision_comment text,
  posted_by        uuid references auth.users (id) on delete restrict,
  posted_at        timestamptz,
  updated_at       timestamptz not null default now(),
  constraint inventory_adjustments_number_not_blank check (btrim(adjustment_number) <> ''),
  constraint inventory_adjustments_reason_matches_kind check (
    (kind = 'adjustment' and reason in (
      'damage', 'spoilage', 'theft', 'expired', 'operational_loss'
    ))
    or (kind = 'waste' and reason in (
      'kitchen_waste', 'burnt_food', 'returned_food', 'expired', 'spoilage'
    ))
  )
);

create table if not exists public.inventory_adjustment_lines (
  id               uuid primary key default gen_random_uuid(),
  adjustment_id    uuid not null references public.inventory_adjustments (id) on delete cascade,
  item_id          uuid not null references public.items (id) on delete restrict,
  unit_id          uuid not null references public.units (id) on delete restrict,
  direction        public.stock_direction not null,
  quantity         numeric(18, 6) not null,
  unit_cost        numeric(18, 6),
  base_quantity    numeric(18, 6),
  posted_cost      numeric(18, 6),
  created_at       timestamptz not null default now(),
  constraint inventory_adjustment_lines_quantity_positive check (quantity > 0),
  constraint inventory_adjustment_lines_unit_cost_positive check (unit_cost is null or unit_cost > 0)
);

create index if not exists inventory_adjustments_created_at_idx
  on public.inventory_adjustments (created_at desc);
create index if not exists inventory_adjustments_kind_status_idx
  on public.inventory_adjustments (kind, status, created_at desc);
create index if not exists inventory_adjustment_lines_adjustment_idx
  on public.inventory_adjustment_lines (adjustment_id);

-- ---------------------------------------------------------------------------
-- 3. Inventory counts (CNT-01..05, STK-04)
--    system_quantity is a snapshot taken when the sheet is created, used for
--    the variance report. Posting reconciles to the balance at posting time so
--    the ledger ends exactly at the physical quantity.
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_counts (
  id               uuid primary key default gen_random_uuid(),
  count_number     text not null unique,
  count_date       date not null,
  location_id      uuid not null references public.stock_locations (id) on delete restrict,
  counter_name     text not null,
  notes            text,
  status           public.inventory_document_status not null default 'draft',
  created_by       uuid references auth.users (id) on delete restrict,
  created_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  decided_by       uuid references auth.users (id) on delete restrict,
  decided_by_name  text,
  decided_at       timestamptz,
  decision_comment text,
  posted_by        uuid references auth.users (id) on delete restrict,
  posted_at        timestamptz,
  updated_at       timestamptz not null default now(),
  constraint inventory_counts_number_not_blank check (btrim(count_number) <> ''),
  constraint inventory_counts_counter_not_blank check (btrim(counter_name) <> '')
);

create table if not exists public.inventory_count_lines (
  id                uuid primary key default gen_random_uuid(),
  count_id          uuid not null references public.inventory_counts (id) on delete cascade,
  item_id           uuid not null references public.items (id) on delete restrict,
  system_quantity   numeric(18, 6) not null,
  physical_quantity numeric(18, 6) not null,
  variance_quantity numeric(18, 6) generated always as (round(physical_quantity - system_quantity, 6)) stored,
  posted_quantity   numeric(18, 6),
  posted_cost       numeric(18, 6),
  created_at        timestamptz not null default now(),
  constraint inventory_count_lines_physical_non_negative check (physical_quantity >= 0),
  constraint inventory_count_lines_system_non_negative check (system_quantity >= 0),
  constraint inventory_count_lines_item_once unique (count_id, item_id)
);

create index if not exists inventory_counts_created_at_idx
  on public.inventory_counts (created_at desc);
create index if not exists inventory_counts_status_idx
  on public.inventory_counts (status, created_at desc);
create index if not exists inventory_count_lines_count_idx
  on public.inventory_count_lines (count_id);

-- ---------------------------------------------------------------------------
-- 4. Derived views
-- ---------------------------------------------------------------------------
-- INV-06: reorder status per active item, comparing total on-hand stock across
-- locations with the item-level reorder level (INV-01, INV-04).
create or replace view public.stock_reorder_status
with (security_invoker = true)
as
select
  i.id as item_id,
  i.code as item_code,
  i.name as item_name,
  bu.code as base_unit_code,
  i.reorder_level,
  round(coalesce(sum(case when t.direction = 'in' then t.quantity else -t.quantity end), 0), 6) as on_hand,
  round(
    greatest(
      i.reorder_level
        - coalesce(sum(case when t.direction = 'in' then t.quantity else -t.quantity end), 0),
      0
    ),
    6
  ) as shortage,
  coalesce(sum(case when t.direction = 'in' then t.quantity else -t.quantity end), 0)
    < i.reorder_level as is_low
from public.items i
join public.units bu on bu.id = i.base_unit_id
left join public.stock_transactions t on t.item_id = i.id
where i.is_active
  and i.reorder_level > 0
group by i.id, i.code, i.name, bu.code, i.reorder_level;

-- CNT-04: variance report lines, including the quantity actually posted.
create or replace view public.inventory_count_variances
with (security_invoker = true)
as
select
  c.id as count_id,
  c.count_number,
  c.count_date,
  c.location_id,
  l.name as location_name,
  c.status,
  cl.id as line_id,
  cl.item_id,
  i.code as item_code,
  i.name as item_name,
  bu.code as base_unit_code,
  cl.system_quantity,
  cl.physical_quantity,
  cl.variance_quantity,
  cl.posted_quantity,
  cl.posted_cost
from public.inventory_counts c
join public.stock_locations l on l.id = c.location_id
join public.inventory_count_lines cl on cl.count_id = c.id
join public.items i on i.id = cl.item_id
join public.units bu on bu.id = i.base_unit_id;

-- ---------------------------------------------------------------------------
-- 5. Authorization helpers
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_inventory()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
    and (
      public.is_admin()
      or public.has_role('general_manager')
      or public.has_role('storekeeper')
    );
$$;

create or replace function public.can_approve_inventory()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
    and (
      public.is_admin()
      or public.has_role('general_manager')
    );
$$;

create or replace function public.can_post_inventory()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
    and (
      public.is_admin()
      or public.has_role('general_manager')
      or public.has_role('storekeeper')
    );
$$;

-- ---------------------------------------------------------------------------
-- 6. Ledger helpers shared by adjustment and count posting
--    Internal only: privileges are revoked below, callers are the
--    SECURITY DEFINER posting functions.
-- ---------------------------------------------------------------------------
create or replace function public.post_stock_in(
  p_transaction_type public.stock_transaction_type,
  p_item_id uuid,
  p_location_id uuid,
  p_base_quantity numeric,
  p_base_unit_cost numeric,
  p_reference_type text,
  p_reference_id uuid,
  p_reference_line_id uuid,
  p_reference_number text
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction_id uuid;
  v_total_cost numeric(18, 6);
  v_unit_cost numeric(18, 6);
begin
  if p_base_quantity is null or p_base_quantity <= 0 then
    raise exception 'A stock increase needs a quantity greater than zero' using errcode = '23514';
  end if;
  if p_base_unit_cost is null or p_base_unit_cost < 0 then
    raise exception 'A stock increase needs a non-negative unit cost' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('stock:' || p_item_id::text || ':' || p_location_id::text, 0::bigint)
  );

  v_unit_cost := round(p_base_unit_cost, 6);
  v_total_cost := round(p_base_quantity * v_unit_cost, 6);

  insert into public.stock_transactions (
    transaction_type, direction, item_id, location_id,
    quantity, unit_cost, total_cost,
    reference_type, reference_id, reference_line_id, reference_number, posted_by
  )
  values (
    p_transaction_type, 'in', p_item_id, p_location_id,
    p_base_quantity, v_unit_cost, v_total_cost,
    p_reference_type, p_reference_id, p_reference_line_id, p_reference_number, auth.uid()
  )
  returning id into v_transaction_id;

  insert into public.stock_layers (
    item_id, location_id, source_transaction_id,
    original_quantity, remaining_quantity, unit_cost
  )
  values (
    p_item_id, p_location_id, v_transaction_id,
    p_base_quantity, p_base_quantity, v_unit_cost
  );

  update public.stock_transactions
     set total_cost = v_total_cost
   where id = v_transaction_id;

  return v_total_cost;
end;
$$;

create or replace function public.post_stock_out(
  p_transaction_type public.stock_transaction_type,
  p_item_id uuid,
  p_location_id uuid,
  p_base_quantity numeric,
  p_reference_type text,
  p_reference_id uuid,
  p_reference_line_id uuid,
  p_reference_number text
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_available numeric(18, 6);
  v_needed numeric(18, 6);
  v_take numeric(18, 6);
  v_take_cost numeric(18, 6);
  v_total_cost numeric(18, 6) := 0;
  v_base_unit_cost numeric(18, 6);
  v_layer public.stock_layers%rowtype;
  v_layer_ids uuid[] := '{}';
  v_layer_quantities numeric[] := '{}';
  v_layer_costs numeric[] := '{}';
  v_transaction_id uuid;
  v_index integer;
begin
  if p_base_quantity is null or p_base_quantity <= 0 then
    raise exception 'A stock decrease needs a quantity greater than zero' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('stock:' || p_item_id::text || ':' || p_location_id::text, 0::bigint)
  );

  select coalesce(sum(remaining_quantity), 0)
    into v_available
  from public.stock_layers
  where item_id = p_item_id
    and location_id = p_location_id
    and remaining_quantity > 0;

  if v_available < p_base_quantity then
    raise exception
      'Insufficient stock for item % at location %: requested % base units, available % base units',
      p_item_id, p_location_id, p_base_quantity, v_available
      using errcode = '23514';
  end if;

  v_needed := p_base_quantity;

  for v_layer in
    select *
    from public.stock_layers
    where item_id = p_item_id
      and location_id = p_location_id
      and remaining_quantity > 0
    order by received_at, id
  loop
    exit when v_needed <= 0;

    v_take := least(v_layer.remaining_quantity, v_needed);
    v_take_cost := round(v_take * v_layer.unit_cost, 6);

    update public.stock_layers
       set remaining_quantity = remaining_quantity - v_take
     where id = v_layer.id;

    v_layer_ids := array_append(v_layer_ids, v_layer.id);
    v_layer_quantities := array_append(v_layer_quantities, v_take);
    v_layer_costs := array_append(v_layer_costs, v_layer.unit_cost);

    v_total_cost := v_total_cost + v_take_cost;
    v_needed := v_needed - v_take;
  end loop;

  if v_needed > 0 then
    raise exception
      'Insufficient stock for item % at location %: requested % base units, available % base units',
      p_item_id, p_location_id, p_base_quantity, v_available
      using errcode = '23514';
  end if;

  v_base_unit_cost := round(v_total_cost / p_base_quantity, 6);

  insert into public.stock_transactions (
    transaction_type, direction, item_id, location_id,
    quantity, unit_cost, total_cost,
    reference_type, reference_id, reference_line_id, reference_number, posted_by
  )
  values (
    p_transaction_type, 'out', p_item_id, p_location_id,
    p_base_quantity, v_base_unit_cost, v_total_cost,
    p_reference_type, p_reference_id, p_reference_line_id, p_reference_number, auth.uid()
  )
  returning id into v_transaction_id;

  for v_index in 1 .. coalesce(array_length(v_layer_ids, 1), 0)
  loop
    insert into public.stock_layer_consumptions (
      issue_transaction_id, layer_id, quantity, unit_cost, total_cost
    )
    values (
      v_transaction_id,
      v_layer_ids[v_index],
      v_layer_quantities[v_index],
      v_layer_costs[v_index],
      round(v_layer_quantities[v_index] * v_layer_costs[v_index], 6)
    );
  end loop;

  return v_total_cost;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Create an adjustment or waste draft (ADJ-01, WST-01..02)
-- ---------------------------------------------------------------------------
create or replace function public.create_inventory_adjustment(
  p_kind text,
  p_adjustment_number text,
  p_adjustment_date date,
  p_location_id uuid,
  p_reason text,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_direction public.stock_direction;
  v_quantity numeric;
  v_unit_cost numeric;
  v_count integer := 0;
begin
  if not public.can_manage_inventory() then
    raise exception 'You do not have permission to record inventory adjustments or waste'
      using errcode = '42501';
  end if;

  if p_kind is null or p_kind not in ('adjustment', 'waste') then
    raise exception 'Choose adjustment or waste' using errcode = '23514';
  end if;
  if nullif(btrim(p_adjustment_number), '') is null then
    raise exception 'A document number is required' using errcode = '23514';
  end if;
  if length(btrim(p_adjustment_number)) > 40 then
    raise exception 'Use 40 characters or fewer for the document number' using errcode = '23514';
  end if;
  if p_adjustment_date is null then
    raise exception 'A document date is required' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.stock_locations l where l.id = p_location_id and l.is_active
  ) then
    raise exception 'Choose an active stock location' using errcode = '23514';
  end if;

  if p_kind = 'adjustment' and p_reason not in (
    'damage', 'spoilage', 'theft', 'expired', 'operational_loss'
  ) then
    raise exception 'Choose an adjustment reason' using errcode = '23514';
  end if;
  if p_kind = 'waste' and p_reason not in (
    'kitchen_waste', 'burnt_food', 'returned_food', 'expired', 'spoilage'
  ) then
    raise exception 'Choose a waste reason' using errcode = '23514';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A document needs at least one line' using errcode = '23514';
  end if;

  insert into public.inventory_adjustments (
    adjustment_number, kind, adjustment_date, location_id, reason, notes, created_by
  )
  values (
    upper(btrim(p_adjustment_number)),
    p_kind::public.stock_adjustment_kind,
    p_adjustment_date,
    p_location_id,
    p_reason,
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_id;

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
    if p_kind = 'waste' and v_direction <> 'out' then
      raise exception 'Waste can only decrease stock' using errcode = '23514';
    end if;

    -- Rejects a unit with no conversion to this item's base unit.
    perform public.stock_unit_factor(v_item_id, v_unit_id);

    insert into public.inventory_adjustment_lines (
      adjustment_id, item_id, unit_id, direction, quantity, unit_cost
    )
    values (v_id, v_item_id, v_unit_id, v_direction, v_quantity,
      case when v_direction = 'in' then round(v_unit_cost, 6) else null end);

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A document needs at least one line' using errcode = '23514';
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Submit and decide an adjustment or waste document
-- ---------------------------------------------------------------------------
create or replace function public.submit_inventory_adjustment(p_adjustment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_inventory() then
    raise exception 'You do not have permission to submit inventory documents'
      using errcode = '42501';
  end if;

  update public.inventory_adjustments
     set status = 'submitted',
         submitted_at = now(),
         updated_at = now()
   where id = p_adjustment_id
     and status = 'draft';

  if not found then
    raise exception 'Only a draft document can be submitted' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.decide_inventory_adjustment(
  p_adjustment_id uuid,
  p_decision text,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_decision public.inventory_document_status;
begin
  if not public.can_approve_inventory() then
    raise exception 'You do not have permission to approve or reject inventory documents'
      using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Choose approved or rejected' using errcode = '23514';
  end if;

  v_decision := p_decision::public.inventory_document_status;

  update public.inventory_adjustments
     set status = v_decision,
         decided_by = auth.uid(),
         decided_by_name = public.current_user_name(),
         decided_at = now(),
         decision_comment = nullif(btrim(coalesce(p_comment, '')), ''),
         updated_at = now()
   where id = p_adjustment_id
     and status = 'submitted';

  if not found then
    raise exception 'Only a submitted document can be approved or rejected'
      using errcode = '23514';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Post an approved adjustment or waste document once
--    Increases create a FIFO layer; decreases consume the oldest layers and
--    record the consumed cost. Balances are never written directly.
-- ---------------------------------------------------------------------------
create or replace function public.post_inventory_adjustment(p_adjustment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc public.inventory_adjustments%rowtype;
  v_line public.inventory_adjustment_lines%rowtype;
  v_factor numeric(18, 6);
  v_base_quantity numeric(18, 6);
  v_base_unit_cost numeric(18, 6);
  v_total_cost numeric(18, 6);
  v_line_total numeric(18, 6);
begin
  if not public.can_post_inventory() then
    raise exception 'You do not have permission to post inventory documents'
      using errcode = '42501';
  end if;

  select * into v_doc from public.inventory_adjustments where id = p_adjustment_id for update;
  if not found then
    raise exception 'Inventory document % not found', p_adjustment_id using errcode = 'P0002';
  end if;
  if v_doc.status = 'posted' then
    raise exception 'Document % is already posted', v_doc.adjustment_number using errcode = '23505';
  end if;
  if v_doc.status <> 'approved' then
    raise exception 'Only an approved document can be posted' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.inventory_adjustment_lines l where l.adjustment_id = v_doc.id
  ) then
    raise exception 'Document % has no lines', v_doc.adjustment_number using errcode = '23514';
  end if;

  for v_line in
    select * from public.inventory_adjustment_lines
    where adjustment_id = v_doc.id
    order by created_at, id
  loop
    if v_doc.kind = 'waste' and v_line.direction <> 'out' then
      raise exception 'Waste can only decrease stock' using errcode = '23514';
    end if;

    v_factor := public.stock_unit_factor(v_line.item_id, v_line.unit_id);
    v_base_quantity := round(v_line.quantity * v_factor, 6);

    if v_line.direction = 'in' then
      v_line_total := round(v_line.quantity * v_line.unit_cost, 2);
      v_base_unit_cost := round(v_line_total / v_base_quantity, 6);
      v_total_cost := public.post_stock_in(
        v_doc.kind::text::public.stock_transaction_type,
        v_line.item_id,
        v_doc.location_id,
        v_base_quantity,
        v_base_unit_cost,
        v_doc.kind::text,
        v_doc.id,
        v_line.id,
        v_doc.adjustment_number
      );
    else
      v_total_cost := public.post_stock_out(
        v_doc.kind::text::public.stock_transaction_type,
        v_line.item_id,
        v_doc.location_id,
        v_base_quantity,
        v_doc.kind::text,
        v_doc.id,
        v_line.id,
        v_doc.adjustment_number
      );
    end if;

    update public.inventory_adjustment_lines
       set base_quantity = v_base_quantity,
           posted_cost = v_total_cost
     where id = v_line.id;
  end loop;

  update public.inventory_adjustments
     set status = 'posted',
         posted_by = auth.uid(),
         posted_at = now(),
         updated_at = now()
   where id = v_doc.id
     and status = 'approved';

  if not found then
    raise exception 'Document % is already posted', v_doc.adjustment_number using errcode = '23505';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Create an inventory count sheet (CNT-01..02)
-- ---------------------------------------------------------------------------
create or replace function public.create_inventory_count(
  p_count_number text,
  p_count_date date,
  p_location_id uuid,
  p_counter_name text,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_physical numeric;
  v_system numeric;
  v_seen uuid[] := '{}';
  v_count integer := 0;
begin
  if not public.can_manage_inventory() then
    raise exception 'You do not have permission to create inventory counts'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_count_number), '') is null then
    raise exception 'A count number is required' using errcode = '23514';
  end if;
  if length(btrim(p_count_number)) > 40 then
    raise exception 'Use 40 characters or fewer for the count number' using errcode = '23514';
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

  insert into public.inventory_counts (
    count_number, count_date, location_id, counter_name, notes, created_by
  )
  values (
    upper(btrim(p_count_number)),
    p_count_date,
    p_location_id,
    btrim(p_counter_name),
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_count_id;

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
    values (v_count_id, v_item_id, v_system, v_physical);

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A count sheet needs at least one line' using errcode = '23514';
  end if;

  return v_count_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Submit and decide an inventory count (CNT-03)
-- ---------------------------------------------------------------------------
create or replace function public.submit_inventory_count(p_count_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_inventory() then
    raise exception 'You do not have permission to submit inventory counts'
      using errcode = '42501';
  end if;

  update public.inventory_counts
     set status = 'submitted',
         submitted_at = now(),
         updated_at = now()
   where id = p_count_id
     and status = 'draft';

  if not found then
    raise exception 'Only a draft count can be submitted' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.decide_inventory_count(
  p_count_id uuid,
  p_decision text,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_decision public.inventory_document_status;
begin
  if not public.can_approve_inventory() then
    raise exception 'You do not have permission to approve or reject inventory counts'
      using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Choose approved or rejected' using errcode = '23514';
  end if;

  v_decision := p_decision::public.inventory_document_status;

  update public.inventory_counts
     set status = v_decision,
         decided_by = auth.uid(),
         decided_by_name = public.current_user_name(),
         decided_at = now(),
         decision_comment = nullif(btrim(coalesce(p_comment, '')), ''),
         updated_at = now()
   where id = p_count_id
     and status = 'submitted';

  if not found then
    raise exception 'Only a submitted count can be approved or rejected'
      using errcode = '23514';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Post an approved count (CNT-03..05, STK-04)
--     The variance posted is the difference between the physical quantity and
--     the ledger balance at posting time, so the resulting balance equals the
--     count. The recorded system snapshot and variance remain for reporting.
-- ---------------------------------------------------------------------------
create or replace function public.post_inventory_count(p_count_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count public.inventory_counts%rowtype;
  v_line public.inventory_count_lines%rowtype;
  v_current numeric(18, 6);
  v_difference numeric(18, 6);
  v_quantity numeric(18, 6);
  v_base_unit_cost numeric(18, 6);
  v_total_cost numeric(18, 6);
begin
  if not public.can_post_inventory() then
    raise exception 'You do not have permission to post inventory counts'
      using errcode = '42501';
  end if;

  select * into v_count from public.inventory_counts where id = p_count_id for update;
  if not found then
    raise exception 'Inventory count % not found', p_count_id using errcode = 'P0002';
  end if;
  if v_count.status = 'posted' then
    raise exception 'Count % is already posted', v_count.count_number using errcode = '23505';
  end if;
  if v_count.status <> 'approved' then
    raise exception 'Only an approved count can be posted' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.inventory_count_lines l where l.count_id = v_count.id
  ) then
    raise exception 'Count % has no lines', v_count.count_number using errcode = '23514';
  end if;

  for v_line in
    select * from public.inventory_count_lines
    where count_id = v_count.id
    order by created_at, id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(
        'stock:' || v_line.item_id::text || ':' || v_count.location_id::text,
        0::bigint
      )
    );

    select round(coalesce(sum(
      case when t.direction = 'in' then t.quantity else -t.quantity end
    ), 0), 6)
      into v_current
    from public.stock_transactions t
    where t.item_id = v_line.item_id
      and t.location_id = v_count.location_id;

    v_difference := round(v_line.physical_quantity - v_current, 6);

    if v_difference = 0 then
      update public.inventory_count_lines
         set posted_quantity = 0,
             posted_cost = 0
       where id = v_line.id;
      continue;
    end if;

    v_quantity := abs(v_difference);

    if v_difference > 0 then
      -- Value a gain at the weighted average of the location's remaining FIFO
      -- layers. When the location has no layers the gain is recorded at zero
      -- cost; the owner can correct valuation with a priced adjustment.
      select case
               when coalesce(sum(remaining_quantity), 0) > 0
                 then round(sum(remaining_quantity * unit_cost) / sum(remaining_quantity), 6)
               else 0
             end
        into v_base_unit_cost
      from public.stock_layers
      where item_id = v_line.item_id
        and location_id = v_count.location_id
        and remaining_quantity > 0;

      v_total_cost := public.post_stock_in(
        'adjustment',
        v_line.item_id,
        v_count.location_id,
        v_quantity,
        v_base_unit_cost,
        'inventory_count',
        v_count.id,
        v_line.id,
        v_count.count_number
      );
    else
      v_total_cost := public.post_stock_out(
        'adjustment',
        v_line.item_id,
        v_count.location_id,
        v_quantity,
        'inventory_count',
        v_count.id,
        v_line.id,
        v_count.count_number
      );
    end if;

    update public.inventory_count_lines
       set posted_quantity = v_difference,
           posted_cost = v_total_cost
     where id = v_line.id;
  end loop;

  update public.inventory_counts
     set status = 'posted',
         posted_by = auth.uid(),
         posted_at = now(),
         updated_at = now()
   where id = v_count.id
     and status = 'approved';

  if not found then
    raise exception 'Count % is already posted', v_count.count_number using errcode = '23505';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Function privileges
-- ---------------------------------------------------------------------------
revoke all on function public.can_manage_inventory() from public;
revoke all on function public.can_approve_inventory() from public;
revoke all on function public.can_post_inventory() from public;
revoke all on function public.post_stock_in(
  public.stock_transaction_type, uuid, uuid, numeric, numeric, text, uuid, uuid, text
) from public;
revoke all on function public.post_stock_out(
  public.stock_transaction_type, uuid, uuid, numeric, text, uuid, uuid, text
) from public;
revoke all on function public.create_inventory_adjustment(
  text, text, date, uuid, text, text, jsonb
) from public;
revoke all on function public.submit_inventory_adjustment(uuid) from public;
revoke all on function public.decide_inventory_adjustment(uuid, text, text) from public;
revoke all on function public.post_inventory_adjustment(uuid) from public;
revoke all on function public.create_inventory_count(text, date, uuid, text, text, jsonb) from public;
revoke all on function public.submit_inventory_count(uuid) from public;
revoke all on function public.decide_inventory_count(uuid, text, text) from public;
revoke all on function public.post_inventory_count(uuid) from public;

grant execute on function public.can_manage_inventory() to authenticated;
grant execute on function public.can_approve_inventory() to authenticated;
grant execute on function public.can_post_inventory() to authenticated;
grant execute on function public.create_inventory_adjustment(
  text, text, date, uuid, text, text, jsonb
) to authenticated;
grant execute on function public.submit_inventory_adjustment(uuid) to authenticated;
grant execute on function public.decide_inventory_adjustment(uuid, text, text) to authenticated;
grant execute on function public.post_inventory_adjustment(uuid) to authenticated;
grant execute on function public.create_inventory_count(text, date, uuid, text, text, jsonb) to authenticated;
grant execute on function public.submit_inventory_count(uuid) to authenticated;
grant execute on function public.decide_inventory_count(uuid, text, text) to authenticated;
grant execute on function public.post_inventory_count(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 14. Audit triggers (AUD-01..03)
-- ---------------------------------------------------------------------------
drop trigger if exists inventory_adjustments_audit on public.inventory_adjustments;
create trigger inventory_adjustments_audit
  after insert or update or delete on public.inventory_adjustments
  for each row execute function public.write_audit_log();

drop trigger if exists inventory_adjustment_lines_audit on public.inventory_adjustment_lines;
create trigger inventory_adjustment_lines_audit
  after insert or update or delete on public.inventory_adjustment_lines
  for each row execute function public.write_audit_log();

drop trigger if exists inventory_counts_audit on public.inventory_counts;
create trigger inventory_counts_audit
  after insert or update or delete on public.inventory_counts
  for each row execute function public.write_audit_log();

drop trigger if exists inventory_count_lines_audit on public.inventory_count_lines;
create trigger inventory_count_lines_audit
  after insert or update or delete on public.inventory_count_lines
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- 15. Row-Level Security
--      Read for active users; no direct writes. Creation, submission, decisions
--      and posting go through the SECURITY DEFINER functions above.
-- ---------------------------------------------------------------------------
alter table public.inventory_adjustments      enable row level security;
alter table public.inventory_adjustment_lines enable row level security;
alter table public.inventory_counts           enable row level security;
alter table public.inventory_count_lines      enable row level security;

drop policy if exists inventory_adjustments_select on public.inventory_adjustments;
create policy inventory_adjustments_select on public.inventory_adjustments
  for select to authenticated
  using (public.is_active_user());

drop policy if exists inventory_adjustment_lines_select on public.inventory_adjustment_lines;
create policy inventory_adjustment_lines_select on public.inventory_adjustment_lines
  for select to authenticated
  using (public.is_active_user());

drop policy if exists inventory_counts_select on public.inventory_counts;
create policy inventory_counts_select on public.inventory_counts
  for select to authenticated
  using (public.is_active_user());

drop policy if exists inventory_count_lines_select on public.inventory_count_lines;
create policy inventory_count_lines_select on public.inventory_count_lines
  for select to authenticated
  using (public.is_active_user());

revoke all on public.inventory_adjustments      from anon, authenticated;
revoke all on public.inventory_adjustment_lines from anon, authenticated;
revoke all on public.inventory_counts           from anon, authenticated;
revoke all on public.inventory_count_lines      from anon, authenticated;

grant select on public.inventory_adjustments      to authenticated;
grant select on public.inventory_adjustment_lines to authenticated;
grant select on public.inventory_counts           to authenticated;
grant select on public.inventory_count_lines      to authenticated;

revoke all on public.stock_reorder_status         from anon, authenticated;
revoke all on public.inventory_count_variances    from anon, authenticated;
grant select on public.stock_reorder_status       to authenticated;
grant select on public.inventory_count_variances  to authenticated;

-- ---------------------------------------------------------------------------
-- 16. Comments
-- ---------------------------------------------------------------------------
comment on table public.inventory_adjustments is 'Adjustment and waste document header (ADJ-01..03, WST-01..04). Draft → submitted → approved/rejected → posted.';
comment on table public.inventory_adjustment_lines is 'Adjustment/waste lines in the entered unit; base_quantity and posted_cost are filled on posting (ADR-009, ADR-010).';
comment on table public.inventory_counts is 'Physical count sheet header (CNT-01..05). Approval is recorded before variances can post.';
comment on table public.inventory_count_lines is 'Count lines. system_quantity is the ledger snapshot at sheet creation; posting reconciles to the current balance.';
comment on column public.inventory_count_lines.physical_quantity is 'Counted quantity in the item base unit.';
comment on column public.inventory_count_lines.variance_quantity is 'physical_quantity - system_quantity, calculated for the variance report (CNT-02, CNT-04).';
comment on column public.inventory_count_lines.posted_quantity is 'Signed quantity posted to the ledger when the count was approved and posted.';
comment on view public.stock_reorder_status is 'Reorder alert source (INV-06): active items with a reorder level, total on hand and shortage.';
comment on view public.inventory_count_variances is 'Variance report source (CNT-04), one row per count line.';
comment on function public.create_inventory_adjustment(text, text, date, uuid, text, text, jsonb) is 'Creates an adjustment or waste draft atomically. Role-gated; OD-06 thresholds are not implemented.';
comment on function public.post_inventory_adjustment(uuid) is 'Posts an approved adjustment or waste document once (ADJ-03, WST-03, ADR-009).';
comment on function public.create_inventory_count(text, date, uuid, text, text, jsonb) is 'Creates a count sheet with system-quantity snapshots and physical quantities (CNT-01..02).';
comment on function public.post_inventory_count(uuid) is 'Posts an approved count, reconciling the ledger to the physical count through adjustment transactions (CNT-03..05, STK-04).';
comment on function public.post_stock_in(public.stock_transaction_type, uuid, uuid, numeric, numeric, text, uuid, uuid, text) is 'Internal helper: inserts an increase transaction and FIFO layer.';
comment on function public.post_stock_out(public.stock_transaction_type, uuid, uuid, numeric, text, uuid, uuid, text) is 'Internal helper: consumes FIFO layers and inserts a decrease transaction.';
