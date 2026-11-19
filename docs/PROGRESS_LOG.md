# Albena RMS — Progress Log

## Session 1: 2026-11-16 — Project Initiation & Governance Baseline

- **Phase**: Phase 0 | **Completion**: 0% → in-progress
- Repository inspection, security setup (`.gitignore`, `.env.example`), governance initialization (`PROJECT_STATUS.md`, `ROADMAP.md`, `DECISIONS.md`, `QUOTA_LOG.md`).
- SRS search: not found locally.
- Commits: `75c0a9f`, `4563767`, `0907ed8`, `bdcdef4`

---

## Session 2: 2026-11-16 — Roadmap Approval

- **Phase**: Phase 0 | **Completion**: → 5%
- Owner formally approved Phase 0 Architecture and 10-milestone Implementation Roadmap.
- Milestone M0 (now Phase 0) marked complete.
- Formally requested SRS from owner.

---

## Session 3: 2026-11-17 — SRS v3.0 Ingestion & Full Requirements Baseline

- **Phase**: Phase 0 → Phase 0 complete | **Completion**: 5% (unchanged — Phase 1 pending OD resolution)
- **Date**: 2026-11-17 10:10 UTC+3
- **Model**: Claude Sonnet 4.6 (Thinking)

### Actions Completed
1. **SRS v3.0 Received**: Owner provided `Albena_RMS_SRS_v3.0_Cloud_Prototype.docx`. Verified it supersedes SRS v2.1.
2. **SRS Committed**: Full SRS text committed to `docs/SRS_v3.0.md` as the authoritative requirements baseline (ADR-005).
3. **Requirements Traceability Matrix Fully Populated**: All 160+ requirement IDs cataloged in `docs/REQUIREMENTS_TRACEABILITY.md` across 32 requirement categories (CON, SEC-ROLE, ARC, USR, OUT, SUP, INV, PR, PO, GRN, SIV, CNT, ADJ, WST, PROD, REC, MENU, TBL, RES, ORD, KDS, RCT, STK, COST, RPT, AUD, NFR, DATA, DEV, PRG, QTA, AC).
4. **Roadmap Realigned to SRS Phases 0–8**: `docs/ROADMAP.md` updated from milestone M0–M9 to SRS-defined Phases 0–8 with weights, exit conditions and requirement cross-references (ADR-006).
5. **New ADRs Added**: ADR-005 (SRS v3.0 baseline), ADR-006 (Phase alignment), ADR-007 (transaction-based stock ledger), ADR-008 (no auto stock deduction from menu sales).
6. **13 Open Decisions Logged**: OD-01..13 formally recorded in `docs/DECISIONS.md` and `docs/REQUIREMENTS_TRACEABILITY.md`. Owner response required before affected phases begin.
7. **New Mandatory Documents Created**:
   - `docs/TESTING.md` — Test strategy, all 19 AC test cases, unit test cases, defect log (SRS PRG requirement).
   - `docs/DEPLOYMENT.md` — Service overview, environment variables, Cloudflare Pages setup, Supabase config, backup/recovery, security checklist, free-tier limit monitoring (SRS PRG requirement).

### Verification
- All SRS requirement IDs cross-checked against section structure.
- Key business rules confirmed in ADR-007 and ADR-008 (stock ledger, no auto-deduction).
- Security requirements CON-06, ARC-03, DEV-02, DEV-03: `.gitignore` and `.env.example` confirmed implemented and committed.

### Files Created / Modified
- `docs/SRS_v3.0.md` (Created)
- `docs/REQUIREMENTS_TRACEABILITY.md` (Fully populated)
- `docs/ROADMAP.md` (Revised — SRS Phase 0–8 alignment)
- `docs/DECISIONS.md` (Updated — ADR-005..008, OD-01..13)
- `docs/TESTING.md` (Created)
- `docs/DEPLOYMENT.md` (Created)
- `PROJECT_STATUS.md` (Updated)
- `docs/PROGRESS_LOG.md` (Updated)

### Outstanding
- Owner answers to OD-01..13 (at minimum OD-01, OD-02, OD-11, OD-13 to unblock Phase 1).
- Commit and push to GitHub `origin/main` (requires owner terminal or token).
- Phase 1 implementation start pending OD resolution.

---

## Session 4: 2026-11-18 — Phase 1 Foundation Implemented Locally

- **Phase**: Phase 1 (in progress) | **Completion**: 5.0% (unchanged — Phase 1 exit condition requires a live deployment)
- **Date**: 2026-11-18 10:35 UTC+3
- **Model**: DeepSeek V4.1 Flash (OpenCode)
- **Starting state**: Documentation complete, but no `src/` directory; `npm run build` failed on a missing entry point.

### Actions Completed
1. **Environment repaired**: first `npm install` had been killed mid-write, leaving a corrupted `esbuild.exe` (`EFTYPE`). Removed `node_modules`, reinstalled cleanly (413 packages), verified esbuild 0.21.5 and Vite 5.4.21.
2. **Toolchain corrected**: `vite.config.ts` now imports `defineConfig` from `vitest/config`, uses an ESM-safe `@` alias and a port setting; added `@types/node`; typecheck now covers both the app (`tsconfig.json`) and the Vite config (`tsconfig.node.json`) without project-reference errors.
3. **Application created**: `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`; strict TypeScript, Tailwind directives and base focus styles.
4. **App shell and routing**: responsive sidebar with mobile drawer, header with business date, five module placeholders (Inventory, Purchasing, Operations, Reports, Settings) and a 404 route. Single `h1` per page for accessibility.
5. **Foundation utilities**: `src/lib/env.ts` (VITE-only values, placeholder detection), `src/lib/format.ts` (ETB 2dp, `Africa/Addis_Ababa`, ISO report dates), `src/lib/cn.ts`.
6. **Network handling (ARC-07)**: global offline banner stating changes cannot be saved, with retry, plus tests.
7. **Testing**: Vitest + Testing Library + jsdom; 8 tests across 3 suites covering the shell, deep-link routing, 404, offline banner and money/timezone formatting.
8. **CI and deployment assets**: `.github/workflows/ci.yml` (Node 20), `public/_redirects`, `public/_headers`, `public/favicon.svg`; `docs/DEPLOYMENT.md` corrected to `npm run build`.

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass (zero warnings)
- `npm run test` — 8/8 pass
- `npm run build` — pass (186 kB JS / 60 kB gzip)
- Preview smoke test — `/` 200, deep link `/inventory` 200 with SPA fallback, `/favicon.svg` 200

