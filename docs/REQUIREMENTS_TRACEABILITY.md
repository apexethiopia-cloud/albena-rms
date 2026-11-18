# Albena RMS — Requirements Traceability Matrix

**Authoritative Source**: `docs/SRS_v3.0.md` (approved 2026-11-17)
**Last Updated**: 2026-11-17

> A requirement is NOT complete merely because code exists. Each row must have implementation evidence, a migration reference, a test case reference and a verified status before it can be marked Accepted.

**Status legend**: `Not Started` | `In Progress` | `Implemented` | `Tested` | `Accepted`

---

## Section 2 — Constraints (CON)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| CON-01 | Internet required; no offline/LAN mode | 0 | — | Architecture decision; no offline code | AC-15, NFR-04 | Not Started |
| CON-02 | Three distinct cloud user accounts | 2 | `users`, `user_profiles` | Auth module, `scripts/seed-test-users.mjs` | AC-01 | **In Progress** — 1 of 3 accounts exists |
| CON-03 | No paid services without owner approval | 0 | — | Policy; docs/QUOTA_LOG.md | — | Not Started |
| CON-04 | Setup must not require bank card | 0 | - | docs/DEPLOYMENT.md provider check | AC-18 | **Implemented** |
| CON-05 | Existing DigitalOcean/Odoo untouched | 0 | — | Policy — no connection to that infra | — | Not Started |
| CON-06 | Public repo — no secrets committed | 0 | — | .gitignore, .env.example | AC-17 | **Implemented** |
| CON-07 | Uncertainty recorded as open decision | 0 | — | docs/DECISIONS.md OD-01..13 | — | **In Progress** |
| CON-08 | Sales recorded; no payment processing | 6 | orders, receipts | POS module; no payment gateway | AC-11, RCT-04 | Not Started |

---

## Section 3 — Security & Roles (SEC-ROLE)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| SEC-ROLE-01 | Permissions enforced server/DB side | 2 | RLS policies | `supabase/migrations/20261118000100_foundation.sql` (applied); anon denied `audit_logs` | AC-02 | **Implemented** — AC-02 negative test still to be recorded |
| SEC-ROLE-02 | Individual accounts; no shared logins | 2 | `user_profiles` | Supabase Auth + `src/features/auth/**` | AC-01 | **Implemented** — only 1 of 3 accounts exists |
| SEC-ROLE-03 | Users only access permitted records/outlets | 2 | RLS outlet filter | `user_outlet_scopes` + RLS | AC-02 | **Implemented** — admin granted all 5 outlets |
| SEC-ROLE-04 | Role/permission changes audit logged | 2 | `audit_logs` | `write_audit_log()` on `user_roles` | AC-13 | **Implemented** |
| SEC-ROLE-05 | Disable/reactivate without deleting history | 3 | `user_profiles.status` | `admin_set_user_status()` | - | **In Progress** — RPC done, UI pending |
| SEC-ROLE-06 | No plaintext passwords in app tables | 2 | - | Supabase Auth handles credentials | - | **Implemented** |

---

## Section 4 — Architecture (ARC)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| ARC-01 | One shared cloud app and DB | 1-2 | Supabase project `naxhjpmaovnuplfjdgdu` | Cloudflare Pages + Supabase | AC-01 | **Implemented** — app deployed, schema applied |
| ARC-02 | Desktop + tablet responsive | 1 | - | `src/components/layout/AppShell.tsx` (Tailwind responsive classes) | Manual UI test | **Implemented** |
| ARC-03 | No service-role key in frontend | 1 | - | `.env.example`; `src/lib/env.ts` (only `VITE_*` values) | AC-17 | **Implemented** |
| ARC-04 | Only anon/publishable keys in client | 1 | — | `src/lib/supabase.ts` (publishable key only, verified in bundle) | AC-17 | **Implemented** |
| ARC-05 | DB schema changes as migration files | 2+ | All migrations | `supabase/migrations/` (0001–0004) | - | **Implemented** |
| ARC-06 | Multi-step ops atomic in DB transactions | 4+ | DB functions | Supabase RPC functions | AC-05 | Not Started |
| ARC-07 | Clear error state on connectivity loss | 1 | - | `src/components/NetworkStatusBanner.tsx` | AC-15, `NetworkStatusBanner.test.tsx` | **Implemented** |
| ARC-08 | No offline queue or background sync | 0 | — | Architecture decision; not implemented | — | Not Started |
| ARC-09 | Re-verify provider free-tier before launch | 0,8 | - | docs/DEPLOYMENT.md | AC-18 | **In Progress** — OD-13 confirmed, re-verify at Phase 8 |

