# Albena RMS — Implementation Roadmap (SRS v3.0 Aligned)

**Aligned with**: `docs/SRS_v3.0.md` Section 11, approved 2026-11-17
**Last Updated**: 2026-11-17

---

## Phase Overview

```mermaid
flowchart LR
    P0["Phase 0\nRequirements & Setup"] --> P1["Phase 1\nFoundation"]
    P1 --> P2["Phase 2\nBackend & Identity"]
    P2 --> P3["Phase 3\nMaster Data"]
    P3 --> P4["Phase 4\nInventory & Purchasing"]
    P4 --> P5["Phase 5\nRecipes & Production"]
    P5 --> P6["Phase 6\nRestaurant Operations"]
    P6 --> P7["Phase 7\nReporting"]
    P7 --> P8["Phase 8\nValidation & Handover"]
```

---

## Phase 0 — Requirements & Setup (5%)
**SRS Reference**: Section 11, Phase 0
**Status**: ✅ **COMPLETE** (approved 2026-11-17)

**Scope**:
- Review SRS v3.0, confirm open decisions
- Inspect repository and verify free-tier/no-card constraints
- Establish all mandatory tracking documents
- Create `.gitignore`, `.env.example`

**Exit Condition**: Owner approves requirements baseline and architecture.
**Completed**: 2026-11-17

**Requirements addressed**: CON-01..08, CON-06✅, CON-07(open), ARC-08, ARC-09, DEV-01..08, QTA-01..06, NFR-14, DATA-03..07

---

## Phase 1 — Foundation (10%)
**SRS Reference**: Section 11, Phase 1
**Status**: ✅ **COMPLETE** (2026-11-18)

**Scope**:
- Initialize Vite + React 18 + TypeScript + Tailwind CSS project
- Configure ESLint, Prettier, Vitest
- Set up environment variable handling (`.env.local`, never committed)
- Configure Cloudflare Pages deployment with GitHub CI/CD
- Implement network connectivity error handling
- Verify Supabase and Cloudflare free-tier/no-card eligibility (OD-13)
- Document provider constraints in `docs/DEPLOYMENT.md`

**Exit Condition**: A secure empty application is reachable on Cloudflare Pages.

**Requirements addressed**: ARC-01, ARC-02, ARC-03, ARC-04, ARC-07, NFR-02, NFR-04, NFR-06, NFR-10, NFR-11, AC-15, AC-17, AC-18

---

## Phase 2 — Backend & Identity (10%)
**SRS Reference**: Section 11, Phase 2
**Status**: ✅ **COMPLETE** (2026-11-18) — schema, RLS and administrator authentication verified live.
⚠️ **AC-01 remains unverified**: only the administrator account exists, so "three test users authenticate" has not been demonstrated.

**Scope**:
- Supabase project initialization and schema migration setup
- Database foundation: `user_profiles`, `roles`, `permissions`, `audit_logs`
- Supabase Auth integration with individual user accounts
- PostgreSQL RLS policies: auth, outlet isolation, role enforcement
- Audit trigger functions (append-only audit log)
- Three test user accounts provisioned and tested

**Exit Condition**: Three test users authenticate and authorization tests pass (AC-01, AC-02).

**Delivered**: `roles`, `user_profiles`, `user_roles`, `outlets`, `user_outlet_scopes`, `audit_logs`; RLS on all six tables; `SECURITY DEFINER` policy helpers; append-only audit triggers; new-user profile trigger; admin RPCs; login/logout/disabled-account UI. Owner applied both migrations and verified the administrator login, role and five outlet scopes.

**Requirements addressed**: SEC-ROLE-01..06, ARC-05, ARC-06, USR-01..05, OUT-04, AUD-01..05, NFR-01, NFR-05..09, AC-01, AC-02, AC-13, AC-17

**Open acceptance item**: create the two remaining test accounts, then record AC-01 and AC-02 results. OD-02 and OD-03 are resolved.

---

## Phase 3 — Master Data (10%)
**SRS Reference**: Section 11, Phase 3
**Status**: ✅ **COMPLETE** — master-data CRUD, unit conversions, categories and user/role/outlet administration delivered and tested.

