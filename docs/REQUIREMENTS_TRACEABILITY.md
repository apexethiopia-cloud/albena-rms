# Albena RMS — Requirements Traceability Matrix

**Authoritative Source**: `docs/SRS_v3.0.md` (approved 2026-11-17)
**Last Updated**: 2026-11-18

> A requirement is NOT complete merely because code exists. Each row must have implementation evidence, a migration reference, a test case reference and a verified status before it can be marked Accepted.

**Status legend**: `Not Started` | `In Progress` | `Implemented` | `Tested` | `Accepted`

---

## Section 2 — Constraints (CON)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| CON-01 | Internet required; no offline/LAN mode | 0 | — | Architecture decision; no offline code | AC-15, NFR-04 | Not Started |
| CON-02 | Three distinct cloud user accounts | 2 | `users`, `user_profiles` | Auth module, `scripts/seed-test-users.mjs` | AC-01 | **Implemented** — three individual accounts exist |
| CON-03 | No paid services without owner approval | 0 | — | Policy; docs/QUOTA_LOG.md | — | Not Started |
| CON-04 | Setup must not require bank card | 0 | - | docs/DEPLOYMENT.md provider check | AC-18 | **Implemented** |
| CON-05 | Existing DigitalOcean/Odoo untouched | 0 | — | Policy — no connection to that infra | — | Not Started |
| CON-06 | Public repo — no secrets committed | 0 | — | .gitignore, .env.example | AC-17 | **Implemented** |
| CON-07 | Uncertainty recorded as open decision | 0 | — | docs/DECISIONS.md OD-01..13 | — | **In Progress** |
| CON-08 | Sales recorded; no payment processing | 6 | `orders`, `receipts` (migration 0010) | `src/features/orders/**`; no payment gateway | `Operations.test.tsx`, RCT-04 | **Implemented** — orders and receipts record sales only; no payment credentials exist |

---

## Section 3 — Security & Roles (SEC-ROLE)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| SEC-ROLE-01 | Permissions enforced server/DB side | 2 | RLS policies | `supabase/migrations/20261118000100_foundation.sql` (applied); anon denied `audit_logs` | AC-02 | **Implemented** — AC-02 negative test still to be recorded |
| SEC-ROLE-02 | Individual accounts; no shared logins | 2 | `user_profiles` | Supabase Auth + `src/features/auth/**` | AC-01 | **Implemented** — three individual accounts exist |
| SEC-ROLE-03 | Users only access permitted records/outlets | 2 | RLS outlet filter | `user_outlet_scopes` + RLS | AC-02 | **Implemented** — admin granted all 5 outlets |
| SEC-ROLE-04 | Role/permission changes audit logged | 2 | `audit_logs` | `write_audit_log()` on `user_roles` | AC-13 | **Implemented** |
| SEC-ROLE-05 | Disable/reactivate without deleting history | 3 | `user_profiles.status` | `admin_set_user_status()` + `UsersPanel` | - | **Implemented** |
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
| ARC-06 | Multi-step ops atomic in DB transactions | 4+ | DB functions | SECURITY DEFINER RPCs for postings, procurement, production and orders | AC-05 | **Implemented** — each workflow step runs inside one database transaction |
| ARC-07 | Clear error state on connectivity loss | 1 | - | `src/components/NetworkStatusBanner.tsx` | AC-15, `NetworkStatusBanner.test.tsx` | **Implemented** |
| ARC-08 | No offline queue or background sync | 0 | — | Architecture decision; not implemented | — | Not Started |
| ARC-09 | Re-verify provider free-tier before launch | 0,8 | - | docs/DEPLOYMENT.md | AC-18 | **In Progress** — OD-13 confirmed, re-verify at Phase 8 |

---