---

## Section 5.1 — User Management (USR)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| USR-01 | Create, edit, disable, reactivate users | 3 | `user_profiles` | Supabase Auth (create) + `admin_set_user_status()` | — | **In Progress** — account creation is dashboard/script only; admin UI pending |
| USR-02 | Assign roles and permissions | 3 | `user_roles` | `admin_assign_role()` RPC | AC-02 | **In Progress** — RPC done, UI pending |
| USR-03 | Password reset via auth provider | 2 | — | Supabase Auth reset flow | — | Not Started |
| USR-04 | Record user metadata; no raw passwords | 2 | `user_profiles` | `handle_new_user()` trigger, `full_name` | — | **Implemented** |
| USR-05 | Audit user/role changes | 2 | `audit_logs` | Triggers on `user_profiles`, `user_roles` | AC-13 | **Implemented** |

---

## Section 5.2 — Outlet Management (OUT)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| OUT-01 | Multiple outlets supported | 3 | `outlets` | `src/features/outlets/**`, `/settings` | `Settings.test.tsx` | **Implemented** — 5 outlets seeded; CRUD covered by tests |
| OUT-02 | Outlet-specific orders/reports | 3,7 | `orders.outlet_id` | Report filters | RPT-01,02 | Not Started |
| OUT-03 | Users scoped to one or more outlets | 3 | `user_outlet_scopes` | RLS outlet filter | AC-02 | **Implemented** — scopes granted; UI pending |
| OUT-04 | Prevent cross-outlet access by default | 2 | RLS policies | RLS row filter | AC-02 | **Implemented** — anon reads filtered; AC-02 negative test pending |

---

## Section 5.3 — Supplier Management (SUP)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| SUP-01 | Supplier master data fields | 3 | `suppliers` | `20261118000300_master_data.sql`, `src/features/suppliers/**` | — | **In Progress** — UI written; migration not applied |
| SUP-02 | CRUD and deactivate suppliers | 3 | `suppliers` | `SuppliersPanel.tsx` (create, edit, deactivate) | `Suppliers.test.tsx` | **In Progress** — UI written; migration not applied |
| SUP-03 | Supplier history and performance reports | 7 | — | Report queries | RPT-03 | Not Started |

---

## Section 5.4 — Inventory Items & Locations (INV)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| INV-01 | Item master data fields | 3 | `items` | `src/features/items/**`, `/inventory` | `Items.test.tsx` | **Implemented** — needs authenticated integration check |
| INV-02 | Item categories (user-maintainable) | 3 | `item_categories` | Seed + RLS applied; selectable in the item form | — | **In Progress** — category CRUD UI pending |
| INV-03 | Multiple stock locations | 3 | `stock_locations` | `src/features/locations/**`, `/inventory` | `Locations.test.tsx` | **Implemented** - needs authenticated integration check |
| INV-04 | Stock balances by item + location | 4 | `stock_balances` | Stock ledger view | AC-04,05 | Not Started |
| INV-05 | Deactivate items; preserve history | 3 | `items.is_active` | `ItemsPanel.tsx` toggle | `Items.test.tsx` | **Implemented** |
| INV-06 | Low-stock/reorder alerts | 4 | `inventory_items.reorder_level` | Alert component | RPT-08 | Not Started |

---

