-- Albena RMS — Phase 7 reporting views (RPT-01..09, KDS-04, COST-01..03)
-- Apply after 20261118001100_receipt_footer_and_function_privileges.sql.
-- Idempotent: safe to re-run.
--
-- Design notes:
--   * Every view uses security_invoker = true, so the caller's RLS policies on
--     the base tables remain the authorization boundary. There is no separate
--     report role gate yet: OD-06 (thresholds and separation of duties) is still
--     open, and Phase 5/6 reads already use is_active_user() for every active
--     user. Granular report roles can be added when OD-06 is decided.
--   * Business dates use Africa/Addis_Ababa (OD-01), matching business_today().
--   * No view invents a slow-moving/dead-stock threshold. inventory_report
--     exposes days_since_last_movement and the caller chooses the threshold.
--   * Theoretical consumption (COST-03) uses the currently published recipe
--     version and the current weighted-average remaining FIFO layer cost. These
--     are documented assumptions, not historical replays.
--   * Revenue reports read receipts (the immutable close snapshot), so an order
--     contributes revenue only after it is closed and a receipt is issued.

-- ---------------------------------------------------------------------------
-- 1. Sales (RPT-01)
-- ---------------------------------------------------------------------------
create or replace view public.sales_daily
with (security_invoker = true)
as
select
  (r.issued_at at time zone 'Africa/Addis_Ababa')::date as business_date,
  r.outlet_id,
  o.code as outlet_code,
  o.name as outlet_name,
  count(*)::integer as receipt_count,
  coalesce(sum(r.line_count), 0)::integer as line_count,
  round(sum(r.subtotal), 2) as subtotal,
  round(sum(r.vat_amount), 2) as vat_amount,
  round(sum(r.total), 2) as total,
  round(avg(r.total), 2) as average_receipt
from public.receipts r
join public.outlets o on o.id = r.outlet_id
group by 1, 2, 3, 4;

create or replace view public.sales_lines
with (security_invoker = true)
as
select
  (rc.issued_at at time zone 'Africa/Addis_Ababa')::date as business_date,
  o.outlet_id,
  outl.code as outlet_code,
  outl.name as outlet_name,
  o.id as order_id,
  o.order_number,
  rc.id as receipt_id,
  rc.receipt_number,
  ol.id as order_line_id,
  o.waiter_name,
  mc.id as category_id,
  coalesce(mc.name, 'Uncategorised') as category_name,
  ol.menu_item_id,
  ol.item_code,
  ol.item_name,
  ol.quantity,
  ol.unit_price,
  ol.line_total
from public.receipts rc
join public.orders o on o.id = rc.order_id
join public.outlets outl on outl.id = o.outlet_id
join public.order_lines ol on ol.order_id = o.id
left join public.menu_items mi on mi.id = ol.menu_item_id
left join public.menu_categories mc on mc.id = mi.category_id;

-- ---------------------------------------------------------------------------
-- 2. Inventory (RPT-02)
-- ---------------------------------------------------------------------------
create or replace view public.inventory_report
with (security_invoker = true)
as
select
  i.id as item_id,
  i.code as item_code,
  i.name as item_name,
  ic.name as category_name,
  bu.code as base_unit_code,
  i.reorder_level,
  round(coalesce(sum(sb.quantity), 0), 6) as on_hand,
  round(coalesce(sum(sb.total_value), 0), 6) as inventory_value,
  round(
    coalesce(sum(sb.total_value), 0) / nullif(sum(sb.quantity), 0),
    6
  ) as average_unit_cost,
  max(sb.last_movement_at) as last_movement_at,
  (
    (now() at time zone 'Africa/Addis_Ababa')::date
      - (max(sb.last_movement_at) at time zone 'Africa/Addis_Ababa')::date
  ) as days_since_last_movement,
  (coalesce(sum(sb.quantity), 0) < i.reorder_level) as is_below_reorder
from public.items i
join public.units bu on bu.id = i.base_unit_id
left join public.item_categories ic on ic.id = i.category_id
left join public.stock_balances sb on sb.item_id = i.id
where i.is_active
group by i.id, i.code, i.name, ic.name, bu.code, i.reorder_level;

