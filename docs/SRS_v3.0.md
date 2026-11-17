# Albena RMS — Software Requirements Specification v3.0 (Cloud Prototype Edition)

> **Document Control**
> | Attribute | Value |
> |:---|:---|
> | Version | 3.0 — Cloud Prototype Edition |
> | Status | Draft — Approved for implementation baseline (2026-11-17) |
> | Prepared for | Albena Business Group |
> | Baseline | Albena RMS SRS Version 2.1 |
> | Date | 16 November 2026 |

This file is the verbatim authoritative source committed to the repository.
The full text was provided by the owner on 2026-11-17.
See `docs/REQUIREMENTS_TRACEABILITY.md` for the implementation mapping.

---

## v2.1 → v3.0 Key Changes

| Area | v2.1 | v3.0 |
|:---|:---|:---|
| Deployment | Standalone / LAN; fully offline | Cloud-hosted web app; internet required |
| Data location | Local storage | Managed cloud PostgreSQL |
| Users | Minimum 20 concurrent | Three remote users concurrently (initial) |
| Cloud | Future sync | Primary operating environment |
| Connectivity | Offline / local LAN KDS | No offline mode; live internet updates |
| Budget | Not specified | Free-tier only; no card without written approval |
| Dev tracking | Not specified | AGY progress records, quota checks, handover reports |
| App architecture | SQLite / PostgreSQL options | PostgreSQL cloud; no local SQLite |

---

## 1. Introduction

### 1.1 Purpose
Albena RMS is a restaurant and hospitality operations system for managing outlets, suppliers, inventory, purchasing, stock movements, recipes and food costing, production, menus, tables, reservations, orders, kitchen workflows, receipts, reports and audit records. The initial implementation is a cloud-only prototype for three users located in different places.

### 1.2 Product Scope
The prototype validates core workflows with shared live data. Users access the same application and database through individual accounts. No local/offline installation. No payment gateway or cash collection.

### 1.3 Intended Audience
- Business owner and decision-makers
- Project lead and requirements approver
- AGY-assisted developers
- Test users representing management, store/inventory and restaurant operations

### 1.4 Definitions

| Term | Meaning |
|:---|:---|
| RMS | Restaurant & Hospitality Management System |
| GRN | Goods Receiving Note |
| SIV | Store Issue Voucher |
| KDS | Kitchen Display System |
| RLS | Row-Level Security in the database |
| AGY | Google Antigravity development environment |
| Prototype | Initial live cloud implementation used for validation |

---

## 2. Project Objectives & Constraints

**CON-01** [Must] Internet connection required; no offline, local-first or LAN-only operation.
**CON-02** [Must] Three distinct user accounts accessing the same cloud environment.
**CON-03** [Must] No paid service, subscription, credit purchase or paid fallback without prior owner approval.
**CON-04** [Must] Setup must not require a bank card for prototype usage.
**CON-05** [Must] Existing DigitalOcean / Odoo environment shall not be touched.
**CON-06** [Must] Public GitHub repo — no secrets, tokens, keys or real personal data committed.
**CON-07** [Must] Uncertainty in business rules recorded as open questions; never invented.
**CON-08** [Must] System records sales and receipts; cash collection and payment processing are outside scope.

---

## 3. Users, Roles and Access Control

| Role | Core Permissions |
|:---|:---|
| System Administrator | System configuration, user/role admin, security settings |
| General Manager | All reports, dashboard, inventory monitoring, approval authority |
| Restaurant Manager | Daily ops, sales, inventory and reservation monitoring |
| Purchasing Officer | Purchase requests, POs and supplier management |
| Storekeeper | Inventory records, GRN, SIV and inventory counts |
| Executive Chef | Recipes, production and food-cost monitoring |
| Kitchen Staff | KDS access and permitted order-status updates |
| Waiter | Open tables, create/modify orders, transfer/split, print guest checks |
| Cashier | Close orders, print receipts and prepare end-of-day summaries |
| Auditor | Read-only access to authorized reports and audit logs |