## Section 5.1 — User Management (USR)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| USR-01 | Create, edit, disable, reactivate users | 3 | `user_profiles` | Supabase Auth (create) + `admin_set_user_status()` | - | **Implemented** - accounts are created in Supabase Auth (dashboard/script, since the browser holds only the publishable key); disable/reactivate and role/outlet management are in the `/settings` user panel |
| USR-02 | Assign roles and permissions | 3 | `user_roles` | `admin_assign_role()` RPC | AC-02 | **Implemented** - role assignment and per-outlet access managed from the `/settings` user panel; RLS and RPC `is_admin()` checks are the boundary |
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
| INV-04 | Stock balances by item + location | 4 | `stock_balances` view | `src/features/stock/StockPanel.tsx` | AC-04,05 | Implemented |
| INV-05 | Deactivate items; preserve history | 3 | `items.is_active` | `ItemsPanel.tsx` toggle | `Items.test.tsx` | **Implemented** |
| INV-06 | Low-stock/reorder alerts | 4 | `stock_reorder_status` view over `items.reorder_level` + `stock_transactions` (migration 0008) | `src/features/stock/LowStockPanel.tsx`, `/inventory` | `InventoryControl.test.tsx` | **Implemented** — total on-hand across locations compared with the item-level level; live UAT deferred |

---

## Section 5.5 — Purchase Requests (PR)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| PR-01 | PR header fields | 4 | `purchase_requests` (migration 0006, applied) | `src/features/procurement/PurchaseRequestsPanel.tsx`, `/purchasing` | `procurementValidation.test.ts`, `Procurement.test.tsx` | **Implemented** — live AC-03 run confirmed |
| PR-02 | PR statuses | 4 | `purchase_request_status` enum | `REQUEST_STATUS_LABELS`, status workflow | `Procurement.test.tsx` | **Implemented** — draft → submitted → approved/rejected enforced by RPC guards |
| PR-03 | PR workflow: submit→approve→PO | 4 | `submit_purchase_request()`, `decide_purchase_request()`, `create_purchase_order()` | `PurchaseRequestsPanel.tsx`, `PurchaseOrdersPanel.tsx` | `Procurement.test.tsx` | **Implemented** — live AC-03 run: approved request seeded one PO through to ordered and closed |
| PR-04 | Record approver, time, comments | 4 | `purchase_requests.decided_by`, `decided_by_name`, `decided_at`, `decision_comment` | Decision panel + list column | `Procurement.test.tsx` | **Implemented** — decision recorded by name, timestamp and optional comment; confirmed live |

---

## Section 5.6 — Purchase Orders (PO)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| PO-01 | PO header and line fields | 4 | `purchase_orders`, `purchase_order_lines` (migration 0006, applied) | `src/features/procurement/PurchaseOrdersPanel.tsx`, `/purchasing` | `procurementValidation.test.ts`, `Procurement.test.tsx` | **Implemented** — supplier, dates, lines with unit cost; `line_total` computed by the database; confirmed live |
| PO-02 | PO statuses | 4 | `purchase_order_status` enum | `ORDER_STATUS_LABELS`, status workflow | `Procurement.test.tsx` | **Implemented** — draft → approved → ordered → closed; confirmed live |
| PO-03 | Link PO to PR | 4 | `purchase_orders.pr_id` (unique) | Source-request selector seeds lines | `Procurement.test.tsx` | **Implemented** — one order per approved request, enforced by unique constraint; confirmed live |
| PO-04 | Prevent unauthorized PO modification | 4 | RLS + `can_manage_purchasing()` / `can_approve_purchasing()` | `PurchaseOrdersPanel.tsx` | `Procurement.test.tsx` | **Implemented** — SELECT-only grants; approval role-gated. Live check: purchasing officer could not approve a PO. OD-06 SoD still open |

---

## Section 5.7 — Goods Receiving Notes (GRN)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| GRN-01 | GRN header fields | 4 | `grns` | `src/features/stock/GrnPanel.tsx` | AC-04 | Implemented |
| GRN-02 | GRN line fields | 4 | `grn_lines` | GRN line entry | AC-04 | Implemented |
| GRN-03 | Posting increases stock and updates valuation atomically | 4 | `post_grn()` | GRN post RPC | AC-04 | Implemented |
| GRN-04 | Link GRN to PO; record shortages/over-receipts | 4 | `grns.po_id`, `grn_lines.po_line_id`, `purchase_order_receipts` (migration 0007, applied) | PO selector + seeded lines in `GrnPanel.tsx`, receipt status table | `Receiving.test.tsx` | **Verified** 2026-11-18 (owner live run) — outstanding lines seeded, drafts ignored, posted receipt moved to `partial`/`complete`, over-receipt recorded as `over` |
| GRN-05 | Prevent duplicate GRN posting | 4 | `grns.posted_at`, unique source-line index | Idempotency guard | — | Implemented |

---