### Files Created / Modified
- Created: `src/**`, `public/*`, `.github/workflows/ci.yml`, `package-lock.json`, `docs/FAST_TRACK_PLAN.md`
- Modified: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `.eslintrc.cjs`, `index.html`, `.gitignore`, `.env.example`, `docs/DEPLOYMENT.md`, `docs/REQUIREMENTS_TRACEABILITY.md`, `PROJECT_STATUS.md`

### Outstanding
- Cloudflare Pages project + first deployment (Phase 1 exit condition).
- Commit and push to `origin/main` (owner credentials required).
- OD-04 (costing) and OD-05 (units) before Phase 4.

---

## Session 5: 2026-11-18 — Phase 1 Accepted Live, Phase 2 Identity Built

- **Phase**: Phase 1 complete → Phase 2 in progress | **Completion**: 5% → **15.0%**
- **Date**: 2026-11-18 12:30 UTC+3
- **Model**: DeepSeek V4.1 Flash (OpenCode)

### Actions Completed
1. **Phase 1 exit verified**: `https://albena-rms.pages.dev` serves the exact local build (matching asset hashes); `/inventory` deep link returns 200, so the SPA fallback works in production.
2. **Owner decisions recorded**: OD-04 **FIFO** (ADR-009) and OD-05 **unit conversion model** (ADR-010). OD-04 had been assumed weighted-average; that assumption is now superseded in the docs.
3. **Supabase connected**: project `naxhjpmaovnuplfjdgdu`; publishable key stored only in `.env.local` (gitignored). Auth health endpoint verified.
4. **Phase 2 schema authored**: `roles`, `user_profiles`, `user_roles`, `outlets`, `user_outlet_scopes`, `audit_logs`; RLS on all six; least-privilege policies; append-only audit triggers; new-user profile trigger; backfill; admin RPCs.
5. **Reference data migration**: 10 SRS roles and 5 outlets, idempotent.
6. **Test-user provisioning**: `scripts/seed-test-users.mjs` (local-only, service-role key), respecting OD-03 full access with all outlets.
7. **Frontend auth**: Supabase client with publishable key only, `AuthProvider`, `ProtectedRoute` with loading/unconfigured/disabled states, login page, sign-out in the shell, signed-in identity card on the dashboard.
8. **Docs**: `supabase/README.md` (apply + schema map), roadmap/status/traceability updated, deployment guide references the project.

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test` — 14/14 pass across 4 suites
- `npm run build` — pass (426 kB JS / 122 kB gzip)
- Live URL — 200 at root and `/inventory`
- Supabase `/auth/v1/health` — GoTrue v2.198.0

### Outstanding
- Apply both migrations to Supabase (agent has no database credentials).
- Create the three test users; verify AC-01 and AC-02.
- Re-deploy the auth build to Cloudflare Pages.

---

## Session 6: 2026-11-18 — Phase 2 Verified Live, Phase 3 Outlet Management

- **Phase**: Phase 2 complete → Phase 3 in progress | **Completion**: 15% → **25.0%**
- **Date**: 2026-11-18 13:15 UTC+3
- **Model**: DeepSeek V4.1 Flash (OpenCode)
- **Starting state**: Owner had applied both Phase 2 migrations and created the administrator account; the agent had not yet verified any of it.

### Actions Completed
1. **Phase 2 verified from outside the app**: anon REST reads return `200 []` for `roles`, `user_profiles`, `outlets` and `user_roles` (RLS filtering, tables present); `audit_logs` returns `42501` (deny by design); an unknown table returns `PGRST205`. Cloudflare's bundle contains the project ref, proving the build received the environment variables.
2. **Master-data migrations authored** (pending owner apply): `stock_locations`, `item_categories`, `units`, `item_unit_conversions`, `suppliers`, `items`; RLS for every table; audit triggers; unit seeds with fixed kg/L factors and NULL factors for box/carton/sack (ADR-010).
3. **Outlet feature built**: `validation.ts` (code pattern, name limits, normalization, `23505`/`42501` error mapping), `api.ts` (RLS client), `OutletsPanel.tsx` (list, create, edit, deactivate/reactivate, loading/empty/error/success states).
4. **Settings page created** and wired to `/settings`, replacing the placeholder. It contains the live outlet panel plus an explicit "Not implemented yet" list so scope is unambiguous.
5. **Write controls gated by role** (System Administrator, General Manager) while documenting that PostgreSQL RLS is the real boundary.
6. **Dashboard and shell updated** to Phase 3 and the verified state.
7. **Tests added**: 11 outlet-validation tests and 7 outlet-panel tests (list, load failure with retry, create, invalid submit, edit, deactivate, read-only role).

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass (zero warnings)
- `npm run test` — 32/32 pass across 6 suites
- `npm run build` — pass (444 kB JS / 126 kB gzip, 18 kB CSS)

### Outstanding
- Owner applies `20261118000300_master_data.sql` then `20261118000400_master_data_seed.sql`.
- Owner creates the two remaining test accounts; AC-01 and AC-02 remain unrecorded.
- Suppliers, item master, stock locations and user administration UI.
- RLS negative-test SQL script for repeatable authorization proof.

---

## Session 7: 2026-11-18 — Supplier Master and Missing-Table Guidance

- **Phase**: Phase 3 in progress | **Completion**: **25.0%** unchanged (Phase 3 exit condition not met)
- **Date**: 2026-11-18 13:30 UTC+3
- **Model**: DeepSeek V4.1 Flash (OpenCode)

### Actions Completed
1. **Deployment verified after the outlet fix**: live bundle contains the outlet panel, the admin-only write copy, and the Supabase project ref. An anonymous `POST /rest/v1/outlets` returns `42501` ("new row violates row-level security policy"), proving the live write boundary.
2. **Shared error mapping**: `src/lib/errors.ts` centralizes `23505`, `42501`, `23514`, `23503`, `P0002` and the missing-table codes `42P01`/`PGRST205`. The missing-table message tells the owner to apply the pending migration instead of exposing a raw PostgREST error.
3. **Supplier feature**: validation (code, required name, optional validated email/phone, length limits, normalization), API via the RLS client, and a full panel with list/create/edit/deactivate.
4. **Purchasing page**: `/purchasing` now hosts the supplier panel plus an explicit list of what is not built (PR, PO, GRN, supplier performance).
5. **Settings page cleaned up**: suppliers removed from the "not implemented" list because they now exist under Purchasing.
6. **Accessibility/UX fix found by a test**: forms use `noValidate`, so the app's own validation messages appear instead of the browser blocking submit on an invalid email field.

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass (zero warnings)
- `npm run test` — 51/51 pass across 8 suites
- `npm run build` — pass (461 kB JS / 129 kB gzip, 18 kB CSS)
- Live bundle — outlet panel, admin-only copy and project ref all present
- Live RLS probe — anon `GET outlets` 200 `[]`; anon `POST outlets` 401 `42501`

### Outstanding
- Suppliers cannot be integration-tested until migrations 0003/0004 are applied. The UI reports this explicitly.
- Item master, stock locations and user administration UI.
- AC-01/AC-02 evidence still needs the two remaining test accounts.

---

## Session 8: 2026-11-18 — Master-Data Tables Applied, Item Master Built

- **Phase**: Phase 3 in progress | **Completion**: **25.0%** (exit condition still open)
- **Date**: 2026-11-18 13:45 UTC+3
- **Model**: DeepSeek V4.1 Flash (OpenCode)
- **Starting state**: Owner reported migrations 0003/0004 applied.

### Actions Completed
1. **Migration verification**: `suppliers`, `items`, `units`, `stock_locations`, `item_categories` and `item_unit_conversions` all respond to REST (`200 []` for anon, which is RLS filtering). Anonymous `POST` to `suppliers`, `items` and `units` returns `42501` ("new row violates row-level security policy"), so the new tables are write-protected.
2. **Seed data not verifiable as anon**: the select policies are `to authenticated` with `is_active_user()`, so seed counts and unit factors can only be confirmed with a real session or SQL. This remains an owner check.
3. **Item master**: validation (code, name, required base unit, non-negative decimal reorder level), data access for items/units/categories, and a full panel with list/create/edit/deactivate.
4. **Inventory page**: `/inventory` now hosts the item panel and states plainly that no stock balances or movements exist yet.
5. **Unit handling in the UI**: base-unit select offers only gram, millilitre and piece; purchase-unit select flags box/carton/sack as needing a per-item factor, with a note that the conversion editor is not built.
6. **Tests**: 9 item-validation and 9 item-panel tests added. App-shell placeholder test moved from `/inventory` to `/reports` since inventory is now a real page.

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass (zero warnings)
- `npm run test` — 69/69 pass across 10 suites
- `npm run build` — pass (480 kB JS / 132 kB gzip, 19 kB CSS)

### Outstanding
- Authenticated end-to-end check of outlets, suppliers and items.
- Item unit-conversion editor, stock-location screen, category CRUD, user administration.
- AC-01/AC-02 evidence needs the two remaining test accounts.

---

## Session 9: 2026-11-18 — Stock Location Management Added

- **Phase**: Phase 3 in progress | **Completion**: **25.0%** (unchanged; Phase 3 exit condition still open)
- **Date**: 2026-11-18 14:05 UTC+3
- **Model**: DeepSeek V4.1 Flash (OpenCode)

### Actions Completed
1. **Stock-location feature built**: validation (code pattern, name), data access (list/create/update) against `stock_locations`, and a full panel with list/create/edit/deactivate.
2. **Inventory page updated**: `/inventory` now renders the items panel followed by the stock-locations panel.
3. **Locations tests**: validation (3) and panel (5) suites, following the existing outlet/supplier/item patterns.

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass (zero warnings)
- `npm run test` — 79/79 pass across 12 suites
- `npm run build` — pass (480 kB JS / 132 kB gzip, 19 kB CSS)

### Outstanding
- Item unit-conversion editor for box / carton / sack.
- Stock locations: still need an authenticated check (the panel is written and unit-tested; seeded locations can only be read with a real session).
- Category CRUD UI, user administration UI.
- AC-01/AC-02 evidence needs the two remaining test accounts.

---

## Session 10: 2026-11-18 — Item Unit-Conversion Editor Built

- **Phase**: Phase 3 in progress | **Completion**: **25.0%** (unchanged; Phase 3 exit condition still open)
- **Date**: 2026-11-18 14:45 UTC+3
- **Model**: DeepSeek V4.1 Flash (OpenCode)

### Actions Completed
1. **Item conversion API**: `listItemUnitConversions`, `createItemUnitConversion`, `updateItemUnitConversion` against `item_unit_conversions`; `createItem` now returns the new item id.
2. **Item form**: when a purchase unit with a null global factor (box / carton / sack) is selected, a required per-item factor field appears and is submitted with create/update.
3. **Tests**: added mock exports for the new API functions and a new test covering item creation + conversion recording.

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass (zero warnings)
- `npm run test` — 80/80 pass across 12 suites
- `npm run build` — pass (491 kB JS / 133 kB gzip, 19 kB CSS)

### Outstanding
- Same as previous session, plus an authenticated end-to-end check.

---

## Session 11: 2026-11-18 — Category CRUD Built

- **Phase**: Phase 3 in progress | **Completion**: **25.0%** (unchanged; Phase 3 exit condition still open)
- **Date**: 2026-11-18 15:55 UTC+3
- **Model**: DeepSeek V4.1 Flash (OpenCode)

### Actions Completed
1. **Category feature built**: validation (required name, 80-char max, whole-number sort order), data access (list/create/update) against `item_categories`, and a full panel with list/create/edit/deactivate.
2. **Inventory page updated**: `/inventory` now renders the item panel followed by the category panel followed by the stock-location panel.
3. **Tests**: new `Categories.test.tsx` (8 panel tests against the Inventory page) and `categoryValidation.test.ts` (6 validation tests).

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass (zero warnings)
- `npm run test` — 94/94 pass across 14 suites
- `npm run build` — pass (493 kB JS / 133 kB gzip, 19 kB CSS)

### Outstanding
- Same as previous session, plus the authenticated end-to-end check.

---

## Session 12: 2026-11-18 — User Administration Delivered; Phase 3 Complete

- **Phase**: Phase 3 ✅ complete → Phase 4 next | **Completion**: **35.0%** (Phases 0–3 complete)
- **Date**: 2026-11-18 17:05 UTC+3
- **Model**: DeepSeek V4.1 Flash (OpenCode)

### Actions Completed
1. **Users feature built**: `listUsers` (profiles + role chips), `listRoles`, `setUserStatus` (`admin_set_user_status` RPC), `assignUserRole` (`admin_assign_role` RPC), and outlet scope list/grant/revoke against `user_outlet_scopes`.
2. **User panel on `/settings`**: account list with status and roles, disable/reactivate, role assignment with client-side duplicate guard, and a per-user outlet-access editor that saves each change immediately.
3. **Settings page cleaned up**: the stale "not implemented" cards for users, stock locations and unit conversions were removed; only the audit-trail and Phase 4 postings cards remain.
4. **Tests**: `Users.test.tsx` (9 panel tests) and `userValidation.test.ts` (6 validation tests); Settings tests updated for the additional panel and shared mocks.
5. **Docs**: Phase 3 marked complete at 35.0% overall; USR-01 and USR-02 marked Implemented.

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass (zero warnings)
- `npm run test` — 109/109 pass across 16 suites
- `npm run build` — pass (493 kB JS / 133 kB gzip, 19 kB CSS)

### Outstanding
- Phase 4: stock ledger, GRN / SIV, FIFO, counts, adjustments.
- RLS negative-test SQL script (AC-02 evidence).

---

## Session 13: 2026-11-18 — Phase 4 Stock Ledger, GRN and SIV Built

- **Phase**: Phase 4 in progress | **Completion**: **35.0%** (unchanged; Phase 4 exit condition still open)
- **Date**: 2026-11-18 17:40 UTC+3
- **Model**: Big Pickle (OpenCode)

### Actions Completed
1. **Migration 0005 authored** — `20261118000500_stock_ledger.sql`: GRN and SIV headers/lines, append-only `stock_transactions`, FIFO `stock_layers` and `stock_layer_consumptions`, derived `stock_balances` / `stock_ledger_entries` views, unit-factor resolution, role gates, posting RPCs, audit triggers and SELECT-only grants.
2. **Posting rules** — `post_grn()` writes one `in` row and one FIFO layer per line; `post_siv()` consumes the oldest layers at source, writes paired `out`/`in` rows and creates a destination layer; negative stock and duplicate posting are rejected in the database.
3. **Stock feature** — `src/features/stock/{api,validation,StockPanel,GrnPanel,SivPanel}.tsx`: ledger-derived balances and movements on `/inventory`, SIV drafts and posting on `/inventory`, GRN drafts and posting on `/purchasing`.
4. **Role gating** — the UI mirrors `can_post_grn()` / `can_post_siv()`; unauthorized roles see a read-only notice, while the database remains the enforcement boundary.
5. **Tests** — `stockValidation.test.ts` (17), `Stock.test.tsx` (5) and `Receiving.test.tsx` (6); the existing Inventory and Purchasing suites gained stock and lookup mocks.
6. **Docs** — Phase 4 marked in progress; GRN/SIV/STK and INV-04 rows updated; OD-06 interim behaviour and the missing location↔outlet link recorded.

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass (zero warnings)
- `npm run test` — 137/137 pass across 19 suites
- `npm run build` — pass (571 kB JS / 147 kB gzip, 20 kB CSS; chunk-size warning only)
- Commit `a0a2d4b` pushed to `main`; Cloudflare deployed it (`index-DS0f0qag.js`, 571 kB) and the served bundle contains the GRN, SIV and stock-ledger panels.

### Outstanding
- **Owner applies** `20261118000500_stock_ledger.sql`; AC-04 and AC-05 still need a live GRN → balance → SIV → balance check.
- Phase 4 remainder: purchase requests/orders, GRN ↔ PO linkage, counts, adjustments, waste, low-stock alerts.
- OD-06 approval thresholds and the stock-location ↔ outlet mapping remain open.
- RLS negative-test SQL script (AC-02 evidence).

---

## Session 14: 2026-11-18 — Phase 4 PR/PO Built; AC-04/AC-05 Verified Live

- **Phase**: Phase 4 in progress | **Completion**: **35.0%** (unchanged; Phase 4 exit condition still open)
- **Date**: 2026-11-18 19:10 UTC+3
- **Model**: Big Pickle (OpenCode)

### Actions Completed
1. **Live stock verification recorded** — owner ran AC-04/AC-05 in the deployed app: GRN 2,000 g → 2,000 g / ETB 240.00; SIV 500 g → 1,500 g / ETB 180.00 (FIFO value); over-issue rejected. Marked **Verified** in the traceability matrix.
2. **Migration 0006 authored** — `20261118000600_purchase_requests_orders.sql`: PR/PO status enums, four tables, `current_user_name()`, `can_manage_purchasing()` / `can_approve_purchasing()`, seven workflow RPCs, audit triggers, RLS with SELECT-only grants, and comments.
3. **Workflow rules** — PR: draft → submitted → approved/rejected, decision records approver name, time and comment. PO: draft → approved → ordered → closed; `pr_id` unique so one order per approved request; unit cost required on order lines.
4. **Procurement feature** — `src/features/procurement/{api,validation,PurchaseLinesEditor,PurchaseRequestsPanel,PurchaseOrdersPanel}.tsx`: PR/PO lists, draft forms, decision panel, PR→PO seeding, status actions and role-aware read-only states.
5. **Purchasing page** — mounts PR → PO → GRN → suppliers; the planned card is reduced to supplier performance reporting.
6. **Tests** — `procurementValidation.test.ts` (13) and `Procurement.test.tsx` (11); procurement mocks added to the Receiving and Suppliers suites.
7. **Docs** — PR/PO rows marked Implemented; AC-04/AC-05 marked Verified; OD-06 interim behaviour extended to PR/PO (self-approval not blocked, no thresholds); resolved open decisions mirrored into the traceability table.

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass (zero warnings)
- `npm run test` — 161/161 pass across 21 suites
- `npm run build` — pass (606 kB JS / 153 kB gzip, 22 kB CSS; chunk-size warning only)
- Commit `87d8379` (PR/PO slice) pushed to `main`; docs commit `ceaf3d9` followed.
- Cloudflare deployed the slice (`index-DTCkkht6.js`, 605,898 bytes); the served bundle contains the PR/PO panels.

### Outstanding
- **Owner applies** `20261118000600_purchase_requests_orders.sql`; AC-03 live run still required (create PR → submit → GM approve → Create PO → approve → ordered → close; confirm a purchasing officer cannot approve).
- Phase 4 remainder: GRN ↔ PO linkage/shortages, counts, adjustments, waste, low-stock alerts.
- OD-06 thresholds and separation of duties remain open; the stock-location ↔ outlet mapping remains open.
- RLS negative-test SQL script (AC-02 evidence).

---

## Session 15: 2026-11-18 — Phase 4 GRN ↔ PO Linkage Built

- **Phase**: Phase 4 in progress | **Completion**: **35.0%** (unchanged; Phase 4 exit condition still open)
- **Date**: 2026-11-18 20:15 UTC+3
- **Model**: Big Pickle (OpenCode)

### Actions Completed
1. **Migration 0007 authored** — `20261118000700_grn_po_linkage.sql`: optional `grns.po_id` and `grn_lines.po_line_id` with indexes, and the 8-argument `create_grn` replacing the 7-argument version. The function rejects a PO from another supplier, a line from another order, and a PO line whose item differs from the GRN line.
2. **Receipt variance view** — `purchase_order_receipts` derives ordered, received and outstanding base quantities per PO line plus `pending`/`partial`/`complete`/`over` status. Only posted GRNs count; over-receipts are recorded, not blocked, because the owner has not defined a tolerance (CON-07).
3. **GRN panel** — purchase-order selector limited to approved/ordered orders; selecting one fixes the supplier, seeds outstanding lines in the ordered unit and cost, and explains the seeding. Each seeded line shows ordered/received/outstanding and warns when the entered quantity exceeds the outstanding amount.
4. **Receipts review** — a "Purchase order receipts" table lists every PO line with ordered/received/outstanding amounts and a status chip; posted documents show their PO number.
5. **Resilient loading** — GRN listing, creation and posting still work when migrations 0006/0007 are not applied; the purchase-order lookups degrade to empty instead of failing the panel.
6. **Tests** — 5 new GRN↔PO cases in `Receiving.test.tsx` (seeding and supplier lock, over-receipt warning, receipts table, PO number on a document) and PO-link normalization in `stockValidation.test.ts`; procurement/receiving/supplier suites gained the new receipt mock.
7. **Docs** — GRN-04 marked Implemented; Phase 4 delivered/remaining lists, blockers and next steps updated.

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass (zero warnings)
- `npm run test` — 166/166 pass across 21 suites
- `npm run build` — pass (613 kB JS / 155 kB gzip, 23 kB CSS; chunk-size warning only)
- Commit `32ef218` (GRN ↔ PO slice) pushed to `main`; docs commit `5e03b86` followed.
- Cloudflare deployed the slice (`index-DNG685JJ.js`, 613,133 bytes); the served bundle contains the receipts view and GRN↔PO panel markers.

### Outstanding
- **Owner applies** `20261118000600_purchase_requests_orders.sql` then `20261118000700_grn_po_linkage.sql` (in that order); AC-03 and GRN-04 live runs still required.
- Phase 4 remainder: counts, adjustments, waste, low-stock alerts.
- OD-06 thresholds and separation of duties remain open; the stock-location ↔ outlet mapping remains open.
- RLS negative-test SQL script (AC-02 evidence).

---

## Session 16: 2026-11-18 — Migrations 0006/0007 Applied and Verified

- **Phase**: Phase 4 in progress | **Completion**: **35.0%** (unchanged; live runs still pending)
- **Date**: 2026-11-18 20:45 UTC+3
- **Model**: Big Pickle (OpenCode)

### Actions Completed
1. **Owner applied both migrations** — `20261118000600_purchase_requests_orders.sql` then `20261118000700_grn_po_linkage.sql`.
2. **Migration verification through PostgREST** with the publishable key:
   - `purchase_requests`, `purchase_orders`, `purchase_order_receipts`, `grns.po_id` and `grn_lines.po_line_id` all resolve; the anon role is denied with `42501`, which proves the objects exist and RLS/grants are in force.
   - The 8-argument `create_grn` exists and returns its role-gate message; the old 7-argument signature returns `PGRST202` and the hint shows the new signature, confirming the drop.
   - All seven PR/PO RPCs (`submit`, `decide`, `create`, `approve`, `mark ordered`, `close`) return their domain permission messages rather than 404.
3. **Docs** — blocker cleared; verification evidence added to `PROJECT_STATUS.md`; AC-03 and GRN-04 rows updated to "awaiting live run".

### Verification
- Migration objects and RPC gates: **pass** (see evidence above)
- Unit gates unchanged from Session 15: typecheck, lint, 166/166 tests, build all pass

### Outstanding
- Live **AC-03**: PR → submit → GM approve → Create PO → approve → ordered → close; purchasing officer must not be able to approve.
- Live **GRN-04**: receive against an ordered PO; confirm outstanding quantities and `partial`/`complete`, and that an over-receipt shows as `over`.
- Phase 4 remainder: counts, adjustments, waste, low-stock alerts.
- OD-06 thresholds and separation of duties remain open; the stock-location ↔ outlet mapping remains open.
- RLS negative-test SQL script (AC-02 evidence).

---

## Session 17: 2026-11-18 — AC-03 and GRN-04 Verified Live

- **Phase**: Phase 4 in progress | **Completion**: **35.0%** (unchanged; counts, adjustments, waste and alerts remain)
- **Date**: 2026-11-18 21:05 UTC+3
- **Model**: Big Pickle (OpenCode)

### Actions Completed
1. **AC-03 verified live by the owner** — PR submitted, approved with approver name/time/comment, converted to one PO, then advanced draft → approved → ordered → closed. A purchasing officer could not approve the PO.
2. **GRN-04 verified live by the owner** — selecting an ordered PO locked the supplier and seeded the outstanding lines; a draft receipt stayed `pending`; posting it moved the status to `partial`/`complete`; a receipt above the outstanding quantity was recorded as `over`.
3. **Docs** — AC-03 and GRN-04 marked Verified; PR/PO rows annotated with live evidence; blocker/risk table and next task updated for the remaining Phase 4 scope.

### Verification
- Live AC-03 and GRN-04: **pass** (owner-run in the deployed app)
- Unit gates unchanged from Session 16: typecheck, lint, 166/166 tests, build all pass

### Outstanding
- Phase 4 remainder: inventory counts, adjustments, waste, low-stock alerts.
- OD-06 thresholds and separation of duties remain open; the stock-location ↔ outlet mapping remains open.
- RLS negative-test SQL script (AC-02 evidence).

---

## Session 18: 2026-11-18 — Counts, Adjustments, Waste and Reorder Alerts Built

- **Phase**: Phase 4 in progress | **Completion**: **35.0%** (unchanged; AC-06/AC-07 live runs pending migration 0008)
- **Date**: 2026-11-18 23:40 UTC+3
- **Model**: Big Pickle (OpenCode)

### Actions Completed
1. **Migration 0008 authored** — `20261118000800_counts_adjustments_waste.sql` adds `inventory_adjustments` / `inventory_adjustment_lines` (shared by adjustments and waste through `kind`), `inventory_counts` / `inventory_count_lines`, the `stock_reorder_status` and `inventory_count_variances` views, the role helpers `can_manage_inventory()`, `can_approve_inventory()` and `can_post_inventory()`, the FIFO helpers `post_stock_in()` / `post_stock_out()`, eight workflow RPCs, audit triggers, RLS and grants. **Not applied yet.**
2. **Counts** — sheets record the item base unit, a `system_quantity` ledger snapshot taken at creation, the physical quantity and a generated variance. Posting after approval reconciles the ledger to the physical quantity at posting time through `adjustment` transactions linked to the count line (`reference_type = 'inventory_count'`); gains are valued at the weighted average of remaining FIFO layers, or zero when the location has no layers.
3. **Adjustments and waste** — increase/decrease lines with SRS reasons; waste allows decrease lines only and offers the five waste reasons. Posting creates a FIFO layer for increases and consumes the oldest layers for decreases, recording the posted cost.
4. **Workflow and roles** — `draft → submitted → approved/rejected → posted`; one-shot posting, read-only posted documents. Manage/submit/post = admin/GM/storekeeper; approve/reject = admin/GM. Self-approval is not blocked and no thresholds exist (OD-06 interim).
5. **Reorder alerts** — total on-hand across locations compared with the item-level reorder level; shows the shortage and can reveal tracked items that are not low.
6. **UI** — `AdjustmentPanel` / `WastePanel`, `CountPanel` and `LowStockPanel` mounted on `/inventory`; `api.ts` gained the new types and RPC wrappers; `validation.ts` gained adjustment/count validation and broader database error messages.
7. **Tests** — `stockValidation.test.ts` grew to 26; new `InventoryControl.test.tsx` has 8 cases covering reorder rows, adjustment/waste payloads, the storekeeper-vs-manager approval gate, confirmed posting, read-only roles and count creation; stock/lookup mocks updated in the existing suites.
8. **Docs** — ADR-011 recorded; CNT/ADJ/WST/STK/INV-06 and AC-06/AC-07 rows updated; Phase 4 delivered/remaining, exit condition and OD-06 notes refreshed.

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass (zero warnings)
- `npm run test` — 182/182 pass across 22 suites
- `npm run build` — pass (670.43 kB JS / 162.87 kB gzip, 23.27 kB CSS; chunk-size warning only)
- Commit `da8a3f2` pushed to `main`; Cloudflare deployed the slice (`assets/index-BSJnI50i.js`, 670,647 bytes) and the served bundle contains the reorder, count, adjustment and waste panel markers.

### Outstanding
- **Owner applies** `20261118000800_counts_adjustments_waste.sql`, then runs AC-06 (count variance → approval → posting reconciles the ledger) and AC-07 (waste decreases stock and FIFO value).
- Agent verifies the migration objects and RPC gates through PostgREST once applied.
- OD-06 thresholds and separation of duties remain open; the stock-location ↔ outlet mapping remains open.
- RLS negative-test SQL script (AC-02 evidence).

---

## Session 19: 2026-11-18 — Migration 0008 Applied; UAT Deferred; Phase 5 Starts

- **Phase**: Phase 4 build complete; Phase 5 in progress | **Completion**: **35.0%** (Phase 4 credit releases at final UAT)
- **Date**: 2026-11-18 23:55 UTC+3
- **Model**: Big Pickle (OpenCode)

### Actions Completed
1. **Owner applied migration 0008** — the inventory counts, adjustments, waste and reorder-alert panels appeared in the deployed app.
2. **Structure verified through PostgREST** — all six objects (`inventory_adjustments`, `inventory_adjustment_lines`, `inventory_counts`, `inventory_count_lines`, `stock_reorder_status`, `inventory_count_variances`) exist and deny anon with `42501`; all eight inventory-control RPCs return their role-gate messages, not 404.
3. **Owner decision** — detailed acceptance testing (AC-06, AC-07 and the remaining criteria) is postponed to a single final UAT at the end of the project; Phase 4 is treated as build-complete and Phase 5 begins.
4. **Docs** — Phase 4 status, blockers and next task updated; Phase 5 marked in progress.

### Verification
- Migration 0008 objects: **pass** (6/6 exist, anon denied)
- Migration 0008 RPC gates: **pass** (8/8 role-gated)
- Panel load in the deployed app: **pass** (owner-confirmed)

### Outstanding
- Final UAT: AC-06 count reconciliation and AC-07 waste/production inventory effects.
- OD-06 thresholds and separation of duties remain open; the stock-location ↔ outlet mapping remains open.
- RLS negative-test SQL script (AC-02 evidence).
- Phase 5 implementation.

---

## Session 20: 2026-11-18 — Phase 5 Recipes, Costing and Production Build

- **Phase**: Phase 5 build complete; migration 0009 awaiting the owner | **Completion**: **35.0%** (Phase 4 and Phase 5 credit releases at final UAT)
- **Date**: 2026-11-18 23:59 UTC+3
- **Model**: Big Pickle (OpenCode)

### Actions Completed
1. **Migration 0009** — `20261118000900_recipes_production.sql` adds `recipes`, immutable `recipe_versions` and `recipe_version_lines`, `production_orders` and `production_inputs`, the `recipe_version_costs` view, role helpers, seven SECURITY DEFINER RPCs, audit triggers, RLS and grants.
2. **Recipe lifecycle** — `create_recipe` writes version 1; `create_recipe_version` appends a draft; `publish_recipe_version` archives the previously published version without deleting history; `update_recipe` edits header metadata only (code stays immutable).
3. **Costing** — `recipe_version_costs` uses the weighted average unit cost of the remaining FIFO layers per ingredient across all locations, then derives total cost, cost per portion, gross profit and food cost %. Ingredients without layers cost zero and set `lines_without_cost` so the UI can warn.
4. **Production** — `create_production_order` validates inputs, resolves base quantities through `stock_unit_factor()` and rejects duplicate inputs; `post_production_order` consumes every input FIFO and creates the output layer at the total consumed cost in one transaction. Drafts never move stock.
5. **UI** — new `/kitchen` page with `RecipesPanel` (create recipe, new version, publish, cost table, read-only role state) and `ProductionPanel` (draft form, input editor, confirm-post, history, yield %); "Kitchen" nav item added; Production removed from the Inventory planned list; footer updated.
6. **Validation** — recipe/version/production validation split into `features/recipes/validation.ts` and `features/production/validation.ts`, including database error mapping for duplicate codes/numbers, publish conflicts, shortages and posted orders.
7. **Tests** — `recipesValidation.test.ts` (16) and `Kitchen.test.tsx` (8) cover payload normalization, units, duplicate inputs, publish, costing display, confirm-post and both role gates.
8. **Docs** — ADR-012 recorded; REC/PROD/COST and AC-07/AC-08/AC-09 rows updated; roadmap, project status and this log refreshed.

### Verification
- `npm run typecheck` — pass
- `npm run lint` — pass (zero warnings)
- `npm run test` — 206/206 pass across 24 suites
- `npm run build` — pass (715.36 kB JS / 170.07 kB gzip, 23.59 kB CSS; chunk-size warning only)
- Commit `5b39343` pushed to `main`; Cloudflare deployed the slice (`assets/index-BKF57faz.js`, 715,354 bytes) and the served bundle contains the `/kitchen` route plus the recipe, costing and production markers.

### Outstanding
- Owner applies migration 0009; agent verifies the five tables, costing view and seven RPC gates through PostgREST.
- Final UAT: AC-06 count reconciliation, AC-07 production posting and AC-08 recipe costing.
- REC-05/REC-07 theoretical consumption needs Phase 6 sales; COST-01..03 remain Phase 7.
- OD-06 thresholds and separation of duties remain open; the stock-location to outlet mapping remains open.
- RLS negative-test SQL script (AC-02 evidence).

---

## Session 21: 2026-11-18 - Phase 6 Restaurant Operations Build

- **Phase**: Phase 6 build complete; migrations 0009 and 0010 awaiting the owner | **Completion**: **35.0%** credited (Phases 4-6 release at final UAT)
- **Date**: 2026-11-18 23:30 UTC+3
- **Model**: Big Pickle (OpenCode)

### Actions Completed
1. **Owner decisions** - OD-07 (VAT 15%, VAT-inclusive menu prices, no service charge or discounts), OD-08 (receipt numbers `<outlet>-YYYYMMDD-####` per outlet per business day with editable business identity), OD-09 (optional table, exact-slot double-booking blocked, overbooking warning), OD-10 (guest name and phone only, no profile/history) and OD-12 (all hotel features deferred) were recorded in ADR-013.
2. **Migration 0010** - `20261118001000_restaurant_operations.sql` adds `business_settings`, `menu_categories`, `menu_items`, `restaurant_tables`, `reservations`, `document_sequences`, `orders`, `order_lines` and `receipts`, the `reservation_slot_load` view, eight role helpers, fifteen SECURITY DEFINER RPCs, audit/`updated_at` triggers, RLS, grants and a Realtime publication for `orders`/`order_lines`.
3. **Menu, tables and reservations** - category and item management with VAT-inclusive prices and optional recipe links; table layout with statuses driven by open orders and reservations; reservation lifecycle `booked -> confirmed -> arrived -> cancelled/completed` with a unique table/slot index and an active-load overbooking warning.
4. **Orders** - create, edit, send, serve, cancel, transfer, split, manager merge and close; lifecycle `pending -> sent_to_kitchen -> preparing -> ready -> served -> closed` plus `cancelled`, enforced in SQL; line code, name and price snapshotted at creation.
5. **Concurrency** - `orders.revision` is checked on every mutation and a stale value raises SQLSTATE `40001`; `FOR UPDATE` locks plus `orders_one_open_per_table` prevent conflicting table use.
6. **Receipts** - closing requires `served`, extracts VAT as `total x rate / (100 + rate)` from inclusive prices, snapshots the business identity and footer, issues an immutable numbered receipt and frees the table when no open order remains.
7. **KDS** - three Sent/Preparing/Ready columns with timestamps, line instructions, role-gated transitions and a Realtime subscription that refetches on any order or line change; online only.
8. **Business settings** - `/settings` panel for business name, TIN, address, phone, VAT rate and receipt footer; admin/GM write access, read-only summary for everyone else.
9. **Receipt footer gap** - the footer was editable but not stored on receipts; `receipt_footer` was added to the receipts table and `close_order()` snapshot, and the receipt view now prints it. Migration 0010 had not been applied, so no follow-up migration was expected at the time. **Correction (Session 22): the applied 0010 was the earlier copy, so hotfix 0011 is required.**
10. **UI and navigation** - the `/operations` placeholder was replaced with `MenuPanel`, `TablesPanel`, `ReservationsPanel`, `OrdersPanel` and `KitchenDisplayPanel`; `BusinessSettingsPanel` was added to `/settings`.
11. **Tests** - `menuValidation.test.ts`, `tablesReservationsValidation.test.ts`, `ordersValidation.test.ts` (10), `Operations.test.tsx` (11) and `Settings.test.tsx` (12) cover payloads, role gates, order/KDS flow, receipt rendering and business settings.
12. **Commits** - slice 1 `ac31955`; slice 2 `3ed1273` (13 files, 3,112 insertions); docs and receipt-footer fix `a80f90f`; all pushed to `main`.

