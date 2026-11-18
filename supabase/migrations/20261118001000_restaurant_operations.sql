-- Albena RMS — Phase 6 restaurant operations
-- Apply after 20261118000900_recipes_production.sql.
-- Idempotent: safe to re-run.
--
-- MENU-01..03: menu categories and items with a code, name, category,
--              VAT-inclusive selling price, optional recipe link and an
--              active flag. Order lines snapshot the item name and price, so
--              editing a menu item never rewrites history.
-- TBL-01..04:  tables per outlet with the SRS statuses, manual status changes
--              through a role-gated RPC, and server-side prevention of two
--              open orders on the same table.
-- RES-01..04:  reservation numbers, guest name/phone per reservation (no
--              guest profile or cross-visit history, owner decision OD-10),
--              status lifecycle, optional table assignment, exact-slot
--              double-booking prevention and a slot-load view for the
--              overbooking warning (OD-09).
-- ORD-01..06:  orders with price snapshots, statuses, optimistic concurrency
--              through a revision counter, modify/cancel/transfer/split/merge
--              RPCs and post-send permission control.
-- KDS-01..05:  order status changes are the data source for the kitchen
--              display; the orders and order_lines tables are added to the
--              Supabase Realtime publication so connected clients see changes
--              over the internet. Offline KDS stays out of scope.
-- RCT-01..05:  receipts numbered per outlet per business day, business
--              identity snapshotted from settings, VAT extracted from
--              VAT-inclusive prices (OD-07), browser printing/PDF only, no
--              payment credentials.
--
-- Owner decisions (2026-11-18):
--   OD-07 VAT 15% only, menu prices include VAT, no service charge or
--         discounts. VAT shown on the receipt is total × 15 / 115.
--   OD-08 receipts use <outlet code>-YYYYMMDD-#### per outlet per day;
--         business name, TIN, address and phone are editable in Settings.
--   OD-09 table assignment is optional; the UI warns when reservations for
--         the same outlet, date and time exceed the active tables.
--   OD-10 reservations keep the guest name and phone required by RES-01, but
--         no guest profile or guest-history table exists (RES-03 dropped).
--   OD-12 hotel features (room charges, room service, folios) are deferred.
--
-- Timezone: document numbers and business-day grouping use the
-- Africa/Addis_Ababa date (OD-01), not the database UTC date.

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.table_status as enum (
    'available', 'occupied', 'reserved', 'cleaning', 'closed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.reservation_status as enum (
    'booked', 'confirmed', 'arrived', 'cancelled', 'completed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.order_status as enum (
    'pending', 'sent_to_kitchen', 'preparing', 'ready', 'served', 'closed', 'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Business identity and VAT settings (OD-08, OD-07)
-- ---------------------------------------------------------------------------
create table if not exists public.business_settings (
  id             boolean primary key default true,
  business_name  text not null default 'Albena',
  tin            text,
  address        text,
  phone          text,
  vat_rate       numeric(5, 2) not null default 15.00,
  receipt_footer text,
  updated_at     timestamptz not null default now(),
  constraint business_settings_single_row check (id),
  constraint business_settings_name_not_blank check (btrim(business_name) <> ''),
  constraint business_settings_vat_range check (vat_rate >= 0 and vat_rate <= 100)
);

insert into public.business_settings (id)
values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Menu (MENU-01..03)
-- ---------------------------------------------------------------------------
create table if not exists public.menu_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_categories_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists menu_categories_name_unique
  on public.menu_categories (lower(name));

insert into public.menu_categories (name, sort_order) values
  ('Appetizers', 10),
  ('Main Course', 20),
  ('Desserts', 30),
  ('Beverages', 40)
on conflict (lower(name)) do nothing;

create table if not exists public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  name          text not null,
  category_id   uuid references public.menu_categories (id) on delete restrict,
  selling_price numeric(14, 2) not null,
  recipe_id     uuid references public.recipes (id) on delete set null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint menu_items_code_not_blank check (btrim(code) <> ''),
  constraint menu_items_name_not_blank check (btrim(name) <> ''),
  constraint menu_items_price_non_negative check (selling_price >= 0)
);

create unique index if not exists menu_items_code_unique
  on public.menu_items (upper(code));
create index if not exists menu_items_category_idx
  on public.menu_items (category_id, name);

-- ---------------------------------------------------------------------------
-- 4. Tables (TBL-01..04)
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_tables (
  id         uuid primary key default gen_random_uuid(),
  outlet_id  uuid not null references public.outlets (id) on delete restrict,
  code       text not null,
  name       text not null,
  capacity   integer not null default 2,
  status     public.table_status not null default 'available',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_tables_code_not_blank check (btrim(code) <> ''),
  constraint restaurant_tables_name_not_blank check (btrim(name) <> ''),
  constraint restaurant_tables_capacity_positive check (capacity > 0)
);

create unique index if not exists restaurant_tables_outlet_code_unique
  on public.restaurant_tables (outlet_id, upper(code));
create index if not exists restaurant_tables_outlet_status_idx
  on public.restaurant_tables (outlet_id, status, code);