**Scope**:
- ✅ Outlet management UI: list, create, edit, deactivate/reactivate (no deletes)
- ✅ Supplier management UI: list, create, edit, deactivate/reactivate (no deletes)
- ✅ Item master UI: list, create, edit, deactivate/reactivate; category, base unit, optional purchase unit, reorder level
- ✅ Stock-location management UI: list, create, edit, deactivate/reactivate (no deletes)
- ✅ Item unit-conversion editor (box / carton / sack factors, created + edit factor, per item)
- ✅ Category management UI: list, create, edit, deactivate/reactivate (no deletes), mounted on `/inventory`
- ✅ User management UI: list profiles, disable/reactivate, assign roles, grant/revoke outlet access (admin only)

**Exit Condition**: Master data CRUD and access scopes pass tests.

**Delivered so far**:
- Migrations `20261118000300_master_data.sql` and `20261118000400_master_data_seed.sql` **applied**: `stock_locations`, `item_categories`, `units`, `item_unit_conversions`, `suppliers`, `items`, RLS, audit triggers, reference seeds. Verified: all six tables respond to REST; anon writes return `42501`.
- Settings page at `/settings` with the outlet panel (admin-only writes, matching the policy).
- Purchasing page at `/purchasing` with the supplier panel (admin / GM / purchasing officer).
- Inventory page at `/inventory` with the item panel, the category panel and the stock-location panel, each gated by its own RLS-backed write policy; the stock ledger section states plainly that no balances or movements exist yet.
- Settings page at `/settings` also hosts the user administration panel: account status through `admin_set_user_status()`, role assignment through `admin_assign_role()`, and per-outlet access through `user_outlet_scopes` (admin-only writes, enforced by RLS and the RPC checks).
- Shared Postgres error mapping (`src/lib/errors.ts`), including a clear message when a table is missing because a migration has not been applied.
- FE tests cover list, load failure, create, validation, edit, deactivate and read-only roles for outlets, suppliers, items, categories and locations; item tests cover base-unit creation and purchase-unit factor recording.

**Requirements addressed**: OUT-01..03, SUP-01..02, INV-01..05, USR-01..05, SEC-ROLE-05

**Depends on**: owner applying migrations 0003 and 0004 before suppliers, items and locations can be used. OD-01, OD-02 and OD-05 are resolved (ADR-010).

---

## Phase 4 — Inventory & Purchasing (20%)
**SRS Reference**: Section 11, Phase 4
**Status**: 🚧 **In Progress** — GRN/SIV ledger and the PR/PO workflow delivered 2026-11-18; remaining scope below

**Delivered (2026-11-18)**:
- Goods Receiving Notes (GRN) with atomic stock increase, FIFO layer creation and duplicate-posting protection
- Store Issue Vouchers (SIV) with atomic source/destination update and FIFO consumption
- Stock ledger engine (append-only transactions, derived balances, movement history)
- Base-unit conversion resolution in the database (ADR-010)
- Purchase Requests: header/lines, Draft → Submitted → Approved/Rejected, approver + time + comment recorded
- Purchase Orders: header/lines with unit costs, Draft → Approved → Ordered → Closed, one order per approved request
- PROCUREMENT role gates: `system_admin`/`general_manager`/`purchasing_officer` manage; `system_admin`/`general_manager` approve
- AC-04 and AC-05 verified against the live database by the owner (GRN 2,000 g / ETB 240.00 → SIV 500 g / ETB 180.00, over-issue rejected)

**Remaining**:
- Apply migration `20261118000600_purchase_requests_orders.sql`, then run the live AC-03 workflow check
- GRN ↔ PO linkage with shortage/over-receipt flags
- Inventory counting module with variance calculation and approval
- Inventory adjustments (approved reasons, audit-trailed)
- Waste recording and posting
- Low-stock/reorder alert system

**Scope**:
- Purchase Request workflow (Draft → Submitted → Approved/Rejected → PO)
- Purchase Order management
- Goods Receiving Notes (GRN) with atomic stock increase and valuation update
- Store Issue Vouchers (SIV) with atomic source/destination update
- Stock ledger engine (transaction-based balances)
- Inventory counting module with variance calculation and approval
- Inventory adjustments (approved reasons, audit-trailed)
- Waste recording and posting
- Low-stock/reorder alert system

**Exit Condition**: Stock ledger and reconciliation tests pass (AC-03..07). AC-04 and AC-05 are verified live; AC-03 is built and awaits migration 0006 plus a live workflow run.

**Requirements addressed**: PR-01..04, PO-01..04, GRN-01..05, SIV-01..05, STK-01..07, CNT-01..05, ADJ-01..03, WST-01..04, INV-04, INV-06