## Section 5.5 — Purchase Requests (PR)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| PR-01 | PR header fields | 4 | `purchase_requests` | `/procurement/pr` | AC-03 | Not Started |
| PR-02 | PR statuses | 4 | `purchase_requests.status` | Status workflow | AC-03 | Not Started |
| PR-03 | PR workflow: submit→approve→PO | 4 | `purchase_requests`, `purchase_orders` | Approval workflow | AC-03 | Not Started |
| PR-04 | Record approver, time, comments | 4 | `purchase_requests.approved_by` | Approval UI | AC-03,13 | Not Started |

---

## Section 5.6 — Purchase Orders (PO)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| PO-01 | PO header and line fields | 4 | `purchase_orders`, `po_lines` | `/procurement/po` | — | Not Started |
| PO-02 | PO statuses | 4 | `purchase_orders.status` | Status workflow | — | Not Started |
| PO-03 | Link PO to PR | 4 | `purchase_orders.pr_id` | PO creation from PR | AC-03 | Not Started |
| PO-04 | Prevent unauthorized PO modification | 4 | RLS + DB function | Approval guard | AC-02 | Not Started |

---

## Section 5.7 — Goods Receiving Notes (GRN)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| GRN-01 | GRN header fields | 4 | `grns` | `/procurement/grn` | AC-04 | Not Started |
| GRN-02 | GRN line fields | 4 | `grn_lines` | GRN line entry | AC-04 | Not Started |
| GRN-03 | Posting increases stock and updates valuation atomically | 4 | DB function | GRN post RPC | AC-04 | Not Started |
| GRN-04 | Link GRN to PO; record shortages/over-receipts | 4 | `grns.po_id` | GRN-PO linkage | — | Not Started |
| GRN-05 | Prevent duplicate GRN posting | 4 | `grns.posted_at` | Idempotency guard | — | Not Started |

---

## Section 5.8 — Store Issue Vouchers (SIV)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| SIV-01 | SIV header fields | 4 | `sivs` | `/inventory/siv` | AC-05 | Not Started |
| SIV-02 | SIV line fields | 4 | `siv_lines` | SIV line entry | AC-05 | Not Started |
| SIV-03 | Posting updates source and destination atomically | 4 | DB function | SIV post RPC | AC-05 | Not Started |
| SIV-04 | Linked stock movements and audit events | 4 | `stock_transactions`, `audit_logs` | Stock movement trigger | AC-05,13 | Not Started |
| SIV-05 | Reject negative-stock transactions | 4 | DB function constraint | Stock check in RPC | — | Not Started |

---

## Section 5.9 — Inventory Counting (CNT)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| CNT-01 | Count sheet header | 4 | `inventory_counts` | `/inventory/counts` | AC-06 | Not Started |
| CNT-02 | Variance per line | 4 | `count_lines` | Count entry UI | AC-06 | Not Started |
| CNT-03 | Review and approval before adjustment posting | 4 | `inventory_counts.status` | Approval workflow | AC-06 | Not Started |
| CNT-04 | Variance and accuracy reports | 7 | — | Report queries | RPT-02 | Not Started |
| CNT-05 | Preserve original count and approval history | 4 | `audit_logs` | Append-only audit | AC-13 | Not Started |

---

## Section 5.10 — Inventory Adjustments (ADJ)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| ADJ-01 | +/- adjustments for approved reasons | 4 | `inventory_adjustments` | `/inventory/adjustments` | AC-06 | Not Started |
| ADJ-02 | Require approval per role config | 4 | RLS + workflow | Approval gate | AC-02 | Not Started |
| ADJ-03 | Post to stock ledger; never overwrite balances | 4 | `stock_transactions` | Adjustment post RPC | AC-06 | Not Started |

---

## Section 5.11 — Waste Management (WST)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| WST-01 | Waste record fields | 4 | `waste_records` | `/inventory/waste` | AC-07 | Not Started |
| WST-02 | Waste types supported | 4 | `waste_records.reason` | Waste type enum | AC-07 | Not Started |
| WST-03 | Post approved waste as inventory decrease | 4 | DB function | Waste post RPC | AC-07 | Not Started |
| WST-04 | Waste cost and trend reports | 7 | — | Report queries | RPT-05 | Not Started |