## Section 5.8 — Store Issue Vouchers (SIV)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| SIV-01 | SIV header fields | 4 | `sivs` | `src/features/stock/SivPanel.tsx` | AC-05 | Implemented |
| SIV-02 | SIV line fields | 4 | `siv_lines` | SIV line entry | AC-05 | Implemented |
| SIV-03 | Posting updates source and destination atomically | 4 | `post_siv()` | SIV post RPC | AC-05 | Implemented |
| SIV-04 | Linked stock movements and audit events | 4 | `stock_transactions`, `audit_logs` | Ledger rows + audit trigger | AC-05,13 | Implemented |
| SIV-05 | Reject negative-stock transactions | 4 | FIFO layer check in `post_siv()` | Stock check in RPC | — | Implemented |

---

## Section 5.9 — Inventory Counting (CNT)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| CNT-01 | Count sheet header | 4 | `inventory_counts` (migration 0008) | `src/features/stock/CountPanel.tsx`, `/inventory` | `InventoryControl.test.tsx` | **Implemented** — number, date, location, counter and notes; live UAT deferred |
| CNT-02 | Variance per line | 4 | `inventory_count_lines.system_quantity`, `variance_quantity` (generated) | Count entry UI + `inventory_count_variances` view | `stockValidation.test.ts`, `InventoryControl.test.tsx` | **Implemented** — snapshot taken at sheet creation; variance calculated by the database |
| CNT-03 | Review and approval before adjustment posting | 4 | `inventory_counts.status` + `submit_/decide_/post_inventory_count()` | Count panel approval and posting gates | `InventoryControl.test.tsx` | **Implemented** — draft → submitted → approved/rejected → posted; posting requires approval and reconciles the ledger to the physical count (STK-04) |
| CNT-04 | Variance and accuracy reports | 7 | `inventory_count_variances` view (migration 0008) | Report queries | RPT-02 | Not Started — variance view is ready for the Phase 7 report |
| CNT-05 | Preserve original count and approval history | 4 | `inventory_counts` decision columns + `audit_logs` | Append-only audit triggers | AC-13 | **Implemented** — original count, system snapshot, approver, time and comment are kept; no update path for posted documents |

---

## Section 5.10 — Inventory Adjustments (ADJ)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| ADJ-01 | +/- adjustments for approved reasons | 4 | `inventory_adjustments`, `inventory_adjustment_lines` (migration 0008) | `src/features/stock/AdjustmentPanel.tsx`, `/inventory` | `stockValidation.test.ts`, `InventoryControl.test.tsx` | **Implemented** — increase/decrease lines with damage, spoilage, theft, expired, operational loss; live UAT deferred |
| ADJ-02 | Require approval per role config | 4 | `can_manage_inventory()`, `can_approve_inventory()`, `can_post_inventory()` | Approval gate in the panel + RPC | `InventoryControl.test.tsx`, `Stock.test.tsx` | **Implemented** — manage/post for admin/GM/storekeeper, approve for admin/GM; OD-06 thresholds still open |
| ADJ-03 | Post to stock ledger; never overwrite balances | 4 | `post_inventory_adjustment()`, `stock_transactions`, `stock_layers` | Adjustment post RPC | `InventoryControl.test.tsx` | **Implemented** — approved document posts once; increases create a FIFO layer, decreases consume oldest layers; no balance column is written |

---

## Section 5.11 — Waste Management (WST)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| WST-01 | Waste record fields | 4 | `inventory_adjustments` with `kind = 'waste'` + lines (migration 0008) | `WastePanel` in `AdjustmentPanel.tsx`, `/inventory` | `stockValidation.test.ts`, `InventoryControl.test.tsx` | **Implemented** — item, quantity, location, date, user and reason recorded; FIFO cost written on posting; live UAT deferred |
| WST-02 | Waste types supported | 4 | `inventory_adjustments` reason check | Waste reason selector | `stockValidation.test.ts` | **Implemented** — kitchen waste, burnt food, returned food, expired, spoilage; waste lines can only decrease stock |
| WST-03 | Post approved waste as inventory decrease | 4 | `post_inventory_adjustment()` | Waste post action | `InventoryControl.test.tsx` | **Implemented** — posts `waste` transactions after approval, consuming FIFO layers |
| WST-04 | Waste cost and trend reports | 7 | Posted cost on `inventory_adjustment_lines` | Report queries | RPT-05 | Not Started — posted cost is recorded for the Phase 7 report |

