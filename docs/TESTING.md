# Albena RMS — Testing Strategy, Test Cases & Results

**Created**: 2026-11-17 | **SRS Reference**: Section 10 (AC-01..AC-19), NFR-01..14
**Status**: Phase 0 — Strategy defined; test cases to be populated as phases complete

---

## 1. Testing Philosophy

- No feature is accepted without at least one test case linked to its SRS requirement ID.
- Automated tests cover critical business logic (stock calculations, costing formulas, RLS policies).
- Manual tests cover UI workflows, concurrent user scenarios and receipt output.
- Security tests explicitly verify that RLS/server-side authorization blocks unauthorized access.
- All tests use **synthetic/demo data only** (NFR-14).

---

## 2. Test Types

| Type | Tool / Method | Coverage Target |
|:---|:---|:---|
| **Unit tests** | Vitest | Business logic functions (food cost %, stock balance, costing) |
| **Integration tests** | Vitest + Supabase local dev | DB transactions, RLS policies, atomic operations |
| **End-to-end (E2E)** | Playwright (or manual protocol) | Full user workflows across phases |
| **Concurrency tests** | Manual — 3 separate sessions | AC-01, AC-05, AC-10, AC-14 |
| **Security tests** | Manual + Supabase SQL console | AC-02, AC-17; unauthorized access attempts |
| **Performance tests** | Browser DevTools + network timing | NFR-03 (<2s p95) |
| **Backup/recovery tests** | Manual Supabase export | AC-16, DATA-04, DATA-06 |

---

## 3. Acceptance Test Cases (from SRS Section 10)

| AC ID | Test Description | Preconditions | Steps | Expected Result | Phase | Status | Date Tested | Tester |
|:---|:---|:---|:---|:---|:---:|:---:|:---:|:---:|
| AC-01 | 3 users sign in concurrently from different locations | 3 test accounts created | Each user signs in from a separate device/location simultaneously | All three are authenticated and see authorized workspace | 2 | Not Started | — | — |
| AC-02 | Role/outlet permissions enforced by DB | RLS policies active | Attempt cross-role and cross-outlet access | Unauthorized attempts return 403/denied; no data leaked | 2 | Not Started | — | — |
| AC-03 | PR → Approve/Reject → PO workflow | Purchasing Officer + Manager accounts | Submit PR, approve, convert to PO | PO created from approved PR; rejection cancels PR | 4 | Not Started | — | — |
| AC-04 | GRN posted once; updates stock and valuation | Active PO, Storekeeper account | Post GRN; attempt re-post | Stock increases correctly; second post rejected | 4 | Not Started | — | — |
| AC-05 | SIV atomic; traceable movements | Stock available in source location | Post SIV; verify source reduced, dest increased | Both balances correct; stock_transactions records created | 4 | Not Started | — | — |
| AC-06 | Count variance calculated; adj reconciles ledger | Stock with known balance | Create count with variance; approve; post adjustment | Ledger balance matches physical count after adjustment | 4 | Not Started | — | — |
| AC-07 | Waste and production update inventory | Stock available | Post waste; post production; verify balances | Waste decreases stock; production consumes inputs and creates output | 4,5 | Not Started | — | — |
| AC-08 | Recipe costing and food cost % verified | Recipe with ingredients and selling price | Calculate food cost | Food Cost % = Cost ÷ Price × 100; matches manual calc | 5 | Not Started | — | — |
| AC-09 | Menu sales don't deduct stock; theoretical separate | Active menu items and orders | Close order; check stock | Stock unchanged; theoretical consumption report shows expected usage | 5,6 | Not Started | — | — |
| AC-10 | Orders appear on KDS; status visible across users | 2 connected sessions (Waiter + Kitchen) | Waiter sends order; kitchen updates status | Kitchen sees order in real time; waiter sees Ready status | 6 | Not Started | — | — |
| AC-11 | Table/reservation/order/receipt workflows | Full setup (tables, menu, users) | End-to-end: reserve → seat → order → receipt | All steps complete per permissions; receipt generated | 6 | Not Started | — | — |
| AC-12 | Reports/dashboard reconcile to test data | Known test transactions | Generate reports for test period | Totals match sum of test transactions; scope respected | 7 | Not Started | — | — |
| AC-13 | Critical actions produce audit events | Audit log active | Perform create/modify/post/approve/cancel actions | Audit log records actor, timestamp, action, record ref | 2+ | Not Started | — | — |
| AC-14 | Concurrent edits don't silently overwrite | 2 users editing same record | Both submit edits simultaneously | Conflict visible and recoverable; no silent data loss | 6 | Not Started | — | — |
| AC-15 | App shows clear error on network failure | Running app | Disconnect network; attempt save | Clear error message; no false success claim | 1 | Not Started | — | — |
| AC-16 | Backup/export documented and tested | Supabase free plan configured | Follow documented export procedure | Export completes; data verifiable | 8 | Not Started | — | — |
| AC-17 | No secrets in repo or browser-delivered code | — | Inspect repo; inspect browser network/source | No secrets found | 0 | **In Progress** | 2026-11-17 | AGY |
| AC-18 | Free-tier/no-card eligibility checked and recorded | — | Review provider terms; document in DEPLOYMENT.md | Eligibility confirmed; limits documented | 0 | Not Started | — | — |
| AC-19 | Owner reviews open decisions and approves next phase | OD-01..13 raised | Owner provides answers; decisions recorded | All blocking ODs resolved before phase start | 0 | **In Progress** | 2026-11-17 | Owner |