---

## Section 5.12 — Production (PROD)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| PROD-01 | Record raw→semi/finished production | 5 | `production_orders` | `/kitchen/production` | AC-07 | Not Started |
| PROD-02 | Production record fields | 5 | `production_orders` | Production form | AC-07 | Not Started |
| PROD-03 | Post: decrease inputs, increase output atomically | 5 | DB function | Production post RPC | AC-07 | Not Started |
| PROD-04 | Production history and traceable movements | 5 | `stock_transactions` | Stock ledger | — | Not Started |

---

## Section 5.13 — Recipe Management (REC)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| REC-01 | Recipe master data fields | 5 | `recipes`, `recipe_ingredients` | `/kitchen/recipes` | AC-08 | Not Started |
| REC-02 | Create/edit with version history | 5 | `recipe_versions` | Recipe version UI | AC-08 | Not Started |
| REC-03 | Calculate cost, selling price, GP, food cost % | 5 | DB computed or function | Recipe costing calc | AC-08 | Not Started |
| REC-04 | Food Cost % = Cost ÷ Price × 100 | 5 | — | Costing formula | AC-08 | Not Started |
| REC-05 | Use recipes for costing, engineering, theoretical consumption | 5,7 | — | Costing + reports | AC-08,09 | Not Started |
| REC-06 | Recipes do NOT auto-deduct stock | 5 | — | No auto-deduction logic | AC-09 | Not Started |
| REC-07 | Theoretical consumption uses recipe versions + sales | 7 | — | Variance report query | COST-01 | Not Started |

---

## Section 5.14 — Menu Management (MENU)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| MENU-01 | Menu item fields | 6 | `menu_items` | `/menu/items` | — | Not Started |
| MENU-02 | Menu categories | 6 | `menu_categories` | Category management | — | Not Started |
| MENU-03 | Deactivate items; preserve historical descriptions/prices | 6 | `menu_items.status` | Menu management | RCT-05 | Not Started |

---

## Section 5.15 — Table Management (TBL)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| TBL-01 | Display table layout and status | 6 | `tables` | Floor plan view | AC-11 | Not Started |
| TBL-02 | Table statuses | 6 | `tables.status` | Status management | AC-11 | Not Started |
| TBL-03 | Merge, split, transfer per permissions | 6 | DB function | Table ops RPC | AC-11 | Not Started |
| TBL-04 | Prevent conflicting simultaneous assignments (server-side) | 6 | DB function + lock | Concurrency guard | AC-14 | Not Started |

---

## Section 5.16 — Reservation Management (RES)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| RES-01 | Reservation record fields | 6 | `reservations` | `/reservations` | AC-11 | Not Started |
| RES-02 | Reservation statuses | 6 | `reservations.status` | Status workflow | AC-11 | Not Started |
| RES-03 | Reservation summary and guest history | 7 | — | Report queries | RPT-07 | Not Started |
| RES-04 | Detect/flag overlapping reservations | 6 | DB constraint | Overlap check | OD-09 | Not Started |

---

## Section 5.17 — Order Taking (ORD)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| ORD-01 | Open/modify/cancel/transfer/split/close orders | 6 | `orders` | POS order module | AC-11 | Not Started |
| ORD-02 | Order header fields | 6 | `orders` | Order form | AC-11 | Not Started |
| ORD-03 | Order line fields (price snapshot) | 6 | `order_lines` | Order line entry | RCT-05 | Not Started |
| ORD-04 | Order statuses | 6 | `orders.status` | Status workflow | AC-10 | Not Started |
| ORD-05 | Concurrent edits handled visibly | 6 | Optimistic locking / realtime | Conflict handler | AC-14 | Not Started |
| ORD-06 | Cancellation/modifications audited | 6 | `audit_logs` | Audit trigger | AC-13 | Not Started |

---

