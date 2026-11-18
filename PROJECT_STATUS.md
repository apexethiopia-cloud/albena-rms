# Albena RMS — Project Status

## 1. Executive Summary

| Attribute | Value |
| :--- | :--- |
| **Project Name** | Albena Restaurant Management System (RMS) |
| **Current Phase** | Phase 4 — Inventory & Purchasing (in progress); Phases 0–3 complete |
| **Overall Completion** | **35.0%** (Phases 0–3 complete; Phase 4 exit condition awaits AC-06/AC-07 live verification) |
| **Last Updated** | 2026-11-18 23:40 UTC+3 |
| **Latest Git Commit** | `e5300d1` (live AC-03 and GRN-04 verification records; counts/adjustments/waste slice follows) |
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
| **Phase 4** | Inventory & Purchasing (PR, PO, GRN, SIV, stock, counts, adjustments, waste, reorder alerts) | 20% | 🚧 **In Progress** | No — every Phase 4 workflow is built; AC-06/AC-07 remain pending migration 0008 and an owner live run |
| **Phase 5** | Recipes & Production | 10% | ⏳ Planned | No |
| **Phase 6** | Restaurant Operations (menu, tables, KDS, POS) | 15% | ⏳ Planned | No |
| **Phase 7** | Reporting & Dashboard | 10% | ⏳ Planned | No |
| **Phase 8** | Validation & Handover | 10% | ⏳ Planned | No |
| **Total** | | **100%** | **35.0% Complete** | |

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
- [x] Migration `20261118000800_counts_adjustments_waste.sql` **authored, not yet applied**: `inventory_adjustments`, `inventory_adjustment_lines`, `inventory_counts`, `inventory_count_lines`, the `stock_reorder_status` and `inventory_count_variances` views, role helpers `can_manage_inventory()` / `can_approve_inventory()` / `can_post_inventory()`, the shared `post_stock_in()` / `post_stock_out()` FIFO helpers, eight workflow RPCs, audit triggers, RLS and grants.
- [x] Counts count in the item base unit; the sheet snapshots `system_quantity` when created, `variance_quantity` is a generated column, and posting reconciles the ledger to the physical quantity at posting time through `adjustment` transactions with `reference_type = 'inventory_count'` (CNT-01..05, STK-04).
- [x] Adjustments support increase/decrease lines with damage, spoilage, theft, expired and operational-loss reasons; increases create a FIFO layer, decreases consume the oldest layers (ADJ-01..03).
- [x] Waste is stored in the same document tables with `kind = 'waste'`, allows decrease lines only, offers the five waste reasons, and posts as a FIFO decrease with the consumed cost recorded (WST-01..03).
- [x] Workflow is `draft → submitted → approved/rejected → posted` for all three document types; a document posts once and posted documents are read-only.
- [x] Role gates: manage/submit/post = System Administrator, General Manager, Storekeeper; approve/reject = System Administrator, General Manager. Self-approval is not blocked and no thresholds exist (OD-06 interim).
- [x] Reorder alerts compare total on-hand across locations with the item-level reorder level, show the shortage and can reveal tracked items that are not low (INV-06).
- [x] UI: `AdjustmentPanel` / `WastePanel`, `CountPanel` and `LowStockPanel` mounted on `/inventory`; validation and database error messages cover the new documents.
- [x] Tests: `stockValidation.test.ts` (26), `InventoryControl.test.tsx` (8) and updated stock/lookup mocks; totals below.
- [ ] **Owner**: apply migration 0008, then live-verify AC-06 and AC-07 in the deployed app.

### Outstanding
- [ ] **Owner**: apply `supabase/migrations/20261118000800_counts_adjustments_waste.sql`.
- [ ] **Owner/agent**: live AC-06 run — count a location below the system quantity, submit, approve as General Manager, post, and confirm the ledger reconciles to the physical quantity with a traceable variance.
- [ ] **Owner/agent**: live AC-07 run — record waste, approve, post, and confirm stock and FIFO value decrease by the consumed cost.
- [ ] **Agent**: verify the migration objects and RPC gates through PostgREST after migration 0008 is applied.
- [ ] Stock locations are not yet linked to outlets, so outlet scoping of stock cannot be enforced (open issue).
- [ ] Add RLS negative-test SQL script for repeatable authorization checks.

---

## 4. Blockers and Risks

