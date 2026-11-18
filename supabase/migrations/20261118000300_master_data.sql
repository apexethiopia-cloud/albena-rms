-- Albena RMS — Phase 3 master data
-- Stock locations, item categories, units, suppliers and items.
-- Apply after 20261118000100_foundation.sql.
-- Idempotent: safe to re-run.
--
-- OD-05 / ADR-010: stock is stored in base units (gram, millilitre, piece).
-- Fixed units carry a global factor (kg = 1000 g, L = 1000 ml). Boxes, cartons
-- and sacks have no universal size, so their factor is stored per item in
-- item_unit_conversions and must be entered explicitly.

-- ---------------------------------------------------------------------------
-- 1. Stock locations (INV-03)
-- ---------------------------------------------------------------------------
create table if not exists public.stock_locations (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Item categories (INV-02)
-- ---------------------------------------------------------------------------
create table if not exists public.item_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Units and item-specific conversions (OD-05 / ADR-010)
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.unit_dimension as enum ('mass', 'volume', 'count');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.units (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  dimension   public.unit_dimension not null,
  is_base     boolean not null default false,
  -- NULL means the unit has no global size and requires an item-specific factor.
  base_factor numeric(18, 6),
  created_at  timestamptz not null default now(),
  constraint units_factor_positive check (base_factor is null or base_factor > 0),
  constraint units_base_requires_factor check (not is_base or base_factor = 1)
);

create table if not exists public.item_unit_conversions (
  item_id     uuid not null,
  unit_id     uuid not null references public.units (id) on delete restrict,
  -- Base units (g / ml / piece) contained in one of this unit for this item.
  base_factor numeric(18, 6) not null,
  created_at  timestamptz not null default now(),
  primary key (item_id, unit_id),
  constraint item_unit_conversions_factor_positive check (base_factor > 0)
);

-- ---------------------------------------------------------------------------
-- 4. Suppliers (SUP-01..03)
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  contact_name  text,
  phone         text,
  email         text,
  address       text,
  tax_number    text,
  payment_terms text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists suppliers_name_idx on public.suppliers (lower(name));

-- ---------------------------------------------------------------------------
-- 5. Items (INV-01..06)
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  category_id     uuid references public.item_categories (id) on delete restrict,
  base_unit_id    uuid not null references public.units (id) on delete restrict,
  purchase_unit_id uuid references public.units (id) on delete restrict,
  reorder_level   numeric(18, 6) not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint items_reorder_level_non_negative check (reorder_level >= 0)
);

alter table public.item_unit_conversions
  drop constraint if exists item_unit_conversions_item_fk;
alter table public.item_unit_conversions
  add constraint item_unit_conversions_item_fk
  foreign key (item_id) references public.items (id) on delete cascade;

create index if not exists items_category_idx on public.items (category_id);
create index if not exists items_name_idx on public.items (lower(name));

-- ---------------------------------------------------------------------------
-- 6. updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists stock_locations_set_updated_at on public.stock_locations;
create trigger stock_locations_set_updated_at
  before update on public.stock_locations
  for each row execute function public.set_updated_at();

drop trigger if exists item_categories_set_updated_at on public.item_categories;
create trigger item_categories_set_updated_at
  before update on public.item_categories
  for each row execute function public.set_updated_at();

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Audit triggers (AUD-01)
-- ---------------------------------------------------------------------------
drop trigger if exists stock_locations_audit on public.stock_locations;
create trigger stock_locations_audit
  after insert or update or delete on public.stock_locations
  for each row execute function public.write_audit_log();

drop trigger if exists item_categories_audit on public.item_categories;
create trigger item_categories_audit
  after insert or update or delete on public.item_categories
  for each row execute function public.write_audit_log();

drop trigger if exists units_audit on public.units;
create trigger units_audit
  after insert or update or delete on public.units
  for each row execute function public.write_audit_log();

drop trigger if exists item_unit_conversions_audit on public.item_unit_conversions;
create trigger item_unit_conversions_audit
  after insert or update or delete on public.item_unit_conversions
  for each row execute function public.write_audit_log();

drop trigger if exists suppliers_audit on public.suppliers;
create trigger suppliers_audit
  after insert or update or delete on public.suppliers
  for each row execute function public.write_audit_log();