---

## Section 5.12 — Production (PROD)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| PROD-01 | Record raw→semi/finished production | 5 | `production_orders` | `/kitchen` (`ProductionPanel.tsx`) | `Kitchen.test.tsx` | **Implemented** — live UAT deferred |
| PROD-02 | Production record fields | 5 | `production_orders`, `production_inputs` | Production form | `Kitchen.test.tsx` | **Implemented** — inputs, quantities, actual/expected output, yield %, date, location, responsible user |
| PROD-03 | Post: decrease inputs, increase output atomically | 5 | `post_production_order()`, `post_stock_in/out()` | Production post RPC | `Kitchen.test.tsx` | **Implemented** — one transaction consumes input FIFO layers and creates the output layer |
| PROD-04 | Production history and traceable movements | 5 | `production_orders`, `stock_transactions` | Production table + stock ledger | `Kitchen.test.tsx` | **Implemented** — posted inputs/output reference the production order in the ledger |

---

## Section 5.13 — Recipe Management (REC)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| REC-01 | Recipe master data fields | 5 | `recipes`, `recipe_versions`, `recipe_version_lines` | `/kitchen` (`RecipesPanel.tsx`) | `Kitchen.test.tsx` | **Implemented** — live UAT deferred |
| REC-02 | Create/edit with version history | 5 | `recipe_versions`, `create_recipe_version()`, `publish_recipe_version()` | Recipe version UI | `Kitchen.test.tsx` | **Implemented** — drafts are append-only; publishing archives the previous version |
| REC-03 | Calculate cost, selling price, GP, food cost % | 5 | View `recipe_version_costs` | Recipe costing table | `Kitchen.test.tsx` | **Implemented** — current FIFO weighted-average ingredient cost per version |
| REC-04 | Food Cost % = Cost ÷ Price × 100 | 5 | View `recipe_version_costs` | Costing view | `recipesValidation.test.ts` | **Implemented** — cost per portion ÷ selling price × 100 |
| REC-05 | Use recipes for costing, engineering, theoretical consumption | 5,7 | View `recipe_version_costs` | Costing live; theoretical consumption in Phase 7 | — | **Partial** — costing is live; theoretical consumption needs Phase 6 sales |
| REC-06 | Recipes do NOT auto-deduct stock | 5 | — | Recipe RPCs never write stock | `Kitchen.test.tsx` | **Implemented** — only `post_production_order()` moves stock |
| REC-07 | Theoretical consumption uses recipe versions + sales | 7 | — | Variance report query | COST-01 | Not Started |

---

## Section 5.14 — Menu Management (MENU)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| MENU-01 | Menu item fields | 6 | `menu_items` (migration 0010) | `src/features/menu/MenuPanel.tsx` | `menuValidation.test.ts` | **Implemented** — code, name, category, VAT-inclusive selling price, optional recipe link and active flag |
| MENU-02 | Menu categories | 6 | `menu_categories` (migration 0010) | `src/features/menu/MenuPanel.tsx` | `menuValidation.test.ts` | **Implemented** — categories with sort order, create/edit and deactivate |
| MENU-03 | Deactivate items; preserve historical descriptions/prices | 6 | `menu_items.is_active`; `order_lines` snapshot | `MenuPanel.tsx`; `OrdersPanel.tsx` | `ordersValidation.test.ts`, `Operations.test.tsx` | **Implemented** — items are never deleted; order lines keep their own code, name and price |

---

## Section 5.15 — Table Management (TBL)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| TBL-01 | Display table layout and status | 6 | `restaurant_tables` (migration 0010) | `src/features/tables/TablesPanel.tsx` | `Operations.test.tsx`; AC-11 at final UAT | **Implemented** - outlet, code, name, capacity and live status |
| TBL-02 | Table statuses | 6 | `restaurant_tables.status` | `TablesPanel.tsx`; order/reservation RPCs | `Operations.test.tsx`; AC-11 at final UAT | **Implemented** — available/occupied/reserved/cleaning/closed; orders and reservations drive the state automatically |
| TBL-03 | Merge, split, transfer per permissions | 6 | `transfer_order`, `split_order`, `merge_orders` (migration 0010) | `src/features/orders/OrdersPanel.tsx` | `Operations.test.tsx`; AC-11 at final UAT | **Implemented** — transfer and split by order takers; merge is manager-only and same-outlet |
| TBL-04 | Prevent conflicting simultaneous assignments (server-side) | 6 | `orders_one_open_per_table`, `reservations_table_slot_unique`, `FOR UPDATE` locks | Order/reservation RPCs | `ordersValidation.test.ts`; AC-14 at final UAT | **Implemented** — one open order per table, one reservation per table/slot, rows locked in the transaction |