**SEC-ROLE-01** [Must] Permissions enforced server/database-side, not only by hiding UI controls.
**SEC-ROLE-02** [Must] Each user authenticates with an individual account; shared accounts prohibited.
**SEC-ROLE-03** [Must] User only accesses records permitted by role and outlet/location scope.
**SEC-ROLE-04** [Must] Administrative role/permission changes shall be audit logged.
**SEC-ROLE-05** [Must] Support disabling/reactivating users without deleting historical transaction attribution.
**SEC-ROLE-06** [Must] No plaintext passwords stored; handled by authentication provider.

---

## 4. System Architecture and Deployment

| Layer | Technology / Responsibility |
|:---|:---|
| Frontend | React + TypeScript + Vite; Tailwind CSS |
| Hosting | Cloudflare Pages free plan |
| Database | Supabase-managed PostgreSQL; schema migrations versioned |
| Authentication | Supabase Auth |
| Authorization | PostgreSQL RLS, least-privilege policies, server-side validation |
| Business Logic | DB transactions/functions; Supabase Edge Functions where appropriate |
| Live Updates | Supabase Realtime for workflows that require it |
| Source Control | Public GitHub: apexethiopia-cloud/albena-rms |
| Development | Google Antigravity (AGY) with human review and owner approval gates |

**ARC-01** [Must] One shared cloud application and one logically shared database; no separate per-user databases.
**ARC-02** [Must] Usable in desktop browsers; adapt to tablet/mobile where practical.
**ARC-03** [Must] Frontend never contains Supabase service-role key or privileged secret.
**ARC-04** [Must] Public client config contains only provider-designated publishable/anon values protected by RLS.
**ARC-05** [Must] DB schema changes versioned as migration files, committed to Git.
**ARC-06** [Must] Business-critical multi-step operations execute atomically in DB transactions.
**ARC-07** [Must] Clear connection/error state displayed when connectivity unavailable; never silently claim unsaved work was saved.
**ARC-08** [Must] No offline queue, background sync or offline mode required.
**ARC-09** [Must] Provider selection rechecked against current free-tier terms before implementation and before public launch.

---

## 5. Functional Requirements

### 5.1 User Management
**USR-01** Create, edit, disable and reactivate user accounts.
**USR-02** Assign business roles and permissions to individual users.
**USR-03** Support password reset through the authentication provider.
**USR-04** Record user ID, name, username/email, role assignment, account status; never store raw passwords.
**USR-05** Audit user creation, role changes, disablement and reactivation.

### 5.2 Outlet Management
**OUT-01** Support multiple outlets (Main Restaurant, Coffee Shop, Pool Bar, Room Service, Banquet Hall).
**OUT-02** Outlet-specific orders, sales summaries and operational reports.
**OUT-03** Authorized users scoped to one or more outlets.
**OUT-04** Prevent cross-outlet access unless role explicitly permits.

### 5.3 Supplier Management
**SUP-01** Maintain supplier code, name, contact, phone, email, address, tax number, payment terms.
**SUP-02** Create, edit, view and deactivate.
**SUP-03** Supplier history, purchase analysis and performance reports.

### 5.4 Inventory Item and Location Management
**INV-01** Maintain item code, name, category, UoM, reorder level, current stock, average cost, last purchase cost.
**INV-02** Categories: meat, poultry, seafood, vegetables, dairy, dry goods, beverages, packaging, cleaning supplies; user-maintainable.
**INV-03** Multiple stock locations: Main Store, Kitchen Store, Bar Store, Coffee Shop Store.
**INV-04** Stock balances maintained separately by item and location.
**INV-05** Create, edit, view and deactivate items without deleting historical transactions.
**INV-06** Low-stock/reorder alerts based on configured reorder levels.

### 5.5 Purchase Requests
**PR-01** Create purchase requests: request number, date, requester, item lines, quantities, status.
**PR-02** Statuses: Draft, Submitted, Approved, Rejected.
**PR-03** Workflow: submission → manager review → approval/rejection → PO creation.
**PR-04** Record approver, decision time and comments.

### 5.6 Purchase Orders
**PO-01** Create POs: PO number, supplier, date, item, quantity, unit cost.
**PO-02** Statuses: Draft, Approved, Ordered, Closed.
**PO-03** Link POs to originating purchase requests where applicable.
**PO-04** Prevent unauthorized approval/modification; corrections controlled and audited.

