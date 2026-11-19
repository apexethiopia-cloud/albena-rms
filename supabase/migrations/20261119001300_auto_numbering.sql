-- Albena RMS — 0013: database-authoritative document and master-code numbering
-- Apply after 20261118001200_reporting.sql.
-- Idempotent: safe to re-run.
--
-- Business documents get PR/PO/GRN/SIV/CNT/ADJ/WST/PRD numbers from one
-- company-wide, per-business-day sequence table. Master records get short
-- OUT/LOC/SUP/ITM/MNU/TBL/RCP/CAT codes from a separate sequence table.
-- Callers can no longer supply a number or code to the create RPCs.
--
-- Verified against migrations 0001-0012:
--   * public.business_today() returns date (0006/0010) and is used by the
--     existing outlet-scoped public.document_sequences pattern.
--   * item_categories (0003) has no `code` column -> no code trigger is added.
--     outlets (0001), stock_locations/suppliers/items (0003), recipes (0009),
--     menu_items/restaurant_tables (0010) all have `code text`.
--   * create_grn's latest overload is the 8-argument version from 0007; the
--     obsolete 7-argument version is dropped defensively as well.

-- ---------------------------------------------------------------------------
-- 1. Company-wide document sequence table (internal only)
-- ---------------------------------------------------------------------------
create table if not exists public.company_document_sequences (
  doc_type      text not null,
  sequence_date date not null,
  last_number   integer not null default 0,
  primary key (doc_type, sequence_date),
  constraint company_document_sequences_type_valid check (
    doc_type in ('pr', 'po', 'grn', 'siv', 'count', 'adjustment', 'waste', 'production')
  )
);

