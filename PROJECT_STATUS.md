# Albena RMS — Project Status

## 1. Executive Summary

| Attribute | Value |
| :--- | :--- |
| **Project Name** | Albena Restaurant Management System (RMS) |
| **Current Phase** | Phase 3 — Master Data (in progress) |
| **Overall Completion** | **25.0%** (Phases 0–2 complete; Phase 3 outlets delivered) |
| **Last Updated** | 2026-11-18 13:15 UTC+3 |
| **Latest Git Commit** | `7496ae0` (supplier master + outlet management) |
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
| **Phase 2** | Backend & Identity (Supabase, Auth, RLS) | 10% | ✅ **Complete** | Schema, RLS and admin auth verified live. **AC-01 unverified** (2 of 3 accounts missing) |
| **Phase 3** | Master Data (outlets, suppliers, inventory) | 10% | 🟡 **In Progress** | No — outlets done; suppliers, items, locations pending |
| **Phase 4** | Inventory & Purchasing (PR, PO, GRN, SIV, stock) | 20% | ⏳ Planned | No |
| **Phase 5** | Recipes & Production | 10% | ⏳ Planned | No |
| **Phase 6** | Restaurant Operations (menu, tables, KDS, POS) | 15% | ⏳ Planned | No |
| **Phase 7** | Reporting & Dashboard | 10% | ⏳ Planned | No |
| **Phase 8** | Validation & Handover | 10% | ⏳ Planned | No |
| **Total** | | **100%** | **25.0% Complete** | |

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
- [x] Item master panel: list, create, edit, deactivate/reactivate with category, base unit, optional purchase unit and reorder level.
- [x] Item write gate matches the `items_write` policy: System Administrator, General Manager, Purchasing Officer, Storekeeper, Executive Chef.
- [x] Base units limited to the seeded gram / millilitre / piece; reorder level validated as a non-negative decimal in the base unit.
- [x] Box/carton/sack purchase units are selectable but flagged in the form as needing a per-item factor (editor not built yet).

### Outstanding
- [ ] **Owner**: create the two remaining test accounts and verify AC-01 / AC-02.
- [ ] Integration-test outlets, suppliers and items with an authenticated account (migrations are applied; all three UIs are written and unit-tested).
- [ ] Item unit-conversion editor for box / carton / sack factors.
- [ ] Stock-location screen.
- [ ] Add RLS negative-test SQL script for repeatable authorization checks.
- [ ] User administration UI (roles, outlet scopes, disable/reactivate).

---

## 4. Blockers and Risks

| Priority | Type | Description | Blocking | Mitigation |
| :---: | :--- | :--- | :--- | :--- |
| 🟡 MEDIUM | **Risk** | AC-01 cannot be demonstrated with one account | Phase 2 acceptance | Owner creates two more accounts (dashboard or `scripts/seed-test-users.mjs`) |
| 🟡 MEDIUM | **Risk** | **Supabase project pausing** after inactivity (free plan) | Demos | Warm-up request before every demo |
| 🟡 MEDIUM | **Risk** | **No automated backups** on the free plan | Phase 4+ | Manual export before milestones; restore test in Phase 8 |
| 🟡 MEDIUM | **Risk** | **AI quota** visible only in the provider UI | Ongoing | Micro-milestones; 25% warn / 15% stop policy |
| 🟢 LOW | **Risk** | **Service-role key** needed only for the seeding script | Test users | Key lives in `.env.local` only; never in the repo or browser bundle |
| 🟢 LOW | **Resolved** | OD-04 and OD-05 answered 2026-11-18 (FIFO, base units) | — | Recorded in ADR-009 and ADR-010 |
| 🟢 LOW | **Resolved** | Master-data migrations 0003/0004 applied 2026-11-18; all six tables respond to REST | — | Anon reads return `200 []`; anon writes return `42501` |

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
| `npm run test` | 10 suites, 69 tests (routing, auth, offline banner, formatting, roles, outlet/supplier/item validation, and all three panels) | **Pass** |
| `npm run build` | Production bundle | **Pass** — 480 kB JS (132 kB gzip), 19 kB CSS |
| Live deployment | `https://albena-rms.pages.dev` root + `/inventory` | **Pass** — 200 through SPA fallback |
| Supabase auth endpoint | `/auth/v1/health` | **Pass** — GoTrue v2.198.0 |
| Supabase anon reads | `roles`, `user_profiles`, `outlets`, `user_roles` | **Pass** — `200 []` (RLS filtering, tables exist) |
| Supabase anon denial | `audit_logs` | **Pass** — `42501`, deny by design |
| Supabase anon write | `POST outlets` as anon | **Pass** — `42501`, new row violates RLS |
| Admin login and scopes | Owner-verified | **Pass** — profile active, `system_admin`, 5 outlets |
| Secret exclusion | `.env.local` ignored; only publishable key used client-side | **Pass** |

---

## 7. Recommended Next Task

> **Owner action (1 step)**: create the two remaining test accounts (Authentication → Users → Add user, auto-confirm, or `scripts/seed-test-users.mjs`), then sign in and confirm AC-01.

Then:
1. Open `/settings`, `/purchasing` and `/inventory` and create one outlet, one supplier and one item with the administrator account. This is the first end-to-end check of RLS with a real session.
2. Run the RLS negative tests: signed-out and role-less requests must be rejected (AC-02).
3. Build the item unit-conversion editor (box / carton / sack factors) and the stock-location screen.