### Verification
- `npm run typecheck` - pass
- `npm run lint` - pass (zero warnings)
- `npm run test` - 252/252 pass across 28 suites
- `npm run build` - pass (811.08 kB JS / 186.65 kB gzip, 24.76 kB CSS; chunk-size warning only)
- Live deployment - `https://albena-rms.pages.dev` serves `assets/index-fqmOEPuP.js` (811,382 bytes) containing New order, Kitchen display, Close & print receipt, Business & receipts, `receipt_number`, `split_order`, `merge_orders` and `receipt_footer`
- Migrations 0009 and 0010 - authored, **not yet applied**

### Outstanding
- Owner applies migration 0009, then 0010 (0010 references `recipes`); agent verifies the Phase 5/6 objects and RPC gates through PostgREST.
- Final UAT: AC-06, AC-07, AC-08, AC-10, AC-11, AC-14 and AC-15.
- KDS-01 shows sent/opened timestamps but no elapsed-minutes counter; KDS-04 prep-time reporting and the reservation/guest-history reports are Phase 7 (RES-03 dropped per OD-10).
- OD-06 thresholds and separation of duties remain open; the stock-location to outlet mapping remains open.
- RLS negative-test SQL script (AC-02 evidence).



## Session 22: 2026-11-18 - Phase 5/6 Migrations Applied and Verified; Receipt Footer Hotfix