| Priority | Type | Description | Blocking | Mitigation |
| :---: | :--- | :--- | :--- | :--- |
| 🔴 HIGH | **Resolved** | Migrations 0006 and 0007 applied 2026-11-18 and checked through PostgREST | AC-03 and GRN-04 demonstration | Objects and RPCs confirmed; anon denied. Only the live signed-in workflow runs remain |
| 🔴 HIGH | **Pending action** | Migration `20261118000800_counts_adjustments_waste.sql` is not applied yet | AC-06/AC-07 and the Phase 4 exit condition | Owner applies it in the Supabase SQL editor; the UI reports the missing tables until then |
| 🟡 MEDIUM | **Risk** | **Supabase project pausing** after inactivity (free plan) | Demos | Warm-up request before every demo |
| 🟡 MEDIUM | **Risk** | **No automated backups** on the free plan | Phase 4+ | Manual export before milestones; restore test in Phase 8 |
| 🟡 MEDIUM | **Risk** | **AI quota** visible only in the provider UI | Ongoing | Micro-milestones; 25% warn / 15% stop policy |
| 🟡 MEDIUM | **Open decision** | OD-06 approval thresholds and separation of duties are undefined | Full Phase 4 acceptance | Interim: PR/PO and inventory-document approval limited to admin/GM with approver, time and comment recorded; manage/post limited to admin/GM/storekeeper for inventory documents; self-approval allowed until SoD is defined; no thresholds invented |
| 🟡 MEDIUM | **Open issue** | `stock_locations` has no outlet link, so stock cannot be outlet-scoped | OUT-03/04 for stock | Decide the location↔outlet model before reporting |
| 🟢 LOW | **Risk** | **Service-role key** needed only for the seeding script | Test users | Key lives in `.env.local` only; never in the repo or browser bundle |
| 🟢 LOW | **Resolved** | OD-04 and OD-05 answered 2026-11-18 (FIFO, base units) | — | Recorded in ADR-009 and ADR-010 |
| 🟢 LOW | **Resolved** | Master-data migrations 0003/0004 applied 2026-11-18; all six tables respond to REST | — | Anon reads return `200 []`; anon writes return `42501` |
| 🟢 LOW | **Resolved** | AC-01/AC-02 sign-off | Phase 2 acceptance | Three individual accounts exist; owner confirmed the end-to-end check |
| 🟢 LOW | **Resolved** | AC-04/AC-05 live stock verification | Phase 4 acceptance | Owner posted a GRN and SIV; balances and FIFO value matched, over-issue rejected |

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
| `src/pages/Inventory.tsx` | **Created** — inventory page with item panel | 2026-11-18 |
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
| `npm run test` | 22 suites, 182 tests (routing, auth, offline banner, formatting, roles, master-data, stock/GRN/SIV, PR/PO, GRN↔PO, counts/adjustments/waste and reorder alerts) | **Pass** |
| `npm run build` | Production bundle | **Pass** — 670.43 kB JS (162.87 kB gzip), 23.27 kB CSS (chunk-size warning only) |
| Live deployment | `https://albena-rms.pages.dev` root + `/inventory` | **Pass** — 200 through SPA fallback |
| Supabase auth endpoint | `/auth/v1/health` | **Pass** — GoTrue v2.198.0 |
| Supabase anon reads | `roles`, `user_profiles`, `outlets`, `user_roles` | **Pass** — `200 []` (RLS filtering, tables exist) |
| Supabase anon denial | `audit_logs` | **Pass** — `42501`, deny by design |
| Supabase anon write | `POST outlets` as anon | **Pass** — `42501`, new row violates RLS |
| Migration 0006/0007 objects | REST probes for `purchase_requests`, `purchase_orders`, `purchase_order_receipts`, `grns.po_id`, `grn_lines.po_line_id` | **Pass** — objects exist; anon denied with `42501` |
| Migration 0007 RPC shape | `create_grn` with 8 args vs the old 7 | **Pass** — 8-arg exists and is role-gated; 7-arg returns `PGRST202` |
| PR/PO RPC gates | Seven procurement RPCs called as anon | **Pass** — each returns its role-gate message, not 404 |
| AC-03 live workflow | Owner-run in the deployed app | **Pass** — approval recorded, PO reached closed, purchasing officer blocked from approving |
| GRN-04 live workflow | Owner-run against an ordered PO | **Pass** — pending → partial/complete after posting, over-receipt shown as `over` |
| Admin login and scopes | Owner-verified | **Pass** — profile active, `system_admin`, 5 outlets |
| Secret exclusion | `.env.local` ignored; only publishable key used client-side | **Pass** |

---

## 7. Recommended Next Task

> **Counts, adjustments, waste and reorder alerts are built and unit-tested.** The owner must apply migration `20261118000800_counts_adjustments_waste.sql`, then AC-06 and AC-07 can be verified live. Phases 0–3 are complete and AC-03/04/05 plus GRN-04 are verified.

Then:
1. Apply migration 0008 and verify its objects/RPC gates through PostgREST (anon denied, eight RPCs reachable and role-gated).
2. Run the live AC-06 count flow: variance captured → approval → posting reconciles the ledger to the count.
3. Run the live AC-07 waste flow: approval → posting decreases stock and FIFO value by the consumed cost.
4. Add the RLS negative-test SQL script for repeatable authorization checks (AC-02).