## Section 5.18 — Kitchen Display System (KDS)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| KDS-01 | Display order info + elapsed time | 6 | — | `/kds` view | AC-10 | Not Started |
| KDS-02 | Kitchen staff update Preparing/Ready | 6 | `orders.status` | KDS action buttons | AC-10 | Not Started |
| KDS-03 | Sync status changes via Supabase Realtime | 6 | — | Realtime subscription | AC-10 | Not Started |
| KDS-04 | Prep-time and delayed-order reporting | 7 | — | Report queries | RPT-06 | Not Started |
| KDS-05 | KDS requires internet; no offline KDS | 0 | — | Architecture decision | CON-01 | Not Started |

---

## Section 5.19 — Receipt Generation (RCT)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| RCT-01 | Receipt fields and format | 6 | `receipts` | Receipt generator | AC-11 | Not Started |
| RCT-02 | Browser print + PDF output | 6 | — | Print/PDF component | AC-11 | Not Started |
| RCT-03 | Record sales/closure/receipt reference | 6 | `receipts` | Order close workflow | — | Not Started |
| RCT-04 | No payment credentials collected/stored | 6 | — | No payment gateway code | — | Not Started |
| RCT-05 | Preserve item descriptions/prices at time of sale | 6 | `order_lines.price_snapshot` | Order line snapshot | — | Not Started |

---

## Section 5.20 — Stock Movement (STK)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| STK-01 | Balances from transactions only | 4 | `stock_transactions` | Stock ledger engine | — | Not Started |
| STK-02 | Stock increases defined | 4 | `stock_transactions.type` | Transaction types | AC-04 | Not Started |
| STK-03 | Stock decreases defined | 4 | `stock_transactions.type` | Transaction types | AC-05 | Not Started |
| STK-04 | Counts verify; variances via adjustments | 4 | `inventory_adjustments` | Count reconciliation | AC-06 | Not Started |
| STK-05 | Menu sales do NOT deduct stock | 6 | — | No auto-deduction | AC-09 | Not Started |
| STK-06 | Stock ledger record fields | 4 | `stock_transactions` | Ledger schema | — | Not Started |
| STK-07 | Prevent duplicate posting; preserve reversals | 4 | Idempotency key | Post guard | — | Not Started |

---

## Section 5.21 — Cost Control (COST)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| COST-01 | Theoretical vs actual consumption comparison | 7 | — | Variance report | — | Not Started |
| COST-02 | Food-cost, inventory, waste, dept-consumption variance | 7 | — | Report queries | RPT-04,05 | Not Started |
| COST-03 | Report identifies period, outlet, recipe version, assumptions | 7 | — | Report metadata | — | Not Started |

---

## Section 5.22 — Reporting (RPT)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| RPT-01 | Sales reports | 7 | — | `/reports/sales` | AC-12 | Not Started |
| RPT-02 | Inventory reports | 7 | — | `/reports/inventory` | AC-12 | Not Started |
| RPT-03 | Purchasing reports | 7 | — | `/reports/purchasing` | AC-12 | Not Started |
| RPT-04 | Cost reports | 7 | — | `/reports/costing` | AC-12 | Not Started |
| RPT-05 | Waste reports | 7 | — | `/reports/waste` | AC-12 | Not Started |
| RPT-06 | Kitchen / KDS timing reports | 7 | — | `/reports/kitchen` | AC-12 | Not Started |
| RPT-07 | Reservation reports | 7 | — | `/reports/reservations` | AC-12 | Not Started |
| RPT-08 | Management dashboard | 7 | — | `/dashboard` | AC-12 | Not Started |
| RPT-09 | Reports respect outlet scope and show filters | 7 | — | Report filter components | AC-12 | Not Started |

---

## Section 5.23 — Audit Trail (AUD)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| AUD-01 | Log: login/logout, create, modify, post, cancel, approve, role changes | 2+ | `audit_logs` | Triggers on identity/master-data tables | AC-13 | **In Progress** — data changes logged; auth login/logout events not logged |
| AUD-02 | Capture: timestamp, actor, action, record ref, before/after | 2+ | `audit_logs` | `write_audit_log()` | AC-13 | **Implemented** |
| AUD-03 | Audit records append-only for ordinary users | 2 | RLS on `audit_logs` | No delete/update policy; grants revoked; anon denied `42501` | AC-13 | **Implemented** |
| AUD-04 | Audit access restricted to authorized roles | 2 | RLS on `audit_logs` | Admin / GM / auditor select policy | AC-02 | **Implemented** |
| AUD-05 | No passwords or tokens in logs | 2 | - | Audit triggers never read `auth.users` secrets | - | **Implemented** |

