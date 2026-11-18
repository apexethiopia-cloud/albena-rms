# Albena RMS — Project Status

## 1. Executive Summary

| Attribute | Value |
| :--- | :--- |
| **Project Name** | Albena Restaurant Management System (RMS) |
| **Current Phase** | Phase 6 build complete — awaiting migrations 0009 and 0010, then final UAT |
| **Overall Completion** | **35.0%** (Phases 0–3 complete; Phases 4–6 credit releases at final UAT) |
| **Last Updated** | 2026-11-18 23:30 UTC+3 |
| **Latest Git Commit** | `a80f90f` (Phase 6 docs + receipt footer) |
| **Active Branch** | `main` |
| **Public Repository** | `https://github.com/apexethiopia-cloud/albena-rms.git` |
| **Live application** | `https://albena-rms.pages.dev` |
| **Supabase project** | `naxhjpmaovnuplfjdgdu` |
| **Authoritative SRS** | `docs/SRS_v3.0.md` (approved 2026-11-17) |
| **Fast-track plan** | `docs/FAST_TRACK_PLAN.md` |

---

## 2. Phase Progress Matrix

Completion percentage calculated from SRS Phase exit conditions only.

| Phase | Scope | Weight | Status | Exit Condition Met |
| :--- | :--- | :---: | :---: | :---: |
| **Phase 0** | Requirements & Setup | 5% | ✅ **Complete** | Yes |
| **Phase 1** | Foundation (React/Vite, Cloudflare, CI/CD) | 10% | ✅ **Complete** | Yes — app live at `albena-rms.pages.dev` |
| **Phase 2** | Backend & Identity (Supabase, Auth, RLS) | 10% | ✅ **Complete** | Schema, RLS and admin auth verified live. **AC-01 confirmed by owner** (all three accounts created) |
| **Phase 3** | Master Data (outlets, suppliers, inventory, users) | 10% | ✅ **Complete** | Master-data CRUD, unit conversions, categories and user/role/outlet administration pass tests |
| **Phase 4** | Inventory & Purchasing (PR, PO, GRN, SIV, stock, counts, adjustments, waste, reorder alerts) | 20% | ✅ **Build complete** | Deferred — all workflows built, migration 0008 applied and structure-verified; AC-06/AC-07 live runs moved to final UAT by the owner (2026-11-18) |
| **Phase 5** | Recipes & Production (versioned recipes, FIFO costing, production posting) | 10% | ✅ **Build complete** | Deferred — recipes, costing and production built and unit-tested; migration 0009 awaits the owner; AC-07/AC-08 live runs moved to final UAT |
| **Phase 6** | Restaurant Operations (menu, tables, reservations, orders, KDS, receipts) | 15% | ✅ **Build complete** | Deferred — all workflows built and unit-tested; migration 0010 (after 0009) awaits the owner; AC-10/AC-11/AC-14/AC-15 live runs moved to final UAT |
| **Phase 7** | Reporting & Dashboard | 10% | ⏳ Planned | No |
| **Phase 8** | Validation & Handover | 10% | ⏳ Planned | No |
| **Total** | | **100%** | **35.0% credited** (build complete through Phase 6) | |

---

## 3. Current Task Status

### Completed (Phase 1, 2026-11-18)
- [x] Toolchain repaired and pinned (`package-lock.json`, Node 20 in CI).
- [x] React + TypeScript + Vite + Tailwind application with routing and app shell.
- [x] Offline / network-error banner (ARC-07).
- [x] ETB (2 decimals) and `Africa/Addis_Ababa` formatting helpers with tests.
- [x] CI workflow; SPA `_redirects` and security `_headers`.
- [x] **Cloudflare Pages deployment live** — `https://albena-rms.pages.dev` (root and `/inventory` both 200).

### Completed (Phase 2, verified live 2026-11-18)
- [x] Owner decisions recorded: **FIFO costing (OD-04, ADR-009)** and **unit conversion model (OD-05, ADR-010)**.
- [x] Supabase project connected; publishable key stored in `.env.local` and Cloudflare env vars only.
- [x] Migration `20261118000100_foundation.sql` **applied**: roles, user_profiles, user_roles, outlets, user_outlet_scopes, audit_logs.
- [x] RLS enabled on all six tables with least-privilege policies.
- [x] `SECURITY DEFINER` helpers (`is_active_user`, `has_role`, `is_admin`) to avoid policy recursion.
- [x] Append-only audit triggers on identity and outlet tables.
- [x] New-user trigger creating a profile, plus backfill for existing accounts.
- [x] Admin RPCs: `admin_set_user_status`, `admin_assign_role`.
- [x] Migration `20261118000200_reference_data.sql` **applied**: 10 SRS roles and 5 outlets.
- [x] `scripts/seed-test-users.mjs` for test-user provisioning (service-role key, local only).
- [x] Frontend auth: Supabase client, `AuthProvider`, `ProtectedRoute`, login page, sign-out, disabled-account state.
- [x] **Owner verification**: administrator authenticates; profile active; `system_admin` role and all five outlet scopes assigned.
- [x] **External verification by agent**: `roles`, `user_profiles`, `outlets`, `user_roles` return `200 []` to anon (RLS filtering); `audit_logs` returns `42501` to anon (deny by design); unknown table returns `PGRST205` (proves tables exist).
- [x] Cloudflare build verified to contain the Supabase project ref, so the environment variables reached the build.

