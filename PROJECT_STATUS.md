# Albena RMS — Project Status

## 1. Executive Summary

| Attribute | Value |
| :--- | :--- |
| **Project Name** | Albena Restaurant Management System (RMS) |
| **Current Phase** | Phase 4 — Inventory & Purchasing (in progress); Phases 0–3 complete |
| **Overall Completion** | **35.0%** (Phases 0–3 complete; Phase 4 exit condition not yet met) |
| **Last Updated** | 2026-11-18 21:05 UTC+3 |
| **Latest Git Commit** | `fa51bd7` (migrations 0006/0007 verification; live AC-03/GRN-04 records follow) |
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
| **Phase 4** | Inventory & Purchasing (PR, PO, GRN, SIV, stock) | 20% | 🚧 **In Progress** | No — PR/PO, GRN/SIV postings, ledger-derived balances and GRN↔PO receipts are built and live-verified; counts, adjustments, waste and reorder alerts remain |
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

### Outstanding
- [x] **Owner**: migrations `20261118000600_purchase_requests_orders.sql` and `20261118000700_grn_po_linkage.sql` applied (2026-11-18).
- [x] **Agent**: migration application verified through PostgREST — all five objects exist, the anon role is denied by RLS/grants, the 8-argument `create_grn` is live, the old 7-argument signature is gone, and all seven PR/PO RPCs return their role-gate messages instead of 404.
- [x] **Owner/agent**: live AC-03 run confirmed — PR approved with approver/time/comment, PO created and advanced draft → approved → ordered → closed, purchasing officer could not approve.
- [x] **Owner/agent**: live GRN-04 run confirmed — outstanding lines seeded, drafts ignored, posting moved the receipt to `partial`/`complete`, and an over-receipt showed as `over`.
- [x] **Owner**: migration `20261118000500_stock_ledger.sql` applied and the GRN/SIV flow verified live (AC-04, AC-05).
- [x] **Owner**: the two additional test accounts were created and the GM / Restaurant Manager roles were assigned.
- [x] AC-01 / AC-02 authenticated end-to-end sign-off confirmed by the owner.
- [x] Authenticated check of outlets, suppliers, items, categories, stock locations and user administration (owner-confirmed).
- [ ] Phase 4 remainder: counts, adjustments, waste and low-stock alerts.
- [ ] Stock locations are not yet linked to outlets, so outlet scoping of stock cannot be enforced (open issue).
- [ ] Add RLS negative-test SQL script for repeatable authorization checks.

---

## 4. Blockers and Risks

| Priority | Type | Description | Blocking | Mitigation |
| :---: | :--- | :--- | :--- | :--- |
| 🔴 HIGH | **Resolved** | Migrations 0006 and 0007 applied 2026-11-18 and checked through PostgREST | AC-03 and GRN-04 demonstration | Objects and RPCs confirmed; anon denied. Only the live signed-in workflow runs remain |
| 🟡 MEDIUM | **Risk** | **Supabase project pausing** after inactivity (free plan) | Demos | Warm-up request before every demo |
| 🟡 MEDIUM | **Risk** | **No automated backups** on the free plan | Phase 4+ | Manual export before milestones; restore test in Phase 8 |
| 🟡 MEDIUM | **Risk** | **AI quota** visible only in the provider UI | Ongoing | Micro-milestones; 25% warn / 15% stop policy |
| 🟡 MEDIUM | **Open decision** | OD-06 approval thresholds and separation of duties are undefined | Full Phase 4 acceptance | Interim: PR/PO approval limited to admin/GM with approver, time and comment recorded; self-approval allowed until SoD is defined; no thresholds invented |
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
| `supabase/README.md` | Created — apply + seeding guide | 2026-11-18 |
| `scripts/seed-test-users.mjs` | Created — local admin script | 2026-11-18 |
| `.github/workflows/ci.yml` | Created | 2026-11-18 |
| `public/favicon.svg`, `_redirects`, `_headers` | Created | 2026-11-18 |
| `package.json`, `package-lock.json` | Corrected; dependencies pinned | 2026-11-18 |
| `vite.config.ts`, `tsconfig*.json`, `.eslintrc.cjs` | Corrected | 2026-11-18 |
| `docs/DECISIONS.md` | ADR-009 (FIFO), ADR-010 (units); OD-04/05 resolved | 2026-11-18 |
| `docs/ROADMAP.md` | Phase 2 complete, Phase 3 in progress | 2026-11-18 |
| `docs/REQUIREMENTS_TRACEABILITY.md` | Phase 2 + outlet rows updated | 2026-11-18 |
| `docs/DEPLOYMENT.md` | npm build, Node 20, SPA files, env-var troubleshooting | 2026-11-18 |
| `docs/PROGRESS_LOG.md`, `PROJECT_STATUS.md` | Updated | 2026-11-18 |
| `docs/FAST_TRACK_PLAN.md` | Created; Day 1 marked complete | 2026-11-18 |

---

## 6. Latest Tests Performed

| Test | Scope | Result |
| :--- | :--- | :--- |
| `npm run typecheck` | App + Vite config, strict TS | **Pass** |
| `npm run lint` | ESLint, zero warnings | **Pass** |
| `npm run test` | 21 suites, 166 tests (routing, auth, offline banner, formatting, roles, master-data, stock/GRN/SIV, PR/PO and GRN↔PO validation and panels) | **Pass** |
| `npm run build` | Production bundle | **Pass** — 613 kB JS (155 kB gzip), 23 kB CSS (chunk-size warning only) |
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

> **AC-03 and GRN-04 are verified live.** Next Phase 4 slice: counts, adjustments, waste and low-stock alerts. Phases 0–3 are complete and AC-04/AC-05 are verified.

Then:
1. Build inventory adjustments and waste postings on the same ledger (ADJ-01..03, WST-01..04).
2. Build physical counts with variance calculation (CNT-01..05, STK-04).
3. Add low-stock/reorder alerts from `stock_balances` plus item reorder levels (INV-06).
4. Add the RLS negative-test SQL script for repeatable authorization checks (AC-02).
