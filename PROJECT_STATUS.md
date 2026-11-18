# Albena RMS — Project Status

## 1. Executive Summary

| Attribute | Value |
| :--- | :--- |
| **Project Name** | Albena Restaurant Management System (RMS) |
| **Current Phase** | Phase 2 — Backend & Identity (in progress) |
| **Overall Completion** | **15.0%** (Phase 0 and Phase 1 complete; Phase 2 code written, migrations pending apply) |
| **Last Updated** | 2026-11-18 12:30 UTC+3 |
| **Latest Git Commit** | `aa826b9` (Phase 2 auth + schema) + `be1f548` (decisions and status docs) |
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
| **Phase 2** | Backend & Identity (Supabase, Auth, RLS) | 10% | 🟡 **In Progress** | No — migrations not yet applied |
| **Phase 3** | Master Data (outlets, suppliers, inventory) | 10% | ⏳ Planned | No |
| **Phase 4** | Inventory & Purchasing (PR, PO, GRN, SIV, stock) | 20% | ⏳ Planned | No |
| **Phase 5** | Recipes & Production | 10% | ⏳ Planned | No |
| **Phase 6** | Restaurant Operations (menu, tables, KDS, POS) | 15% | ⏳ Planned | No |
| **Phase 7** | Reporting & Dashboard | 10% | ⏳ Planned | No |
| **Phase 8** | Validation & Handover | 10% | ⏳ Planned | No |
| **Total** | | **100%** | **15.0% Complete** | |

---

## 3. Current Task Status

### Completed (Phase 1, 2026-11-18)
- [x] Toolchain repaired and pinned (`package-lock.json`, Node 20 in CI).
- [x] React + TypeScript + Vite + Tailwind application with routing and app shell.
- [x] Offline / network-error banner (ARC-07).
- [x] ETB (2 decimals) and `Africa/Addis_Ababa` formatting helpers with tests.
- [x] 14 tests, ESLint clean, strict typecheck, production build.
- [x] CI workflow; SPA `_redirects` and security `_headers`.
- [x] **Cloudflare Pages deployment live** — `https://albena-rms.pages.dev` (root and `/inventory` both 200).

### Completed (Phase 2 — written, pending apply)
- [x] Owner decisions recorded: **FIFO costing (OD-04, ADR-009)** and **unit conversion model (OD-05, ADR-010)**.
- [x] Supabase project connected; publishable key stored in `.env.local` only.
- [x] Migration `20261118000100_foundation.sql`: roles, user_profiles, user_roles, outlets, user_outlet_scopes, audit_logs.
- [x] RLS enabled on all six tables with least-privilege policies.
- [x] `SECURITY DEFINER` helpers (`is_active_user`, `has_role`, `is_admin`) to avoid policy recursion.
- [x] Append-only audit triggers on identity and outlet tables.
- [x] New-user trigger creating a profile, plus backfill for existing accounts.
- [x] Admin RPCs: `admin_set_user_status`, `admin_assign_role`.
- [x] Migration `20261118000200_reference_data.sql`: 10 SRS roles and 5 outlets (idempotent).
- [x] `scripts/seed-test-users.mjs` for the three test users (service-role key, local only).
- [x] Frontend auth: Supabase client, `AuthProvider`, `ProtectedRoute`, login page, sign-out, disabled-account state.
- [x] `supabase/README.md` with apply instructions and the schema/RLS map.

### In Progress
- [ ] **Apply the two migrations** to the Supabase project (SQL editor or `supabase db push`).
- [ ] **Create the three test users** and assign roles/outlets.
- [ ] Re-deploy to Cloudflare Pages with the new auth build.

### Outstanding (Next Session)
- [ ] Verify AC-01 (three logins) and AC-02 (unauthorized access fails).
- [ ] Add RLS negative-test SQL script.
- [ ] Begin Phase 3 master data: outlets, locations, suppliers, item categories/items.

---

## 4. Blockers and Risks