### Completed (Phase 3 — master data UI)
- [x] Migration `20261118000300_master_data.sql` authored: `stock_locations`, `item_categories`, `units`, `item_unit_conversions`, `suppliers`, `items`, RLS policies, audit triggers, comments.
- [x] Migration `20261118000400_master_data_seed.sql` authored: 4 stock locations, 9 categories, unit catalogue with fixed kg/L factors and item-specific box/carton/sack factors.
- [x] `/settings` route now renders a real page (no longer a placeholder).
- [x] Outlet panel: list, create, edit, deactivate/reactivate; never deletes.
- [x] Client-side validation (code pattern, name length, trimming, uppercasing) and database error mapping (`23505` duplicate, `42501` permission).
- [x] Write controls hidden for roles without management rights; the database enforces the same rule regardless.
- [x] Loading, empty, load-failure, action-error and success states.
- [x] Explicit "Not implemented yet" section on the Settings page so scope is unambiguous.
- [x] `/purchasing` route now renders a real page (no longer a placeholder).
- [x] Supplier panel: list, create, edit, deactivate/reactivate with contact, phone, email, address, tax number and payment terms.
- [x] Supplier validation: code pattern, required name, optional-but-validated email and phone, field length limits, normalization (uppercase code, lowercase email, trimmed text).
- [x] Supplier write gate matches the `suppliers_write` policy: System Administrator, General Manager, Purchasing Officer.
- [x] Missing-table errors (`PGRST205`/`42P01`) explain that a pending migration must be applied, instead of showing a raw PostgREST message.
- [x] `/inventory` route now renders a real page (no longer a placeholder).
- [x] Item master panel: list, create, edit, deactivate/reactivate with category, base unit, optional purchase unit, reorder level.
- [x] Item unit-conversion factor entry for purchase units without a universal size (box / carton / sack), recorded per item via `item_unit_conversions`.
- [x] Item write gate matches the `items_write` policy: System Administrator, General Manager, Purchasing Officer, Storekeeper, Executive Chef.
- [x] Base units limited to the seeded gram / millilitre / piece; reorder level validated as a non-negative decimal in the base unit.
- [x] Box/carton/sack purchase units are selectable; when selected, a per-item factor is required and recorded via `item_unit_conversions` (create + edit).
- [x] Category panel: list, create, edit, deactivate/reactivate with name + sort-order validation, mounted on the `/inventory` page (write gate mirrors `item_categories_write`).
- [x] User administration panel on `/settings`: lists profiles with status and roles, disables/reactivates accounts through `admin_set_user_status()`, assigns roles through `admin_assign_role()`, and grants/revokes per-outlet access via `user_outlet_scopes`.
- [x] Outlet-access editor lists active outlets plus any outlet already granted (so an outlet deactivated later can still be revoked); each change saves immediately.
- [x] Admin-only write gate in the UI (`system_admin`) mirrored by the RPC `is_admin()` checks and `user_outlet_scopes_admin_write` RLS policy.

### Completed (Phase 4 — stock ledger, GRN and SIV slice)
- [x] Migration `20261118000500_stock_ledger.sql` **applied by owner** (2026-11-18): `grns`, `grn_lines`, `sivs`, `siv_lines`, append-only `stock_transactions`, FIFO `stock_layers`, `stock_layer_consumptions`, plus the `stock_balances` and `stock_ledger_entries` views.
- [x] Posting functions (`create_grn`, `post_grn`, `create_siv`, `post_siv`) create drafts and post them atomically; each posting is protected against duplicates by `posted_at` and the source-line unique index.
- [x] FIFO: each receipt creates a cost layer; each issue consumes the oldest layers first and records the consumed cost; negative stock is rejected (ADR-009).
- [x] Unit resolution in the database mirrors the item master: fixed factors for kg/L, per-item factors for box/carton/sack, dimension mismatches rejected (ADR-010).
- [x] Role gates `can_post_grn()` and `can_post_siv()` follow the SRS role table; ledger tables have SELECT-only grants and no direct write policy (ADR-003, ADR-007).
- [x] GRN panel on `/purchasing`: list, draft creation, two-step posting confirmation, read-only state and database error messages.
- [x] SIV panel on `/inventory`: list, draft creation with available-at-source guidance, FIFO posting and negative-stock rejection.
- [x] Stock panel on `/inventory`: ledger-derived balances by item/location, FIFO value and recent movements. No editable balance field exists (ADR-007).
- [x] Tests: `stockValidation.test.ts` (17), `Stock.test.tsx` (5) and `Receiving.test.tsx` (6), plus stock/lookup mocks in the existing Inventory and Purchasing suites.
- [x] **Owner live verification (2026-11-18)**: GRN posted 2,000 g → balance 2,000 g / ETB 240.00; SIV issued 500 g → 1,500 g / ETB 180.00; over-issue rejected. FIFO value check passed. (AC-04, AC-05)