---

## Section 5.16 — Reservation Management (RES)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| RES-01 | Reservation record fields | 6 | `reservations` (migration 0010) | `src/features/reservations/ReservationsPanel.tsx` | `tablesReservationsValidation.test.ts`; AC-11 at final UAT | **Implemented** — guest name, phone, party size, date/time and optional table; no guest profile (OD-10) |
| RES-02 | Reservation statuses | 6 | `reservations.status` | `ReservationsPanel.tsx`; `set_reservation_status()` | `Operations.test.tsx`; AC-11 at final UAT | **Implemented** — booked → confirmed → arrived → cancelled/completed, with table state updates |
| RES-03 | Reservation summary and guest history | 7 | — | Report queries | RPT-07 | **Dropped** — OD-10 removed guest profiles and history |
| RES-04 | Detect/flag overlapping reservations | 6 | `reservations_table_slot_unique`; `reservation_slot_load` view | `ReservationsPanel.tsx` | `tablesReservationsValidation.test.ts` | **Implemented** — the exact table/slot pair is blocked by a unique index; overbooking raises a visible warning from active load vs tables |

---

## Section 5.17 — Order Taking (ORD)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| ORD-01 | Open/modify/cancel/transfer/split/close orders | 6 | `create_order`, `update_order`, `cancel_order`, `transfer_order`, `split_order`, `close_order` (migration 0010) | `src/features/orders/OrdersPanel.tsx` | `Operations.test.tsx`; AC-11 at final UAT | **Implemented** — every action is an atomic SECURITY DEFINER RPC |
| ORD-02 | Order header fields | 6 | `orders` | `OrdersPanel.tsx` | `ordersValidation.test.ts` | **Implemented** — order number, outlet, optional table, waiter, notes, timestamps and lifecycle status |
| ORD-03 | Order line fields (price snapshot) | 6 | `order_lines` | `OrdersPanel.tsx` | `ordersValidation.test.ts`; RCT-05 | **Implemented** — item code, name and unit price are copied at line creation |
| ORD-04 | Order statuses | 6 | `orders.status`; `set_order_status()` | `OrdersPanel.tsx`; `KitchenDisplayPanel.tsx` | `Operations.test.tsx`; AC-10 at final UAT | **Implemented** — pending → sent → preparing → ready → served → closed, plus cancelled; illegal transitions rejected in SQL |
| ORD-05 | Concurrent edits handled visibly | 6 | `orders.revision`; SQLSTATE `40001` | `OrdersPanel.tsx`; `validation.ts` | `ordersValidation.test.ts`; AC-14 at final UAT | **Implemented** — stale revisions are rejected and the UI explains that the order changed |
| ORD-06 | Cancellation/modifications audited | 6 | `audit_logs`; `orders_audit`, `order_lines_audit` | Audit triggers | `ordersValidation.test.ts`; AC-13 at final UAT | **Implemented** — inserts, updates and cancellations are appended to the audit log |

---

## Section 5.18 — Kitchen Display System (KDS)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| KDS-01 | Display order info + elapsed time | 6 | — | `src/features/orders/KitchenDisplayPanel.tsx` | `Operations.test.tsx`; AC-10 at final UAT | **Partial** — ticket shows order number, table, waiter, lines, instructions and sent/opened timestamps; no elapsed-minutes counter |
| KDS-02 | Kitchen staff update Preparing/Ready | 6 | `set_order_status()`; `can_update_kitchen_status()` | `KitchenDisplayPanel.tsx` | `Operations.test.tsx`; AC-10 at final UAT | **Implemented** — Sent/Preparing/Ready columns with role-gated transitions |
| KDS-03 | Sync status changes via Supabase Realtime | 6 | Realtime publication on `orders`/`order_lines` | `subscribeToOrderChanges()` in `src/features/orders/api.ts` | `Operations.test.tsx`; AC-10 at final UAT | **Implemented** — any change triggers a refetch; the database stays authoritative |
| KDS-04 | Prep-time and delayed-order reporting | 7 | — | Report queries | RPT-06 | Not Started |
| KDS-05 | KDS requires internet; no offline KDS | 0 | — | Architecture decision; no offline queue | CON-01 | **Implemented** — online-only display with no local persistence |