---

## Section 6 — Non-Functional Requirements (NFR)

| Req ID | Description Summary | Phase | Verification Method | Status |
|:---|:---|:---:|:---|:---:|
| NFR-01 | 3 concurrent authenticated users | 2 | Concurrency test AC-01 | Not Started |
| NFR-02 | Architecture allows future growth | 1–2 | Architecture review | Not Started |
| NFR-03 | <2s response for 95% of requests | 6–8 | Performance test | Not Started |
| NFR-04 | Clear loading/error/retry feedback | 1 | Manual UI test | Not Started |
| NFR-05 | Data persists and visible to authorized users | 2 | Concurrency test | Not Started |
| NFR-06 | HTTPS + secure session handling | 1–2 | Deployment check | Not Started |
| NFR-07 | Least-privilege DB access + RLS + server-side validation | 2 | Security test AC-02 | Not Started |
| NFR-08 | Input validation client + server; injection protection | 2+ | Security test | Not Started |
| NFR-09 | Timezone-safe timestamps | 2 | Unit test | Not Started |
| NFR-10 | Responsive desktop + tablet | 1 | Manual UI test | **In Progress** — responsive shell, device test pending |
| NFR-11 | TypeScript, modular, linting, tests for critical logic | 1+ | CI check | **In Progress** — strict TS, ESLint, Vitest, CI workflow |
| NFR-12 | No claimed uptime/backups beyond verified plan | 0,8 | docs/DEPLOYMENT.md | Not Started |
| NFR-13 | Provider quotas and limits documented and monitored | 0,8 | docs/DEPLOYMENT.md | Not Started |
| NFR-14 | Synthetic data only in prototype | 0 | Policy | **In Progress** |

---

## Section 7 — Data Integrity (DATA)

| Req ID | Description Summary | Phase | Verification Method | Status |
|:---|:---|:---:|:---|:---:|
| DATA-01 | Relational constraints, FK, UUID, transactions | 2+ | Schema review | Not Started |
| DATA-02 | No physical delete of posted transactions/audit | 2+ | RLS policy + DB constraint | Not Started |
| DATA-03 | Document actual backup/recovery of free plan | 0,8 | docs/DEPLOYMENT.md | Not Started |
| DATA-04 | Manual export/backup procedure documented | 8 | docs/DEPLOYMENT.md | Not Started |
| DATA-05 | No assumed PITR/automated backups; must verify | 0 | docs/DEPLOYMENT.md | Not Started |
| DATA-06 | Restore test in non-prod if supported free | 8 | Test record | Not Started |
| DATA-07 | Owner informed of data-loss risks | 0 | Disclosed in docs/DEPLOYMENT.md | Not Started |

---

## Section 8 — Dev Controls (DEV)

| Req ID | Description Summary | Phase | Status |
|:---|:---|:---:|:---:|
| DEV-01 | Small descriptive commits to approved repo | Ongoing | **In Progress** |
| DEV-02 | .gitignore excludes secrets | 0 | **Implemented** |
| DEV-03 | .env.example with placeholders only | 0 | **Implemented** |
| DEV-04 | Review staged changes before commit/push | Ongoing | **In Progress** |
| DEV-05 | No force-push or destructive repo ops | Ongoing | **In Progress** |
| DEV-06 | AGY inspects repo/SRS before implementation | 0 | **Implemented** |
| DEV-07 | AGY code reviewed and tested | Ongoing | **In Progress** |
| DEV-08 | No major architecture/DB changes without approval | Ongoing | **In Progress** |

---

## Section 9 — Progress & Quota Controls (PRG / QTA)