### Completed (Phase 4 — purchase requests and purchase orders)
- [x] Migration `20261118000600_purchase_requests_orders.sql` authored: `purchase_request_status` and `purchase_order_status` enums; `purchase_requests`, `purchase_request_lines`, `purchase_orders`, `purchase_order_lines`; unique `pr_id` so one PO per request.
- [x] RPCs create drafts and drive the workflow atomically: `create_purchase_request`, `submit_purchase_request`, `decide_purchase_request`, `create_purchase_order`, `approve_purchase_order`, `mark_purchase_order_ordered`, `close_purchase_order`.
- [x] Approval decisions record the approver name, time and optional comment (PR-04); PO approval records `approved_by`/`approved_at`.
- [x] Role gates `can_manage_purchasing()` (admin/GM/purchasing officer) and `can_approve_purchasing()` (admin/GM) follow the SRS role table; direct writes are revoked and tables are SELECT-only to authenticated users.
- [x] Audit triggers on all four procurement tables.
- [x] PR panel on `/purchasing`: list with status/decision, draft creation, submit, approve/reject with comment.
- [x] PO panel on `/purchasing`: list with supplier/source request/status, draft creation with costs, optional seed from an approved request, approve → mark ordered → close.
- [x] Tests: `procurementValidation.test.ts` (13), `Procurement.test.tsx` (11), plus procurement mocks in the Receiving and Suppliers suites.

### Completed (Phase 4 — GRN ↔ PO linkage)
- [x] Migration `20261118000700_grn_po_linkage.sql` authored: optional `grns.po_id` and `grn_lines.po_line_id`, indexes, and the 8-argument `create_grn` that rejects a mismatched supplier or PO line item.
- [x] `purchase_order_receipts` view derives ordered/received/outstanding base quantities and `pending`/`partial`/`complete`/`over` status from posted GRNs only; drafts do not count and over-receipts are not blocked (no tolerance invented, CON-07).
- [x] GRN panel: purchase-order selector (approved/ordered orders), supplier locked to the order, outstanding lines seeded at the ordered unit and cost, over-receipt warning per line, PO number on documents, and a receipts table for review.
- [x] Tests: 5 new GRN↔PO cases in `Receiving.test.tsx` plus PO-link normalization in `stockValidation.test.ts`; total 166/166 across 21 suites.

### Completed (Phase 4 — inventory counts, adjustments, waste and reorder alerts)
- [x] Migration `20261118000800_counts_adjustments_waste.sql` **applied by owner and structure-verified** (2026-11-18): all six objects exist, anon is denied with `42501`, and all eight RPCs return their role-gate messages instead of 404.
- [x] `inventory_adjustments`, `inventory_adjustment_lines`, `inventory_counts`, `inventory_count_lines`, the `stock_reorder_status` and `inventory_count_variances` views, role helpers `can_manage_inventory()` / `can_approve_inventory()` / `can_post_inventory()`, the shared `post_stock_in()` / `post_stock_out()` FIFO helpers, eight workflow RPCs, audit triggers, RLS and grants.
- [x] Counts count in the item base unit; the sheet snapshots `system_quantity` when created, `variance_quantity` is a generated column, and posting reconciles the ledger to the physical quantity at posting time through `adjustment` transactions with `reference_type = 'inventory_count'` (CNT-01..05, STK-04).
- [x] Adjustments support increase/decrease lines with damage, spoilage, theft, expired and operational-loss reasons; increases create a FIFO layer, decreases consume the oldest layers (ADJ-01..03).
- [x] Waste is stored in the same document tables with `kind = 'waste'`, allows decrease lines only, offers the five waste reasons, and posts as a FIFO decrease with the consumed cost recorded (WST-01..03).
- [x] Workflow is `draft → submitted → approved/rejected → posted` for all three document types; a document posts once and posted documents are read-only.
- [x] Role gates: manage/submit/post = System Administrator, General Manager, Storekeeper; approve/reject = System Administrator, General Manager. Self-approval is not blocked and no thresholds exist (OD-06 interim).
- [x] Reorder alerts compare total on-hand across locations with the item-level reorder level, show the shortage and can reveal tracked items that are not low (INV-06).
- [x] UI: `AdjustmentPanel` / `WastePanel`, `CountPanel` and `LowStockPanel` mounted on `/inventory`; validation and database error messages cover the new documents.
- [x] Tests: `stockValidation.test.ts` (26), `InventoryControl.test.tsx` (8) and updated stock/lookup mocks; totals below.
- [x] **Owner**: migration 0008 applied (2026-11-18); AC-06/AC-07 live verification deferred to final UAT.
- [x] **Agent**: migration 0008 verified through PostgREST — six objects exist, anon denied with `42501`, eight RPCs return role-gate messages.