---

## Section 5.19 — Receipt Generation (RCT)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| RCT-01 | Receipt fields and format | 6 | `receipts` (migration 0010) | `src/features/orders/ReceiptView.tsx` | `Operations.test.tsx`; AC-11 at final UAT | **Implemented** — number, date, business identity, TIN, table, waiter, lines, VAT breakdown, total and footer |
| RCT-02 | Browser print + PDF output | 6 | — | `ReceiptView.tsx` (`window.print()`) | Manual print at final UAT | **Implemented** — browser print and print-to-PDF, no client-side PDF dependency |
| RCT-03 | Record sales/closure/receipt reference | 6 | `close_order()`; `receipts.order_id` unique | `OrdersPanel.tsx` | `Operations.test.tsx`; RCT-05 | **Implemented** — closing stores the totals on the order and links one immutable receipt |
| RCT-04 | No payment credentials collected/stored | 6 | — | No payment fields or gateway anywhere | `ordersValidation.test.ts` | **Implemented** — orders record no payment data |
| RCT-05 | Preserve item descriptions/prices at time of sale | 6 | `order_lines.item_code`, `item_name`, `unit_price` | Order line creation | `ordersValidation.test.ts` | **Implemented** — snapshots survive later menu edits; receipts repeat the snapshot |

---

## Section 5.20 — Stock Movement (STK)

| Req ID | Description Summary | Phase | DB Migration | Implementation File(s) | Test Case | Status |
|:---|:---|:---:|:---|:---|:---|:---:|
| STK-01 | Balances from transactions only | 4 | `stock_transactions`, `stock_balances` | `src/features/stock/StockPanel.tsx` | — | Implemented |
| STK-02 | Stock increases defined | 4 | `stock_transactions.transaction_type` | GRN and adjustment increases implemented; opening/production not built | AC-04,06 | In Progress |
| STK-03 | Stock decreases defined | 4 | `stock_transactions.transaction_type` | SIV, adjustment and waste decreases implemented; production not built | AC-05,07 | In Progress |
| STK-04 | Counts verify; variances via adjustments | 4 | `post_inventory_count()` → `adjustment` transactions (migration 0008) | Count reconciliation | `InventoryControl.test.tsx` | **Implemented** — approved count reconciles the ledger to the physical quantity; the posted variance is traceable to the count line |
| STK-05 | Menu sales do NOT deduct stock | 6 | — | `close_order()` never writes `stock_transactions` | `Operations.test.tsx`; AC-09 | **Implemented** — menu sales and stock stay separate (ADR-008) |
| STK-06 | Stock ledger record fields | 4 | `stock_transactions`, `stock_ledger_entries` | Ledger schema + history view | — | Implemented |
| STK-07 | Prevent duplicate posting; preserve reversals | 4 | `posted_at` + unique index | Post guard; reversal flow not built | — | In Progress |

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
| AC-03 | PR submit→approve/reject→PO workflow per permissions | 4 | **Verified** 2026-11-18 (owner live run) — PR submitted and approved with approver/time/comment, PO created from it and moved draft → approved → ordered → closed; purchasing officer could not approve a PO |
| AC-04 | GRN posted once; updates correct location and valuation | 4 | **Verified** 2026-11-18 (owner live run) — GRN 2,000 g posted once to the chosen location, balance 2,000 g / ETB 240.00 |
| AC-05 | SIV/transfer atomic; traceable stock movements | 4 | **Verified** 2026-11-18 (owner live run) — SIV 500 g left 1,500 g / ETB 180.00 (FIFO), over-issue rejected, movements traceable |
| AC-06 | Count variance calculated; approved adj reconciles ledger | 4 | **Implemented** — count variance, approval and posting built and unit-tested; migration 0008 applied and structure-verified; live UAT deferred by the owner |
| AC-07 | Waste and production update inventory correctly | 4,5 | **Implemented** — approved waste and posted production both move stock through the FIFO ledger and are unit-tested; live UAT deferred by the owner |
| AC-08 | Recipe costing and food-cost % verified | 5 | **Implemented** — `recipe_version_costs` computes cost per portion, gross profit and food cost %; panel tested; live UAT deferred |
| AC-09 | Menu sales don't deduct stock; theoretical consumption separate | 5,6 | **Implemented** — recipe definitions and order close never write stock (REC-06, STK-05, ADR-008); the theoretical-consumption report remains Phase 7 |
| AC-10 | Orders appear on KDS; status visible to other users over internet | 6 | **Implemented** — KDS columns, role-gated transitions and Realtime refetch built and unit-tested; the multi-user live run is deferred to final UAT |
| AC-11 | Table/reservation/order/receipt workflows per permissions | 6 | **Implemented** — menus, tables, reservations, order lifecycle, closing and receipts built and unit-tested; live three-user run deferred to final UAT |
| AC-12 | Reports/dashboard reconcile to test data; respect access scope | 7 | Not Started |
| AC-13 | Critical actions produce audit events | 2+ | **In Progress** — business, procurement, inventory, recipe and order changes are audited; login/logout events are not logged |
| AC-14 | Concurrent edits don't overwrite; conflicts visible | 6 | **Implemented** — revision checks with SQLSTATE `40001`, row locks and one-open-order-per-table; the concurrent live run is deferred to final UAT |
| AC-15 | App shows clear error on network failure | 1 | **In Progress** — offline banner tested; save-failure UX pending data layer |
| AC-16 | Backup/export procedure documented and tested | 8 | Not Started |
| AC-17 | No secrets in repo or browser-delivered code | 0 | **In Progress** |
| AC-18 | Free-tier/no-card eligibility checked and recorded | 0 | Not Started |
| AC-19 | Owner reviews open decisions and approves next phase scope | 0,8 | Not Started |

