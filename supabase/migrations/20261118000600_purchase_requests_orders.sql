-- Albena RMS — Phase 4 purchase requests and purchase orders
-- Apply after 20261118000500_stock_ledger.sql.
-- Idempotent: safe to re-run.
--
-- PR-01..04: purchase request header, lines, Draft/Submitted/Approved/Rejected
--            statuses, and a recorded approver decision with time and comment.
-- PO-01..04: purchase order header and lines, Draft/Approved/Ordered/Closed
--            statuses, an optional link to the originating request, and
--            approval restricted to the roles named in the SRS role table.
--
-- OD-06 (approval thresholds and separation of duties) is still open. This
-- migration does not invent thresholds or a no-self-approval rule: the General
-- Manager has approval authority in the SRS role table, and System
-- Administrators can approve as they can administer every module. A request
-- can therefore be approved by the same person who raised it until the owner
-- defines separation-of-duties rules. Every decision is recorded and audited.

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.purchase_request_status as enum (
    'draft',
    'submitted',
    'approved',
    'rejected'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.purchase_order_status as enum (
    'draft',
    'approved',
    'ordered',
    'closed'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Purchase requests (PR-01..04)
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_requests (
  id              uuid primary key default gen_random_uuid(),
  pr_number       text not null unique,
  request_date    date not null,
  requested_by    uuid references auth.users (id) on delete restrict,
  requester_name  text not null default '',
  notes           text,
  status          public.purchase_request_status not null default 'draft',
  submitted_at    timestamptz,
  decided_by      uuid references auth.users (id) on delete restrict,
  decided_by_name text,
  decided_at      timestamptz,
  decision_comment text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint purchase_requests_number_not_blank check (btrim(pr_number) <> '')
);

create table if not exists public.purchase_request_lines (
  id         uuid primary key default gen_random_uuid(),
  pr_id      uuid not null references public.purchase_requests (id) on delete cascade,
  item_id    uuid not null references public.items (id) on delete restrict,
  unit_id    uuid not null references public.units (id) on delete restrict,
  quantity   numeric(18, 6) not null,
  created_at timestamptz not null default now(),
  constraint purchase_request_lines_quantity_positive check (quantity > 0)
);

create index if not exists purchase_requests_created_at_idx
  on public.purchase_requests (created_at desc);
create index if not exists purchase_requests_status_idx
  on public.purchase_requests (status, created_at desc);
create index if not exists purchase_request_lines_pr_idx
  on public.purchase_request_lines (pr_id);

-- ---------------------------------------------------------------------------
-- 3. Purchase orders (PO-01..04)
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id             uuid primary key default gen_random_uuid(),
  po_number      text not null unique,
  supplier_id    uuid not null references public.suppliers (id) on delete restrict,
  pr_id          uuid references public.purchase_requests (id) on delete restrict,
  order_date     date not null,
  expected_date  date,
  notes          text,
  status         public.purchase_order_status not null default 'draft',
  created_by     uuid references auth.users (id) on delete restrict,
  created_at     timestamptz not null default now(),
  approved_by    uuid references auth.users (id) on delete restrict,
  approved_at    timestamptz,
  ordered_at     timestamptz,
  closed_at      timestamptz,
  updated_at     timestamptz not null default now(),
  constraint purchase_orders_number_not_blank check (btrim(po_number) <> ''),
  constraint purchase_orders_pr_once unique (pr_id)
);

create table if not exists public.purchase_order_lines (
  id         uuid primary key default gen_random_uuid(),
  po_id      uuid not null references public.purchase_orders (id) on delete cascade,
  item_id    uuid not null references public.items (id) on delete restrict,
  unit_id    uuid not null references public.units (id) on delete restrict,
  quantity   numeric(18, 6) not null,
  unit_cost  numeric(14, 2) not null,
  line_total numeric(14, 2) generated always as (round(quantity * unit_cost, 2)) stored,
  created_at timestamptz not null default now(),
  constraint purchase_order_lines_quantity_positive check (quantity > 0),
  constraint purchase_order_lines_unit_cost_positive check (unit_cost > 0)
);

create index if not exists purchase_orders_created_at_idx
  on public.purchase_orders (created_at desc);
create index if not exists purchase_orders_status_idx
  on public.purchase_orders (status, created_at desc);
create index if not exists purchase_order_lines_po_idx
  on public.purchase_order_lines (po_id);

-- ---------------------------------------------------------------------------
-- 4. Authorization helpers
--    Purchasing Officer owns requests and orders; the General Manager has
--    approval authority; System Administrators can act in every module.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_name()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select nullif(btrim(p.full_name), '')
      from public.user_profiles p
      where p.id = auth.uid()
    ),
    'Unknown user'
  );
$$;

create or replace function public.can_manage_purchasing()
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
      or public.has_role('purchasing_officer')
    );