### Completed (Phase 5 — recipes, costing and production)
- [x] Migration `20261118000900_recipes_production.sql` **authored, not yet applied**: `recipes`, `recipe_versions`, `recipe_version_lines`, `production_orders`, `production_inputs`, the `recipe_version_costs` view, role helpers `can_manage_recipes()` / `can_manage_production()`, seven workflow RPCs, audit triggers, RLS and grants.
- [x] Recipe history is append-only: creating a recipe writes version 1, editing writes a new draft version, and publishing archives the previous published version without deleting it (REC-01, REC-02).
- [x] Ingredient lines store the entered unit and the base quantity resolved through `stock_unit_factor()` at creation, so a unit with no conversion is rejected up front (ADR-010).
- [x] `recipe_version_costs` derives total cost, cost per portion, gross profit and food cost % from the current FIFO weighted-average ingredient cost across all locations; ingredients without layers cost zero and are flagged (REC-03, REC-04).
- [x] Recipe creation and publishing never touch stock (REC-06, ADR-008).
- [x] Production orders record date, location, actual output, optional expected output with a generated yield %, responsible user and inputs (PROD-01, PROD-02).
- [x] `post_production_order()` consumes every input FIFO through `post_stock_out()` and creates the output layer at the consumed cost in one transaction; drafts and definitions never move stock (PROD-03, PROD-04, STK-02/03).
- [x] Roles: manage recipes and production = System Administrator, General Manager, Executive Chef, matching the SRS role table; no approval step or threshold is invented (OD-06 still open).
- [x] UI: `/kitchen` page with the Recipes panel (create, new version, publish, cost table) and the Production panel (draft, input editor, confirm-and-post, history); "Kitchen" nav item added and Production removed from the Inventory planned list.
- [x] Tests: `recipesValidation.test.ts` (16) and `Kitchen.test.tsx` (8); totals below.

### Completed (Phase 6 — restaurant operations, slice 1: menu, tables and reservations)
- [x] Migration `20261118001000_restaurant_operations.sql` **authored, not yet applied**: `business_settings`, `menu_categories`, `menu_items`, `restaurant_tables`, `reservations`, `document_sequences`, `orders`, `order_lines`, `receipts`, the `reservation_slot_load` view, eight role helpers, fifteen workflow RPCs, audit/`updated_at` triggers, RLS, grants and a Realtime publication for `orders`/`order_lines`.
- [x] Menu: categories with sort order, items with code, name, category, VAT-inclusive selling price, optional recipe link and active flag; items are never deleted, so historical order lines stay readable (MENU-01..03).
- [x] Tables: layout with outlet, code, name, seats, zone, active flag and status; state advances automatically as orders and reservations change (TBL-01, TBL-02).
- [x] Reservations: guest name and phone, party size, date/time and optional table; statuses `booked → confirmed → arrived → cancelled/completed`; exact-slot double-booking is blocked and overbooking shows a warning from `reservation_slot_load` (RES-01, RES-02, RES-04; RES-03 dropped per OD-10).
- [x] Role gates mirror the SQL helpers: menu and layout = admin/GM/RM; table status = +waiter/cashier; reservations = +waiter.
- [x] UI: `MenuPanel`, `TablesPanel` and `ReservationsPanel` mounted on `/operations`; the placeholder route was replaced.
- [x] Tests: `menuValidation.test.ts`, `tablesReservationsValidation.test.ts` and the extended `Operations.test.tsx`.
- [x] Committed as `ac31955` and pushed to `main`; Cloudflare deployed the slice.