| Req ID | Description Summary | Status |
|:---|:---|:---:|
| PRG-01 | Session-start report | **In Progress** |
| PRG-02 | Post-task documentation update | **In Progress** |
| PRG-03 | End-session handover | **In Progress** |
| PRG-04 | % calculated from milestone criteria | **In Progress** |
| QTA-01 | Quota check at session start + major tasks | **In Progress** |
| QTA-02 | Warn at 25% remaining | **In Progress** |
| QTA-03 | Stop at 15% remaining | **In Progress** |
| QTA-04 | Report 'unknown' if quota unreadable | **In Progress** |
| QTA-05 | No paid upgrade without approval | **In Progress** |
| QTA-06 | Quota report includes how/when checked | **In Progress** |

---

## Section 10 — Acceptance Criteria (AC)

| Req ID | Description | Phase | Status |
|:---|:---|:---:|:---:|
| AC-01 | 3 users sign in concurrently from different locations | 2 | Not Started |
| AC-02 | Role/outlet permissions enforced by DB; unauthorized fails | 2 | Not Started |
| AC-03 | PR submit→approve/reject→PO workflow per permissions | 4 | Not Started |
| AC-04 | GRN posted once; updates correct location and valuation | 4 | Not Started |
| AC-05 | SIV/transfer atomic; traceable stock movements | 4 | Not Started |
| AC-06 | Count variance calculated; approved adj reconciles ledger | 4 | Not Started |
| AC-07 | Waste and production update inventory correctly | 4,5 | Not Started |
| AC-08 | Recipe costing and food-cost % verified | 5 | Not Started |
| AC-09 | Menu sales don't deduct stock; theoretical consumption separate | 5,6 | Not Started |
| AC-10 | Orders appear on KDS; status visible to other users over internet | 6 | Not Started |
| AC-11 | Table/reservation/order/receipt workflows per permissions | 6 | Not Started |
| AC-12 | Reports/dashboard reconcile to test data; respect access scope | 7 | Not Started |
| AC-13 | Critical actions produce audit events | 2+ | Not Started |
| AC-14 | Concurrent edits don't overwrite; conflicts visible | 6 | Not Started |
| AC-15 | App shows clear error on network failure | 1 | **In Progress** — offline banner tested; save-failure UX pending data layer |
| AC-16 | Backup/export procedure documented and tested | 8 | Not Started |
| AC-17 | No secrets in repo or browser-delivered code | 0 | **In Progress** |
| AC-18 | Free-tier/no-card eligibility checked and recorded | 0 | Not Started |
| AC-19 | Owner reviews open decisions and approves next phase scope | 0,8 | Not Started |

---

## Open Decisions Tracking

| OD ID | Decision Required | Impact | Owner Response | Status |
|:---|:---|:---|:---|:---:|
| OD-01 | Business timezone | Daily totals, report dates | — | **Open** |
| OD-02 | One entity + multiple outlets OR multi-tenant? | DB isolation model | — | **Open** |
| OD-03 | Named test users → roles and outlet scopes | Auth and permission tests | — | **Open** |
| OD-04 | Inventory costing method (weighted average?) | Valuation calculations | — | **Open** |
| OD-05 | Unit conversion rules; purchase/storage/issue units | Stock and costing accuracy | — | **Open** |
| OD-06 | Approval thresholds and SoD rules for PR/PO/GRN/SIV/counts | Controls and fraud prevention | — | **Open** |
| OD-07 | Taxes, service charges, discounts in scope? | Receipt totals | — | **Open** |
| OD-08 | Receipt numbering, business identity, language, currency | Receipt presentation | — | **Open** |
| OD-09 | Reservation capacity rules; table assignment mandatory? | Conflict validation logic | — | **Open** |
| OD-10 | Guest profiles/history retention and privacy rules | Personal-data handling | — | **Open** |
| OD-11 | Currency and decimal precision | Money calculations | — | **Open** |
| OD-12 | Hotel features (room charges, room service) now or deferred? | Scope of Phase 6 | — | **Open** |
| OD-13 | Free-tier eligibility and backup/restore expectations | DEPLOYMENT.md content | — | **Open** |