$$;

create or replace function public.can_approve_purchasing()
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

-- ---------------------------------------------------------------------------
-- 5. Create a draft purchase request
-- ---------------------------------------------------------------------------
create or replace function public.create_purchase_request(
  p_pr_number text,
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

  if nullif(btrim(p_pr_number), '') is null then
    raise exception 'A request number is required' using errcode = '23514';
  end if;
  if length(btrim(p_pr_number)) > 40 then
    raise exception 'Use 40 characters or fewer for the request number' using errcode = '23514';
  end if;
  if p_request_date is null then
    raise exception 'A request date is required' using errcode = '23514';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A purchase request needs at least one line' using errcode = '23514';
  end if;

  insert into public.purchase_requests (
    pr_number, request_date, requested_by, requester_name, notes
  )
  values (
    upper(btrim(p_pr_number)),
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

-- ---------------------------------------------------------------------------
-- 6. Submit and decide a purchase request
-- ---------------------------------------------------------------------------
create or replace function public.submit_purchase_request(p_pr_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_purchasing() then
    raise exception 'You do not have permission to submit purchase requests'
      using errcode = '42501';
  end if;

  update public.purchase_requests
     set status = 'submitted',
         submitted_at = now(),
         updated_at = now()
   where id = p_pr_id
     and status = 'draft';

  if not found then
    raise exception 'Only a draft purchase request can be submitted' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.decide_purchase_request(
  p_pr_id uuid,
  p_decision text,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_decision public.purchase_request_status;
begin
  if not public.can_approve_purchasing() then
    raise exception 'You do not have permission to approve or reject purchase requests'
      using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Choose approved or rejected' using errcode = '23514';
  end if;

  v_decision := p_decision::public.purchase_request_status;

  update public.purchase_requests
     set status = v_decision,
         decided_by = auth.uid(),
         decided_by_name = public.current_user_name(),
         decided_at = now(),
         decision_comment = nullif(btrim(coalesce(p_comment, '')), ''),
         updated_at = now()
   where id = p_pr_id
     and status = 'submitted';

  if not found then
    raise exception 'Only a submitted purchase request can be approved or rejected'
      using errcode = '23514';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Create a draft purchase order, optionally from an approved request
-- ---------------------------------------------------------------------------
create or replace function public.create_purchase_order(
  p_po_number text,
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

  if nullif(btrim(p_po_number), '') is null then
    raise exception 'A purchase order number is required' using errcode = '23514';
  end if;
  if length(btrim(p_po_number)) > 40 then
    raise exception 'Use 40 characters or fewer for the purchase order number'
      using errcode = '23514';
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

  insert into public.purchase_orders (
    po_number, supplier_id, pr_id, order_date, expected_date, notes, created_by
  )
  values (
    upper(btrim(p_po_number)),
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

-- ---------------------------------------------------------------------------
-- 8. Approve, order and close a purchase order
-- ---------------------------------------------------------------------------
create or replace function public.approve_purchase_order(p_po_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_approve_purchasing() then
    raise exception 'You do not have permission to approve purchase orders'
      using errcode = '42501';
  end if;

  update public.purchase_orders
     set status = 'approved',
         approved_by = auth.uid(),
         approved_at = now(),
         updated_at = now()
   where id = p_po_id
     and status = 'draft';

  if not found then
    raise exception 'Only a draft purchase order can be approved' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.mark_purchase_order_ordered(p_po_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_purchasing() then
    raise exception 'You do not have permission to update purchase orders'
      using errcode = '42501';
  end if;

  update public.purchase_orders
     set status = 'ordered',
         ordered_at = now(),
         updated_at = now()
   where id = p_po_id
     and status = 'approved';

  if not found then
    raise exception 'Only an approved purchase order can be marked as ordered'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.close_purchase_order(p_po_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_purchasing() then
    raise exception 'You do not have permission to update purchase orders'
      using errcode = '42501';
  end if;

  update public.purchase_orders
     set status = 'closed',
         closed_at = now(),
         updated_at = now()
   where id = p_po_id
     and status = 'ordered';

  if not found then
    raise exception 'Only an ordered purchase order can be closed' using errcode = '23514';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Function privileges
-- ---------------------------------------------------------------------------
revoke all on function public.current_user_name() from public;
revoke all on function public.can_manage_purchasing() from public;
revoke all on function public.can_approve_purchasing() from public;
revoke all on function public.create_purchase_request(text, date, text, jsonb) from public;
revoke all on function public.submit_purchase_request(uuid) from public;
revoke all on function public.decide_purchase_request(uuid, text, text) from public;
revoke all on function public.create_purchase_order(text, uuid, uuid, date, date, text, jsonb) from public;
revoke all on function public.approve_purchase_order(uuid) from public;
revoke all on function public.mark_purchase_order_ordered(uuid) from public;
revoke all on function public.close_purchase_order(uuid) from public;

grant execute on function public.current_user_name() to authenticated;
grant execute on function public.can_manage_purchasing() to authenticated;
grant execute on function public.can_approve_purchasing() to authenticated;
grant execute on function public.create_purchase_request(text, date, text, jsonb) to authenticated;
grant execute on function public.submit_purchase_request(uuid) to authenticated;
grant execute on function public.decide_purchase_request(uuid, text, text) to authenticated;
grant execute on function public.create_purchase_order(text, uuid, uuid, date, date, text, jsonb) to authenticated;
grant execute on function public.approve_purchase_order(uuid) to authenticated;
grant execute on function public.mark_purchase_order_ordered(uuid) to authenticated;
grant execute on function public.close_purchase_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Audit triggers (AUD-01..03)
-- ---------------------------------------------------------------------------
drop trigger if exists purchase_requests_audit on public.purchase_requests;
create trigger purchase_requests_audit
  after insert or update or delete on public.purchase_requests
  for each row execute function public.write_audit_log();

drop trigger if exists purchase_request_lines_audit on public.purchase_request_lines;
create trigger purchase_request_lines_audit
  after insert or update or delete on public.purchase_request_lines
  for each row execute function public.write_audit_log();

drop trigger if exists purchase_orders_audit on public.purchase_orders;
create trigger purchase_orders_audit
  after insert or update or delete on public.purchase_orders
  for each row execute function public.write_audit_log();

drop trigger if exists purchase_order_lines_audit on public.purchase_order_lines;
create trigger purchase_order_lines_audit
  after insert or update or delete on public.purchase_order_lines
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- 11. Row-Level Security
--     Read for active users; no direct writes. Draft creation, submission,
--     decisions and status changes go through the SECURITY DEFINER functions.
-- ---------------------------------------------------------------------------
alter table public.purchase_requests      enable row level security;
alter table public.purchase_request_lines enable row level security;
alter table public.purchase_orders        enable row level security;
alter table public.purchase_order_lines   enable row level security;

drop policy if exists purchase_requests_select on public.purchase_requests;
create policy purchase_requests_select on public.purchase_requests
  for select to authenticated
  using (public.is_active_user());

drop policy if exists purchase_request_lines_select on public.purchase_request_lines;
create policy purchase_request_lines_select on public.purchase_request_lines
  for select to authenticated
  using (public.is_active_user());

drop policy if exists purchase_orders_select on public.purchase_orders;
create policy purchase_orders_select on public.purchase_orders
  for select to authenticated
  using (public.is_active_user());

drop policy if exists purchase_order_lines_select on public.purchase_order_lines;
create policy purchase_order_lines_select on public.purchase_order_lines
  for select to authenticated
  using (public.is_active_user());

revoke all on public.purchase_requests      from anon, authenticated;
revoke all on public.purchase_request_lines from anon, authenticated;
revoke all on public.purchase_orders        from anon, authenticated;
revoke all on public.purchase_order_lines   from anon, authenticated;

grant select on public.purchase_requests      to authenticated;
grant select on public.purchase_request_lines to authenticated;
grant select on public.purchase_orders        to authenticated;
grant select on public.purchase_order_lines   to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Comments
-- ---------------------------------------------------------------------------
comment on table public.purchase_requests is 'Purchase request header (PR-01..04). Statuses: draft, submitted, approved, rejected.';
comment on table public.purchase_request_lines is 'Purchase request lines in the requested unit (PR-01..02).';
comment on table public.purchase_orders is 'Purchase order header (PO-01..04). Statuses: draft, approved, ordered, closed. pr_id links the originating request.';
comment on table public.purchase_order_lines is 'Purchase order lines in the ordered unit with the agreed unit cost (PO-01).';
comment on function public.create_purchase_request(text, date, text, jsonb) is 'Creates a draft purchase request and lines atomically. Role-gated; OD-06 approval thresholds are not implemented.';
comment on function public.submit_purchase_request(uuid) is 'Moves a draft purchase request to submitted (PR-03).';
comment on function public.decide_purchase_request(uuid, text, text) is 'Approves or rejects a submitted request and records the approver, time and comment (PR-03..04).';
comment on function public.create_purchase_order(text, uuid, uuid, date, date, text, jsonb) is 'Creates a draft purchase order, optionally linked to one approved request (PO-01..03).';
comment on function public.approve_purchase_order(uuid) is 'Approves a draft purchase order; restricted to approval roles (PO-02, PO-04).';
comment on function public.mark_purchase_order_ordered(uuid) is 'Moves an approved order to ordered (PO-02).';
comment on function public.close_purchase_order(uuid) is 'Closes an ordered purchase order (PO-02).';