### Completed (Phase 6 — restaurant operations, slice 2: orders, KDS and receipts)
- [x] Orders: `create_order`, `update_order`, `set_order_status`, `cancel_order`, `transfer_order`, `split_order`, `merge_orders` and `close_order` run atomically under `SECURITY DEFINER`.
- [x] Lifecycle `pending → sent_to_kitchen → preparing → ready → served → closed`, plus `cancelled`; transitions are enforced in SQL, and edits/cancels after the order is sent require a manager (ORD-01..04, ORD-06).
- [x] Every line snapshots the menu code, name and unit price, so later menu edits cannot rewrite history (ORD-03, RCT-05).
- [x] Revision-based optimistic concurrency: a stale `p_expected_revision` raises SQLSTATE `40001` and the UI explains that someone else changed the order (ORD-05).
- [x] Closing requires a served order, computes VAT as `total × rate ÷ (100 + rate)` from the VAT-inclusive line prices, writes an immutable receipt and frees the table (ORD-01, RCT-03, OD-07).
- [x] Receipt numbers are `<OUTLET>-YYYYMMDD-####` per outlet per business day via `document_sequences`; the business name, TIN, address, phone, VAT rate and footer are snapshotted onto each receipt (RCT-01, OD-08).
- [x] Table state follows orders: assigning a table occupies it, and the last close/cancel frees it when no other open order remains.
- [x] Kitchen display: three columns (Sent, Preparing, Ready), sent/opened timestamps, line instructions, role-gated transitions and a Supabase Realtime subscription that refetches on any `orders`/`order_lines` change (KDS-01..03); KDS-01 is partial because it shows timestamps but no elapsed-minutes counter.
- [x] KDS remains online-only; no offline queue exists (KDS-05).
- [x] Settings: `BusinessSettingsPanel` edits the receipt identity and VAT rate; write access is limited to admin/GM and everyone else sees a read-only summary (OD-08).
- [x] Order guardrails: merging requires a manager and same-outlet open orders; split must leave at least one line behind; transfers ignore tables that already have an open order.
- [x] Tests: `ordersValidation.test.ts` (10), `Operations.test.tsx` (11) and `Settings.test.tsx` (12) cover payloads, role gates, the order/KDS flow, receipt rendering and business settings.
- [x] Committed as `3ed1273` (13 files, 3,112 insertions) and pushed to `main`; a follow-up snapshot fix stores the receipt footer on each receipt. Cloudflare serves `assets/index-fqmOEPuP.js` (811,382 bytes) containing the order, KDS and receipt markers.

### Outstanding
- [ ] **Owner**: apply `supabase/migrations/20261118000900_recipes_production.sql`.
- [ ] **Owner**: apply `supabase/migrations/20261118001000_restaurant_operations.sql` **after** 0009 (0010 references `recipes`).
- [ ] **Agent**: after both migrations, verify the Phase 5/6 tables, views and RPC role gates through PostgREST; anon must receive the role-gate error (`42501`), not `404`.
- [ ] **Owner/agent**: AC-06 count reconciliation, AC-07 production posting, AC-08 costing, AC-10 KDS flow, AC-11 order/table workflow, AC-14 concurrency and AC-15 reservations **deferred to final UAT** by the owner (2026-11-18).
- [ ] KDS-04 prep-time reporting and RES-03 guest history are Phase 7 report work; COST-01..03 also remain in Phase 7.
- [ ] Stock locations are not yet linked to outlets, so outlet scoping of stock and recipe costing cannot be enforced (open issue).
- [ ] Add RLS negative-test SQL script for repeatable authorization checks.

---

## 4. Blockers and Risks

| Priority | Type | Description | Blocking | Mitigation |
| :---: | :--- | :--- | :--- | :--- |
| 🔴 HIGH | **Resolved** | Migrations 0006 and 0007 applied 2026-11-18 and checked through PostgREST | AC-03 and GRN-04 demonstration | Objects and RPCs confirmed; anon denied. Only the live signed-in workflow runs remain |
| 🔴 HIGH | **Pending action** | Migration `20261118000900_recipes_production.sql` is not applied yet | Phase 5 live panels | Owner applies it in the Supabase SQL editor; the UI reports the missing objects until then |
| 🔴 HIGH | **Pending action** | Migration `20261118001000_restaurant_operations.sql` is not applied yet and must follow 0009 | Phase 6 live panels | Owner applies it after 0009; `menu_items.recipe_id` references `recipes`, so the order matters |
| 🟡 MEDIUM | **Risk** | **Supabase project pausing** after inactivity (free plan) | Demos | Warm-up request before every demo |
| 🟡 MEDIUM | **Risk** | **No automated backups** on the free plan | Phase 4+ | Manual export before milestones; restore test in Phase 8 |
| 🟡 MEDIUM | **Risk** | **AI quota** visible only in the provider UI | Ongoing | Micro-milestones; 25% warn / 15% stop policy |
| 🟡 MEDIUM | **Open decision** | OD-06 approval thresholds and separation of duties are undefined | Full Phase 4 acceptance | Interim: PR/PO and inventory-document approval limited to admin/GM with approver, time and comment recorded; manage/post limited to admin/GM/storekeeper for inventory documents; self-approval allowed until SoD is defined; no thresholds invented |
| 🟡 MEDIUM | **Open issue** | `stock_locations` has no outlet link, so stock cannot be outlet-scoped; Phase 6 reads remain role-based | OUT-03/04 and outlet-scoped reports | Decide the location↔outlet model before reporting |
| 🟢 LOW | **Risk** | **Service-role key** needed only for the seeding script | Test users | Key lives in `.env.local` only; never in the repo or browser bundle |
| 🟢 LOW | **Resolved** | OD-04 and OD-05 answered 2026-11-18 (FIFO, base units) | — | Recorded in ADR-009 and ADR-010 |
| 🟢 LOW | **Resolved** | Master-data migrations 0003/0004 applied 2026-11-18; all six tables respond to REST | — | Anon reads return `200 []`; anon writes return `42501` |
| 🟢 LOW | **Resolved** | AC-01/AC-02 sign-off | Phase 2 acceptance | Three individual accounts exist; owner confirmed the end-to-end check |
| 🟢 LOW | **Resolved** | AC-04/AC-05 live stock verification | Phase 4 acceptance | Owner posted a GRN and SIV; balances and FIFO value matched, over-issue rejected |
| 🟢 LOW | **Resolved** | OD-07, OD-08, OD-09, OD-10 and OD-12 answered 2026-11-18 | Phase 6 build | VAT 15% inclusive only; outlet-day receipt numbers; optional table assignment with slot blocking; no guest profiles; hotel features deferred — recorded in ADR-013 |