-- ---------------------------------------------------------------------------
-- 5. Reservations (RES-01..04, OD-09, OD-10)
-- ---------------------------------------------------------------------------
create table if not exists public.reservations (
  id                uuid primary key default gen_random_uuid(),
  reservation_number text not null unique,
  outlet_id         uuid not null references public.outlets (id) on delete restrict,
  guest_name        text not null,
  guest_phone       text not null,
  reserved_date     date not null,
  reserved_time     time not null,
  party_size        integer not null,
  table_id          uuid references public.restaurant_tables (id) on delete set null,
  special_requests  text,
  status            public.reservation_status not null default 'booked',
  created_by        uuid references auth.users (id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  status_updated_by uuid references auth.users (id) on delete restrict,
  status_updated_at timestamptz,
  constraint reservations_guest_name_not_blank check (btrim(guest_name) <> ''),
  constraint reservations_guest_phone_not_blank check (btrim(guest_phone) <> ''),
  constraint reservations_party_positive check (party_size > 0)
);

-- Only one active reservation per table and exact slot. The UI still warns
-- when the number of active reservations exceeds the active tables.
create unique index if not exists reservations_table_slot_unique
  on public.reservations (table_id, reserved_date, reserved_time)
  where table_id is not null
    and status in ('booked', 'confirmed', 'arrived');
create index if not exists reservations_slot_idx
  on public.reservations (outlet_id, reserved_date, reserved_time);
create index if not exists reservations_status_idx
  on public.reservations (status, reserved_date);

-- ---------------------------------------------------------------------------
-- 6. Document numbering (orders, receipts, reservations)
-- ---------------------------------------------------------------------------
create table if not exists public.document_sequences (
  outlet_id     uuid not null references public.outlets (id) on delete cascade,
  doc_type      text not null,
  sequence_date date not null,
  last_number   integer not null default 0,
  primary key (outlet_id, doc_type, sequence_date),
  constraint document_sequences_type_valid check (
    doc_type in ('order', 'receipt', 'reservation')
  ),
  constraint document_sequences_number_non_negative check (last_number >= 0)
);

create or replace function public.business_today()
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (now() at time zone 'Africa/Addis_Ababa')::date;
$$;

create or replace function public.next_document_number(
  p_outlet_id uuid,
  p_doc_type text,
  p_prefix text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outlet_code text;
  v_number integer;
begin
  if p_doc_type not in ('order', 'receipt', 'reservation') then
    raise exception 'Unknown document type' using errcode = '23514';
  end if;

  select upper(btrim(code)) into v_outlet_code
  from public.outlets
  where id = p_outlet_id;

  if v_outlet_code is null then
    raise exception 'Choose a valid outlet' using errcode = '23503';
  end if;

  insert into public.document_sequences as seq (outlet_id, doc_type, sequence_date, last_number)
  values (p_outlet_id, p_doc_type, public.business_today(), 1)
  on conflict (outlet_id, doc_type, sequence_date)
  do update set last_number = seq.last_number + 1
  returning last_number into v_number;

  return concat_ws(
    '-',
    nullif(upper(btrim(coalesce(p_prefix, ''))), ''),
    v_outlet_code,
    to_char(public.business_today(), 'YYYYMMDD'),
    lpad(v_number::text, 4, '0')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Orders and lines (ORD-01..06, RCT-05)
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  text not null unique,
  outlet_id     uuid not null references public.outlets (id) on delete restrict,
  table_id      uuid references public.restaurant_tables (id) on delete set null,
  waiter_id     uuid references auth.users (id) on delete restrict,
  waiter_name   text not null default '',
  status        public.order_status not null default 'pending',
  revision      integer not null default 1,
  notes         text,
  opened_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  sent_at       timestamptz,
  preparing_at  timestamptz,
  ready_at      timestamptz,
  served_at     timestamptz,
  closed_at     timestamptz,
  closed_by     uuid references auth.users (id) on delete restrict,
  cancelled_at  timestamptz,
  cancelled_by  uuid references auth.users (id) on delete restrict,
  cancel_reason text,
  subtotal      numeric(14, 2),
  vat_amount    numeric(14, 2),
  total         numeric(14, 2),
  constraint orders_revision_positive check (revision > 0),
  constraint orders_closed_totals check (
    status <> 'closed'
    or (closed_at is not null and subtotal is not null and vat_amount is not null and total is not null)
  ),
  constraint orders_cancelled_fields check (
    status <> 'cancelled' or cancelled_at is not null
  )
);

-- TBL-04: at most one open order per table.
create unique index if not exists orders_one_open_per_table
  on public.orders (table_id)
  where table_id is not null
    and status in ('pending', 'sent_to_kitchen', 'preparing', 'ready', 'served');
create index if not exists orders_outlet_status_idx
  on public.orders (outlet_id, status, opened_at desc);
create index if not exists orders_open_idx
  on public.orders (status, opened_at);

create table if not exists public.order_lines (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete cascade,
  menu_item_id         uuid references public.menu_items (id) on delete restrict,
  item_code            text not null,
  item_name            text not null,
  unit_price           numeric(14, 2) not null,
  quantity             integer not null,
  line_total           numeric(14, 2)
    generated always as (round(unit_price * quantity, 2)) stored,
  special_instructions text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint order_lines_code_not_blank check (btrim(item_code) <> ''),
  constraint order_lines_name_not_blank check (btrim(item_name) <> ''),
  constraint order_lines_price_non_negative check (unit_price >= 0),
  constraint order_lines_quantity_positive check (quantity > 0)
);

create index if not exists order_lines_order_idx
  on public.order_lines (order_id);

-- ---------------------------------------------------------------------------
-- 8. Receipts (RCT-01..05)
-- ---------------------------------------------------------------------------
create table if not exists public.receipts (
  id               uuid primary key default gen_random_uuid(),
  receipt_number   text not null unique,
  order_id         uuid not null unique references public.orders (id) on delete restrict,
  outlet_id        uuid not null references public.outlets (id) on delete restrict,
  issued_at        timestamptz not null default now(),
  issued_by        uuid references auth.users (id) on delete restrict,
  business_name    text not null,
  business_tin     text,
  business_address text,
  business_phone   text,
  vat_rate         numeric(5, 2) not null,
  subtotal         numeric(14, 2) not null,
  vat_amount       numeric(14, 2) not null,
  total            numeric(14, 2) not null,
  table_code       text,
  waiter_name      text not null default '',
  receipt_footer   text,
  line_count       integer not null default 0,
  constraint receipts_totals_non_negative check (subtotal >= 0 and vat_amount >= 0 and total >= 0),
  constraint receipts_vat_range check (vat_rate >= 0 and vat_rate <= 100)
);

create index if not exists receipts_issued_at_idx
  on public.receipts (issued_at desc);

-- ---------------------------------------------------------------------------
-- 9. Authorization helpers
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_menu()
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
      or public.has_role('restaurant_manager')
    );
$$;

create or replace function public.can_manage_table_layout()
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
      or public.has_role('restaurant_manager')
    );