### 5.7 Goods Receiving Note (GRN)
**GRN-01** Record GRN number, supplier, invoice number, date, receiving user.
**GRN-02** Record item, received quantity, unit cost, line total.
**GRN-03** On authorized posting, increase correct location stock and update inventory valuation.
**GRN-04** Link GRNs to POs; record shortages/over-receipts for review.
**GRN-05** Prevent duplicate posting.

### 5.8 Store Issue Voucher (SIV) and Transfers
**SIV-01** Create SIV: number, date, source location, destination dept/location, requester, approver.
**SIV-02** Record item, quantity and unit per line.
**SIV-03** On posting, reduce source and increase destination stock atomically.
**SIV-04** Create linked stock movement records and audit events.
**SIV-05** Reject transactions that would create negative stock unless owner-approved rule permits.

### 5.9 Inventory Counting
**CNT-01** Create count sheets: count number, date, counter, location.
**CNT-02** Capture system quantity, physical quantity, calculated variance per item.
**CNT-03** Count review and approval before any stock adjustment is posted.
**CNT-04** Inventory variance and accuracy reports.
**CNT-05** Preserve original count and approval history.

### 5.10 Inventory Adjustments
**ADJ-01** Positive and negative adjustments for approved reasons: damage, spoilage, theft, expired, operational loss.
**ADJ-02** Require approval per configured role permissions.
**ADJ-03** Post approved adjustments to stock ledger and audit trail; never directly overwrite balances.

### 5.11 Waste Management
**WST-01** Record waste: item, quantity, location, date, user, reason, cost.
**WST-02** Kitchen waste, burnt food, returned food, expired products, spoilage.
**WST-03** Post approved waste as inventory decrease transaction.
**WST-04** Waste cost and waste percentage/trend reports.

### 5.12 Production
**PROD-01** Record production converting raw materials into semi-finished/finished products.
**PROD-02** Record production inputs, quantities, output, yield, date, location, responsible user.
**PROD-03** On posting, decrease consumed ingredients and increase produced stock atomically.
**PROD-04** Maintain production history and traceable stock movements.

### 5.13 Recipe Management and Costing
**REC-01** Maintain recipe code, menu item, ingredients, quantities, units, yield.
**REC-02** Create and edit recipes with version history.
**REC-03** Calculate recipe cost, selling price, gross profit, food cost percentage.
**REC-04** Food Cost % = Recipe Cost ÷ Selling Price × 100.
**REC-05** Use recipes for costing, pricing, profitability, menu engineering and theoretical consumption.
**REC-06** Recipe definitions and menu sales shall NOT automatically deduct inventory; controlled stock transactions only.
**REC-07** Theoretical consumption reports use recipe versions/effective dates and sales data.

### 5.14 Menu Management
**MENU-01** Maintain menu code, name, category, selling price, recipe reference, active/inactive status.
**MENU-02** Categories: appetizers, main course, desserts, beverages.
**MENU-03** Create, edit and deactivate menu items while preserving historical order descriptions and prices.

### 5.15 Table Management
**TBL-01** Display table layout and current status.
**TBL-02** Statuses: Available, Occupied, Reserved, Cleaning, Closed.
**TBL-03** Merge, split and transfer operations subject to permissions.
**TBL-04** Prevent conflicting simultaneous table assignments via server-side validation.

### 5.16 Reservation Management
**RES-01** Record: reservation number, guest name, phone, date, time, party size, special requests.
**RES-02** Statuses: Booked, Confirmed, Arrived, Cancelled, Completed.
**RES-03** Reservation summary and guest history reports per access permissions.
**RES-04** Detect/flag overlapping reservations for the same table/capacity where configured.

### 5.17 Order Taking
**ORD-01** Open, modify, cancel, transfer, split and close orders per role permissions.
**ORD-02** Record: order number, table, waiter, outlet, date/time, order lines.
**ORD-03** Order lines: menu item, quantity, price snapshot, special instructions.
**ORD-04** Statuses: Pending, Sent to Kitchen, Preparing, Ready, Served, Closed.
**ORD-05** Concurrent edits shall not silently overwrite; conflicts handled visibly.
**ORD-06** Cancellation and post-send modifications are permission-controlled and audited.