-- ---------------------------------------------------------------------------
-- 3. Purchasing (RPT-03)
-- ---------------------------------------------------------------------------
create or replace view public.purchase_request_report
with (security_invoker = true)
as
select
  pr.id as pr_id,
  pr.pr_number,
  pr.request_date,
  pr.requester_name,
  pr.status,
  pr.submitted_at,
  pr.decided_by_name,
  pr.decided_at,
  pr.decision_comment,
  coalesce(l.line_count, 0) as line_count,
  round(coalesce(l.total_quantity, 0), 6) as total_quantity
from public.purchase_requests pr
left join (
  select
    prl.pr_id,
    count(*)::integer as line_count,
    sum(prl.quantity) as total_quantity
  from public.purchase_request_lines prl
  group by prl.pr_id
) l on l.pr_id = pr.id;

create or replace view public.purchase_order_report
with (security_invoker = true)
as
select
  po.id as po_id,
  po.po_number,
  po.order_date,
  po.expected_date,
  po.status,
  s.code as supplier_code,
  s.name as supplier_name,
  pr.pr_number,
  coalesce(l.line_count, 0) as line_count,
  round(coalesce(l.ordered_value, 0), 2) as ordered_value,
  round(coalesce(r.received_value, 0), 2) as received_value
from public.purchase_orders po
join public.suppliers s on s.id = po.supplier_id
left join public.purchase_requests pr on pr.id = po.pr_id
left join (
  select
    pol.po_id,
    count(*)::integer as line_count,
    sum(pol.line_total) as ordered_value
  from public.purchase_order_lines pol
  group by pol.po_id
) l on l.po_id = po.id
left join (
  select
    pol.po_id,
    sum(gl.line_total) as received_value
  from public.grn_lines gl
  join public.grns g on g.id = gl.grn_id
  join public.purchase_order_lines pol on pol.id = gl.po_line_id
  where g.posted_at is not null
  group by pol.po_id
) r on r.po_id = po.id;

create or replace view public.grn_report
with (security_invoker = true)
as
select
  g.id as grn_id,
  g.grn_number,
  g.invoice_number,
  g.received_date,
  s.code as supplier_code,
  s.name as supplier_name,
  l.code as location_code,
  l.name as location_name,
  po.po_number,
  g.posted_at,
  coalesce(li.line_count, 0) as line_count,
  round(coalesce(li.total_value, 0), 2) as total_value
from public.grns g
join public.suppliers s on s.id = g.supplier_id
join public.stock_locations l on l.id = g.location_id
left join public.purchase_orders po on po.id = g.po_id
left join (
  select
    gl.grn_id,
    count(*)::integer as line_count,
    sum(gl.line_total) as total_value
  from public.grn_lines gl
  group by gl.grn_id
) li on li.grn_id = g.id;

-- ---------------------------------------------------------------------------
-- 4. Cost and waste (RPT-04, RPT-05, COST-01..03)
-- ---------------------------------------------------------------------------
create or replace view public.waste_report
with (security_invoker = true)
as
select
  a.id as adjustment_id,
  a.adjustment_number,
  a.adjustment_date,
  a.location_id,
  l.code as location_code,
  l.name as location_name,
  a.reason,
  a.notes,
  al.id as line_id,
  al.item_id,
  i.code as item_code,
  i.name as item_name,
  bu.code as base_unit_code,
  u.code as entered_unit_code,
  al.quantity,
  al.base_quantity,
  al.unit_cost,
  round(coalesce(al.posted_cost, al.base_quantity * al.unit_cost, 0), 2) as waste_cost
from public.inventory_adjustments a
join public.stock_locations l on l.id = a.location_id
join public.inventory_adjustment_lines al on al.adjustment_id = a.id
join public.items i on i.id = al.item_id
join public.units bu on bu.id = i.base_unit_id
join public.units u on u.id = al.unit_id
where a.kind = 'waste'
  and a.status = 'posted';