$$;

create or replace function public.can_set_table_status()
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
      or public.has_role('restaurant_manager')
      or public.has_role('waiter')
      or public.has_role('cashier')
    );
$$;

create or replace function public.can_manage_reservations()
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
      or public.has_role('restaurant_manager')
      or public.has_role('waiter')
    );
$$;

create or replace function public.can_take_orders()
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
      or public.has_role('restaurant_manager')
      or public.has_role('waiter')
    );
$$;

create or replace function public.can_update_kitchen_status()
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
      or public.has_role('restaurant_manager')
      or public.has_role('executive_chef')
      or public.has_role('kitchen_staff')
    );
$$;

create or replace function public.can_close_orders()
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
      or public.has_role('restaurant_manager')
      or public.has_role('cashier')
    );
$$;

create or replace function public.can_manage_business_settings()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
    and (public.is_admin() or public.has_role('general_manager'));
$$;

-- ---------------------------------------------------------------------------
-- 10. Internal table-state helpers
-- ---------------------------------------------------------------------------
create or replace function public.occupy_table(p_table_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.restaurant_tables
  set status = 'occupied'
  where id = p_table_id
    and status in ('available', 'reserved');
$$;

create or replace function public.free_table_if_idle(p_table_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.restaurant_tables t
  set status = 'available'
  where t.id = p_table_id
    and t.status = 'occupied'
    and not exists (
      select 1
      from public.orders o
      where o.table_id = p_table_id
        and o.status in ('pending', 'sent_to_kitchen', 'preparing', 'ready', 'served')
    );
$$;

-- ---------------------------------------------------------------------------
-- 11. Tables: role-gated status change (TBL-02, TBL-04)
-- ---------------------------------------------------------------------------
create or replace function public.set_table_status(
  p_table_id uuid,
  p_status public.table_status
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_table public.restaurant_tables%rowtype;
begin
  if not public.can_set_table_status() then
    raise exception 'You do not have permission to change table status' using errcode = '42501';
  end if;

  select * into v_table from public.restaurant_tables where id = p_table_id for update;
  if not found then
    raise exception 'That table no longer exists' using errcode = 'P0002';
  end if;

  if p_status = 'available' and exists (
    select 1 from public.orders o
    where o.table_id = p_table_id
      and o.status in ('pending', 'sent_to_kitchen', 'preparing', 'ready', 'served')
  ) then
    raise exception 'This table still has an open order' using errcode = '23514';
  end if;

  update public.restaurant_tables
  set status = p_status
  where id = p_table_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Reservations (RES-01..04)
-- ---------------------------------------------------------------------------
create or replace function public.create_reservation(
  p_outlet_id uuid,
  p_guest_name text,
  p_guest_phone text,
  p_reserved_date date,
  p_reserved_time time,
  p_party_size integer,
  p_table_id uuid,
  p_special_requests text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_table public.restaurant_tables%rowtype;
begin
  if not public.can_manage_reservations() then
    raise exception 'You do not have permission to manage reservations' using errcode = '42501';
  end if;

  if not exists (select 1 from public.outlets where id = p_outlet_id and is_active) then
    raise exception 'Choose an active outlet' using errcode = '23514';
  end if;
  if nullif(btrim(p_guest_name), '') is null then
    raise exception 'A guest name is required' using errcode = '23514';
  end if;
  if length(btrim(p_guest_name)) > 120 then
    raise exception 'Use 120 characters or fewer for the guest name' using errcode = '23514';
  end if;
  if nullif(btrim(p_guest_phone), '') is null then
    raise exception 'A guest phone is required' using errcode = '23514';
  end if;
  if length(btrim(p_guest_phone)) > 40 then
    raise exception 'Use 40 characters or fewer for the guest phone' using errcode = '23514';
  end if;
  if p_reserved_date is null then
    raise exception 'Choose the reservation date' using errcode = '23514';
  end if;
  if p_reserved_time is null then
    raise exception 'Choose the reservation time' using errcode = '23514';
  end if;
  if p_party_size is null or p_party_size <= 0 then
    raise exception 'The party size must be greater than zero' using errcode = '23514';
  end if;

  if p_table_id is not null then
    select * into v_table from public.restaurant_tables where id = p_table_id;
    if not found then
      raise exception 'Choose a valid table' using errcode = '23503';
    end if;
    if v_table.outlet_id <> p_outlet_id then
      raise exception 'The table belongs to another outlet' using errcode = '23514';
    end if;
    if not v_table.is_active then
      raise exception 'That table is not active' using errcode = '23514';
    end if;
  end if;

  insert into public.reservations (
    reservation_number, outlet_id, guest_name, guest_phone, reserved_date,
    reserved_time, party_size, table_id, special_requests, created_by
  )
  values (
    public.next_document_number(p_outlet_id, 'reservation', 'RES'),
    p_outlet_id,
    btrim(p_guest_name),
    btrim(p_guest_phone),
    p_reserved_date,
    p_reserved_time,
    p_party_size,
    p_table_id,
    nullif(btrim(coalesce(p_special_requests, '')), ''),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.assign_reservation_table(
  p_reservation_id uuid,
  p_table_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.reservations%rowtype;
  v_table public.restaurant_tables%rowtype;
begin
  if not public.can_manage_reservations() then
    raise exception 'You do not have permission to manage reservations' using errcode = '42501';
  end if;

  select * into v_reservation from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'That reservation no longer exists' using errcode = 'P0002';
  end if;

  if v_reservation.status in ('cancelled', 'completed') then
    raise exception 'A closed reservation cannot be reassigned' using errcode = '23514';
  end if;

  if p_table_id is not null then
    select * into v_table from public.restaurant_tables where id = p_table_id;
    if not found then
      raise exception 'Choose a valid table' using errcode = '23503';
    end if;
    if v_table.outlet_id <> v_reservation.outlet_id then
      raise exception 'The table belongs to another outlet' using errcode = '23514';
    end if;
    if not v_table.is_active then
      raise exception 'That table is not active' using errcode = '23514';
    end if;
  end if;

  update public.reservations
  set table_id = p_table_id,
      updated_at = now()
  where id = p_reservation_id;

  if p_table_id is not null and v_reservation.status = 'arrived' then
    perform public.occupy_table(p_table_id);
  end if;
end;
$$;

create or replace function public.set_reservation_status(
  p_reservation_id uuid,
  p_status public.reservation_status
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.reservations%rowtype;
begin
  if not public.can_manage_reservations() then
    raise exception 'You do not have permission to manage reservations' using errcode = '42501';
  end if;

  select * into v_reservation from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'That reservation no longer exists' using errcode = 'P0002';
  end if;

  if v_reservation.status = p_status then
    return;
  end if;

  if v_reservation.status = 'booked' then
    if p_status not in ('confirmed', 'arrived', 'cancelled') then
      raise exception 'A booked reservation can only be confirmed, arrived or cancelled'
        using errcode = '23514';
    end if;
  elsif v_reservation.status = 'confirmed' then
    if p_status not in ('arrived', 'cancelled') then
      raise exception 'A confirmed reservation can only arrive or be cancelled'
        using errcode = '23514';
    end if;
  elsif v_reservation.status = 'arrived' then
    if p_status not in ('completed', 'cancelled') then
      raise exception 'An arrived reservation can only be completed or cancelled'
        using errcode = '23514';
    end if;
  else
    raise exception 'This reservation is already %', v_reservation.status using errcode = '23514';
  end if;

  update public.reservations
  set status = p_status,
      status_updated_by = auth.uid(),
      status_updated_at = now(),
      updated_at = now()
  where id = p_reservation_id;

  if v_reservation.table_id is not null then
    if p_status = 'arrived' then
      perform public.occupy_table(v_reservation.table_id);
    elsif p_status in ('cancelled', 'completed') then
      perform public.free_table_if_idle(v_reservation.table_id);
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Orders (ORD-01..06)
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_outlet_id uuid,
  p_table_id uuid,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_table public.restaurant_tables%rowtype;
  v_line jsonb;
  v_menu_item public.menu_items%rowtype;
  v_quantity integer;
  v_line_count integer := 0;
begin
  if not public.can_take_orders() then
    raise exception 'You do not have permission to take orders' using errcode = '42501';
  end if;

  if not exists (select 1 from public.outlets where id = p_outlet_id and is_active) then
    raise exception 'Choose an active outlet' using errcode = '23514';
  end if;

  if p_table_id is not null then
    select * into v_table from public.restaurant_tables where id = p_table_id for update;
    if not found then
      raise exception 'Choose a valid table' using errcode = '23503';
    end if;
    if v_table.outlet_id <> p_outlet_id then
      raise exception 'The table belongs to another outlet' using errcode = '23514';
    end if;
    if not v_table.is_active then
      raise exception 'That table is not active' using errcode = '23514';
    end if;
    if v_table.status in ('cleaning', 'closed') then
      raise exception 'That table is cleaning or closed. Choose another table' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.orders o
      where o.table_id = p_table_id
        and o.status in ('pending', 'sent_to_kitchen', 'preparing', 'ready', 'served')
    ) then
      raise exception 'That table already has an open order' using errcode = '23505';
    end if;
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'An order needs at least one line' using errcode = '23514';
  end if;

  insert into public.orders (
    order_number, outlet_id, table_id, waiter_id, waiter_name, notes
  )
  values (
    public.next_document_number(p_outlet_id, 'order', 'ORD'),
    p_outlet_id,
    p_table_id,
    auth.uid(),
    coalesce((select full_name from public.user_profiles where id = auth.uid()), ''),
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_quantity := coalesce((v_line ->> 'quantity')::integer, 0);
    if v_quantity <= 0 then
      raise exception 'Every order line needs a quantity greater than zero' using errcode = '23514';
    end if;

    select * into v_menu_item
    from public.menu_items
    where id = nullif(v_line ->> 'menu_item_id', '')::uuid
      and is_active;

    if not found then
      raise exception 'Choose an active menu item for every order line' using errcode = '23514';
    end if;

    insert into public.order_lines (
      order_id, menu_item_id, item_code, item_name, unit_price, quantity,
      special_instructions
    )
    values (
      v_order_id,
      v_menu_item.id,
      v_menu_item.code,
      v_menu_item.name,
      v_menu_item.selling_price,
      v_quantity,
      nullif(btrim(coalesce(v_line ->> 'special_instructions', '')), '')
    );

    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count = 0 then
    raise exception 'An order needs at least one line' using errcode = '23514';
  end if;

  if p_table_id is not null then
    perform public.occupy_table(p_table_id);
  end if;

  return v_order_id;
end;
$$;

create or replace function public.update_order(
  p_order_id uuid,
  p_expected_revision integer,
  p_table_id uuid,
  p_notes text,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_table public.restaurant_tables%rowtype;
  v_line jsonb;
  v_menu_item public.menu_items%rowtype;
  v_quantity integer;
  v_line_count integer := 0;
begin
  if not public.can_take_orders() then
    raise exception 'You do not have permission to change orders' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'That order no longer exists' using errcode = 'P0002';
  end if;

  if v_order.status in ('closed', 'cancelled') then
    raise exception 'A closed or cancelled order cannot be changed' using errcode = '23514';
  end if;
  if v_order.revision <> p_expected_revision then
    raise exception 'This order was changed by someone else. Refresh and try again.'
      using errcode = '40001';
  end if;
  if v_order.status <> 'pending'
     and not (public.is_admin()
              or public.has_role('general_manager')
              or public.has_role('restaurant_manager')) then
    raise exception 'Only a manager can change an order after it was sent to the kitchen'
      using errcode = '42501';
  end if;

  if p_table_id is distinct from v_order.table_id then
    if p_table_id is not null then
      select * into v_table from public.restaurant_tables where id = p_table_id for update;
      if not found then
        raise exception 'Choose a valid table' using errcode = '23503';
      end if;
      if v_table.outlet_id <> v_order.outlet_id then
        raise exception 'The table belongs to another outlet' using errcode = '23514';
      end if;
      if not v_table.is_active or v_table.status in ('cleaning', 'closed') then
        raise exception 'That table is not available' using errcode = '23514';
      end if;
      if exists (
        select 1 from public.orders o
        where o.table_id = p_table_id
          and o.id <> p_order_id
          and o.status in ('pending', 'sent_to_kitchen', 'preparing', 'ready', 'served')
      ) then
        raise exception 'That table already has an open order' using errcode = '23505';
      end if;
    end if;
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'An order needs at least one line' using errcode = '23514';
  end if;

  delete from public.order_lines where order_id = p_order_id;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_quantity := coalesce((v_line ->> 'quantity')::integer, 0);
    if v_quantity <= 0 then
      raise exception 'Every order line needs a quantity greater than zero' using errcode = '23514';
    end if;

    select * into v_menu_item
    from public.menu_items
    where id = nullif(v_line ->> 'menu_item_id', '')::uuid
      and is_active;

    if not found then
      raise exception 'Choose an active menu item for every order line' using errcode = '23514';
    end if;

    insert into public.order_lines (
      order_id, menu_item_id, item_code, item_name, unit_price, quantity,
      special_instructions
    )
    values (
      p_order_id,
      v_menu_item.id,
      v_menu_item.code,
      v_menu_item.name,
      v_menu_item.selling_price,
      v_quantity,
      nullif(btrim(coalesce(v_line ->> 'special_instructions', '')), '')
    );

    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count = 0 then
    raise exception 'An order needs at least one line' using errcode = '23514';
  end if;

  if p_table_id is distinct from v_order.table_id then
    if v_order.table_id is not null then
      perform public.free_table_if_idle(v_order.table_id);
    end if;
    if p_table_id is not null then
      perform public.occupy_table(p_table_id);
    end if;
  end if;

  update public.orders
  set table_id = p_table_id,
      notes = nullif(btrim(coalesce(p_notes, '')), ''),
      revision = revision + 1,
      updated_at = now()
  where id = p_order_id;
end;
$$;

create or replace function public.set_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_expected_revision integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'That order no longer exists' using errcode = 'P0002';
  end if;

  if v_order.status in ('closed', 'cancelled') then
    raise exception 'A closed or cancelled order cannot change status' using errcode = '23514';
  end if;
  if v_order.revision <> p_expected_revision then
    raise exception 'This order was changed by someone else. Refresh and try again.'
      using errcode = '40001';
  end if;

  if p_status = 'sent_to_kitchen' then
    if not public.can_take_orders() then
      raise exception 'You do not have permission to send orders' using errcode = '42501';
    end if;
    if v_order.status <> 'pending' then
      raise exception 'Only a pending order can be sent to the kitchen' using errcode = '23514';
    end if;
  elsif p_status = 'preparing' then
    if not public.can_update_kitchen_status() then
      raise exception 'You do not have permission to update kitchen status' using errcode = '42501';
    end if;
    if v_order.status <> 'sent_to_kitchen' then
      raise exception 'Only an order sent to the kitchen can start preparing' using errcode = '23514';
    end if;
  elsif p_status = 'ready' then
    if not public.can_update_kitchen_status() then
      raise exception 'You do not have permission to update kitchen status' using errcode = '42501';
    end if;
    if v_order.status not in ('sent_to_kitchen', 'preparing') then
      raise exception 'Only a sent or preparing order can be marked ready' using errcode = '23514';
    end if;
  elsif p_status = 'served' then
    if not public.can_take_orders() then
      raise exception 'You do not have permission to mark orders served' using errcode = '42501';
    end if;
    if v_order.status <> 'ready' then
      raise exception 'Only a ready order can be served' using errcode = '23514';
    end if;
  else
    raise exception 'Use the close or cancel action for that status' using errcode = '23514';
  end if;

  update public.orders
  set status = p_status,
      revision = revision + 1,
      updated_at = now(),
      sent_at = case when p_status = 'sent_to_kitchen' then now() else sent_at end,
      preparing_at = case when p_status = 'preparing' then now() else preparing_at end,
      ready_at = case when p_status = 'ready' then now() else ready_at end,
      served_at = case when p_status = 'served' then now() else served_at end
  where id = p_order_id;
end;
$$;

create or replace function public.cancel_order(
  p_order_id uuid,
  p_reason text,
  p_expected_revision integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.can_take_orders() then
    raise exception 'You do not have permission to cancel orders' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'That order no longer exists' using errcode = 'P0002';
  end if;

  if v_order.status in ('closed', 'cancelled') then
    raise exception 'This order is already closed or cancelled' using errcode = '23514';
  end if;
  if v_order.revision <> p_expected_revision then
    raise exception 'This order was changed by someone else. Refresh and try again.'
      using errcode = '40001';
  end if;
  if v_order.status <> 'pending'
     and not (public.is_admin()
              or public.has_role('general_manager')
              or public.has_role('restaurant_manager')) then
    raise exception 'Only a manager can cancel an order after it was sent to the kitchen'
      using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A cancellation reason is required' using errcode = '23514';
  end if;

  update public.orders
  set status = 'cancelled',
      cancel_reason = btrim(p_reason),
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      revision = revision + 1,
      updated_at = now()
  where id = p_order_id;

  if v_order.table_id is not null then
    perform public.free_table_if_idle(v_order.table_id);
  end if;
end;
$$;

create or replace function public.transfer_order(
  p_order_id uuid,
  p_table_id uuid,
  p_expected_revision integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_table public.restaurant_tables%rowtype;
begin
  if not public.can_take_orders() then
    raise exception 'You do not have permission to transfer orders' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'That order no longer exists' using errcode = 'P0002';
  end if;

  if v_order.status in ('closed', 'cancelled') then
    raise exception 'A closed or cancelled order cannot be transferred' using errcode = '23514';
  end if;
  if v_order.revision <> p_expected_revision then
    raise exception 'This order was changed by someone else. Refresh and try again.'
      using errcode = '40001';
  end if;
  if p_table_id = v_order.table_id then
    raise exception 'The order is already on that table' using errcode = '23514';
  end if;
  if p_table_id is null then
    raise exception 'Choose the table to transfer the order to' using errcode = '23514';
  end if;

  select * into v_table from public.restaurant_tables where id = p_table_id for update;
  if not found then
    raise exception 'Choose a valid table' using errcode = '23503';
  end if;
  if v_table.outlet_id <> v_order.outlet_id then
    raise exception 'The table belongs to another outlet' using errcode = '23514';
  end if;
  if not v_table.is_active or v_table.status in ('cleaning', 'closed') then
    raise exception 'That table is not available' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.orders o
    where o.table_id = p_table_id
      and o.id <> p_order_id
      and o.status in ('pending', 'sent_to_kitchen', 'preparing', 'ready', 'served')
  ) then
    raise exception 'That table already has an open order' using errcode = '23505';
  end if;

  update public.orders
  set table_id = p_table_id,
      revision = revision + 1,
      updated_at = now()
  where id = p_order_id;

  if v_order.table_id is not null then
    perform public.free_table_if_idle(v_order.table_id);
  end if;
  perform public.occupy_table(p_table_id);
end;
$$;

create or replace function public.split_order(
  p_order_id uuid,
  p_line_ids jsonb,
  p_new_table_id uuid,
  p_expected_revision integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_new_order_id uuid;
  v_table public.restaurant_tables%rowtype;
  v_line_count integer;
  v_moved_count integer;
begin
  if not public.can_take_orders() then
    raise exception 'You do not have permission to split orders' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'That order no longer exists' using errcode = 'P0002';
  end if;

  if v_order.status in ('closed', 'cancelled') then
    raise exception 'A closed or cancelled order cannot be split' using errcode = '23514';
  end if;
  if v_order.revision <> p_expected_revision then
    raise exception 'This order was changed by someone else. Refresh and try again.'
      using errcode = '40001';
  end if;
  if p_line_ids is null or jsonb_typeof(p_line_ids) <> 'array' or jsonb_array_length(p_line_ids) = 0 then
    raise exception 'Choose at least one line to split' using errcode = '23514';
  end if;

  select count(*) into v_line_count from public.order_lines where order_id = p_order_id;
  select count(*) into v_moved_count
  from public.order_lines
  where order_id = p_order_id
    and id in (select (value #>> '{}')::uuid from jsonb_array_elements(p_line_ids));

  if v_moved_count <> jsonb_array_length(p_line_ids) then
    raise exception 'Every split line must belong to this order' using errcode = '23514';
  end if;
  if v_moved_count >= v_line_count then
    raise exception 'Leave at least one line on the original order' using errcode = '23514';
  end if;

  if p_new_table_id is not null then
    select * into v_table from public.restaurant_tables where id = p_new_table_id for update;
    if not found then
      raise exception 'Choose a valid table' using errcode = '23503';
    end if;
    if v_table.outlet_id <> v_order.outlet_id then
      raise exception 'The table belongs to another outlet' using errcode = '23514';
    end if;
    if not v_table.is_active or v_table.status in ('cleaning', 'closed') then
      raise exception 'That table is not available' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.orders o
      where o.table_id = p_new_table_id
        and o.status in ('pending', 'sent_to_kitchen', 'preparing', 'ready', 'served')
    ) then
      raise exception 'That table already has an open order' using errcode = '23505';
    end if;
  end if;

  insert into public.orders (
    order_number, outlet_id, table_id, waiter_id, waiter_name, notes
  )
  values (
    public.next_document_number(v_order.outlet_id, 'order', 'ORD'),
    v_order.outlet_id,
    p_new_table_id,
    v_order.waiter_id,
    v_order.waiter_name,
    'Split from ' || v_order.order_number
  )
  returning id into v_new_order_id;

  update public.order_lines
  set order_id = v_new_order_id,
      updated_at = now()
  where order_id = p_order_id
    and id in (select (value #>> '{}')::uuid from jsonb_array_elements(p_line_ids));

  update public.orders
  set revision = revision + 1,
      updated_at = now()
  where id = p_order_id;

  if p_new_table_id is not null then
    perform public.occupy_table(p_new_table_id);
  end if;

  return v_new_order_id;
end;
$$;

create or replace function public.merge_orders(
  p_source_order_id uuid,
  p_target_order_id uuid,
  p_expected_revision_source integer,
  p_expected_revision_target integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source public.orders%rowtype;
  v_target public.orders%rowtype;
begin
  if not (public.is_admin()
          or public.has_role('general_manager')
          or public.has_role('restaurant_manager')) then
    raise exception 'You do not have permission to merge orders' using errcode = '42501';
  end if;

  if p_source_order_id = p_target_order_id then
    raise exception 'Choose two different orders to merge' using errcode = '23514';
  end if;

  select * into v_source from public.orders where id = p_source_order_id for update;
  if not found then
    raise exception 'The source order no longer exists' using errcode = 'P0002';
  end if;
  select * into v_target from public.orders where id = p_target_order_id for update;
  if not found then
    raise exception 'The target order no longer exists' using errcode = 'P0002';
  end if;

  if v_source.status in ('closed', 'cancelled') or v_target.status in ('closed', 'cancelled') then
    raise exception 'Only open orders can be merged' using errcode = '23514';
  end if;
  if v_source.outlet_id <> v_target.outlet_id then
    raise exception 'Orders from different outlets cannot be merged' using errcode = '23514';
  end if;
  if v_source.revision <> p_expected_revision_source
     or v_target.revision <> p_expected_revision_target then
    raise exception 'One of these orders was changed by someone else. Refresh and try again.'
      using errcode = '40001';
  end if;

  update public.order_lines
  set order_id = p_target_order_id,
      updated_at = now()
  where order_id = p_source_order_id;

  update public.orders
  set status = 'cancelled',
      cancel_reason = 'Merged into ' || v_target.order_number,
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      revision = revision + 1,
      updated_at = now()
  where id = p_source_order_id;

  update public.orders
  set revision = revision + 1,
      updated_at = now()
  where id = p_target_order_id;

  if v_source.table_id is not null then
    perform public.free_table_if_idle(v_source.table_id);
  end if;

  return p_target_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. Close the order and issue the receipt (RCT-01..05)
-- ---------------------------------------------------------------------------
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
-- 15. Reservation slot load for the overbooking warning (OD-09)
-- ---------------------------------------------------------------------------
create or replace view public.reservation_slot_load as
select
  r.outlet_id,
  r.reserved_date,
  r.reserved_time,
  count(*)::integer as active_reservations,
  (
    select count(*)::integer
    from public.restaurant_tables t
    where t.outlet_id = r.outlet_id
      and t.is_active
  ) as active_tables
from public.reservations r
where r.status in ('booked', 'confirmed', 'arrived')
  and public.is_active_user()
group by r.outlet_id, r.reserved_date, r.reserved_time;

-- ---------------------------------------------------------------------------
-- 16. Function privileges
-- ---------------------------------------------------------------------------
revoke all on function public.business_today() from public;
revoke all on function public.next_document_number(uuid, text, text) from public;
revoke all on function public.occupy_table(uuid) from public;
revoke all on function public.free_table_if_idle(uuid) from public;
revoke all on function public.can_manage_menu() from public;
revoke all on function public.can_manage_table_layout() from public;
revoke all on function public.can_set_table_status() from public;
revoke all on function public.can_manage_reservations() from public;
revoke all on function public.can_take_orders() from public;
revoke all on function public.can_update_kitchen_status() from public;
revoke all on function public.can_close_orders() from public;
revoke all on function public.can_manage_business_settings() from public;
revoke all on function public.set_table_status(uuid, public.table_status) from public;
revoke all on function public.create_reservation(uuid, text, text, date, time, integer, uuid, text) from public;
revoke all on function public.assign_reservation_table(uuid, uuid) from public;
revoke all on function public.set_reservation_status(uuid, public.reservation_status) from public;
revoke all on function public.create_order(uuid, uuid, text, jsonb) from public;
revoke all on function public.update_order(uuid, integer, uuid, text, jsonb) from public;
revoke all on function public.set_order_status(uuid, public.order_status, integer) from public;
revoke all on function public.cancel_order(uuid, text, integer) from public;
revoke all on function public.transfer_order(uuid, uuid, integer) from public;
revoke all on function public.split_order(uuid, jsonb, uuid, integer) from public;
revoke all on function public.merge_orders(uuid, uuid, integer, integer) from public;
revoke all on function public.close_order(uuid, integer) from public;

grant execute on function public.can_manage_menu() to authenticated;
grant execute on function public.can_manage_table_layout() to authenticated;
grant execute on function public.can_set_table_status() to authenticated;
grant execute on function public.can_manage_reservations() to authenticated;
grant execute on function public.can_take_orders() to authenticated;
grant execute on function public.can_update_kitchen_status() to authenticated;
grant execute on function public.can_close_orders() to authenticated;
grant execute on function public.can_manage_business_settings() to authenticated;
grant execute on function public.set_table_status(uuid, public.table_status) to authenticated;
grant execute on function public.create_reservation(uuid, text, text, date, time, integer, uuid, text) to authenticated;
grant execute on function public.assign_reservation_table(uuid, uuid) to authenticated;
grant execute on function public.set_reservation_status(uuid, public.reservation_status) to authenticated;
grant execute on function public.create_order(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.update_order(uuid, integer, uuid, text, jsonb) to authenticated;
grant execute on function public.set_order_status(uuid, public.order_status, integer) to authenticated;
grant execute on function public.cancel_order(uuid, text, integer) to authenticated;
grant execute on function public.transfer_order(uuid, uuid, integer) to authenticated;
grant execute on function public.split_order(uuid, jsonb, uuid, integer) to authenticated;
grant execute on function public.merge_orders(uuid, uuid, integer, integer) to authenticated;
grant execute on function public.close_order(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 17. updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists business_settings_set_updated_at on public.business_settings;
create trigger business_settings_set_updated_at
  before update on public.business_settings
  for each row execute function public.set_updated_at();

drop trigger if exists menu_categories_set_updated_at on public.menu_categories;
create trigger menu_categories_set_updated_at
  before update on public.menu_categories
  for each row execute function public.set_updated_at();

drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

drop trigger if exists restaurant_tables_set_updated_at on public.restaurant_tables;
create trigger restaurant_tables_set_updated_at
  before update on public.restaurant_tables
  for each row execute function public.set_updated_at();

drop trigger if exists order_lines_set_updated_at on public.order_lines;
create trigger order_lines_set_updated_at
  before update on public.order_lines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 18. Audit triggers (AUD-01..03). The internal sequence counter is excluded
--     on purpose: every receipt it produces is itself audited.
-- ---------------------------------------------------------------------------
drop trigger if exists business_settings_audit on public.business_settings;
create trigger business_settings_audit
  after insert or update or delete on public.business_settings
  for each row execute function public.write_audit_log();

drop trigger if exists menu_categories_audit on public.menu_categories;
create trigger menu_categories_audit
  after insert or update or delete on public.menu_categories
  for each row execute function public.write_audit_log();

drop trigger if exists menu_items_audit on public.menu_items;
create trigger menu_items_audit
  after insert or update or delete on public.menu_items
  for each row execute function public.write_audit_log();

drop trigger if exists restaurant_tables_audit on public.restaurant_tables;
create trigger restaurant_tables_audit
  after insert or update or delete on public.restaurant_tables
  for each row execute function public.write_audit_log();

drop trigger if exists reservations_audit on public.reservations;
create trigger reservations_audit
  after insert or update or delete on public.reservations
  for each row execute function public.write_audit_log();

drop trigger if exists orders_audit on public.orders;
create trigger orders_audit
  after insert or update or delete on public.orders
  for each row execute function public.write_audit_log();

drop trigger if exists order_lines_audit on public.order_lines;
create trigger order_lines_audit
  after insert or update or delete on public.order_lines
  for each row execute function public.write_audit_log();

drop trigger if exists receipts_audit on public.receipts;
create trigger receipts_audit
  after insert or update or delete on public.receipts
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- 19. Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.business_settings  enable row level security;
alter table public.menu_categories    enable row level security;
alter table public.menu_items         enable row level security;
alter table public.restaurant_tables  enable row level security;
alter table public.reservations       enable row level security;
alter table public.orders             enable row level security;
alter table public.order_lines        enable row level security;
alter table public.receipts           enable row level security;
alter table public.document_sequences enable row level security;

-- Business settings: read for active users, write for admin / general manager.
drop policy if exists business_settings_select on public.business_settings;
create policy business_settings_select on public.business_settings
  for select to authenticated
  using (public.is_active_user());

drop policy if exists business_settings_write on public.business_settings;
create policy business_settings_write on public.business_settings
  for all to authenticated
  using (public.can_manage_business_settings())
  with check (public.can_manage_business_settings());

-- Menu: read for active users, write for menu managers.
drop policy if exists menu_categories_select on public.menu_categories;
create policy menu_categories_select on public.menu_categories
  for select to authenticated
  using (public.is_active_user());

drop policy if exists menu_categories_write on public.menu_categories;
create policy menu_categories_write on public.menu_categories
  for all to authenticated
  using (public.can_manage_menu())
  with check (public.can_manage_menu());

drop policy if exists menu_items_select on public.menu_items;
create policy menu_items_select on public.menu_items
  for select to authenticated
  using (public.is_active_user());

drop policy if exists menu_items_write on public.menu_items;
create policy menu_items_write on public.menu_items
  for all to authenticated
  using (public.can_manage_menu())
  with check (public.can_manage_menu());

-- Tables: read for active users, layout writes for table managers. Status
-- changes also go through set_table_status(), which carries its own gate.
drop policy if exists restaurant_tables_select on public.restaurant_tables;
create policy restaurant_tables_select on public.restaurant_tables
  for select to authenticated
  using (public.is_active_user());

drop policy if exists restaurant_tables_write on public.restaurant_tables;
create policy restaurant_tables_write on public.restaurant_tables
  for all to authenticated
  using (public.can_manage_table_layout())
  with check (public.can_manage_table_layout());

-- Reservations, orders and receipts: read for active users, no direct writes.
-- All writes go through the SECURITY DEFINER functions above.
drop policy if exists reservations_select on public.reservations;
create policy reservations_select on public.reservations
  for select to authenticated
  using (public.is_active_user());

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated
  using (public.is_active_user());

drop policy if exists order_lines_select on public.order_lines;
create policy order_lines_select on public.order_lines
  for select to authenticated
  using (public.is_active_user());

drop policy if exists receipts_select on public.receipts;
create policy receipts_select on public.receipts
  for select to authenticated
  using (public.is_active_user());

-- document_sequences has RLS enabled and no policy: only the SECURITY DEFINER
-- numbering function can reach it.

revoke all on public.business_settings  from anon, authenticated;
revoke all on public.menu_categories    from anon, authenticated;
revoke all on public.menu_items         from anon, authenticated;
revoke all on public.restaurant_tables  from anon, authenticated;
revoke all on public.reservations       from anon, authenticated;
revoke all on public.orders             from anon, authenticated;
revoke all on public.order_lines        from anon, authenticated;
revoke all on public.receipts           from anon, authenticated;
revoke all on public.document_sequences from anon, authenticated;
revoke all on public.reservation_slot_load from anon, authenticated;

grant select, insert, update on public.business_settings to authenticated;
grant select, insert, update on public.menu_categories to authenticated;
grant select, insert, update on public.menu_items to authenticated;
grant select, insert, update on public.restaurant_tables to authenticated;
grant select on public.reservations to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_lines to authenticated;
grant select on public.receipts to authenticated;
grant select on public.reservation_slot_load to authenticated;

-- ---------------------------------------------------------------------------
-- 20. Realtime publication for the kitchen display (KDS-03)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_publication
    where pubname = 'supabase_realtime'
      and puballtables = false
  ) then
    begin
      alter publication supabase_realtime add table public.orders;
    exception
      when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.order_lines;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 21. Comments
-- ---------------------------------------------------------------------------
comment on table public.business_settings is 'Single row of receipt identity and VAT settings (OD-07, OD-08). Menu prices are VAT-inclusive.';
comment on table public.menu_categories is 'Menu categories from MENU-02.';
comment on table public.menu_items is 'Menu items with code, category, VAT-inclusive price and optional recipe link (MENU-01..03). Order lines snapshot name and price.';
comment on table public.restaurant_tables is 'Tables per outlet with the SRS statuses (TBL-01..04). At most one open order per table.';
comment on table public.reservations is 'Reservations with guest name and phone per RES-01; no guest profile or history (OD-10). Optional table, exact-slot double-booking prevented.';
comment on table public.orders is 'Order header with status, revision for optimistic concurrency, and closed totals. Closing issues a receipt.';
comment on table public.order_lines is 'Price and description snapshots per order line (ORD-03, RCT-05). Later menu edits never rewrite history.';
comment on table public.receipts is 'Receipts numbered per outlet per business day (OD-08) with snapshotted business identity and VAT extracted from VAT-inclusive totals (OD-07).';
comment on table public.document_sequences is 'Internal per-outlet daily counters for orders, receipts and reservations. No direct access.';
comment on view public.reservation_slot_load is 'Active reservations and active table count per outlet/date/time for the overbooking warning (OD-09).';
comment on function public.close_order(uuid, integer) is 'Closes a served order, computes VAT-inclusive totals, issues a numbered receipt and frees the table (RCT-01..05).';
comment on function public.split_order(uuid, jsonb, uuid, integer) is 'Moves selected lines to a new order, leaving at least one line on the original (TBL-03, ORD-01).';
comment on function public.merge_orders(uuid, uuid, integer, integer) is 'Moves all lines from the source order to the target and cancels the source (TBL-03, ORD-01).';