### 5.18 Kitchen Display System (KDS)
**KDS-01** Display: order number, table, waiter, items, notes, elapsed time.
**KDS-02** Kitchen staff can accept orders and update Preparing/Ready status.
**KDS-03** Synchronize order changes and status updates to connected users over internet.
**KDS-04** Preparation-time and delayed-order reporting.
**KDS-05** KDS requires internet; offline/LAN KDS is out of scope.

### 5.19 Receipt Generation and Sales Recording
**RCT-01** Generate receipts: business name, receipt number, date/time, table, waiter, items, quantities, prices, total.
**RCT-02** Browser printing and PDF output; thermal/A4 depends on user's printer and browser.
**RCT-03** Record sales/order closure and receipt references.
**RCT-04** No card/bank payment credentials collected, processed or stored.
**RCT-05** Preserve item descriptions and prices as at time of sale.

### 5.20 Inventory Control and Stock Movement
**STK-01** Inventory balances derived from posted transactions, not manually edited balance fields.
**STK-02** Stock increases: opening balances, GRNs, positive adjustments, production output.
**STK-03** Stock decreases: SIVs, negative adjustments, waste, production consumption.
**STK-04** Physical counts verify balances; approved variances posted through adjustment transactions.
**STK-05** Menu sales shall NOT automatically deduct inventory.
**STK-06** Stock ledger records: transaction type, source/dest location, item, quantity, unit, cost, reference, posting user, timestamp.
**STK-07** Prevent duplicate posting; reversals/corrections preserved as traceable transactions.

### 5.21 Cost Control and Variance Analysis
**COST-01** Compare theoretical consumption (recipes + sales) with actual consumption (inventory movements + counts).
**COST-02** Food-cost, inventory, waste and department-consumption variance reports.
**COST-03** Identify reporting period, outlet/location, recipe version and assumptions per calculation.

### 5.22 Reporting and Dashboard
**RPT-01** Sales reports: daily, monthly, outlet, category, menu item, waiter performance.
**RPT-02** Inventory reports: stock on hand, stock movement, valuation, slow-moving, dead stock.
**RPT-03** Purchasing reports: purchase requests, POs and GRNs.
**RPT-04** Cost reports: recipe cost, food cost percentage, profitability.
**RPT-05** Waste reports: waste cost and trends.
**RPT-06** Kitchen reports: preparation time and delayed orders.
**RPT-07** Reservation reports: reservation summary and guest history.
**RPT-08** Dashboard: today's sales, open tables, kitchen queue, low-stock items, inventory value, top-selling items, food cost %, waste %, reservation status.
**RPT-09** Reports respect user outlet/location scope and display date range and filters.

### 5.23 Audit Trail
**AUD-01** Record: login/logout, record creation/modification, posting, cancellation, approval, role/permission changes.
**AUD-02** Capture: timestamp, actor, action, record reference, before/after values for critical changes.
**AUD-03** Audit records are append-only; ordinary users cannot delete or edit them.
**AUD-04** Audit access restricted to authorized roles.
**AUD-05** No passwords, authentication tokens or unnecessary sensitive data in logs.

---

## 6. Non-Functional Requirements
**NFR-01** Support at least 3 authenticated concurrent users from different internet locations.
**NFR-02** Architecture should not prevent later growth beyond 3 users.
**NFR-03** Target <2 seconds response for 95% of requests under normal test conditions.
**NFR-04** Clear loading, success, validation, permission-denied, network-error and retry feedback.
**NFR-05** Data changes persist in cloud DB and are visible to authorized users after successful commit.
**NFR-06** Secure HTTPS transport and provider-supported secure session handling.
**NFR-07** Least-privilege DB access, RLS policies and server-side validation for every sensitive operation.
**NFR-08** Input validation on client and server; protect against injection, broken access control and unsafe file uploads.
**NFR-09** Consistent timestamps in timezone-safe format; display local time per agreed business timezone.
**NFR-10** Responsive and usable on desktop and tablet browser sizes.
**NFR-11** TypeScript, modular components, consistent naming, linting and automated tests for critical business logic.
**NFR-12** No claimed guaranteed uptime or backups beyond actual verified provider plan.
**NFR-13** Provider free-tier quotas, pausing policies, storage/egress limits and eligibility documented and monitored.
**NFR-14** Initial prototype uses synthetic/demo data; real data requires separate security review.