| Priority | Type | Description | Blocking | Mitigation |
| :---: | :--- | :--- | :--- | :--- |
| 🟡 MEDIUM | **Blocker** | Phase 2 migrations have not been applied; the live app will show "profile missing" until then | Phase 2 exit | Owner runs the SQL or Supabase CLI link; agent cannot authenticate to the database |
| 🟡 MEDIUM | **Risk** | **Supabase project pausing** after inactivity (free plan) | Demos | Warm-up request before every demo |
| 🟡 MEDIUM | **Risk** | **No automated backups** on the free plan | Phase 4+ | Manual export before milestones; restore test in Phase 8 |
| 🟡 MEDIUM | **Risk** | **AI quota** visible only in the provider UI | Ongoing | Micro-milestones; 25% warn / 15% stop policy |
| 🟢 LOW | **Risk** | **Service-role key** needed only for the seeding script | Test users | Key lives in `.env.local` only; never in the repo or browser bundle |
| 🟢 LOW | **Resolved** | OD-04 and OD-05 answered 2026-11-18 (FIFO, base units) | — | Recorded in ADR-009 and ADR-010 |

---

## 5. Files Created or Modified

| File | Action | Date |
| :--- | :--- | :--- |
| `src/**` | Created — shell, pages, auth, lib, tests | 2026-11-18 |
| `src/features/auth/**` | **Created** — context, provider, route guard | 2026-11-18 |
| `src/pages/Login.tsx` | **Created** | 2026-11-18 |
| `src/lib/supabase.ts` | **Created** | 2026-11-18 |
| `supabase/migrations/20261118000100_foundation.sql` | **Created** — schema, RLS, audit | 2026-11-18 |
| `supabase/migrations/20261118000200_reference_data.sql` | **Created** — roles + outlets | 2026-11-18 |
| `supabase/README.md` | **Created** — apply + seeding guide | 2026-11-18 |
| `scripts/seed-test-users.mjs` | **Created** — local admin script | 2026-11-18 |
| `.github/workflows/ci.yml` | **Created** | 2026-11-18 |
| `public/favicon.svg`, `_redirects`, `_headers` | **Created** | 2026-11-18 |
| `package.json`, `package-lock.json` | Corrected; dependencies pinned | 2026-11-18 |
| `vite.config.ts`, `tsconfig*.json`, `.eslintrc.cjs` | Corrected | 2026-11-18 |
| `docs/DECISIONS.md` | Added ADR-009 (FIFO), ADR-010 (units); OD-04/05 resolved | 2026-11-18 |
| `docs/ROADMAP.md` | Phase 1 complete, Phase 2 in progress, blockers cleared | 2026-11-18 |
| `docs/REQUIREMENTS_TRACEABILITY.md` | Phase 1 + Phase 2 rows updated | 2026-11-18 |
| `docs/DEPLOYMENT.md` | npm build, Node 20, SPA files, OD-13 confirmed | 2026-11-18 |
| `docs/PROGRESS_LOG.md`, `PROJECT_STATUS.md` | Updated | 2026-11-18 |
| `docs/FAST_TRACK_PLAN.md` | Created; Day 1 marked complete | 2026-11-18 |

---

## 6. Latest Tests Performed

| Test | Scope | Result |
| :--- | :--- | :--- |
| `npm run typecheck` | App + Vite config, strict TS | **Pass** |
| `npm run lint` | ESLint, zero warnings | **Pass** |
| `npm run test` | 4 suites, 14 tests (routing, auth redirects, offline banner, formatting, roles) | **Pass** |
| `npm run build` | Production bundle | **Pass** — 426 kB JS (122 kB gzip), 16 kB CSS |
| Live deployment | `https://albena-rms.pages.dev` root + `/inventory` + favicon | **Pass** — 200, asset hashes match local build |
| Supabase auth endpoint | `/auth/v1/health` | **Pass** — GoTrue v2.198.0 |
| Secret exclusion | `.env.local` ignored; only publishable key used client-side | **Pass** |

---

## 7. Recommended Next Task

> **Owner action (2 steps)**:
> 1. Apply `supabase/migrations/20261118000100_foundation.sql` then `20261118000200_reference_data.sql` (SQL editor, in order).
> 2. Create the three test users (Dashboard → Authentication → Users, or run `scripts/seed-test-users.mjs` with the service-role key in `.env.local`).

Then:
1. Sign in at the deployed URL with each of the three accounts (AC-01).
2. Run the RLS negative tests: signed-out and role-less requests must be rejected (AC-02).
3. Re-deploy and begin Phase 3 master data.