alter table public.company_document_sequences enable row level security;
-- RLS enabled, deliberately no policies. No audit trigger: every document that
-- consumes a number is itself audited by its existing *_audit trigger.
revoke all on public.company_document_sequences from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Company document number allocator
-- ---------------------------------------------------------------------------
create or replace function public.next_company_document_number(p_doc_type text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_number integer;
begin
  if p_doc_type is null or p_doc_type not in (
    'pr', 'po', 'grn', 'siv', 'count', 'adjustment', 'waste', 'production'
  ) then
    raise exception 'Unknown company document type %', p_doc_type using errcode = '23514';
  end if;

  -- Prefixes are fixed server-side; a caller cannot choose or influence them.
  v_prefix := case p_doc_type
    when 'pr'         then 'PR'
    when 'po'         then 'PO'
    when 'grn'        then 'GRN'
    when 'siv'        then 'SIV'
    when 'count'      then 'CNT'
    when 'adjustment' then 'ADJ'
    when 'waste'      then 'WST'
    when 'production' then 'PRD'
  end;

  insert into public.company_document_sequences as seq (doc_type, sequence_date, last_number)
  values (p_doc_type, public.business_today(), 1)
  on conflict (doc_type, sequence_date)
  do update set last_number = seq.last_number + 1
  returning seq.last_number into v_number;

  return concat_ws(
    '-',
    v_prefix,
    to_char(public.business_today(), 'YYYYMMDD'),
    lpad(v_number::text, 4, '0')
  );
end;
$$;

-- Internal allocator only: workflow RPCs call it as their SECURITY DEFINER owner.
-- Direct authenticated calls would consume numbers without creating a document.
revoke all on function public.next_company_document_number(text) from public, anon, authenticated;

comment on function public.next_company_document_number(text) is
  'Allocates a company-wide, per-business-day document number (e.g. PR-20261119-0001). Prefix is server-side only.';

-- ---------------------------------------------------------------------------
-- 3. Master code sequence table (internal only)
-- ---------------------------------------------------------------------------
create table if not exists public.master_code_sequences (
  code_type   text primary key,
  last_number integer not null default 0,
  constraint master_code_sequences_type_valid check (
    code_type in (
      'outlet', 'location', 'supplier', 'item', 'menu_item',
      'restaurant_table', 'recipe', 'category'
    )
  )
);

alter table public.master_code_sequences enable row level security;
-- RLS enabled, deliberately no policies. No audit trigger (internal counter).
revoke all on public.master_code_sequences from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Master code allocator
-- ---------------------------------------------------------------------------
create or replace function public.next_master_code(p_code_type text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_number integer;
begin
  if p_code_type is null or p_code_type not in (
    'outlet', 'location', 'supplier', 'item', 'menu_item',
    'restaurant_table', 'recipe', 'category'
  ) then
    raise exception 'Unknown master code type %', p_code_type using errcode = '23514';
  end if;

  v_prefix := case p_code_type
    when 'outlet'           then 'OUT'
    when 'location'         then 'LOC'
    when 'supplier'         then 'SUP'
    when 'item'             then 'ITM'
    when 'menu_item'        then 'MNU'
    when 'restaurant_table' then 'TBL'
    when 'recipe'           then 'RCP'
    when 'category'         then 'CAT'
  end;

  insert into public.master_code_sequences as seq (code_type, last_number)
  values (p_code_type, 1)
  on conflict (code_type)
  do update set last_number = seq.last_number + 1
  returning seq.last_number into v_number;

  -- 3-letter prefix + '-' + 5 digits = 9 characters, within all existing
  -- 12/20/40-character code validators.
  return concat_ws('-', v_prefix, lpad(v_number::text, 5, '0'));
end;
$$;

-- Internal allocator only; the BEFORE INSERT trigger calls it as the function owner.
revoke all on function public.next_master_code(text) from public, anon, authenticated;

comment on function public.next_master_code(text) is
  'Allocates a short master-data code (e.g. ITM-00001). Prefix is server-side only.';

-- ---------------------------------------------------------------------------
-- 5. BEFORE INSERT trigger: fill blank master codes, never overwrite user codes
-- ---------------------------------------------------------------------------
create or replace function public.assign_master_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := public.next_master_code(tg_argv[0]);
  end if;
  return new;
end;
$$;

revoke all on function public.assign_master_code() from public, anon;

-- item_categories has no code column in 0003 and is intentionally skipped.
drop trigger if exists trg_assign_code_outlets on public.outlets;
create trigger trg_assign_code_outlets
  before insert on public.outlets
  for each row execute function public.assign_master_code('outlet');

drop trigger if exists trg_assign_code_stock_locations on public.stock_locations;
create trigger trg_assign_code_stock_locations
  before insert on public.stock_locations
  for each row execute function public.assign_master_code('location');

drop trigger if exists trg_assign_code_suppliers on public.suppliers;
create trigger trg_assign_code_suppliers
  before insert on public.suppliers
  for each row execute function public.assign_master_code('supplier');

drop trigger if exists trg_assign_code_items on public.items;
create trigger trg_assign_code_items
  before insert on public.items
  for each row execute function public.assign_master_code('item');

drop trigger if exists trg_assign_code_menu_items on public.menu_items;
create trigger trg_assign_code_menu_items
  before insert on public.menu_items
  for each row execute function public.assign_master_code('menu_item');

drop trigger if exists trg_assign_code_restaurant_tables on public.restaurant_tables;
create trigger trg_assign_code_restaurant_tables
  before insert on public.restaurant_tables
  for each row execute function public.assign_master_code('restaurant_table');

drop trigger if exists trg_assign_code_recipes on public.recipes;
create trigger trg_assign_code_recipes
  before insert on public.recipes
  for each row execute function public.assign_master_code('recipe');

-- ---------------------------------------------------------------------------
-- 6. create_purchase_request — old (text, date, text, jsonb) -> (date, text, jsonb)
-- ---------------------------------------------------------------------------
drop function if exists public.create_purchase_request(text, date, text, jsonb);

create or replace function public.create_purchase_request(
  p_request_date date,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pr_id uuid;
  v_pr_number text;
  v_line jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_quantity numeric;
  v_count integer := 0;
begin
  if not public.can_manage_purchasing() then
    raise exception 'You do not have permission to create purchase requests'
      using errcode = '42501';
  end if;

  if p_request_date is null then
    raise exception 'A request date is required' using errcode = '23514';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A purchase request needs at least one line' using errcode = '23514';
  end if;

  v_pr_number := public.next_company_document_number('pr');

  insert into public.purchase_requests (
    pr_number, request_date, requested_by, requester_name, notes
  )
  values (
    v_pr_number,
    p_request_date,
    auth.uid(),
    public.current_user_name(),
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_pr_id;

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

    -- Rejects a unit with no conversion to this item's base unit.
    perform public.stock_unit_factor(v_item_id, v_unit_id);

    insert into public.purchase_request_lines (pr_id, item_id, unit_id, quantity)
    values (v_pr_id, v_item_id, v_unit_id, v_quantity);

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A purchase request needs at least one line' using errcode = '23514';
  end if;

  return v_pr_id;
end;
$$;

revoke all on function public.create_purchase_request(date, text, jsonb) from public, anon;
grant execute on function public.create_purchase_request(date, text, jsonb) to authenticated;

comment on function public.create_purchase_request(date, text, jsonb) is
  'Creates a draft purchase request and lines atomically. Number is allocated by the database (PR). Role-gated.';

-- ---------------------------------------------------------------------------
-- 7. create_purchase_order
--    old (text, uuid, uuid, date, date, text, jsonb) -> (uuid, uuid, date, date, text, jsonb)
-- ---------------------------------------------------------------------------
drop function if exists public.create_purchase_order(text, uuid, uuid, date, date, text, jsonb);

create or replace function public.create_purchase_order(
  p_supplier_id uuid,
  p_pr_id uuid,
  p_order_date date,
  p_expected_date date,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_po_id uuid;
  v_po_number text;
  v_line jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_quantity numeric;
  v_unit_cost numeric;
  v_count integer := 0;
begin
  if not public.can_manage_purchasing() then
    raise exception 'You do not have permission to create purchase orders'
      using errcode = '42501';
  end if;

  if p_order_date is null then
    raise exception 'An order date is required' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.suppliers s where s.id = p_supplier_id and s.is_active
  ) then
    raise exception 'Choose an active supplier' using errcode = '23514';
  end if;

  if p_pr_id is not null then
    if not exists (
      select 1 from public.purchase_requests pr
      where pr.id = p_pr_id and pr.status = 'approved'
    ) then
      raise exception 'Choose an approved purchase request' using errcode = '23514';
    end if;
    if exists (select 1 from public.purchase_orders po where po.pr_id = p_pr_id) then
      raise exception 'That purchase request already has a purchase order' using errcode = '23505';
    end if;
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A purchase order needs at least one line' using errcode = '23514';
  end if;

  v_po_number := public.next_company_document_number('po');

  insert into public.purchase_orders (
    po_number, supplier_id, pr_id, order_date, expected_date, notes, created_by
  )
  values (
    v_po_number,
    p_supplier_id,
    p_pr_id,
    p_order_date,
    p_expected_date,
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_po_id;

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
    values (v_po_id, v_item_id, v_unit_id, v_quantity, round(v_unit_cost, 2));

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'A purchase order needs at least one line' using errcode = '23514';
  end if;

  return v_po_id;
end;
$$;

revoke all on function public.create_purchase_order(uuid, uuid, date, date, text, jsonb) from public, anon;
grant execute on function public.create_purchase_order(uuid, uuid, date, date, text, jsonb) to authenticated;

comment on function public.create_purchase_order(uuid, uuid, date, date, text, jsonb) is
  'Creates a draft purchase order, optionally linked to one approved request. Number is allocated by the database (PO).';

-- ---------------------------------------------------------------------------
-- 8. create_grn — latest 0007 overload (text,uuid,text,date,uuid,text,jsonb,uuid)
--    -> (uuid, text, date, uuid, text, jsonb, uuid)
-- ---------------------------------------------------------------------------
drop function if exists public.create_grn(text, uuid, text, date, uuid, text, jsonb);
drop function if exists public.create_grn(text, uuid, text, date, uuid, text, jsonb, uuid);

create or replace function public.create_grn(
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
  v_grn_number text;
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

  v_grn_number := public.next_company_document_number('grn');

  insert into public.grns (
    grn_number, supplier_id, invoice_number, received_date, location_id, notes, po_id, created_by
  )
  values (
    v_grn_number,
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

revoke all on function public.create_grn(uuid, text, date, uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.create_grn(uuid, text, date, uuid, text, jsonb, uuid) to authenticated;

comment on function public.create_grn(uuid, text, date, uuid, text, jsonb, uuid) is
  'Creates a draft GRN and lines atomically, optionally linked to one purchase order. Number is allocated by the database (GRN).';

-- ---------------------------------------------------------------------------
-- 9. create_siv — old (text, date, uuid, uuid, text, jsonb) -> (date, uuid, uuid, text, jsonb)
-- ---------------------------------------------------------------------------
drop function if exists public.create_siv(text, date, uuid, uuid, text, jsonb);

create or replace function public.create_siv(
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
  v_siv_number text;
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

  v_siv_number := public.next_company_document_number('siv');

  insert into public.sivs (
    siv_number, issue_date, source_location_id, destination_location_id, notes, requested_by
  )
  values (
    v_siv_number,
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

revoke all on function public.create_siv(date, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.create_siv(date, uuid, uuid, text, jsonb) to authenticated;

comment on function public.create_siv(date, uuid, uuid, text, jsonb) is
  'Creates a draft SIV and lines atomically. Number is allocated by the database (SIV).';

-- ---------------------------------------------------------------------------
-- 10. create_inventory_adjustment
--     old (text, text, date, uuid, text, text, jsonb)
--     -> (text, date, uuid, text, text, jsonb)
-- ---------------------------------------------------------------------------
drop function if exists public.create_inventory_adjustment(text, text, date, uuid, text, text, jsonb);

create or replace function public.create_inventory_adjustment(
  p_kind text,
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
  v_adjustment_number text;
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

  -- Waste records use their own sequence; everything else is an adjustment.
  v_adjustment_number := public.next_company_document_number(
    case when p_kind = 'waste' then 'waste' else 'adjustment' end
  );

  insert into public.inventory_adjustments (
    adjustment_number, kind, adjustment_date, location_id, reason, notes, created_by
  )
  values (
    v_adjustment_number,
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

revoke all on function public.create_inventory_adjustment(text, date, uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_inventory_adjustment(text, date, uuid, text, text, jsonb) to authenticated;

comment on function public.create_inventory_adjustment(text, date, uuid, text, text, jsonb) is
  'Creates an adjustment or waste draft atomically. Number is allocated by the database (ADJ or WST). Role-gated.';

-- ---------------------------------------------------------------------------
-- 11. create_inventory_count
--     old (text, date, uuid, text, text, jsonb) -> (date, uuid, text, text, jsonb)
-- ---------------------------------------------------------------------------
drop function if exists public.create_inventory_count(text, date, uuid, text, text, jsonb);

create or replace function public.create_inventory_count(
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
  v_count_number text;
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

  v_count_number := public.next_company_document_number('count');

  insert into public.inventory_counts (
    count_number, count_date, location_id, counter_name, notes, created_by
  )
  values (
    v_count_number,
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

revoke all on function public.create_inventory_count(date, uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_inventory_count(date, uuid, text, text, jsonb) to authenticated;

comment on function public.create_inventory_count(date, uuid, text, text, jsonb) is
  'Creates a count sheet with system-quantity snapshots and physical quantities (CNT-01..02). Number is allocated by the database.';

-- ---------------------------------------------------------------------------
-- 12. create_production_order
--     old (text, date, uuid, uuid, uuid, numeric, numeric, text, text, jsonb)
--     -> (date, uuid, uuid, uuid, numeric, numeric, text, text, jsonb)
-- ---------------------------------------------------------------------------
drop function if exists public.create_production_order(
  text, date, uuid, uuid, uuid, numeric, numeric, text, text, jsonb
);

create or replace function public.create_production_order(
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
  v_order_number text;
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

  v_order_number := public.next_company_document_number('production');

  insert into public.production_orders (
    order_number, production_date, location_id,
    output_item_id, output_unit_id, output_quantity, output_base_quantity,
    expected_output_quantity, responsible_name, notes, created_by
  )
  values (
    v_order_number,
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

revoke all on function public.create_production_order(date, uuid, uuid, uuid, numeric, numeric, text, text, jsonb) from public, anon;
grant execute on function public.create_production_order(date, uuid, uuid, uuid, numeric, numeric, text, text, jsonb) to authenticated;

comment on function public.create_production_order(date, uuid, uuid, uuid, numeric, numeric, text, text, jsonb) is
  'Creates a production draft with validated inputs and resolved base quantities. Number is allocated by the database (PRD).';

-- ---------------------------------------------------------------------------
-- 13. create_recipe — old (text,text,text,text,numeric,numeric,jsonb)
--     -> (text, text, text, numeric, numeric, jsonb)
-- ---------------------------------------------------------------------------
drop function if exists public.create_recipe(text, text, text, text, numeric, numeric, jsonb);

create or replace function public.create_recipe(
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
  v_code text;
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
  if p_yield_quantity is null or p_yield_quantity <= 0 then
    raise exception 'The recipe yield must be greater than zero' using errcode = '23514';
  end if;
  if p_selling_price is null or p_selling_price < 0 then
    raise exception 'The selling price cannot be negative' using errcode = '23514';
  end if;

  v_code := public.next_master_code('recipe');

  insert into public.recipes (code, name, menu_item_name, notes, created_by)
  values (
    v_code,
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

revoke all on function public.create_recipe(text, text, text, numeric, numeric, jsonb) from public, anon;
grant execute on function public.create_recipe(text, text, text, numeric, numeric, jsonb) to authenticated;

comment on function public.create_recipe(text, text, text, numeric, numeric, jsonb) is
  'Creates a recipe and its first draft version atomically (REC-01, REC-02). Code is allocated by the database (RCP).';

-- ---------------------------------------------------------------------------
-- 14. can_take_orders(): cashiers may now create and modify orders
-- ---------------------------------------------------------------------------
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
      or public.has_role('cashier')
    );
$$;

revoke all on function public.can_take_orders() from public, anon;
grant execute on function public.can_take_orders() to authenticated;

-- Make the changed function signatures visible to PostgREST immediately.
notify pgrst, 'reload schema';
