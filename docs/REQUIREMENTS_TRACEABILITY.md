# Albena RMS — Requirements Traceability Matrix

This document maps requirements from the authoritative Software Requirements Specification (SRS) to architectural components, database entities, UI views, and verification tests.

> [!IMPORTANT]
> **SRS Dependency Status**: The official Albena RMS SRS document is currently **PENDING DELIVERY** from the project owner. The functional areas below represent the baseline structural placeholders identified in the project master instructions and will be updated with exact SRS clause IDs upon delivery.

---

## 1. Functional Area Traceability Baseline

| Area ID | Functional Domain | Planned Milestone | SRS Clause Ref | Database Tables | UI Component / View | Test Verification | Status |
| :---: | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| **FA-01** | Company, Restaurant, Branch & Outlets | M2 | *Pending SRS* | `companies`, `restaurants`, `branches`, `outlets` | `/settings/organization` | Schema & RLS Test | Planned |
| **FA-02** | User Accounts, Roles & Permissions | M3 | *Pending SRS* | `user_profiles`, `user_roles`, `role_permissions` | `/settings/users`, `/auth` | Multi-user Auth Test | Planned |
| **FA-03** | Inventory & Stock Management | M4 | *Pending SRS* | `inventory_items`, `stock_levels`, `stock_transactions` | `/inventory/items`, `/inventory/stock` | Stock Rebalance Test | Planned |
| **FA-04** | Suppliers & Purchasing | M4 | *Pending SRS* | `suppliers`, `purchase_orders`, `purchase_order_items` | `/procurement/suppliers`, `/procurement/po` | PO Flow Test | Planned |
| **FA-05** | Goods Received Notes (GRN) | M4 | *Pending SRS* | `goods_received_notes`, `grn_items` | `/procurement/grn` | GRN Stock Update Test | Planned |
| **FA-06** | Stock Issue Vouchers (SIV) | M4 | *Pending SRS* | `stock_issue_vouchers`, `siv_items` | `/inventory/siv` | SIV Department Issue Test | Planned |
| **FA-07** | Recipes & Food Costing | M5 | *Pending SRS* | `recipes`, `recipe_ingredients`, `cost_history` | `/kitchen/recipes`, `/costing` | BOM Cost Calculation Test | Planned |
| **FA-08** | Menu & Pricing Management | M5 | *Pending SRS* | `menu_categories`, `menu_items`, `price_tiers` | `/menu/items`, `/menu/pricing` | Menu Sync Test | Planned |
| **FA-09** | Tables, Reservations & Orders | M6 | *Pending SRS* | `dining_tables`, `reservations`, `orders`, `order_items` | `/floor-plan`, `/reservations` | Table Status Flow Test | Planned |
| **FA-10** | POS & Kitchen Display System (KDS) | M7 | *Pending SRS* | `orders`, `order_items`, `order_routing` | `/pos`, `/kds` | Realtime KDS Sync Test | Planned |
| **FA-11** | Reports & Dashboards | M8 | *Pending SRS* | Dynamic aggregated views / functions | `/reports/sales`, `/reports/cogs` | Financial Audit Test | Planned |
| **FA-12** | Audit Trails & Security | M8 | *Pending SRS* | `audit_logs` | `/settings/audit-logs` | Tamper-evidence Test | Planned |

---

## 2. Three-User Geodistributed Testing Traceability

| Persona | Primary Role | Geographic Location (Simulated) | Assigned Core Functional Areas | Validation Scenario | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **User 1** | Branch General Manager | Location 1 (HQ / Remote Admin) | FA-01, FA-02, FA-11, FA-12 | Organization setup, role assignment, live sales & audit monitoring | Planned |
| **User 2** | Head Chef / Storekeeper | Location 2 (Kitchen / Warehouse) | FA-03, FA-04, FA-05, FA-06, FA-07, FA-10 | Stock intake (GRN), kitchen requisitions (SIV), recipe costing, and live KDS fulfillment | Planned |
| **User 3** | Head Cashier / Floor Lead | Location 3 (Front of House) | FA-08, FA-09, FA-10 | Table booking, high-speed POS order entry, split bill settlement, live KDS dispatch | Planned |

---

## 3. Compliance & Traceability Rules
1. Every developed feature must trace back to a specific clause in the official SRS.
2. If an SRS requirement is ambiguous, submit a Request for Clarification (RFC) to the owner before coding.
3. No feature is marked "Complete" until both functional acceptance criteria and 3-user concurrency checks have passed.
