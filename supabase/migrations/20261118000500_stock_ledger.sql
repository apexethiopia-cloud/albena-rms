-- Albena RMS — Phase 4 stock ledger, GRN and SIV
-- Apply after 20261118000400_master_data_seed.sql.
-- Idempotent: safe to re-run.
--
-- ADR-007: balances are derived from stock_transactions. Nothing updates a
--          balance column, because no balance column exists.
-- ADR-009: every receipt creates a FIFO layer; every issue consumes the oldest
--          layers first and records the consumed cost. Negative stock is
--          rejected. Layers are never rewritten; remaining quantities shrink.
-- ADR-010: stock quantities are stored in the item base unit. Documents keep
--          the entered unit and the factor is resolved by the database.
--
-- OD-06 (approval thresholds and separation of duties) is still open. This
-- migration therefore does not invent an approval chain: it restricts draft
-- creation and posting to the roles named in the SRS role table, and records
-- who posted the document. Approval steps can be added later without changing
-- the ledger shape.

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.stock_direction as enum ('in', 'out');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.stock_transaction_type as enum (
    'opening',
    'grn',
    'siv',
    'adjustment',
    'waste',
    'production'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Goods receiving notes (GRN-01..05)
-- ---------------------------------------------------------------------------
create table if not exists public.grns (
  id             uuid primary key default gen_random_uuid(),
  grn_number     text not null unique,
  supplier_id    uuid not null references public.suppliers (id) on delete restrict,
  invoice_number text not null,
  received_date  date not null,
  location_id    uuid not null references public.stock_locations (id) on delete restrict,
  notes          text,
  created_by     uuid references auth.users (id),
  created_at     timestamptz not null default now(),
  posted_by      uuid references auth.users (id),
  posted_at      timestamptz
);

create table if not exists public.grn_lines (
  id               uuid primary key default gen_random_uuid(),
  grn_id           uuid not null references public.grns (id) on delete cascade,
  item_id          uuid not null references public.items (id) on delete restrict,
  unit_id          uuid not null references public.units (id) on delete restrict,
  quantity         numeric(18, 6) not null,
  unit_cost        numeric(14, 2) not null,
  line_total       numeric(14, 2) generated always as (round(quantity * unit_cost, 2)) stored,
  base_quantity    numeric(18, 6),
  base_unit_cost   numeric(18, 6),
  created_at       timestamptz not null default now(),
  constraint grn_lines_quantity_positive check (quantity > 0),
  constraint grn_lines_unit_cost_positive check (unit_cost > 0)
);

create index if not exists grns_created_at_idx on public.grns (created_at desc);
create index if not exists grns_location_idx on public.grns (location_id);
create index if not exists grn_lines_grn_idx on public.grn_lines (grn_id);

-- ---------------------------------------------------------------------------
-- 3. Store issue vouchers (SIV-01..05)
-- ---------------------------------------------------------------------------
create table if not exists public.sivs (
  id                     uuid primary key default gen_random_uuid(),
  siv_number             text not null unique,
  issue_date             date not null,
  source_location_id     uuid not null references public.stock_locations (id) on delete restrict,
  destination_location_id uuid not null references public.stock_locations (id) on delete restrict,
  notes                  text,
  requested_by           uuid references auth.users (id),
  created_at             timestamptz not null default now(),
  posted_by              uuid references auth.users (id),
  posted_at              timestamptz,
  constraint sivs_different_locations check (source_location_id <> destination_location_id)
);

create table if not exists public.siv_lines (
  id               uuid primary key default gen_random_uuid(),
  siv_id           uuid not null references public.sivs (id) on delete cascade,
  item_id          uuid not null references public.items (id) on delete restrict,
  unit_id          uuid not null references public.units (id) on delete restrict,
  quantity         numeric(18, 6) not null,
  base_quantity    numeric(18, 6),
  posted_cost      numeric(18, 6),
  created_at       timestamptz not null default now(),
  constraint siv_lines_quantity_positive check (quantity > 0)
);

create index if not exists sivs_created_at_idx on public.sivs (created_at desc);
create index if not exists sivs_source_idx on public.sivs (source_location_id);
create index if not exists siv_lines_siv_idx on public.siv_lines (siv_id);

-- ---------------------------------------------------------------------------
-- 4. Append-only stock ledger (STK-01..03, STK-06..07)
-- ---------------------------------------------------------------------------
create table if not exists public.stock_transactions (
  id                uuid primary key default gen_random_uuid(),
  transaction_type  public.stock_transaction_type not null,
  direction         public.stock_direction not null,
  item_id           uuid not null references public.items (id) on delete restrict,
  location_id       uuid not null references public.stock_locations (id) on delete restrict,
  quantity          numeric(18, 6) not null,
  unit_cost         numeric(18, 6) not null default 0,
  total_cost        numeric(18, 6) not null default 0,
  reference_type    text not null,
  reference_id      uuid not null,
  reference_line_id uuid,
  reference_number  text,
  posted_by         uuid references auth.users (id),
  posted_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  constraint stock_transactions_quantity_positive check (quantity > 0),
  constraint stock_transactions_unit_cost_non_negative check (unit_cost >= 0),
  constraint stock_transactions_total_cost_non_negative check (total_cost >= 0)
);

create index if not exists stock_transactions_item_location_idx
  on public.stock_transactions (item_id, location_id, posted_at, id);
create index if not exists stock_transactions_reference_idx
  on public.stock_transactions (reference_type, reference_id);
-- One movement of a given direction per source line. A SIV line therefore has
-- exactly one out row and one in row, and a GRN line exactly one in row.
create unique index if not exists stock_transactions_source_once
  on public.stock_transactions (reference_type, reference_line_id, direction)
  where reference_line_id is not null;

-- ---------------------------------------------------------------------------
-- 5. FIFO cost layers and layer consumption (ADR-009)
-- ---------------------------------------------------------------------------
create table if not exists public.stock_layers (
  id                  uuid primary key default gen_random_uuid(),
  item_id             uuid not null references public.items (id) on delete restrict,
  location_id         uuid not null references public.stock_locations (id) on delete restrict,
  source_transaction_id uuid not null unique references public.stock_transactions (id) on delete restrict,
  original_quantity   numeric(18, 6) not null,
  remaining_quantity  numeric(18, 6) not null,
  unit_cost           numeric(18, 6) not null,
  received_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  constraint stock_layers_original_positive check (original_quantity > 0),
  constraint stock_layers_remaining_range check (remaining_quantity >= 0 and remaining_quantity <= original_quantity),
  constraint stock_layers_unit_cost_non_negative check (unit_cost >= 0)
);

create index if not exists stock_layers_fifo_idx
  on public.stock_layers (item_id, location_id, received_at, id)
  where remaining_quantity > 0;

create table if not exists public.stock_layer_consumptions (
  id                  uuid primary key default gen_random_uuid(),
  issue_transaction_id uuid not null references public.stock_transactions (id) on delete restrict,
  layer_id            uuid not null references public.stock_layers (id) on delete restrict,
  quantity            numeric(18, 6) not null,
  unit_cost           numeric(18, 6) not null,
  total_cost          numeric(18, 6) not null,
  created_at          timestamptz not null default now(),
  constraint stock_layer_consumptions_quantity_positive check (quantity > 0),
  constraint stock_layer_consumptions_unit_cost_non_negative check (unit_cost >= 0),
  constraint stock_layer_consumptions_total_cost_non_negative check (total_cost >= 0),
  constraint stock_layer_consumptions_once unique (issue_transaction_id, layer_id)
);

create index if not exists stock_layer_consumptions_issue_idx
  on public.stock_layer_consumptions (issue_transaction_id);

-- ---------------------------------------------------------------------------
-- 6. Derived balance and history views (ADR-007)
--    security_invoker keeps RLS in force for the caller.
-- ---------------------------------------------------------------------------
create or replace view public.stock_balances
with (security_invoker = true)
as
select
  t.item_id,
  i.code as item_code,
  i.name as item_name,
  bu.code as base_unit_code,
  t.location_id,
  l.code as location_code,
  l.name as location_name,
  round(sum(case when t.direction = 'in' then t.quantity else -t.quantity end), 6) as quantity,
  round(coalesce(v.total_value, 0), 6) as total_value,
  max(t.posted_at) as last_movement_at
from public.stock_transactions t
join public.items i on i.id = t.item_id
join public.units bu on bu.id = i.base_unit_id
join public.stock_locations l on l.id = t.location_id
left join (
  select item_id, location_id, sum(remaining_quantity * unit_cost) as total_value
  from public.stock_layers
  group by item_id, location_id
) v on v.item_id = t.item_id and v.location_id = t.location_id
group by t.item_id, i.code, i.name, bu.code, t.location_id, l.code, l.name, v.total_value;

create or replace view public.stock_ledger_entries
with (security_invoker = true)
as
select
  t.id,
  t.posted_at,
  t.transaction_type,
  t.direction,
  t.item_id,
  i.code as item_code,
  i.name as item_name,
  bu.code as base_unit_code,
  t.location_id,
  l.code as location_code,
  l.name as location_name,
  t.quantity,
  t.unit_cost,
  t.total_cost,
  t.reference_type,
  t.reference_id,
  t.reference_number
from public.stock_transactions t
join public.items i on i.id = t.item_id
join public.units bu on bu.id = i.base_unit_id
join public.stock_locations l on l.id = t.location_id;

-- ---------------------------------------------------------------------------
-- 7. Unit-factor resolution (ADR-010)
--    Returns how many base units one selected unit contains for this item.
-- ---------------------------------------------------------------------------
create or replace function public.stock_unit_factor(
  p_item_id uuid,
  p_unit_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_base_unit_id uuid;
  v_base_dimension public.unit_dimension;
  v_unit_dimension public.unit_dimension;
  v_factor numeric(18, 6);
begin
  select i.base_unit_id, bu.dimension
    into v_base_unit_id, v_base_dimension
  from public.items i
  join public.units bu on bu.id = i.base_unit_id
  where i.id = p_item_id;

  if v_base_unit_id is null then
    raise exception 'Unknown item %', p_item_id using errcode = 'P0002';
  end if;

  select u.dimension, u.base_factor
    into v_unit_dimension, v_factor
  from public.units u
  where u.id = p_unit_id;

  if v_unit_dimension is null then
    raise exception 'Unknown unit %', p_unit_id using errcode = 'P0002';
  end if;

  if v_unit_dimension <> v_base_dimension then
    raise exception 'Unit dimension % does not match the item base dimension %',
      v_unit_dimension, v_base_dimension
      using errcode = '23514';
  end if;

  if p_unit_id = v_base_unit_id then
    return 1;
  end if;

  -- Fixed units (kg, litre) carry a global factor.
  if v_factor is not null then
    return v_factor;
  end if;

  -- Boxes, cartons and sacks require an explicit per-item factor.
  select c.base_factor
    into v_factor
  from public.item_unit_conversions c
  where c.item_id = p_item_id
    and c.unit_id = p_unit_id;

  if v_factor is null then
    raise exception 'No conversion is configured from unit % to the base unit for item %',
      p_unit_id, p_item_id
      using errcode = '23514';
  end if;

  return v_factor;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Posting authorization helpers
--    OD-06 approval thresholds are not defined yet. These helpers restrict
--    posting to the roles named in the SRS role table; they are not an
--    approval workflow.
-- ---------------------------------------------------------------------------
create or replace function public.can_post_grn()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
    and (
      public.has_role('system_admin')
      or public.has_role('general_manager')
      or public.has_role('purchasing_officer')
      or public.has_role('storekeeper')
    );
$$;

create or replace function public.can_post_siv()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
    and (
      public.has_role('system_admin')
      or public.has_role('general_manager')
      or public.has_role('storekeeper')
    );
$$;

-- ---------------------------------------------------------------------------
-- 9. Create draft documents (header + lines atomically)
-- ---------------------------------------------------------------------------
create or replace function public.create_grn(
  p_grn_number text,
  p_supplier_id uuid,
  p_invoice_number text,
  p_received_date date,
  p_location_id uuid,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grn_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_quantity numeric;
  v_unit_cost numeric;
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
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A GRN needs at least one line' using errcode = '23514';
  end if;

  insert into public.grns (
    grn_number, supplier_id, invoice_number, received_date, location_id, notes, created_by
  )
  values (
    upper(btrim(p_grn_number)),
    p_supplier_id,
    btrim(p_invoice_number),
    p_received_date,
    p_location_id,
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_grn_id;

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

    -- Rejects a unit with no conversion to this item's base unit.
    perform public.stock_unit_factor(v_item_id, v_unit_id);

    insert into public.grn_lines (grn_id, item_id, unit_id, quantity, unit_cost)
    values (v_grn_id, v_item_id, v_unit_id, v_quantity, round(v_unit_cost, 2));

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A GRN needs at least one line' using errcode = '23514';
  end if;

  return v_grn_id;
end;
$$;

create or replace function public.create_siv(
  p_siv_number text,
  p_issue_date date,
  p_source_location_id uuid,
  p_destination_location_id uuid,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_siv_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_quantity numeric;
  v_count integer := 0;
begin
  if not public.can_post_siv() then
    raise exception 'You do not have permission to create store issue vouchers'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_siv_number), '') is null then
    raise exception 'A SIV number is required' using errcode = '23514';
  end if;
  if p_issue_date is null then
    raise exception 'An issue date is required' using errcode = '23514';
  end if;
  if p_source_location_id = p_destination_location_id then
    raise exception 'Source and destination locations must be different' using errcode = '23514';
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

  insert into public.sivs (
    siv_number, issue_date, source_location_id, destination_location_id, notes, requested_by
  )
  values (
    upper(btrim(p_siv_number)),
    p_issue_date,
    p_source_location_id,
    p_destination_location_id,
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_siv_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_item_id := nullif(v_line ->> 'item_id', '')::uuid;
    v_unit_id := nullif(v_line ->> 'unit_id', '')::uuid;
    v_quantity := nullif(v_line ->> 'quantity', '')::numeric;

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
    values (v_siv_id, v_item_id, v_unit_id, v_quantity);

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A SIV needs at least one line' using errcode = '23514';
  end if;

  return v_siv_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Post a GRN: stock in + one FIFO layer per line
-- ---------------------------------------------------------------------------
create or replace function public.post_grn(p_grn_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grn public.grns%rowtype;
  v_line public.grn_lines%rowtype;
  v_factor numeric(18, 6);
  v_base_quantity numeric(18, 6);
  v_line_total numeric(14, 2);
  v_base_unit_cost numeric(18, 6);
  v_transaction_id uuid;
begin
  if not public.can_post_grn() then
    raise exception 'You do not have permission to post goods receiving notes'
      using errcode = '42501';
  end if;

  select * into v_grn from public.grns where id = p_grn_id for update;
  if not found then
    raise exception 'GRN % not found', p_grn_id using errcode = 'P0002';
  end if;
  if v_grn.posted_at is not null then
    raise exception 'GRN % is already posted', v_grn.grn_number using errcode = '23505';
  end if;
  if not exists (select 1 from public.grn_lines l where l.grn_id = v_grn.id) then
    raise exception 'GRN % has no lines', v_grn.grn_number using errcode = '23514';
  end if;

  for v_line in
    select * from public.grn_lines where grn_id = v_grn.id order by created_at, id
  loop
    v_factor := public.stock_unit_factor(v_line.item_id, v_line.unit_id);
    v_base_quantity := round(v_line.quantity * v_factor, 6);
    v_line_total := round(v_line.quantity * v_line.unit_cost, 2);
    v_base_unit_cost := round(v_line_total / v_base_quantity, 6);

    -- Serialize postings for this item/location pair so FIFO consumption cannot
    -- race a concurrent receipt or issue.
    perform pg_advisory_xact_lock(
      hashtextextended('stock:' || v_line.item_id::text || ':' || v_grn.location_id::text, 0::bigint)
    );

    insert into public.stock_transactions (
      transaction_type, direction, item_id, location_id,
      quantity, unit_cost, total_cost,
      reference_type, reference_id, reference_line_id, reference_number, posted_by
    )
    values (
      'grn', 'in', v_line.item_id, v_grn.location_id,
      v_base_quantity, v_base_unit_cost, v_line_total,
      'grn', v_grn.id, v_line.id, v_grn.grn_number, auth.uid()
    )
    returning id into v_transaction_id;

    insert into public.stock_layers (
      item_id, location_id, source_transaction_id,
      original_quantity, remaining_quantity, unit_cost
    )
    values (
      v_line.item_id, v_grn.location_id, v_transaction_id,
      v_base_quantity, v_base_quantity, v_base_unit_cost
    );

    update public.grn_lines
       set base_quantity = v_base_quantity,
           base_unit_cost = v_base_unit_cost
     where id = v_line.id;
  end loop;

  update public.grns
     set posted_by = auth.uid(),
         posted_at = now()
   where id = v_grn.id and posted_at is null;

  if not found then
    raise exception 'GRN % is already posted', v_grn.grn_number using errcode = '23505';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Post a SIV: FIFO issue from source + matching layer at destination
-- ---------------------------------------------------------------------------
create or replace function public.post_siv(p_siv_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_siv public.sivs%rowtype;
  v_line public.siv_lines%rowtype;
  v_factor numeric(18, 6);
  v_base_quantity numeric(18, 6);
  v_available numeric(18, 6);
  v_needed numeric(18, 6);
  v_take numeric(18, 6);
  v_take_cost numeric(18, 6);
  v_total_cost numeric(18, 6);
  v_base_unit_cost numeric(18, 6);
  v_layer public.stock_layers%rowtype;
  v_layer_ids uuid[];
  v_layer_quantities numeric[];
  v_layer_costs numeric[];
  v_out_transaction_id uuid;
  v_in_transaction_id uuid;
  v_index integer;
begin
  if not public.can_post_siv() then
    raise exception 'You do not have permission to post store issue vouchers'
      using errcode = '42501';
  end if;

  select * into v_siv from public.sivs where id = p_siv_id for update;
  if not found then
    raise exception 'SIV % not found', p_siv_id using errcode = 'P0002';
  end if;
  if v_siv.posted_at is not null then
    raise exception 'SIV % is already posted', v_siv.siv_number using errcode = '23505';
  end if;
  if not exists (select 1 from public.siv_lines l where l.siv_id = v_siv.id) then
    raise exception 'SIV % has no lines', v_siv.siv_number using errcode = '23514';
  end if;

  for v_line in
    select * from public.siv_lines where siv_id = v_siv.id order by created_at, id
  loop
    v_factor := public.stock_unit_factor(v_line.item_id, v_line.unit_id);
    v_base_quantity := round(v_line.quantity * v_factor, 6);

    perform pg_advisory_xact_lock(
      hashtextextended('stock:' || v_line.item_id::text || ':' || v_siv.source_location_id::text, 0::bigint)
    );

    select coalesce(sum(remaining_quantity), 0)
      into v_available
    from public.stock_layers
    where item_id = v_line.item_id
      and location_id = v_siv.source_location_id
      and remaining_quantity > 0;

    if v_available < v_base_quantity then
      raise exception
        'Insufficient stock for item % at location %: requested % base units, available % base units',
        v_line.item_id, v_siv.source_location_id, v_base_quantity, v_available
        using errcode = '23514';
    end if;

    v_needed := v_base_quantity;
    v_total_cost := 0;
    v_layer_ids := '{}';
    v_layer_quantities := '{}';
    v_layer_costs := '{}';

    for v_layer in
      select *
      from public.stock_layers
      where item_id = v_line.item_id
        and location_id = v_siv.source_location_id
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
        v_line.item_id, v_siv.source_location_id, v_base_quantity, v_available
        using errcode = '23514';
    end if;

    v_base_unit_cost := round(v_total_cost / v_base_quantity, 6);

    insert into public.stock_transactions (
      transaction_type, direction, item_id, location_id,
      quantity, unit_cost, total_cost,
      reference_type, reference_id, reference_line_id, reference_number, posted_by
    )
    values (
      'siv', 'out', v_line.item_id, v_siv.source_location_id,
      v_base_quantity, v_base_unit_cost, v_total_cost,
      'siv', v_siv.id, v_line.id, v_siv.siv_number, auth.uid()
    )
    returning id into v_out_transaction_id;

    for v_index in 1 .. coalesce(array_length(v_layer_ids, 1), 0)
    loop
      insert into public.stock_layer_consumptions (
        issue_transaction_id, layer_id, quantity, unit_cost, total_cost
      )
      values (
        v_out_transaction_id,
        v_layer_ids[v_index],
        v_layer_quantities[v_index],
        v_layer_costs[v_index],
        round(v_layer_quantities[v_index] * v_layer_costs[v_index], 6)
      );
    end loop;

    insert into public.stock_transactions (
      transaction_type, direction, item_id, location_id,
      quantity, unit_cost, total_cost,
      reference_type, reference_id, reference_line_id, reference_number, posted_by
    )
    values (
      'siv', 'in', v_line.item_id, v_siv.destination_location_id,
      v_base_quantity, v_base_unit_cost, v_total_cost,
      'siv', v_siv.id, v_line.id, v_siv.siv_number, auth.uid()
    )
    returning id into v_in_transaction_id;

    insert into public.stock_layers (
      item_id, location_id, source_transaction_id,
      original_quantity, remaining_quantity, unit_cost
    )
    values (
      v_line.item_id, v_siv.destination_location_id, v_in_transaction_id,
      v_base_quantity, v_base_quantity, v_base_unit_cost
    );

    update public.siv_lines
       set base_quantity = v_base_quantity,
           posted_cost = v_total_cost
     where id = v_line.id;
  end loop;

  update public.sivs
     set posted_by = auth.uid(),
         posted_at = now()
   where id = v_siv.id and posted_at is null;

  if not found then
    raise exception 'SIV % is already posted', v_siv.siv_number using errcode = '23505';
  end if;
end;
$$;

revoke all on function public.stock_unit_factor(uuid, uuid) from public;
revoke all on function public.can_post_grn() from public;
revoke all on function public.can_post_siv() from public;
revoke all on function public.create_grn(text, uuid, text, date, uuid, text, jsonb) from public;
revoke all on function public.create_siv(text, date, uuid, uuid, text, jsonb) from public;
revoke all on function public.post_grn(uuid) from public;
revoke all on function public.post_siv(uuid) from public;

grant execute on function public.stock_unit_factor(uuid, uuid) to authenticated;
grant execute on function public.can_post_grn() to authenticated;
grant execute on function public.can_post_siv() to authenticated;
grant execute on function public.create_grn(text, uuid, text, date, uuid, text, jsonb) to authenticated;
grant execute on function public.create_siv(text, date, uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.post_grn(uuid) to authenticated;
grant execute on function public.post_siv(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Audit triggers (AUD-01..03)
-- ---------------------------------------------------------------------------
drop trigger if exists grns_audit on public.grns;
create trigger grns_audit
  after insert or update or delete on public.grns
  for each row execute function public.write_audit_log();

drop trigger if exists grn_lines_audit on public.grn_lines;
create trigger grn_lines_audit
  after insert or update or delete on public.grn_lines
  for each row execute function public.write_audit_log();

drop trigger if exists sivs_audit on public.sivs;
create trigger sivs_audit
  after insert or update or delete on public.sivs
  for each row execute function public.write_audit_log();

drop trigger if exists siv_lines_audit on public.siv_lines;
create trigger siv_lines_audit
  after insert or update or delete on public.siv_lines
  for each row execute function public.write_audit_log();

drop trigger if exists stock_transactions_audit on public.stock_transactions;
create trigger stock_transactions_audit
  after insert on public.stock_transactions
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- 13. Row-Level Security
--    Read for active users; no direct writes. Draft creation and posting go
--    through the SECURITY DEFINER functions above, which check roles.
-- ---------------------------------------------------------------------------
alter table public.grns                     enable row level security;
alter table public.grn_lines                enable row level security;
alter table public.sivs                     enable row level security;
alter table public.siv_lines                enable row level security;
alter table public.stock_transactions       enable row level security;
alter table public.stock_layers             enable row level security;
alter table public.stock_layer_consumptions enable row level security;

drop policy if exists grns_select on public.grns;
create policy grns_select on public.grns
  for select to authenticated
  using (public.is_active_user());

drop policy if exists grn_lines_select on public.grn_lines;
create policy grn_lines_select on public.grn_lines
  for select to authenticated
  using (public.is_active_user());

drop policy if exists sivs_select on public.sivs;
create policy sivs_select on public.sivs
  for select to authenticated
  using (public.is_active_user());

drop policy if exists siv_lines_select on public.siv_lines;
create policy siv_lines_select on public.siv_lines
  for select to authenticated
  using (public.is_active_user());

drop policy if exists stock_transactions_select on public.stock_transactions;
create policy stock_transactions_select on public.stock_transactions
  for select to authenticated
  using (public.is_active_user());

drop policy if exists stock_layers_select on public.stock_layers;
create policy stock_layers_select on public.stock_layers
  for select to authenticated
  using (public.is_active_user());

drop policy if exists stock_layer_consumptions_select on public.stock_layer_consumptions;
create policy stock_layer_consumptions_select on public.stock_layer_consumptions
  for select to authenticated
  using (public.is_active_user());

-- No INSERT/UPDATE/DELETE policy exists. Remove the default table grants so a
-- direct PostgREST write cannot bypass the posting functions.
revoke all on public.grns                     from anon, authenticated;
revoke all on public.grn_lines                from anon, authenticated;
revoke all on public.sivs                     from anon, authenticated;
revoke all on public.siv_lines                from anon, authenticated;
revoke all on public.stock_transactions       from anon, authenticated;
revoke all on public.stock_layers             from anon, authenticated;
revoke all on public.stock_layer_consumptions from anon, authenticated;

grant select on public.grns                     to authenticated;
grant select on public.grn_lines                to authenticated;
grant select on public.sivs                     to authenticated;
grant select on public.siv_lines                to authenticated;
grant select on public.stock_transactions       to authenticated;
grant select on public.stock_layers             to authenticated;
grant select on public.stock_layer_consumptions to authenticated;

revoke all on public.stock_balances from anon, authenticated;
revoke all on public.stock_ledger_entries from anon, authenticated;
grant select on public.stock_balances to authenticated;
grant select on public.stock_ledger_entries to authenticated;

-- ---------------------------------------------------------------------------
-- 14. Comments
-- ---------------------------------------------------------------------------
comment on table public.grns is 'Goods receiving note header (GRN-01..05). Draft until posted_at is set.';
comment on table public.grn_lines is 'GRN lines in the entered unit; base_quantity/base_unit_cost are filled on posting (GRN-02, ADR-010).';
comment on table public.sivs is 'Store issue voucher header (SIV-01..05). Draft until posted_at is set.';
comment on table public.siv_lines is 'SIV lines in the entered unit; base_quantity/posted_cost are filled by FIFO posting (SIV-02, ADR-009).';
comment on table public.stock_transactions is 'Append-only stock ledger (STK-01..03, STK-06..07, ADR-007). Balances are derived from here.';
comment on column public.stock_transactions.quantity is 'Quantity in the item base unit (gram, millilitre or piece).';
comment on column public.stock_transactions.unit_cost is 'Internal FIFO cost per base unit. Currencies are rounded to 2 decimals only for display and document totals.';
comment on table public.stock_layers is 'FIFO cost layers (ADR-009). Original quantities never change; remaining_quantity is reduced by issues.';
comment on table public.stock_layer_consumptions is 'Which FIFO layers an issue consumed, and at what cost (ADR-009).';
comment on view public.stock_balances is 'Ledger-derived stock balance by item and location (STK-01, ADR-007). Quantities come from stock_transactions; value comes from remaining FIFO layers.';
comment on view public.stock_ledger_entries is 'Readable stock movement history (STK-06).';
comment on function public.stock_unit_factor(uuid, uuid) is 'Resolves the base-unit factor for an item/unit pair, rejecting dimensions that do not match (ADR-010).';
comment on function public.create_grn(text, uuid, text, date, uuid, text, jsonb) is 'Creates a draft GRN and lines atomically. Role-gated; OD-06 approval steps are not implemented yet.';
comment on function public.create_siv(text, date, uuid, uuid, text, jsonb) is 'Creates a draft SIV and lines atomically. Role-gated; OD-06 approval steps are not implemented yet.';
comment on function public.post_grn(uuid) is 'Posts a GRN once: inserts ledger rows and FIFO layers (GRN-03, GRN-05, ADR-009).';
comment on function public.post_siv(uuid) is 'Posts a SIV once: consumes FIFO layers at source and creates matching layers at destination (SIV-03..05, ADR-009).';
