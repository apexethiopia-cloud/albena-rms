# Albena RMS — Fast-Track Development Plan

**Created**: 2026-11-18
**Baseline**: `docs/SRS_v3.0.md` (approved 2026-11-17) + `docs/ROADMAP.md` (Phases 0–8)
**Purpose**: Turn the current 5%-complete documentation baseline into a working cloud prototype in the shortest credible path, without violating SRS constraints.

> **Status 2026-11-18 (updated 13:15 UTC+3)**: Phases 1 and 2 are complete and the app is live at `https://albena-rms.pages.dev`. Supabase migrations 0001/0002 are applied and the administrator account is verified. Phase 3 is in progress: outlet management ships at `/settings`, and master-data migrations 0003/0004 await the owner's apply. Typecheck, lint, 32 tests and the production build pass.

---

## 1. Current State Audit

### What exists and is correct

| Area | State | Evidence |
|:---|:---|:---|
| Requirements baseline | Complete | `docs/SRS_v3.0.md`, 160+ IDs in `docs/REQUIREMENTS_TRACEABILITY.md` |
| Governance docs | Complete | `PROJECT_STATUS.md`, `ROADMAP.md`, `DECISIONS.md`, `TESTING.md`, `DEPLOYMENT.md`, `QUOTA_LOG.md` |
| Security guardrails | In place | `.gitignore` excludes `.env*`; `.env.example` has placeholders only |
| Stack choice | Decided | React 18 + TS + Vite 5 + Tailwind 3, Supabase (Postgres/Auth/Realtime), Cloudflare Pages |
| Project scaffolding | **Partial, uncommitted** | `package.json`, `vite.config.ts`, `tsconfig*.json`, `tailwind.config.js`, `postcss.config.js`, `.eslintrc.cjs`, `.prettierrc`, `index.html` |
| Blocking decisions | Mostly answered | OD-01 timezone, OD-02 single entity/multi-outlet, OD-03 all-access test users, OD-11 ETB, OD-13 free tier confirmed |

### What is missing or broken (verified today)

| # | Blocker | Impact | Fix |
|:--:|:---|:---|:---|
| B1 | **No `src/` directory at all** | `npm run build` fails: `Rollup failed to resolve import "/src/main.tsx"`; dev server has no entry | Create `src/main.tsx`, `App.tsx`, `index.css`, `src/test/setup.ts` |
| B2 | `vite.config.ts` imports `defineConfig` from `vite` but uses a `test` block | Not caught today (`tsc` does not check `vite.config.ts`), but config is semantically wrong and breaks once checked | Import from `vitest/config` |
| B3 | `vite.config.ts` uses `__dirname` in an ESM package (`"type": "module"`) and `path` without `@types/node` | Latent failure on a stricter `tsc -b`; fragile config loading | Use `fileURLToPath(new URL('./src', import.meta.url))`; add `@types/node` |
| B4 | `vitest` `setupFiles: './src/test/setup.ts'` does not exist | Every test run fails immediately | Create the setup file |
| B5 | `index.html` references `/favicon.svg`, no `public/` folder | 404 on every load (cosmetic, but flagged in review) | Add `public/favicon.svg` |
| B6 | PowerShell execution policy blocks `npm.ps1` | Agent cannot run `npm` directly | Use `cmd /c "npm.cmd ..."` (verified working), or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| B7 | No CI workflow, no Cloudflare config | Phase 1 exit condition ("secure empty app reachable") cannot be met | Add `.github/workflows/ci.yml`, `public/_redirects` SPA fallback |
| B8 | `docs/DEPLOYMENT.md` says build command `pnpm run build` | Deployment would fail; repo is npm-only | Change to `npm run build`, output `dist` |

### Toolchain verification (2026-11-18)

| Check | Result |
|:---|:---|
| `npm install` (clean) | ✅ 413 packages in 56s (after deleting a corrupted partial `node_modules`) |
| `esbuild --version` | ✅ 0.21.5 |
| `vite --version` | ✅ 5.4.21 / win32-x64 / node v26.13.1 |
| `npm run typecheck` | ✅ exits 0 — but only because `src/` does not exist, so nothing is actually checked |
| `npm run build` | ❌ `Rollup failed to resolve import "/src/main.tsx" from index.html` |

**Note (B9, resolved)**: the first install was killed by a timeout and left a truncated `esbuild.exe` that failed with `EFTYPE` / "Access is denied". Deleting `node_modules` and reinstalling fixed it. npm 11 now reports install scripts as "not yet covered by allowScripts" for `esbuild`; this is informational and did not prevent the binary from working.

---

## 2. Non-Negotiable Requirements (short digest)

These drive design decisions and cannot be traded for speed:

1. **Cloud-only** — internet required, no offline queue, no local DB (CON-01, ARC-08).
2. **Free tier only, no card** (CON-03, CON-04, OD-13 confirmed).
3. **3 individual users**, no shared accounts (CON-02, SEC-ROLE-02).
4. **Authorization in Postgres RLS**, not UI hiding (SEC-ROLE-01, ADR-003).
5. **Stock balances derived from an immutable transaction ledger** — never direct balance updates (STK-01, ADR-007).
6. **Menu sales never auto-deduct stock** (REC-06, STK-05, ADR-008).
7. **Atomic posting** for GRN/SIV/production via DB functions/transactions (ARC-06).
8. **Append-only audit trail**; no deletes by ordinary users (AUD-03, DATA-02).
9. **Clear network-error state**; never claim unsaved work was saved (ARC-07, AC-15).
10. **No secrets in the public repo or browser bundle** (ARC-03/04, CON-06).

---

## 3. Decision Gates

| Decision | Status | Needed by | Action |
|:---|:---|:---|:---|
| OD-01 Timezone | ✅ Africa/Addis_Ababa (UTC+3) | Phase 1 | Apply to all date formatting/report boundaries |
| OD-02 Tenancy | ✅ One entity, multiple outlets | Phase 2 | `outlets` table + `user_outlet_scopes` |
| OD-03 Test users | ✅ Full access for 3 users | Phase 2 | Seed 3 accounts with all roles |
| OD-11 Currency | ✅ ETB, 2 decimals | Phase 1 | Store money as `numeric(14,2)`; never floats |
| OD-13 Free tier | ✅ Confirmed | Phase 1 | Record in `DEPLOYMENT.md`; monitor quotas |
| OD-04 Costing method | ⚠️ Weighted average assumed | **Phase 4 start** | Owner must confirm before GRN valuation code |
| OD-05 Unit conversions | ❌ Open | **Phase 4 start** | Default to `1 item = 1 base UoM` until answered; do not invent factors |
| OD-06 Approval rules | ✅ Required | Phase 4 | Single-approver flows with role checks |
| OD-07 Taxes/discounts | ❌ Open | Phase 6 | Model as optional line-level fields, default 0% |
| OD-08 Receipt format | 🟡 ETB confirmed, format TBC | Phase 6 | Numbering `OUTLET-YYYYMMDD-NNNN` as draft |
| OD-09 Reservation rules | ❌ Open | Phase 6 | Table assignment optional; overlap warning only |
| OD-10 Guest data | ❌ Open | Phase 6 | Store name/phone only; no history retention policy |
| OD-12 Hotel features | ❌ Open | Phase 6 | Deferred unless owner says otherwise |

**Implication**: Phases 1–3 are fully unblocked. Phase 4 needs OD-04 and OD-05 answered — request them now so they are not on the critical path next week.

---

## 4. Strategy for Speed

### 4.1 Vertical slices, not layer-by-layer

Each domain ships **DB migration → RLS policies → RPC/business function → typed client → UI → tests** in one pass. This avoids a big-bang integration phase, which is the main schedule risk in a 9-phase plan.

### 4.2 Build shared primitives once, reuse everywhere

| Primitive | Used by | Built in |
|:---|:---|:---|
| `DataTable` (sort/filter/paginate/empty/error) | every list screen | Phase 3 |
| `FormSheet` + field components + validation helper | every create/edit screen | Phase 3 |
| `StatusBadge`, `ConfirmDialog`, `PageHeader`, `FilterBar` | all modules | Phase 3 |
| `useSupabaseQuery` / `useMutation` hooks (loading, error, retry, toast) | all data access | Phase 2 |
| `assertRole` / `<RequirePermission>` (UX only; DB is authority) | all routes | Phase 2 |
| `post_stock_transaction()` DB function | GRN, SIV, waste, production, adjustments, counts | Phase 4 |
| Money/quantity helpers (`ETB`, 2dp, timezone-aware dates) | all modules | Phase 1 |
| Seed script (`supabase/seed.sql`) | demos and all acceptance tests | Phase 2 |
| Typed DB schema (`supabase gen types typescript`) | compile-time safety | Phase 2 |

### 4.3 Database-first

Business rules live in SQL (RLS + RPC + triggers), so the frontend stays thin. One migration per domain, one RPC per atomic posting operation. This directly satisfies SEC-ROLE-01, ARC-06, AUD-01..05 with less code than a custom API layer.

### 4.4 Test where it pays

- **Unit** (Vitest): money math, food-cost %, variance, status transitions.
- **DB/RLS** (SQL test script): unauthorized read/write must fail for each table.
- **Smoke** (manual scripted, 10 min): 3 users, concurrent order + KDS update.
- Skip heavy E2E automation; the SRS asks for verified workflows, not a test framework.

---

## 5. Schedule (aggressive but realistic)

Assumes one focused developer-agent session per working day and owner answers OD-04/OD-05 by Day 7.