---

## 4. Unit Test Cases (to be expanded per phase)

| Test ID | Function / Module | Input | Expected Output | SRS Req | Status |
|:---|:---|:---|:---|:---:|:---:|
| UT-01 | `calculateFoodCostPct(cost, price)` | cost=50, price=200 | 25.0% | REC-04 | Not Started |
| UT-02 | `calculateFoodCostPct(cost, price)` | price=0 | Error / divide-by-zero handled | REC-04 | Not Started |
| UT-03 | `calculateRecipeCost(ingredients)` | 3 ingredients with quantity and unit cost | Sum of line costs | REC-03 | Not Started |
| UT-04 | Stock balance after GRN post | Opening=10, GRN qty=5 | Balance=15 | STK-01, GRN-03 | Not Started |
| UT-05 | Stock balance after SIV post | Source=10, SIV qty=4 | Source=6, Dest+4 | SIV-03 | Not Started |
| UT-06 | Negative stock rejection | Available=2, SIV qty=5 | Error returned | SIV-05 | Not Started |
| UT-07 | Inventory variance calculation | System qty=10, Physical qty=8 | Variance=-2 | CNT-02 | Not Started |
| UT-08 | Duplicate GRN post prevention | GRN already posted | Error / idempotency | GRN-05 | Not Started |
| UT-09 | Timestamp timezone safety | UTC timestamp stored | Displayed in business timezone | NFR-09 | Not Started |

---

## 5. Defects Log

| Defect ID | Phase Discovered | Description | Severity | Status | Resolved In |
|:---|:---:|:---|:---:|:---:|:---:|
| (None yet) | | | | | |

---

## 6. Test Execution Summary by Phase

| Phase | Total ACs | Passed | Failed | Not Tested | Completion |
|:---|:---:|:---:|:---:|:---:|:---:|
| Phase 0 | AC-17, AC-18, AC-19 | 0 | 0 | 3 | 0% |
| Phase 1 | AC-15, AC-17 | 0 | 0 | 2 | 0% |
| Phase 2 | AC-01, AC-02, AC-13, AC-17 | 0 | 0 | 4 | 0% |
| Phase 3 | (master data smoke tests) | 0 | 0 | — | 0% |
| Phase 4 | AC-03..07 | 0 | 0 | 5 | 0% |
| Phase 5 | AC-07..09 | 0 | 0 | 3 | 0% |
| Phase 6 | AC-10..11, AC-14..15 | 0 | 0 | 4 | 0% |
| Phase 7 | AC-12 | 0 | 0 | 1 | 0% |
| Phase 8 | AC-01..19 (full) | 0 | 0 | 19 | 0% |