---

## 5. Files Created or Modified

| File | Action | Date |
| :--- | :--- | :--- |
| `src/**` | Created — shell, pages, auth, lib, tests | 2026-11-18 |
| `src/features/auth/**` | Created — context, provider, route guard | 2026-11-18 |
| `src/features/outlets/validation.ts` | **Created** — outlet validation + DB error mapping | 2026-11-18 |
| `src/features/outlets/api.ts` | **Created** — outlet data access via RLS client | 2026-11-18 |
| `src/features/outlets/OutletsPanel.tsx` | **Created** — list/create/edit/deactivate UI | 2026-11-18 |
| `src/features/suppliers/validation.ts` | **Created** — supplier validation + DB error mapping | 2026-11-18 |
| `src/features/suppliers/api.ts` | **Created** — supplier data access via RLS client | 2026-11-18 |
| `src/features/suppliers/SuppliersPanel.tsx` | **Created** — supplier CRUD UI | 2026-11-18 |
| `src/features/items/validation.ts` | **Created** — item validation | 2026-11-18 |
| `src/features/items/api.ts` | **Created** — items, units and categories data access | 2026-11-18 |
| `src/features/items/ItemsPanel.tsx` | **Created** — item master CRUD UI | 2026-11-18 |
| `src/lib/errors.ts` | **Created** — shared Postgres error mapping | 2026-11-18 |
| `src/pages/Settings.tsx` | **Created** — settings page with outlet panel | 2026-11-18 |
| `src/pages/Purchasing.tsx` | **Created** — purchasing page with supplier panel | 2026-11-18 |
| `src/pages/Inventory.tsx` | **Updated** — stock, reorder, issue, count, adjustment, waste and master-data panels; Production moved to `/kitchen` | 2026-11-18 |
| `src/pages/Login.tsx` | Created | 2026-11-18 |
| `src/lib/supabase.ts` | Created | 2026-11-18 |
| `supabase/migrations/20261118000100_foundation.sql` | Created — applied by owner | 2026-11-18 |
| `supabase/migrations/20261118000200_reference_data.sql` | Created — applied by owner | 2026-11-18 |
| `supabase/migrations/20261118000300_master_data.sql` | Created — **applied by owner** | 2026-11-18 |
| `supabase/migrations/20261118000400_master_data_seed.sql` | Created — **applied by owner** | 2026-11-18 |
| `supabase/migrations/20261118000500_stock_ledger.sql` | Created — **applied by owner** | 2026-11-18 |
| `src/features/stock/**` | **Created** — ledger API, unit/GRN/SIV validation, stock/GRN/SIV panels | 2026-11-18 |
| `src/test/Stock.test.tsx`, `src/test/Receiving.test.tsx`, `src/test/stockValidation.test.ts` | **Created** — Phase 4 panel and validation tests | 2026-11-18 |
| `supabase/migrations/20261118000600_purchase_requests_orders.sql` | **Created** — PR/PO schema, RPCs, RLS, audit — **applied by owner** | 2026-11-18 |
| `src/features/procurement/**` | **Created** — PR/PO API, validation, line editor and panels | 2026-11-18 |
| `src/test/Procurement.test.tsx`, `src/test/procurementValidation.test.ts` | **Created** — PR/PO panel and validation tests | 2026-11-18 |
| `supabase/migrations/20261118000700_grn_po_linkage.sql` | **Created** — GRN↔PO columns, `create_grn` update, receipts view — **applied by owner** | 2026-11-18 |
| `supabase/migrations/20261118000800_counts_adjustments_waste.sql` | **Created** — counts, adjustments, waste, reorder view, role helpers, 8 RPCs, RLS/audit — **not yet applied** | 2026-11-18 |
| `src/features/stock/AdjustmentPanel.tsx` | **Created** — adjustment and waste panels with approval/posting flow | 2026-11-18 |
| `src/features/stock/CountPanel.tsx` | **Created** — count sheet with system/physical/variance and approval/posting | 2026-11-18 |
| `src/features/stock/LowStockPanel.tsx` | **Created** — reorder alert table | 2026-11-18 |
| `src/test/InventoryControl.test.tsx` | **Created** — reorder, adjustment, waste and count panels plus role gates | 2026-11-18 |
| `supabase/migrations/20261118000900_recipes_production.sql` | **Created** — recipes/versions/lines, production orders/inputs, costing view, 7 RPCs, RLS/audit — **not yet applied** | 2026-11-18 |
| `src/features/recipes/**` | **Created** — recipe API, validation, costing table and version UI | 2026-11-18 |
| `src/features/production/**` | **Created** — production API, validation, draft/post panel | 2026-11-18 |
| `src/pages/Kitchen.tsx` | **Created** — `/kitchen` page mounting both panels | 2026-11-18 |
| `src/test/recipesValidation.test.ts`, `src/test/Kitchen.test.tsx` | **Created** — Phase 5 validation and panel tests | 2026-11-18 |
| `supabase/migrations/20261118001000_restaurant_operations.sql` | **Created** — menu, tables, reservations, orders, receipts, business settings, 15 RPCs, RLS/audit/Realtime — **not yet applied** | 2026-11-18 |
| `src/features/menu/**` | **Created** — menu API, validation, category and item panel | 2026-11-18 |
| `src/features/tables/**` | **Created** — table layout API, validation and panel | 2026-11-18 |
| `src/features/reservations/**` | **Created** — reservation API, validation, slot-load warning and panel | 2026-11-18 |
| `src/features/orders/validation.ts` | **Created** — order validation and conflict/rule error mapping | 2026-11-18 |
| `src/features/orders/api.ts` | **Created** — order/receipt access, RPC wrappers, Realtime helper | 2026-11-18 |
| `src/features/orders/OrdersPanel.tsx` | **Created** — order create/edit/send/serve/close/cancel/transfer/split/merge UI | 2026-11-18 |
| `src/features/orders/KitchenDisplayPanel.tsx` | **Created** — KDS columns, transitions and Realtime refetch | 2026-11-18 |
| `src/features/orders/ReceiptView.tsx` | **Created** — printable receipt with VAT breakdown | 2026-11-18 |
| `src/features/settings/validation.ts`, `api.ts`, `BusinessSettingsPanel.tsx` | **Created** — business identity and VAT settings | 2026-11-18 |
| `src/pages/Operations.tsx` | **Created** — `/operations` page mounting menu, tables, reservations, orders and KDS | 2026-11-18 |
| `src/pages/Settings.tsx` | **Updated** — business settings panel added | 2026-11-18 |
| `src/test/menuValidation.test.ts`, `src/test/tablesReservationsValidation.test.ts`, `src/test/ordersValidation.test.ts` | **Created** — Phase 6 validation tests | 2026-11-18 |
| `src/test/Operations.test.tsx`, `src/test/Settings.test.tsx` | **Updated** — Phase 6 panels, order/KDS flow and business settings | 2026-11-18 |
| `supabase/README.md` | Created — apply + seeding guide | 2026-11-18 |
| `scripts/seed-test-users.mjs` | Created — local admin script | 2026-11-18 |
| `.github/workflows/ci.yml` | Created | 2026-11-18 |
| `public/favicon.svg`, `_redirects`, `_headers` | Created | 2026-11-18 |
| `package.json`, `package-lock.json` | Corrected; dependencies pinned | 2026-11-18 |
| `vite.config.ts`, `tsconfig*.json`, `.eslintrc.cjs` | Corrected | 2026-11-18 |
| `docs/DECISIONS.md` | ADR-009 (FIFO), ADR-010 (units), ADR-011 (inventory control); OD-04/05 resolved, OD-06 interim | 2026-11-18 |
| `docs/ROADMAP.md` | Phase 4 delivered/remaining/exit/decisions refreshed | 2026-11-18 |
| `docs/REQUIREMENTS_TRACEABILITY.md` | CNT, ADJ, WST, STK, INV-06 and AC-06/AC-07 rows updated | 2026-11-18 |
| `docs/DEPLOYMENT.md` | npm build, Node 20, SPA files, env-var troubleshooting | 2026-11-18 |
| `docs/PROGRESS_LOG.md`, `PROJECT_STATUS.md` | Updated | 2026-11-18 |
| `docs/FAST_TRACK_PLAN.md` | Created; Day 1 marked complete | 2026-11-18 |