create or replace view public.theoretical_consumption
with (security_invoker = true)
as
with sold as (
  select
    (rc.issued_at at time zone 'Africa/Addis_Ababa')::date as business_date,
    o.outlet_id,
    ol.menu_item_id,
    ol.item_code as menu_item_code,
    ol.item_name as menu_item_name,
    sum(ol.quantity)::integer as portions_sold
  from public.receipts rc
  join public.orders o on o.id = rc.order_id
  join public.order_lines ol on ol.order_id = o.id
  where ol.menu_item_id is not null
  group by 1, 2, 3, 4, 5
),
published as (
  select distinct on (v.recipe_id)
    v.id as version_id,
    v.recipe_id
  from public.recipe_versions v
  where v.status = 'published'
  order by v.recipe_id, v.version_number desc
),
item_costs as (
  select
    sl.item_id,
    sum(sl.remaining_quantity * sl.unit_cost)
      / nullif(sum(sl.remaining_quantity), 0) as average_unit_cost
  from public.stock_layers sl
  where sl.remaining_quantity > 0
  group by sl.item_id
)
select
  s.business_date,
  s.outlet_id,
  outl.code as outlet_code,
  outl.name as outlet_name,
  s.menu_item_id,
  s.menu_item_code,
  s.menu_item_name,
  s.portions_sold,
  rl.item_id as ingredient_item_id,
  i.code as ingredient_code,
  i.name as ingredient_name,
  bu.code as base_unit_code,
  round(s.portions_sold * rl.base_quantity, 6) as theoretical_quantity,
  round(coalesce(ic.average_unit_cost, 0), 6) as average_unit_cost,
  round(
    s.portions_sold * rl.base_quantity * coalesce(ic.average_unit_cost, 0),
    2
  ) as theoretical_cost
from sold s
join public.menu_items mi on mi.id = s.menu_item_id
join published p on p.recipe_id = mi.recipe_id
join public.recipe_version_lines rl on rl.version_id = p.version_id
join public.outlets outl on outl.id = s.outlet_id
join public.items i on i.id = rl.item_id
join public.units bu on bu.id = i.base_unit_id
left join item_costs ic on ic.item_id = rl.item_id;

create or replace view public.consumption_variance
with (security_invoker = true)
as
with theoretical as (
  select
    tc.business_date,
    tc.ingredient_item_id as item_id,
    sum(tc.theoretical_quantity) as theoretical_quantity,
    sum(tc.theoretical_cost) as theoretical_cost
  from public.theoretical_consumption tc
  group by 1, 2
),
actual as (
  select
    (t.posted_at at time zone 'Africa/Addis_Ababa')::date as business_date,
    t.item_id,
    sum(case when t.direction = 'out' then t.quantity else 0 end) as issued_quantity,
    sum(case when t.direction = 'out' then t.total_cost else 0 end) as issued_cost,
    sum(case when t.transaction_type = 'waste' then t.quantity else 0 end)
      as waste_quantity
  from public.stock_transactions t
  group by 1, 2
)
select
  coalesce(th.business_date, a.business_date) as business_date,
  coalesce(th.item_id, a.item_id) as item_id,
  i.code as item_code,
  i.name as item_name,
  bu.code as base_unit_code,
  round(coalesce(th.theoretical_quantity, 0), 6) as theoretical_quantity,
  round(coalesce(th.theoretical_cost, 0), 2) as theoretical_cost,
  round(coalesce(a.issued_quantity, 0), 6) as issued_quantity,
  round(coalesce(a.issued_cost, 0), 2) as issued_cost,
  round(coalesce(a.waste_quantity, 0), 6) as waste_quantity,
  round(
    coalesce(a.issued_quantity, 0) - coalesce(th.theoretical_quantity, 0),
    6
  ) as variance_quantity
from theoretical th
full join actual a
  on a.business_date = th.business_date
 and a.item_id = th.item_id
join public.items i on i.id = coalesce(th.item_id, a.item_id)
join public.units bu on bu.id = i.base_unit_id;

-- ---------------------------------------------------------------------------
-- 5. Kitchen performance (RPT-06, KDS-04)
-- ---------------------------------------------------------------------------
create or replace view public.kitchen_performance
with (security_invoker = true)
as
select
  o.id as order_id,
  o.order_number,
  (o.opened_at at time zone 'Africa/Addis_Ababa')::date as business_date,
  o.outlet_id,
  outl.code as outlet_code,
  outl.name as outlet_name,
  o.status,
  o.waiter_name,
  o.opened_at,
  o.sent_at,
  o.preparing_at,
  o.ready_at,
  o.served_at,
  o.closed_at,
  o.cancelled_at,
  round(extract(epoch from (o.ready_at - o.sent_at)) / 60.0, 2)
    as minutes_to_ready,
  round(extract(epoch from (o.served_at - o.sent_at)) / 60.0, 2)
    as minutes_to_serve,
  round(extract(epoch from (o.closed_at - o.opened_at)) / 60.0, 2)
    as minutes_open