---

## 7. Data Integrity, Backup and Recovery
**DATA-01** Relational constraints, foreign keys, unique identifiers and transactions to protect integrity.
**DATA-02** Posted stock transactions and audit history not physically deleted through normal workflows.
**DATA-03** Document actual backup/recovery capabilities of selected free plan.
**DATA-04** Manual export/backup procedure documented and tested before prototype acceptance.
**DATA-05** Automated backups, PITR and restore guarantees not assumed; must be verified against provider plan.
**DATA-06** Restore test performed in non-production environment if supported without paid plan.
**DATA-07** Owner informed of material data-loss risk from free-tier limits, inactivity pausing or lack of automated backups.

---

## 8. GitHub, Secrets and Development Controls
**DEV-01** Small, descriptive commits to owner-approved GitHub location.
**DEV-02** Public repo: .env, credentials, secrets, service-role keys and real personal data excluded by .gitignore.
**DEV-03** .env.example with placeholder names only; never real values.
**DEV-04** Review staged changes for secrets before every commit/push.
**DEV-05** No force-push, history rewrite or destructive repo operations without owner approval.
**DEV-06** AGY inspects repo and SRS before implementation; maintains task plan; reports blockers.
**DEV-07** AGY-generated code reviewed and tested; not automatically approved.
**DEV-08** No major architecture change, destructive DB change, significant rewrite, visibility change or paid-service activation without owner approval.

---

## 9. Progress Tracking and AGY Quota Controls
**PRG-01** At session start: report phase, completed work, pending work, blockers, next task, quota visibility.
**PRG-02** After significant task/milestone: update progress records, report changed files, tests, results and commit reference.
**PRG-03** Before ending session: save work, update documentation, provide handover report.
**PRG-04** Progress percentage calculated from milestone acceptance criteria, not guessed.

**QTA-01** Check AGY quota at session start, before major tasks, after substantial work and before lengthy tasks.
**QTA-02** At 25% remaining: warn owner, stop optional work, save progress, prepare handover.
**QTA-03** At 15% remaining: stop development, save and document state, await owner direction.
**QTA-04** If quota cannot be read: report 'unknown/not available'; never fabricate.
**QTA-05** No credit purchase, paid plan change or paid fallback without owner approval.
**QTA-06** Quota report states: observed value, when/how checked, whether authoritative, recommended next action.

---

## 10. Acceptance Criteria
**AC-01** Three users sign in from different locations concurrently to the same authorized cloud workspace.
**AC-02** Role and outlet permissions enforced by DB/server; unauthorized access attempts fail.
**AC-03** PR submitted, approved/rejected and converted to PO per permissions.
**AC-04** GRN posted once and updates correct stock location and valuation.
**AC-05** SIV/transfer updates source and destination balances atomically with traceable stock movements.
**AC-06** Inventory counts calculate variances; approved adjustments reconcile the stock ledger.
**AC-07** Waste and production transactions update inventory correctly.
**AC-08** Recipe costing and food-cost % calculations produce verified results.
**AC-09** Menu sales do not auto-deduct stock; theoretical consumption reporting is separate.
**AC-10** Orders appear on KDS and status changes are visible to other connected users over internet.
**AC-11** Table, reservation, order transfer/split and receipt workflows operate as permitted.
**AC-12** Reports and dashboard totals reconcile to underlying test transactions and respect access scope.
**AC-13** Critical actions generate audit events with actor, timestamp and record reference.
**AC-14** Concurrent edits do not silently overwrite; errors/conflicts visible and recoverable.
**AC-15** App clearly indicates when network failure prevents change from being saved.
**AC-16** Documented backup/export and recovery procedure tested to extent supported by selected free plan.
**AC-17** No secrets in public repository or browser-delivered code.
**AC-18** Actual free-tier/no-card eligibility and limitations of each service checked and recorded.
**AC-19** Owner has reviewed unresolved decisions and approved scope for next phase.

---

## 11. Implementation Phases (SRS-defined)

