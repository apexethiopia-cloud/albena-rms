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