| Day | Phase | Deliverable | Exit check |
|:--:|:---|:---|:---|
| 1 | 1 | Fixed scaffold, app shell, routing, Tailwind, network/error banner, Vitest + one passing test, CI workflow | `npm run build`, `lint`, `test` all green locally |
| 2 | 1 | Cloudflare Pages project connected, env vars set, first deploy | Public HTTPS URL serves the shell |
| 3 | 2 | Supabase project, migrations 0001 (profiles/roles/outlets/scopes/audit), RLS on all tables, 3 seeded users | 3 logins work; unauthorized table access rejected |
| 4 | 2 | Login/logout, session handling, route guards, audit triggers | AC-01, AC-02 (partial), AC-13 (partial) pass |
| 5–6 | 3 | Outlets, locations, categories, suppliers, items, user admin | Master-data CRUD + scope tests pass |
| 7–8 | 4 | Stock ledger engine + `post_stock_transaction()` + movement history | Ledger reconciles; no direct balance writes |
| 9 | 4 | PR → approval → PO | AC-03 |
| 10 | 4 | GRN posting + valuation + duplicate-post guard | AC-04 |
| 11 | 4 | SIV/transfer atomic + negative-stock rejection | AC-05 |
| 12 | 4 | Counts, adjustments, waste, low-stock alerts | AC-06, AC-07 |
| 13–14 | 5 | Recipes, versions, costing, production posting, theoretical consumption | AC-08, AC-09 |
| 15 | 6 | Menus, tables, reservations | AC-11 (partial) |
| 16–17 | 6 | Orders, KDS with Realtime, order status sync | AC-10, AC-14 |
| 18 | 6 | Receipts (print + PDF), price snapshots | AC-11, AC-15 |
| 19–20 | 7 | Sales/inventory/purchasing/cost/waste reports + dashboard | AC-12 |
| 21 | 8 | Security review, backup/export + restore test, concurrency test | AC-16, AC-17, AC-18 |
| 22 | 8 | Owner demo, handover report, acceptance | AC-19 |

**Fastest credible completion: ~22 working days.** The critical path is Phase 4 (largest weight, 20%); everything before it must not slip.

### Parallelisation opportunities
- Reports (Phase 7) can start read-only once Phase 4 tables exist.
- UI primitives (Phase 3) can be built while Supabase migrations are reviewed.
- Receipt template (Phase 6) can be drafted by the owner early (needs OD-08).

---

## 6. Immediate Next 90 Minutes (Day 1 checklist) — ✅ complete 2026-11-18

1. ✅ `cmd /c "npm.cmd install"` — 413 packages, `package-lock.json` generated.
2. ✅ Created `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`, `public/favicon.svg`.
3. ✅ Fixed `vite.config.ts` (`vitest/config` import, ESM-safe alias); added `@types/node`.
4. ✅ Added `src/lib/env.ts` with placeholder detection (no throw — Phase 1 boots without Supabase).
5. ✅ Added `src/components/NetworkStatusBanner.tsx` (ARC-07) with passing tests.
6. ✅ Added `.github/workflows/ci.yml` (typecheck, lint, test, build on Node 20).
7. ✅ Added `public/_redirects` (`/* /index.html 200`) and `public/_headers`.
8. ✅ `typecheck`, `lint`, `test` (8/8) and `build` all green; preview smoke test passed.
9. ✅ Updated `PROJECT_STATUS.md`, `docs/PROGRESS_LOG.md`, `docs/REQUIREMENTS_TRACEABILITY.md`, `docs/DEPLOYMENT.md`.

**Not done yet**: Cloudflare Pages project and first public deployment (Phase 1 exit condition).

---

## 7. Risks to the Fast Path

| Risk | Likelihood | Mitigation |
|:---|:---:|:---|
| OD-04 / OD-05 still open at Phase 4 | High | Escalate on Day 1; fall back to documented assumption only with owner sign-off |
| RLS policy mistakes cause silent data exposure | Medium | One negative test per table; review policies before each phase exit |
| Realtime complexity delays KDS | Medium | Polling fallback (5s) behind a flag if Realtime misbehaves |
| Supabase free-tier pausing interrupts demos | Medium | Warm-up ping before demo; document in handover |
| Scope creep into hotel/PMS features (OD-12) | Medium | Explicitly deferred; change request required |
| Agent quota exhaustion | Medium | Micro-milestones; checkpoint docs after every phase exit |

---

## 8. Definition of Done (per slice)

A slice is done only when all of the following are true:

- [ ] Migration file committed and applied; RLS enabled on every new table.
- [ ] Atomic operation implemented as a DB function where multi-step.
- [ ] UI covers list, create, edit, and the relevant workflow action.
- [ ] Loading / empty / error / permission-denied states present.
- [ ] Unit test for calculation or state transition passes.
- [ ] RLS negative test passes (wrong role/outlet is rejected).
- [ ] Traceability row updated to `Implemented` or `Tested`.
- [ ] Progress log and status updated with the commit reference.