- **Phase**: Phase 6 build complete; migrations 0009/0010 applied, 0011 pending | **Completion**: **35.0%** credited (Phases 4-6 release at final UAT)
- **Date**: 2026-11-19 00:30 UTC+3
- **Model**: Big Pickle (OpenCode)

### Actions Completed
1. **Owner applied migrations** - 0009 `recipes_production` and then 0010 `restaurant_operations` were applied on the live project on 2026-11-18.
2. **PostgREST verification** - 49 probes with the anonymous key (16 table/view GETs and 33 RPC calls with named arguments). Every Phase 5 object (`recipes`, `recipe_versions`, `recipe_version_lines`, `production_orders`, `production_inputs`, `recipe_version_costs`) and Phase 6 object (`business_settings`, `menu_categories`, `menu_items`, `restaurant_tables`, `reservations`, `orders`, `order_lines`, `receipts`, `reservation_slot_load`, `document_sequences`) resolves. Anon reads return `42501 permission denied`, not `404`/`PGRST202`.
3. **RPC verification** - all nine Phase 5 and all 24 Phase 6 RPCs resolve. Workflow RPCs return their role-gate `42501` message, the eight Phase 6 role helpers return `false`, `business_today()` returns `2026-11-18`, `next_document_number()` rejects an unknown outlet with `409` (foreign key) rather than a missing function, and the not-found paths return their own SQLSTATEs.
4. **Gap found** - the applied 0010 predates the receipt-footer snapshot: `receipts?select=receipt_footer` returns `42703 column receipts.receipt_footer does not exist`, so the live `close_order()` is the earlier copy. The migration file in git is correct; re-running it would not add the column because the table already exists.
5. **Hotfix 0011** - `20261118001100_receipt_footer_and_function_privileges.sql` adds `receipt_footer` with `add column if not exists`, recreates `close_order()` with the footer snapshot, and revokes anonymous EXECUTE on helpers and RPCs. It also closes a privilege hole found during the probe: `occupy_table()`, `free_table_if_idle()`, `next_document_number()`, `insert_recipe_version_lines()`, `post_stock_in()` and `post_stock_out()` are `SECURITY DEFINER`, have no internal role gate, and were executable by `anon` because the earlier migrations revoked only from `PUBLIC`.
6. **Docs corrected** - table columns are `capacity` (no `seats`/`zone`); OD-07/08/09/10/12 marked resolved in the traceability decision table; migration statuses and next-task guidance refreshed in `PROJECT_STATUS.md`, `ROADMAP.md` and `REQUIREMENTS_TRACEABILITY.md`.