---

## Open Decisions Tracking

| OD ID | Decision Required | Impact | Owner Response | Status |
|:---|:---|:---|:---|:---:|
| OD-01 | Business timezone | Daily totals, report dates | Africa/Addis_Ababa (UTC+3) | **Resolved** |
| OD-02 | One entity + multiple outlets OR multi-tenant? | DB isolation model | One business entity with multiple outlets | **Resolved** |
| OD-03 | Named test users → roles and outlet scopes | Auth and permission tests | Three individual accounts, full access, all outlets | **Resolved** |
| OD-04 | Inventory costing method (weighted average?) | Valuation calculations | FIFO (ADR-009) | **Resolved** |
| OD-05 | Unit conversion rules; purchase/storage/issue units | Stock and costing accuracy | Base units + per-item factors (ADR-010) | **Resolved** |
| OD-06 | Approval thresholds and SoD rules for PR/PO/GRN/SIV/counts | Controls and fraud prevention | **Approval workflows required** — thresholds and SoD not yet defined | **Open** — Phase 4 postings are role-gated and record who acted. PR approval is restricted to System Administrator/General Manager with approver, time and comment recorded; self-approval is not blocked and no monetary thresholds exist. Counts, adjustments and waste are now built with manage/post restricted to admin/GM/storekeeper and approval to admin/GM; self-approval is still not blocked and no thresholds exist. |
| OD-07 | Taxes, service charges, discounts in scope? | Receipt totals | VAT 15% only; menu prices are VAT-inclusive; no service charge or discounts (ADR-013) | **Resolved** |
| OD-08 | Receipt numbering, business identity, language, currency | Receipt presentation | ETB; receipt numbers `<OUTLET>-YYYYMMDD-####` per outlet per business day; identity editable in Settings (ADR-013) | **Resolved** |
| OD-09 | Reservation capacity rules; table assignment mandatory? | Conflict validation logic | Optional table assignment; exact-slot double-booking blocked; overbooking warning (ADR-013) | **Resolved** |
| OD-10 | Guest profiles/history retention and privacy rules | Personal-data handling | Guest name and phone only; no profile or history (RES-03 dropped) (ADR-013) | **Resolved** |
| OD-11 | Currency and decimal precision | Money calculations | ETB, 2 decimal places | **Resolved** |
| OD-12 | Hotel features (room charges, room service) now or deferred? | Scope of Phase 6 | All hotel features deferred (ADR-013) | **Resolved** |
| OD-13 | Free-tier eligibility and backup/restore expectations | DEPLOYMENT.md content | Supabase + Cloudflare Pages free tier, no card | **Resolved** |
