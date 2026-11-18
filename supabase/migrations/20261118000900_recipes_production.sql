-- Albena RMS — Phase 5 recipes, costing and production
-- Apply after 20261118000800_counts_adjustments_waste.sql.
-- Idempotent: safe to re-run.
--
-- REC-01..07: recipe header (code, name, menu item, notes), immutable version
--             history (yield, selling price, ingredient lines in entered units
--             plus base quantities), publish/archive lifecycle, and a derived
--             costing view (cost, gross profit, food cost %).
-- PROD-01..04: production orders with inputs, actual output, optional expected
--             output/yield %, responsible user, date and location. Posting
--             consumes inputs FIFO and creates the output FIFO layer in one
--             transaction; definitions never deduct stock automatically.
-- STK-02/03:  production output increases stock and production inputs decrease
--             stock through the append-only ledger.
--
-- REC-06 and ADR-008: creating or publishing a recipe never touches stock.
-- Only post_production_order() moves inventory, and only through the ledger.
--
-- The menu entity is Phase 6 (MENU-01..03). Until it exists, a recipe stores
-- the menu item name as text and its selling price on the version. Replacing
-- the text with a menu_items foreign key is a Phase 6 migration; no menu table
-- or menu rule is invented here (CON-07).
--
-- Recipe costing uses the weighted average unit cost of the remaining FIFO
-- layers for each ingredient, across all stock locations, because stock
-- locations are not yet outlet-scoped. An ingredient with no remaining layers
-- costs zero and is counted in lines_without_cost so the UI can flag it. The
-- historical version keeps its quantities, yield and price; the cost shown is
-- always the current ledger cost, which is what REC-03 asks for. No standard
-- cost or price list is invented.

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.recipe_version_status as enum ('draft', 'published', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.production_status as enum ('draft', 'posted');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Recipes and versions (REC-01..03)
-- ---------------------------------------------------------------------------
create table if not exists public.recipes (
  id             uuid primary key default gen_random_uuid(),
  code           text not null,
  name           text not null,
  menu_item_name text,
  notes          text,
  created_by     uuid references auth.users (id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint recipes_code_not_blank check (btrim(code) <> ''),
  constraint recipes_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists recipes_code_unique
  on public.recipes (upper(code));

create table if not exists public.recipe_versions (
  id              uuid primary key default gen_random_uuid(),
  recipe_id       uuid not null references public.recipes (id) on delete cascade,
  version_number  integer not null,
  status          public.recipe_version_status not null default 'draft',
  yield_quantity  numeric(18, 6) not null,
  selling_price   numeric(14, 2) not null,
  notes           text,
  effective_from  date,
  created_by      uuid references auth.users (id) on delete restrict,
  created_at      timestamptz not null default now(),
  published_by    uuid references auth.users (id) on delete restrict,
  published_at    timestamptz,
  constraint recipe_versions_number_positive check (version_number > 0),
  constraint recipe_versions_yield_positive check (yield_quantity > 0),
  constraint recipe_versions_price_non_negative check (selling_price >= 0),
  constraint recipe_versions_recipe_number unique (recipe_id, version_number)
);

create index if not exists recipe_versions_recipe_idx
  on public.recipe_versions (recipe_id, version_number desc);
create index if not exists recipe_versions_status_idx
  on public.recipe_versions (status, created_at desc);

create table if not exists public.recipe_version_lines (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references public.recipe_versions (id) on delete cascade,
  item_id       uuid not null references public.items (id) on delete restrict,
  unit_id       uuid not null references public.units (id) on delete restrict,
  quantity      numeric(18, 6) not null,
  base_quantity numeric(18, 6) not null,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint recipe_version_lines_quantity_positive check (quantity > 0),
  constraint recipe_version_lines_base_positive check (base_quantity > 0)
);

create index if not exists recipe_version_lines_version_idx
  on public.recipe_version_lines (version_id, sort_order);

-- ---------------------------------------------------------------------------
-- 3. Recipe costing view (REC-03, REC-04, REC-05)
-- ---------------------------------------------------------------------------
create or replace view public.recipe_version_costs
with (security_invoker = true)
as
with item_costs as (
  select
    sl.item_id,
    sum(sl.remaining_quantity * sl.unit_cost) / nullif(sum(sl.remaining_quantity), 0)
      as average_unit_cost
  from public.stock_layers sl
  where sl.remaining_quantity > 0
  group by sl.item_id
),
line_costs as (
  select
    l.version_id,
    sum(l.base_quantity * coalesce(ic.average_unit_cost, 0)) as total_cost,
    count(*) filter (where ic.item_id is null) as lines_without_cost
  from public.recipe_version_lines l
  left join item_costs ic on ic.item_id = l.item_id
  group by l.version_id
)
select
  v.id as version_id,
  v.recipe_id,
  r.code as recipe_code,
  r.name as recipe_name,
  r.menu_item_name,
  v.version_number,
  v.status,
  v.yield_quantity,
  v.selling_price,
  v.effective_from,
  round(coalesce(lc.total_cost, 0), 6) as total_cost,
  round(coalesce(lc.total_cost, 0) / v.yield_quantity, 6) as cost_per_portion,
  round(v.selling_price - coalesce(lc.total_cost, 0) / v.yield_quantity, 2) as gross_profit,
  case
    when v.selling_price > 0
      then round(
        (coalesce(lc.total_cost, 0) / v.yield_quantity) / v.selling_price * 100,
        2
      )
  end as food_cost_pct,
  coalesce(lc.lines_without_cost, 0) as lines_without_cost
from public.recipe_versions v
join public.recipes r on r.id = v.recipe_id
left join line_costs lc on lc.version_id = v.id;

-- ---------------------------------------------------------------------------
-- 4. Production orders (PROD-01..04)
-- ---------------------------------------------------------------------------
create table if not exists public.production_orders (
  id                       uuid primary key default gen_random_uuid(),
  order_number             text not null unique,
  production_date          date not null,
  location_id              uuid not null references public.stock_locations (id) on delete restrict,
  output_item_id           uuid not null references public.items (id) on delete restrict,
  output_unit_id           uuid not null references public.units (id) on delete restrict,
  output_quantity          numeric(18, 6) not null,
  output_base_quantity     numeric(18, 6) not null,
  expected_output_quantity numeric(18, 6),
  yield_percentage         numeric(7, 2)
    generated always as (
      case
        when expected_output_quantity is not null and expected_output_quantity > 0
          then round(output_quantity / expected_output_quantity * 100, 2)
      end
    ) stored,
  responsible_name         text not null,
  notes                    text,
  status                   public.production_status not null default 'draft',
  created_by               uuid references auth.users (id) on delete restrict,
  created_at               timestamptz not null default now(),
  posted_by                uuid references auth.users (id) on delete restrict,
  posted_at                timestamptz,
  updated_at               timestamptz not null default now(),
  constraint production_orders_number_not_blank check (btrim(order_number) <> ''),
  constraint production_orders_output_positive check (output_quantity > 0),
  constraint production_orders_output_base_positive check (output_base_quantity > 0),
  constraint production_orders_expected_positive check (
    expected_output_quantity is null or expected_output_quantity > 0
  ),
  constraint production_orders_responsible_not_blank check (btrim(responsible_name) <> '')
);

create index if not exists production_orders_created_at_idx
  on public.production_orders (created_at desc);
create index if not exists production_orders_status_idx
  on public.production_orders (status, production_date desc);

create table if not exists public.production_inputs (
  id              uuid primary key default gen_random_uuid(),
  production_id   uuid not null references public.production_orders (id) on delete cascade,
  item_id         uuid not null references public.items (id) on delete restrict,
  unit_id         uuid not null references public.units (id) on delete restrict,
  quantity        numeric(18, 6) not null,
  base_quantity   numeric(18, 6) not null,
  posted_cost     numeric(18, 6),
  created_at      timestamptz not null default now(),
  constraint production_inputs_quantity_positive check (quantity > 0),
  constraint production_inputs_base_positive check (base_quantity > 0),
  constraint production_inputs_item_once unique (production_id, item_id)
);

create index if not exists production_inputs_production_idx
  on public.production_inputs (production_id);

-- ---------------------------------------------------------------------------
-- 5. Authorization helpers
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_recipes()
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
      or public.has_role('executive_chef')
    );
$$;

create or replace function public.can_manage_production()
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
      or public.has_role('executive_chef')
    );
$$;

-- ---------------------------------------------------------------------------
-- 6. Internal: validate and insert recipe lines
-- ---------------------------------------------------------------------------
create or replace function public.insert_recipe_version_lines(
  p_version_id uuid,
  p_lines jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_quantity numeric;
  v_factor numeric(18, 6);
  v_base_quantity numeric(18, 6);
  v_count integer := 0;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A recipe version needs at least one ingredient' using errcode = '23514';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_item_id := nullif(v_line ->> 'item_id', '')::uuid;
    v_unit_id := nullif(v_line ->> 'unit_id', '')::uuid;
    v_quantity := nullif(v_line ->> 'quantity', '')::numeric;

    if v_item_id is null or not exists (
      select 1 from public.items i where i.id = v_item_id and i.is_active
    ) then
      raise exception 'Every ingredient needs an active item' using errcode = '23514';
    end if;
    if v_unit_id is null then
      raise exception 'Every ingredient needs a unit' using errcode = '23514';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Every ingredient needs a quantity greater than zero' using errcode = '23514';
    end if;

    -- Rejects a unit with no conversion to this item's base unit (ADR-010).
    v_factor := public.stock_unit_factor(v_item_id, v_unit_id);
    v_base_quantity := round(v_quantity * v_factor, 6);
    if v_base_quantity <= 0 then
      raise exception 'The converted ingredient quantity must be greater than zero'
        using errcode = '23514';
    end if;

    insert into public.recipe_version_lines (
      version_id, item_id, unit_id, quantity, base_quantity, sort_order
    )
    values (p_version_id, v_item_id, v_unit_id, v_quantity, v_base_quantity, v_count);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Create a recipe with its first draft version (REC-01, REC-02)
-- ---------------------------------------------------------------------------
create or replace function public.create_recipe(
  p_code text,
  p_name text,
  p_menu_item_name text,
  p_notes text,
  p_yield_quantity numeric,
  p_selling_price numeric,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recipe_id uuid;
  v_version_id uuid;
begin
  if not public.can_manage_recipes() then
    raise exception 'You do not have permission to manage recipes' using errcode = '42501';
  end if;

  if nullif(btrim(p_code), '') is null then
    raise exception 'A recipe code is required' using errcode = '23514';
  end if;
  if length(btrim(p_code)) > 40 then
    raise exception 'Use 40 characters or fewer for the recipe code' using errcode = '23514';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'A recipe name is required' using errcode = '23514';
  end if;
  if length(btrim(p_name)) > 120 then
    raise exception 'Use 120 characters or fewer for the recipe name' using errcode = '23514';
  end if;
  if p_yield_quantity is null or p_yield_quantity <= 0 then
    raise exception 'The recipe yield must be greater than zero' using errcode = '23514';
  end if;
  if p_selling_price is null or p_selling_price < 0 then
    raise exception 'The selling price cannot be negative' using errcode = '23514';
  end if;

  insert into public.recipes (code, name, menu_item_name, notes, created_by)
  values (
    upper(btrim(p_code)),
    btrim(p_name),
    nullif(btrim(coalesce(p_menu_item_name, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_recipe_id;

  insert into public.recipe_versions (
    recipe_id, version_number, status, yield_quantity, selling_price, notes, created_by
  )
  values (
    v_recipe_id, 1, 'draft', p_yield_quantity, round(p_selling_price, 2),
    nullif(btrim(coalesce(p_notes, '')), ''), auth.uid()
  )
  returning id into v_version_id;

  perform public.insert_recipe_version_lines(v_version_id, p_lines);

  return v_recipe_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Create a new draft version of an existing recipe (REC-02)
-- ---------------------------------------------------------------------------
create or replace function public.create_recipe_version(
  p_recipe_id uuid,
  p_notes text,
  p_yield_quantity numeric,
  p_selling_price numeric,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version_id uuid;
  v_next_number integer;
begin
  if not public.can_manage_recipes() then
    raise exception 'You do not have permission to manage recipes' using errcode = '42501';
  end if;

  perform 1 from public.recipes where id = p_recipe_id for update;
  if not found then
    raise exception 'Recipe % does not exist', p_recipe_id using errcode = 'P0002';
  end if;

  if p_yield_quantity is null or p_yield_quantity <= 0 then
    raise exception 'The recipe yield must be greater than zero' using errcode = '23514';
  end if;
  if p_selling_price is null or p_selling_price < 0 then
    raise exception 'The selling price cannot be negative' using errcode = '23514';
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_number
  from public.recipe_versions
  where recipe_id = p_recipe_id;

  insert into public.recipe_versions (
    recipe_id, version_number, status, yield_quantity, selling_price, notes, created_by
  )
  values (
    p_recipe_id, v_next_number, 'draft', p_yield_quantity, round(p_selling_price, 2),
    nullif(btrim(coalesce(p_notes, '')), ''), auth.uid()
  )
  returning id into v_version_id;

  perform public.insert_recipe_version_lines(v_version_id, p_lines);

  return v_version_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Update recipe header metadata (REC-02)
--    Code is immutable because it identifies the recipe on documents.
-- ---------------------------------------------------------------------------
create or replace function public.update_recipe(
  p_recipe_id uuid,
  p_name text,
  p_menu_item_name text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_recipes() then
    raise exception 'You do not have permission to manage recipes' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'A recipe name is required' using errcode = '23514';
  end if;
  if length(btrim(p_name)) > 120 then
    raise exception 'Use 120 characters or fewer for the recipe name' using errcode = '23514';
  end if;

  update public.recipes
     set name = btrim(p_name),
         menu_item_name = nullif(btrim(coalesce(p_menu_item_name, '')), ''),
         notes = nullif(btrim(coalesce(p_notes, '')), ''),
         updated_at = now()
   where id = p_recipe_id;

  if not found then
    raise exception 'Recipe % does not exist', p_recipe_id using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Publish a draft version (REC-02)
--     One published version per recipe; the previous one is archived, never
--     deleted, so historical versions stay available for costing.
-- ---------------------------------------------------------------------------
create or replace function public.publish_recipe_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version public.recipe_versions%rowtype;
begin
  if not public.can_manage_recipes() then
    raise exception 'You do not have permission to manage recipes' using errcode = '42501';
  end if;

  select * into v_version
  from public.recipe_versions
  where id = p_version_id
  for update;

  if not found then
    raise exception 'Recipe version % does not exist', p_version_id using errcode = 'P0002';
  end if;
  if v_version.status <> 'draft' then
    raise exception 'Only a draft version can be published' using errcode = '23514';
  end if;

  update public.recipe_versions
     set status = 'archived'
   where recipe_id = v_version.recipe_id
     and status = 'published'
     and id <> p_version_id;

  update public.recipe_versions
     set status = 'published',
         published_by = auth.uid(),
         published_at = now(),
         effective_from = coalesce(effective_from, current_date)
   where id = p_version_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Create a production order draft (PROD-01, PROD-02)
-- ---------------------------------------------------------------------------
create or replace function public.create_production_order(
  p_order_number text,
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
  v_quantity numeric;
  v_factor numeric(18, 6);
  v_output_base_quantity numeric(18, 6);
  v_item_ids uuid[] := '{}';
  v_count integer := 0;
begin
  if not public.can_manage_production() then
    raise exception 'You do not have permission to record production' using errcode = '42501';
  end if;

  if nullif(btrim(p_order_number), '') is null then
    raise exception 'A production number is required' using errcode = '23514';
  end if;
  if length(btrim(p_order_number)) > 40 then
    raise exception 'Use 40 characters or fewer for the production number' using errcode = '23514';
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
    raise exception 'The converted output quantity must be greater than zero' using errcode = '23514';
  end if;

  if p_inputs is null or jsonb_typeof(p_inputs) <> 'array' or jsonb_array_length(p_inputs) = 0 then
    raise exception 'A production order needs at least one input' using errcode = '23514';
  end if;

  insert into public.production_orders (
    order_number, production_date, location_id,
    output_item_id, output_unit_id, output_quantity, output_base_quantity,
    expected_output_quantity, responsible_name, notes, created_by
  )
  values (
    upper(btrim(p_order_number)),
    p_production_date,
    p_location_id,
    p_output_item_id,
    p_output_unit_id,
    p_output_quantity,
    v_output_base_quantity,
    p_expected_output_quantity,
    btrim(p_responsible_name),
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_id;

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
    values (v_id, v_item_id, v_unit_id, v_quantity, round(v_quantity * v_factor, 6));

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A production order needs at least one input' using errcode = '23514';
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Post a production order (PROD-03, PROD-04)
--     Decreases every input through FIFO and increases the output with the
--     consumed cost, all in one transaction. Definitions never move stock
--     (REC-06, ADR-008).
-- ---------------------------------------------------------------------------
create or replace function public.post_production_order(p_production_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.production_orders%rowtype;
  v_input public.production_inputs%rowtype;
  v_input_count integer := 0;
  v_total_cost numeric(18, 6) := 0;
  v_input_cost numeric(18, 6);
  v_output_unit_cost numeric(18, 6);
begin
  if not public.can_manage_production() then
    raise exception 'You do not have permission to post production' using errcode = '42501';
  end if;

  select * into v_order
  from public.production_orders
  where id = p_production_id
  for update;

  if not found then
    raise exception 'Production order % does not exist', p_production_id using errcode = 'P0002';
  end if;
  if v_order.status <> 'draft' then
    raise exception 'Production order % is already posted', v_order.order_number
      using errcode = '23505';
  end if;

  for v_input in
    select *
    from public.production_inputs
    where production_id = p_production_id
    order by id
  loop
    v_input_cost := public.post_stock_out(
      'production',
      v_input.item_id,
      v_order.location_id,
      v_input.base_quantity,
      'production_order',
      v_order.id,
      v_input.id,
      v_order.order_number
    );

    update public.production_inputs
       set posted_cost = v_input_cost
     where id = v_input.id;

    v_total_cost := v_total_cost + v_input_cost;
    v_input_count := v_input_count + 1;
  end loop;

  if v_input_count = 0 then
    raise exception 'Production order % has no inputs', v_order.order_number
      using errcode = '23514';
  end if;

  v_output_unit_cost := round(v_total_cost / v_order.output_base_quantity, 6);

  perform public.post_stock_in(
    'production',
    v_order.output_item_id,
    v_order.location_id,
    v_order.output_base_quantity,
    v_output_unit_cost,
    'production_order',
    v_order.id,
    null,
    v_order.order_number
  );

  update public.production_orders
     set status = 'posted',
         posted_by = auth.uid(),
         posted_at = now(),
         updated_at = now()
   where id = v_order.id
     and status = 'draft';

  if not found then
    raise exception 'Production order % is already posted', v_order.order_number
      using errcode = '23505';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Function privileges
-- ---------------------------------------------------------------------------
revoke all on function public.can_manage_recipes() from public;
revoke all on function public.can_manage_production() from public;
revoke all on function public.insert_recipe_version_lines(uuid, jsonb) from public;
revoke all on function public.create_recipe(text, text, text, text, numeric, numeric, jsonb) from public;
revoke all on function public.create_recipe_version(uuid, text, numeric, numeric, jsonb) from public;
revoke all on function public.update_recipe(uuid, text, text, text) from public;
revoke all on function public.publish_recipe_version(uuid) from public;
revoke all on function public.create_production_order(
  text, date, uuid, uuid, uuid, numeric, numeric, text, text, jsonb
) from public;
revoke all on function public.post_production_order(uuid) from public;

grant execute on function public.can_manage_recipes() to authenticated;
grant execute on function public.can_manage_production() to authenticated;
grant execute on function public.create_recipe(text, text, text, text, numeric, numeric, jsonb) to authenticated;
grant execute on function public.create_recipe_version(uuid, text, numeric, numeric, jsonb) to authenticated;
grant execute on function public.update_recipe(uuid, text, text, text) to authenticated;
grant execute on function public.publish_recipe_version(uuid) to authenticated;
grant execute on function public.create_production_order(
  text, date, uuid, uuid, uuid, numeric, numeric, text, text, jsonb
) to authenticated;
grant execute on function public.post_production_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 14. Audit triggers (AUD-01..03)
-- ---------------------------------------------------------------------------
drop trigger if exists recipes_audit on public.recipes;
create trigger recipes_audit
  after insert or update or delete on public.recipes
  for each row execute function public.write_audit_log();

drop trigger if exists recipe_versions_audit on public.recipe_versions;
create trigger recipe_versions_audit
  after insert or update or delete on public.recipe_versions
  for each row execute function public.write_audit_log();

drop trigger if exists recipe_version_lines_audit on public.recipe_version_lines;
create trigger recipe_version_lines_audit
  after insert or update or delete on public.recipe_version_lines
  for each row execute function public.write_audit_log();

drop trigger if exists production_orders_audit on public.production_orders;
create trigger production_orders_audit
  after insert or update or delete on public.production_orders
  for each row execute function public.write_audit_log();

drop trigger if exists production_inputs_audit on public.production_inputs;
create trigger production_inputs_audit
  after insert or update or delete on public.production_inputs
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- 15. Row-Level Security
--      Read for active users; no direct writes. All writes go through the
--      SECURITY DEFINER functions above.
-- ---------------------------------------------------------------------------
alter table public.recipes               enable row level security;
alter table public.recipe_versions       enable row level security;
alter table public.recipe_version_lines  enable row level security;
alter table public.production_orders     enable row level security;
alter table public.production_inputs     enable row level security;

drop policy if exists recipes_select on public.recipes;
create policy recipes_select on public.recipes
  for select to authenticated
  using (public.is_active_user());

drop policy if exists recipe_versions_select on public.recipe_versions;
create policy recipe_versions_select on public.recipe_versions
  for select to authenticated
  using (public.is_active_user());

drop policy if exists recipe_version_lines_select on public.recipe_version_lines;
create policy recipe_version_lines_select on public.recipe_version_lines
  for select to authenticated
  using (public.is_active_user());

drop policy if exists production_orders_select on public.production_orders;
create policy production_orders_select on public.production_orders
  for select to authenticated
  using (public.is_active_user());

drop policy if exists production_inputs_select on public.production_inputs;
create policy production_inputs_select on public.production_inputs
  for select to authenticated
  using (public.is_active_user());

revoke all on public.recipes              from anon, authenticated;
revoke all on public.recipe_versions      from anon, authenticated;
revoke all on public.recipe_version_lines from anon, authenticated;
revoke all on public.production_orders    from anon, authenticated;
revoke all on public.production_inputs    from anon, authenticated;

grant select on public.recipes              to authenticated;
grant select on public.recipe_versions      to authenticated;
grant select on public.recipe_version_lines to authenticated;
grant select on public.production_orders    to authenticated;
grant select on public.production_inputs    to authenticated;

revoke all on public.recipe_version_costs from anon, authenticated;
grant select on public.recipe_version_costs to authenticated;

-- ---------------------------------------------------------------------------
-- 16. Comments
-- ---------------------------------------------------------------------------
comment on table public.recipes is 'Recipe header (REC-01, REC-02). The menu item stays text until the Phase 6 menu entity exists.';
comment on table public.recipe_versions is 'Immutable recipe versions (REC-02). Draft → published; publishing archives the previous published version.';
comment on table public.recipe_version_lines is 'Ingredient lines in the entered unit plus the base quantity resolved at creation (ADR-010).';
comment on view public.recipe_version_costs is 'Recipe costing (REC-03..05): current FIFO weighted-average ingredient cost, cost per portion, gross profit and food cost %.';
comment on table public.production_orders is 'Production order header (PROD-01..04): location, actual output, optional expected output/yield %, responsible user and posting state.';
comment on table public.production_inputs is 'Consumed inputs with base quantities and the FIFO cost recorded at posting.';
comment on function public.create_recipe(text, text, text, text, numeric, numeric, jsonb) is 'Creates a recipe and its first draft version atomically (REC-01, REC-02).';
comment on function public.create_recipe_version(uuid, text, numeric, numeric, jsonb) is 'Adds the next draft version without deleting history (REC-02).';
comment on function public.publish_recipe_version(uuid) is 'Publishes a draft version and archives the previous published version (REC-02).';
comment on function public.create_production_order(text, date, uuid, uuid, uuid, numeric, numeric, text, text, jsonb) is 'Creates a production draft with validated inputs and resolved base quantities (PROD-01..02).';
comment on function public.post_production_order(uuid) is 'Posts production once: consumes inputs FIFO and creates the output layer atomically (PROD-03, STK-02/03).';