### Verification
- Anon probes - 49 calls, no missing table, view or function; all denials are `42501`
- Defect confirmation - `receipts.receipt_footer` absent (`42703`) on the live schema
- Hotfix 0011 - authored, **not yet applied** (no local Postgres to syntax-check)
- Application tests - unchanged since the last green run (252/252 across 28 suites)

### Outstanding
- Owner applies `20261118001100_receipt_footer_and_function_privileges.sql`; agent re-probes the footer column and anonymous function denials.
- Final UAT: AC-06, AC-07, AC-08, AC-10, AC-11, AC-14 and AC-15.
- OD-06 thresholds/separation of duties and the stock-location to outlet mapping remain open.



## Session 23: 2026-11-19 - Hotfix 0011 Applied and Re-Verified; Phase 6 Closed

- **Phase**: Phase 6 verified live; Phase 7 next | **Completion**: **35.0%** credited (Phases 4-6 release at final UAT)
- **Date**: 2026-11-19 01:00 UTC+3
- **Model**: Big Pickle (OpenCode)

### Actions Completed
1. **Owner applied 0011** - `20261118001100_receipt_footer_and_function_privileges.sql` ran successfully on the live project.
2. **Footer fixed** - `receipts?select=id,receipt_number,receipt_footer` now returns `42501 permission denied for table receipts` instead of `42703 column does not exist`, confirming the column and schema-cache reload. `close_order()` is the version that snapshots `business_settings.receipt_footer`.
3. **Privilege hole closed** - `occupy_table`, `free_table_if_idle`, `next_document_number`, `insert_recipe_version_lines`, `post_stock_in` and `post_stock_out` all return `401` / `42501 permission denied for function` to anon.
4. **No regressions** - sample probes of `recipes`, `reservations`, `can_close_orders`, `close_order` and `business_today` return `401`/`42501`, not `404`/`PGRST202`.
5. **Records updated** - `PROJECT_STATUS.md`, `ROADMAP.md` and this log now show 0009/0010/0011 applied and verified; the hotfix blocker is resolved and the recommended next task is Phase 7.