drop trigger if exists items_audit on public.items;
create trigger items_audit
  after insert or update or delete on public.items
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- 8. Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.stock_locations        enable row level security;
alter table public.item_categories        enable row level security;
alter table public.units                  enable row level security;
alter table public.item_unit_conversions  enable row level security;
alter table public.suppliers              enable row level security;
alter table public.items                  enable row level security;

-- Reference data: read for active users, manage for admin / general manager.
drop policy if exists stock_locations_select on public.stock_locations;
create policy stock_locations_select on public.stock_locations
  for select to authenticated
  using (public.is_active_user());

drop policy if exists stock_locations_write on public.stock_locations;
create policy stock_locations_write on public.stock_locations
  for all to authenticated
  using (public.is_admin() or public.has_role('general_manager'))
  with check (public.is_admin() or public.has_role('general_manager'));

drop policy if exists item_categories_select on public.item_categories;
create policy item_categories_select on public.item_categories
  for select to authenticated
  using (public.is_active_user());

drop policy if exists item_categories_write on public.item_categories;
create policy item_categories_write on public.item_categories
  for all to authenticated
  using (public.is_admin() or public.has_role('general_manager'))
  with check (public.is_admin() or public.has_role('general_manager'));

drop policy if exists units_select on public.units;
create policy units_select on public.units
  for select to authenticated
  using (public.is_active_user());

drop policy if exists units_write on public.units;
create policy units_write on public.units
  for all to authenticated
  using (public.is_admin() or public.has_role('general_manager'))
  with check (public.is_admin() or public.has_role('general_manager'));

-- Suppliers: purchasing owns them.
drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers
  for select to authenticated
  using (public.is_active_user());

drop policy if exists suppliers_write on public.suppliers;
create policy suppliers_write on public.suppliers
  for all to authenticated
  using (
    public.is_admin()
    or public.has_role('general_manager')
    or public.has_role('purchasing_officer')
  )
  with check (
    public.is_admin()
    or public.has_role('general_manager')
    or public.has_role('purchasing_officer')
  );

-- Items: purchasing, stores and the chef can maintain them.
drop policy if exists items_select on public.items;
create policy items_select on public.items
  for select to authenticated
  using (public.is_active_user());

drop policy if exists items_write on public.items;
create policy items_write on public.items
  for all to authenticated
  using (
    public.is_admin()
    or public.has_role('general_manager')
    or public.has_role('purchasing_officer')
    or public.has_role('storekeeper')
    or public.has_role('executive_chef')
  )
  with check (
    public.is_admin()
    or public.has_role('general_manager')
    or public.has_role('purchasing_officer')
    or public.has_role('storekeeper')
    or public.has_role('executive_chef')
  );

-- Item conversions follow the item's write permissions.
drop policy if exists item_unit_conversions_select on public.item_unit_conversions;
create policy item_unit_conversions_select on public.item_unit_conversions
  for select to authenticated
  using (public.is_active_user());

drop policy if exists item_unit_conversions_write on public.item_unit_conversions;
create policy item_unit_conversions_write on public.item_unit_conversions
  for all to authenticated
  using (
    public.is_admin()
    or public.has_role('general_manager')
    or public.has_role('purchasing_officer')
    or public.has_role('storekeeper')
    or public.has_role('executive_chef')
  )
  with check (
    public.is_admin()
    or public.has_role('general_manager')
    or public.has_role('purchasing_officer')
    or public.has_role('storekeeper')
    or public.has_role('executive_chef')
  );

comment on table public.units is 'Unit catalogue (ADR-010). base_factor NULL = item-specific size.';
comment on table public.item_unit_conversions is 'Per-item factor from a purchase unit to the base unit (boxes, cartons, sacks).';
comment on table public.suppliers is 'Supplier master (SUP-01..03).';
comment on table public.items is 'Inventory item master (INV-01..06). Balances live in the stock ledger, not here.';
comment on column public.items.base_unit_id is 'Must reference a base unit: g (mass), ml (volume) or piece (count). Stock is stored in this unit.';
comment on column public.items.reorder_level is 'Expressed in the item base unit. Compared against ledger-derived balances in Phase 4.';
comment on column public.items.purchase_unit_id is 'Default buying unit. A factor to the base unit is required in item_unit_conversions unless it is the base unit or a fixed-factor unit.';
comment on column public.item_unit_conversions.base_factor is 'How many base units one of this unit contains for this item. Example: 1 carton = 24 bottles = 24 pieces.';