from public.orders o
join public.outlets outl on outl.id = o.outlet_id
where o.sent_at is not null;

-- ---------------------------------------------------------------------------
-- 6. Reservations (RPT-07)
-- ---------------------------------------------------------------------------
create or replace view public.reservation_daily
with (security_invoker = true)
as
select
  r.reserved_date,
  r.outlet_id,
  outl.code as outlet_code,
  outl.name as outlet_name,
  count(*)::integer as total_reservations,
  count(*) filter (where r.status = 'booked')::integer as booked,
  count(*) filter (where r.status = 'confirmed')::integer as confirmed,
  count(*) filter (where r.status = 'arrived')::integer as arrived,
  count(*) filter (where r.status = 'completed')::integer as completed,
  count(*) filter (where r.status = 'cancelled')::integer as cancelled,
  count(*) filter (where r.table_id is null)::integer as unassigned,
  coalesce(sum(r.party_size), 0)::integer as covers,
  coalesce(
    sum(r.party_size) filter (where r.status in ('booked', 'confirmed', 'arrived')),
    0
  )::integer as expected_covers
from public.reservations r
join public.outlets outl on outl.id = r.outlet_id
group by r.reserved_date, r.outlet_id, outl.code, outl.name;

-- ---------------------------------------------------------------------------
-- 7. Access control for the report views
--    Base tables keep their is_active_user() RLS policies; report views are
--    readable by authenticated users only, never by anon.
-- ---------------------------------------------------------------------------
revoke all on public.sales_daily from public, anon, authenticated;
revoke all on public.sales_lines from public, anon, authenticated;
revoke all on public.inventory_report from public, anon, authenticated;
revoke all on public.purchase_request_report from public, anon, authenticated;
revoke all on public.purchase_order_report from public, anon, authenticated;
revoke all on public.grn_report from public, anon, authenticated;
revoke all on public.waste_report from public, anon, authenticated;
revoke all on public.theoretical_consumption from public, anon, authenticated;
revoke all on public.consumption_variance from public, anon, authenticated;
revoke all on public.kitchen_performance from public, anon, authenticated;
revoke all on public.reservation_daily from public, anon, authenticated;

grant select on public.sales_daily to authenticated;
grant select on public.sales_lines to authenticated;
grant select on public.inventory_report to authenticated;
grant select on public.purchase_request_report to authenticated;
grant select on public.purchase_order_report to authenticated;
grant select on public.grn_report to authenticated;
grant select on public.waste_report to authenticated;
grant select on public.theoretical_consumption to authenticated;
grant select on public.consumption_variance to authenticated;
grant select on public.kitchen_performance to authenticated;
grant select on public.reservation_daily to authenticated;

comment on view public.sales_daily is
  'RPT-01: daily revenue and receipt totals per outlet, from immutable receipts (Africa/Addis_Ababa dates).';
comment on view public.sales_lines is
  'RPT-01: sold order lines per receipt with menu category and waiter.';
comment on view public.inventory_report is
  'RPT-02: on-hand quantity, FIFO value and days since last movement per active item. Caller chooses slow/dead thresholds.';
comment on view public.purchase_request_report is
  'RPT-03: purchase request header totals and statuses. Request lines carry no price.';
comment on view public.purchase_order_report is
  'RPT-03: purchase order values and posted GRN received value per PO.';
comment on view public.grn_report is
  'RPT-03: goods received notes with supplier, location and posted value.';
comment on view public.waste_report is
  'RPT-05: posted waste adjustment lines with cost.';
comment on view public.theoretical_consumption is
  'COST-03: sales quantity x current published recipe x current weighted-average FIFO cost, per business date and outlet.';
comment on view public.consumption_variance is
  'COST-03: theoretical versus ledger-issued quantity per item and business date; issued includes SIV, production inputs and waste.';
comment on view public.kitchen_performance is
  'RPT-06 / KDS-04: order timestamps and minutes to ready/serve for orders sent to the kitchen.';
comment on view public.reservation_daily is
  'RPT-07: reservation counts and covers per date and outlet. Summary only; no guest history (RES-03 dropped per OD-10).';