### Verification
- Post-hotfix probe script - 12 checks, all expected outcomes (`401`/`42501`, no `42703`/`404`)
- Application tests - unchanged since the last green run (252/252 across 28 suites); no application code changed

### Outstanding
- Final UAT: AC-06, AC-07, AC-08, AC-10, AC-11, AC-14 and AC-15.
- Phase 7 reporting/dashboard build (RPT-01..09, KDS-04, COST-01..03).
- OD-06 thresholds/separation of duties and the stock-location to outlet mapping remain open; RLS negative-test SQL script (AC-02) still to add.



## Session 24: 2026-11-19 - Phase 7 Reporting and Dashboard Built

- **Phase**: Phase 7 build complete, migration 0012 awaiting owner application | **Completion**: **35.0%** credited (Phases 4-7 release at final UAT)
- **Date**: 2026-11-19 09:00 UTC+3
- **Model**: Big Pickle (OpenCode)

### Actions Completed
1. **Migration 0012 authored** - `20261118001200_reporting.sql` creates eleven `security_invoker` views (`sales_daily`, `sales_lines`, `inventory_report`, `purchase_request_report`, `purchase_order_report`, `grn_report`, `waste_report`, `theoretical_consumption`, `consumption_variance`, `kitchen_performance`, `reservation_daily`), revokes anon/PUBLIC access and grants select to `authenticated`. Business dates use `Africa/Addis_Ababa` (OD-01); revenue comes from immutable receipts (ADR-008) and inventory from the derived ledger (ADR-007).
2. **Reports page built** - `/reports` replaces the placeholder with shared From/To/Outlet filters (RPT-09) and Sales, Inventory, Purchasing, Cost and Waste, Kitchen Performance and Reservations sections. Sales includes the AC-12 reconciliation of sold lines against receipt net sales. No thresholds were invented: idle days and delayed minutes are caller-supplied UI filters.
3. **Dashboard rebuilt** - `/dashboard` replaces the setup checklist with RPT-08 KPIs: today's sales, kitchen queue and delayed tickets, occupied tables, low stock, inventory value, food cost %, waste %, reservations and top items.
4. **Code and tests** - typed loaders with paged queries, validation helpers, nine report-helper tests, five Reports page tests and updated App shell tests. Added the routes to `App.tsx` and navigation/footer entries in `AppShell.tsx`.
5. **Committed** - `63115ba` (Phase 7 reporting views, reports page and dashboard), pushed to `main`; Cloudflare deployment follows the push.

### Verification
- `npm run typecheck`, `npm run lint`, `npm run build` - all Pass; production bundle 850.64 kB JS (195.52 kB gzip), 25.05 kB CSS (chunk-size warning only)
- Full suite - 266/266 tests across 30 suites Pass
- Focused rerun after the AC-12 reconciliation tweak - 11/11 Pass (`Reports.test.tsx`, `App.test.tsx`)
- Migration 0012 - authored only; no local PostgreSQL available, so it awaits owner application and PostgREST verification

### Outstanding
- **Owner**: apply `supabase/migrations/20261118001200_reporting.sql` after 0011, then reload the PostgREST schema cache.
- **Agent**: probe all eleven views through PostgREST (objects resolve, anon `42501`, no `404`/`42703`).
- **Owner/agent**: AC-12 live reconciliation and dashboard figures, deferred to final UAT with AC-06, AC-07, AC-08, AC-10, AC-11, AC-14 and AC-15.
- OD-06 thresholds/separation of duties and the stock-location to outlet mapping remain open; RLS negative-test SQL script (AC-02) still to add.