---

## 6. Latest Tests Performed

| Test | Scope | Result |
| :--- | :--- | :--- |
| `npm run typecheck` | App + Vite config, strict TS | **Pass** |
| `npm run lint` | ESLint, zero warnings | **Pass** |
| `npm run test` | 28 suites, 252 tests (routing, auth, offline banner, formatting, roles, master data, stock/GRN/SIV, PR/PO, GRN↔PO, counts/adjustments/waste, reorder alerts, recipes/costing, production, menus, tables, reservations, orders, KDS and business settings) | **Pass** |
| `npm run build` | Production bundle | **Pass** — 811.08 kB JS (186.65 kB gzip), 24.76 kB CSS (chunk-size warning only) |
| Live deployment | `https://albena-rms.pages.dev` root + `/inventory` | **Pass** — 200 through SPA fallback; `assets/index-BSJnI50i.js` (670,647 bytes) contains the reorder, count, adjustment and waste panel markers |
| Live deployment (Phase 5) | `https://albena-rms.pages.dev` root and served bundle | **Pass** — 200; `assets/index-BKF57faz.js` (715,354 bytes) contains the `/kitchen` route, New recipe/New production actions, food cost, `recipe_version_costs`, `create_recipe` and `post_production_order` |
| Live deployment (Phase 6) | `https://albena-rms.pages.dev` root and served bundle | **Pass** — 200; `assets/index-fqmOEPuP.js` (811,382 bytes) contains New order, Kitchen display, Close & print receipt, Business & receipts, `receipt_number`, `split_order`, `merge_orders` and `receipt_footer` |
| Supabase auth endpoint | `/auth/v1/health` | **Pass** — GoTrue v2.198.0 |
| Supabase anon reads | `roles`, `user_profiles`, `outlets`, `user_roles` | **Pass** — `200 []` (RLS filtering, tables exist) |
| Supabase anon denial | `audit_logs` | **Pass** — `42501`, deny by design |
| Supabase anon write | `POST outlets` as anon | **Pass** — `42501`, new row violates RLS |
| Migration 0006/0007 objects | REST probes for `purchase_requests`, `purchase_orders`, `purchase_order_receipts`, `grns.po_id`, `grn_lines.po_line_id` | **Pass** — objects exist; anon denied with `42501` |
| Migration 0007 RPC shape | `create_grn` with 8 args vs the old 7 | **Pass** — 8-arg exists and is role-gated; 7-arg returns `PGRST202` |
| PR/PO RPC gates | Seven procurement RPCs called as anon | **Pass** — each returns its role-gate message, not 404 |
| Migration 0008 objects | REST probes for `inventory_adjustments`, `inventory_adjustment_lines`, `inventory_counts`, `inventory_count_lines`, `stock_reorder_status`, `inventory_count_variances` | **Pass** — all six exist; anon denied with `42501` |
| Migration 0008 RPC gates | Eight inventory-control RPCs called as anon with named arguments | **Pass** — each returns its role-gate message, not 404 |
| Phase 5 unit tests | `recipesValidation.test.ts` (16) and `Kitchen.test.tsx` (8) | **Pass** — recipe/version/production payloads, publish, costing display, confirm-post and role gates |
| Phase 6 unit tests | `ordersValidation.test.ts` (10), `Operations.test.tsx` (11) and `Settings.test.tsx` (12) | **Pass** — order payloads, concurrency/rule errors, role gates, send/close/receipt flow, KDS realtime refetch and business settings |
| Migration 0009 | Authored, **not yet applied** | **Awaiting owner** |
| Migration 0010 | Authored, **not yet applied**; must follow 0009 | **Awaiting owner** |
| AC-03 live workflow | Owner-run in the deployed app | **Pass** — approval recorded, PO reached closed, purchasing officer blocked from approving |
| GRN-04 live workflow | Owner-run against an ordered PO | **Pass** — pending → partial/complete after posting, over-receipt shown as `over` |
| Admin login and scopes | Owner-verified | **Pass** — profile active, `system_admin`, 5 outlets |
| Secret exclusion | `.env.local` ignored; only publishable key used client-side | **Pass** |

---

## 7. Recommended Next Task

> **Phase 6 build is complete.** Migrations 0009 and 0010 await the owner; menus, tables, reservations, orders, kitchen display, receipts and business settings are built, unit-tested and deployed. Final UAT covers AC-06, AC-07, AC-08, AC-10, AC-11, AC-14 and AC-15.

Then:
1. Owner applies `20261118000900_recipes_production.sql`, then `20261118001000_restaurant_operations.sql` (in that order); agent verifies the Phase 5/6 objects and RPC gates through PostgREST.
2. Start Phase 7 — Reporting & Dashboard (sales, inventory, purchasing, cost, waste, KDS timing, reservations and the management dashboard), including KDS-04 and the COST report set.
3. Add the RLS negative-test SQL script for repeatable authorization checks (AC-02).