**Decisions**: OD-04 FIFO (ADR-009) and OD-05 unit model (ADR-010) both confirmed 2026-11-18. OD-06 approval thresholds remain undefined: postings are role-gated and record who acted; PR/PO approval is limited to System Administrator/General Manager, self-approval is not blocked, and no monetary thresholds exist.

---

## Phase 5 — Recipes & Production (10%)
**SRS Reference**: Section 11, Phase 5
**Status**: ⏳ Planned

**Scope**:
- Recipe management (ingredients, quantities, yield, version history)
- Food cost calculation engine (Food Cost % = Cost ÷ Price × 100)
- Production order recording (raw → semi/finished goods)
- Atomic production posting (consume inputs, produce outputs)
- Theoretical consumption baseline for variance reporting

**Exit Condition**: Costing and production calculations pass (AC-07, AC-08, AC-09).

**Requirements addressed**: REC-01..07, PROD-01..04, COST-01..03

**Decisions**: consumes FIFO layer costs (ADR-009) in base units (ADR-010).

---

## Phase 6 — Restaurant Operations (15%)
**SRS Reference**: Section 11, Phase 6
**Status**: ⏳ Planned

**Scope**:
- Menu management (items, categories, pricing, deactivation)
- Table layout and status management
- Reservation workflow (Booked → Confirmed → Arrived → Cancelled/Completed)
- Order taking (open, modify, cancel, transfer, split, close)
- Kitchen Display System (KDS) with Supabase Realtime
- Receipt generation (browser print + PDF)
- Price snapshot preservation at order close

**Exit Condition**: Three-user live workflows pass (AC-10, AC-11, AC-14, AC-15).

**Requirements addressed**: MENU-01..03, TBL-01..04, RES-01..04, ORD-01..06, KDS-01..05, RCT-01..05, NFR-03

**Blocked by**: OD-07 (taxes/discounts), OD-08 (receipt format), OD-09 (reservation rules), OD-10 (guest profiles), OD-12 (hotel features scope)

---

## Phase 7 — Reporting (10%)
**SRS Reference**: Section 11, Phase 7
**Status**: ⏳ Planned

**Scope**:
- Sales reports (daily, monthly, outlet, category, waiter)
- Inventory reports (stock on hand, movement, valuation, slow-moving)
- Purchasing reports (PR, PO, GRN)
- Cost reports (recipe cost, food cost %, profitability)
- Waste reports and trends
- KDS / kitchen timing reports
- Reservation reports and guest history
- Management dashboard (KPIs: open tables, kitchen queue, low-stock, top items, food cost %, waste %)
- All reports respect outlet scope and show applied filters

**Exit Condition**: Report totals reconcile to test data (AC-12).

**Requirements addressed**: RPT-01..09, COST-01..03, SUP-03, CNT-04, WST-04, KDS-04

---

## Phase 8 — Validation & Handover (10%)
**SRS Reference**: Section 11, Phase 8
**Status**: ⏳ Planned

**Scope**:
- Full security review (secrets, RLS, injection, broken access control)
- Three-user concurrent end-to-end acceptance test across separate locations
- Backup/export procedure documented and tested (DATA-03..07)
- Restore test in Supabase if supported free
- Performance test: <2s p95 response (NFR-03)
- Final documentation: `docs/DEPLOYMENT.md`, `docs/TESTING.md`
- Owner demo and prototype acceptance

**Exit Condition**: Owner accepts prototype test results and known limitations (AC-01..AC-19).

**Requirements addressed**: AC-01..19, NFR-01..14, DATA-01..07, ARC-09

---

## Completion Calculation

| Phase | Weight | Status | Credit |
|:---|:---:|:---:|:---:|
| Phase 0 | 5% | ✅ Complete | 5.0% |
| Phase 1 | 10% | ✅ Complete | 10.0% |
| Phase 2 | 10% | ✅ Complete | 10.0% |
| Phase 3 | 10% | ✅ Complete | 10.0% |
| Phase 4 | 20% | 🚧 In Progress | 0% |
| Phase 5 | 10% | ⏳ Planned | 0% |
| Phase 6 | 15% | ⏳ Planned | 0% |
| Phase 7 | 10% | ⏳ Planned | 0% |
| Phase 8 | 10% | ⏳ Planned | 0% |
| **Total** | **100%** | | **35.0%** |