| Phase | Scope | Exit Condition |
|:---|:---|:---|
| 0 — Requirements & setup | Review SRS, confirm open decisions, inspect repo, verify free-tier/no-card constraints, establish tracking docs | Owner approves requirements baseline and architecture |
| 1 — Foundation | React/TS/Vite, lint/test setup, env handling, CI/build, initial Cloudflare deployment | Secure empty application is reachable |
| 2 — Backend & identity | Supabase schema foundation, auth, user profiles, role model, RLS, audit foundation | Three test users authenticate; authorization tests pass |
| 3 — Master data | Business workspace, outlets, locations, suppliers, inventory item master | Master data CRUD and access scopes pass tests |
| 4 — Inventory & purchasing | PR, PO, GRN, SIV, stock ledger, counts, adjustments, waste | Stock ledger and reconciliation tests pass |
| 5 — Recipes & production | Recipes, costing, production inputs/outputs, theoretical consumption | Costing and production calculations pass |
| 6 — Restaurant operations | Menus, tables, reservations, orders, KDS, receipts | Three-user live workflows pass |
| 7 — Reporting | Operational reports, cost/variance analysis, management dashboard | Report totals reconcile to test data |
| 8 — Validation & handover | Security review, concurrency tests, backup/recovery, documentation, owner demo | Owner accepts prototype test results and known limitations |

---

## 12. Open Decisions Requiring Owner Confirmation

| ID | Decision Required | Why It Matters |
|:---|:---|:---|
| OD-01 | Business timezone for reports, reservations and daily closing | Consistent dates and daily totals |
| OD-02 | One business entity with multiple outlets, or multiple separate tenants? | Database isolation and access model |
| OD-03 | Assign three named test users to roles and outlet scopes | Role and permission test coverage |
| OD-04 | Inventory costing method (weighted average or other) | Inventory valuation and cost reports |
| OD-05 | Unit conversion rules; purchase vs storage vs issue units per item | Accurate stock and costing calculations |
| OD-06 | Approval thresholds and separation-of-duties for PR, PO, GRN, SIV, counts, adjustments | Controls and fraud prevention |
| OD-07 | Taxes, service charges, discounts in scope and calculation method | Receipt and sales accuracy |
| OD-08 | Receipt numbering format, business identity fields, language/currency | Receipt and reporting presentation |
| OD-09 | Reservation capacity rules; whether table assignment is mandatory | Reservation conflict validation |
| OD-10 | Guest profiles/history retention and applicable privacy/retention rules | Personal-data handling |
| OD-11 | Business currency and decimal precision | Money and quantity calculations |
| OD-12 | Hotel-specific features (room charges, room service, guest folios) in scope now or deferred | Original spec mentions hospitality/hotel |
| OD-13 | Exact free-tier eligibility and backup/restore expectations after provider review | Avoid charges and data-loss assumptions |

---

## 13. Explicit Exclusions
- Offline operation, local installation, LAN-only deployment, offline synchronization
- Use of existing DigitalOcean / Odoo environment
- Payment gateway, card processing, bank integration, cash collection
- Paid hosting, paid APIs, paid AI, paid model fallback without owner approval
- Production use with real sensitive data before separate security review
- Hotel PMS/room folio integration unless separately specified and approved
- Guarantees of 20 concurrent users, HA, automatic daily backups or DR beyond verified free-plan capabilities

---

## 14. Change Control and Approval

| Revision | Date | Description | Status |
|:---|:---|:---|:---|
| 2.1 | Original | Offline/local-network RMS baseline | Superseded for cloud prototype |
| 3.0 | 16 Nov 2026 | Revised for cloud-only 3-user prototype | Approved as implementation baseline 2026-11-17 |

---

## Appendix A — Key Business Rules (Retained from v2.1)
1. Cash collection and payment processing occur **outside** Albena RMS.
2. Inventory balances derived from inventory transactions only.
3. Menu sales do **not** automatically deduct stock.
4. Recipes support costing, pricing, profitability, menu engineering and theoretical consumption.
5. Actual inventory accountability maintained through GRN, SIV, counts, approved adjustments, waste and production.
6. SIV and production transactions update related stock balances as a single consistent operation.
7. Audit history preserves critical actions and must not be deletable by ordinary users.
