# Albena RMS — Architecture Decision Records (ADR)

**Updated**: 2026-11-19 — SRS v3.0 approval plus ADR-014..017 (POS, numbering, draft CRUD, brand theme)

---

## ADR-001: Cloud-Native, Zero-Offline Architecture
- **Date**: 2026-11-16 | **Status**: Accepted
- **SRS Reference**: CON-01, ARC-08, KDS-05
- **Decision**: Internet required; no offline, local-first, or LAN-only operation. No offline queue or background sync.
- **Consequences**: Simplifies data consistency. Relies on continuous internet during test sessions.

---

## ADR-002: Technology Stack & Free-Tier Strictness
- **Date**: 2026-11-16 | **Status**: Accepted
- **SRS Reference**: CON-03, CON-04, ARC-01..09
- **Decision**: React + TypeScript + Vite + Tailwind CSS / Supabase PostgreSQL + Auth + Realtime / Cloudflare Pages / GitHub public repo.
- **Consequences**: Zero recurring infrastructure cost for prototyping. Must monitor free-tier limits (OD-13).

---

## ADR-003: Database-Enforced Row-Level Security Over Client Checks
- **Date**: 2026-11-16 | **Status**: Accepted
- **SRS Reference**: SEC-ROLE-01, ARC-03, ARC-04, NFR-07
- **Decision**: Every table must enable PostgreSQL RLS. Authorization enforced natively in DB policies using `auth.uid()`. Frontend permission gates are UX only.
- **Consequences**: DB secured even if client code is bypassed or anon keys are inspected.

---

## ADR-004: Public Repository Secret Isolation Policy
- **Date**: 2026-11-16 | **Status**: Accepted
- **SRS Reference**: CON-06, DEV-02, DEV-03, DEV-04, ARC-03
- **Decision**: Zero secrets committed. `.gitignore` excludes `.env*`. Frontend uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Service-role key never in browser code.
- **Consequences**: Protects against credential compromise in public repository.

---

## ADR-005: SRS v3.0 Adopted as Authoritative Requirements Baseline
- **Date**: 2026-11-17 | **Status**: Accepted — requires owner formal approval
- **SRS Reference**: Section 14 (Change Control)
- **Context**: Owner provided Albena_RMS_SRS_v3.0_Cloud_Prototype.docx on 2026-11-17. SRS v2.1 (offline/LAN model) is superseded.
- **Decision**: SRS v3.0 is committed to `docs/SRS_v3.0.md` as the binding requirements baseline. All features must trace to a requirement ID in this document. All open decisions (OD-01..OD-13) must be resolved by the owner before the affected phase begins implementation.
- **Consequences**: Any conflict between SRS v3.0 and later verbal/chat instructions must be raised for formal resolution; never silently interpreted.

---

## ADR-006: Implementation Phases Aligned to SRS Section 11 (Phases 0–8)
- **Date**: 2026-11-17 | **Status**: Accepted
- **SRS Reference**: Section 11
- **Context**: Previous roadmap used milestones M0–M9. SRS v3.0 defines Phases 0–8 with explicit scope and exit conditions.
- **Decision**: `docs/ROADMAP.md` now uses Phases 0–8 exactly as defined in SRS v3.0 Section 11. Progress percentages are recalculated accordingly.
- **Consequences**: Project tracking documents updated to use Phase numbering consistently.

---

## ADR-007: Transaction-Based Stock Ledger (No Direct Balance Updates)
- **Date**: 2026-11-17 | **Status**: Accepted
- **SRS Reference**: STK-01, ADJ-03, DATA-02
- **Decision**: Inventory balances are always derived from the stock transaction ledger (`stock_transactions` table). No direct UPDATE of stock balance fields is ever performed by application code. All adjustments, GRNs, SIVs, waste, and production post immutable transaction records.
- **Consequences**: Full audit trail of all stock movements. Physical balances always reconcilable. Historical data integrity guaranteed.

---

## ADR-008: Menu Sales Do NOT Auto-Deduct Inventory
- **Date**: 2026-11-17 | **Status**: Accepted
- **SRS Reference**: REC-06, STK-05, AC-09, Appendix A
- **Decision**: Placing or closing a menu order does not trigger an automatic inventory deduction. Actual stock accountability is maintained through GRN, SIV, counts, approved adjustments, waste and production. Recipe-based theoretical consumption is computed separately for variance reporting only.
- **Consequences**: Prevents accidental inventory manipulation from POS operations. Variance reports show difference between theoretical and actual consumption.

---

## ADR-009: FIFO Inventory Costing
- **Date**: 2026-11-18 | **Status**: Accepted (owner decision)
- **SRS Reference**: OD-04, INV-01, GRN-03, STK-06, COST-01..03
- **Context**: The SRS left the costing method open. The owner selected FIFO on 2026-11-18.
- **Decision**: Inventory is valued using first-in, first-out cost layers.
  - Each posted receipt (GRN, positive adjustment, production output) creates a cost layer: item, location, quantity received, unit cost, received timestamp.
  - Each posted issue (SIV, waste, negative adjustment, production consumption) consumes the oldest available layers first and records the consumed layer costs on the stock transaction.
  - Stock value at any location = sum of remaining layer quantity × layer unit cost.
  - A negative adjustment, waste posting or SIV that cannot be covered by existing layers is rejected (no negative stock) unless an owner-approved rule permits it.
- **Consequences**: Requires a `stock_layers` table alongside `stock_transactions`. Weighted-average valuation is **not** implemented. Recipe and food-cost calculations use FIFO layer cost at calculation time. Historical layers are never rewritten; corrections are new, traceable transactions (DATA-02).

---

## ADR-010: Unit Conversion Model
- **Date**: 2026-11-18 | **Status**: Accepted (owner decision)
- **SRS Reference**: OD-05, INV-01, PR-01, GRN-02, SIV-02
- **Context**: The owner confirmed these conversion families: kilogram ↔ gram, litre ↔ millilitre, box ↔ individual pieces, carton ↔ bottles, sack ↔ kilogram.
- **Decision**:
  - Stock is always stored in a **base unit per dimension**: gram (mass), millilitre (volume), piece (count).
  - Fixed conversions: `1 kg = 1000 g`, `1 L = 1000 mL`.
  - Item-specific conversions (`box → piece`, `carton → bottle`, `sack → kg`) are configured **per item** in `item_unit_conversions` with an explicit factor. No global factor is assumed for these, because a carton, box or sack has no universal size.
  - An item cannot be purchased, received or issued in a unit that has no configured conversion to its base unit.
  - Prices are stored per base unit; documents display the purchase/issue unit and the converted base quantity.
- **Consequences**: Phase 4 needs `units` and `item_unit_conversions` tables. Seed only the fixed kg/g and L/mL rows. Sack/box/carton factors must be entered by the owner or an administrator per item; the system must never invent them (CON-07).

---

## ADR-011: Inventory Control Documents, Count Reconciliation and Reorder Aggregation
- **Date**: 2026-11-18 | **Status**: Accepted
- **SRS Reference**: CNT-01..05, ADJ-01..03, WST-01..04, STK-04, INV-06, SEC-ROLE-01, ADR-007..010
- **Context**: Counts, adjustments and waste all change stock after a review step. The owner has not defined OD-06 thresholds or separation of duties, and stock locations are not yet mapped to outlets.
- **Decision**:
  - One `inventory_adjustments` table holds both adjustment and waste documents, distinguished by `kind` and by the ledger transaction type. Waste can only contain decrease lines.
  - All three document types share the status path `draft → submitted → approved/rejected → posted`. Submission, decisions and posting are separate RPCs; a document can only post once.
  - **Counts count in the item base unit.** The sheet stores `system_quantity` (ledger snapshot at sheet creation) and `physical_quantity`; `variance_quantity` is a generated column. This snapshot/variance stays on the record for reporting even if stock moves before approval.
  - **Posting a count reconciles the ledger to the physical quantity at posting time**, not to the snapshot variance. It writes `adjustment` transactions with `reference_type = 'inventory_count'` linked to the count line, so no balance column is ever overwritten (ADR-007).
  - A count gain is valued at the weighted average of the location's remaining FIFO layers; when the location has no layers it is posted at zero cost and can be corrected later with a priced adjustment. A count loss consumes FIFO layers exactly like an issue.
  - **Roles**: manage/submit/post inventory documents = `system_admin`, `general_manager`, `storekeeper`; approve/reject = `system_admin`, `general_manager`. Self-approval is not blocked and no monetary thresholds exist, consistent with the OD-06 interim position.
  - **INV-06 reorder alerts** compare an item's `reorder_level` (in base units) with total on-hand across all locations, because stock is not yet outlet-scoped.
- **Consequences**: Migration `20261118000800_counts_adjustments_waste.sql` adds the documents, the count reconciliation, two reporting views and role helpers. OD-06 and the stock-location ↔ outlet mapping remain open; neither is invented here.

---

## ADR-012: Recipe Versioning, FIFO-Based Costing and Production Posting
- **Date**: 2026-11-18 | **Status**: Accepted
- **SRS Reference**: REC-01..07, PROD-01..04, COST-01..03, STK-02/03, AC-07, AC-08, ADR-007..011
- **Context**: Phase 5 needs recipes with history and food costing, plus production that turns inputs into outputs without breaking the ledger rules. The menu entity is Phase 6, and stock locations are not yet outlet-scoped.
- **Decision**:
  - **Recipe header + immutable versions.** `recipes` holds code, name, menu item name and notes; `recipe_versions` holds the yield, selling price, notes and status (`draft`, `published`, `archived`). Every edit is a new version, so history is never overwritten. Publishing a draft archives the previous published version and stamps `published_by`, `published_at` and `effective_from`.
  - **Ingredient lines store both the entered quantity/unit and the resolved base quantity.** The database resolves the factor at creation through `stock_unit_factor()` (ADR-010) and rejects a unit with no conversion, so later costing does not depend on re-entering a factor.
  - **Costing uses the current FIFO layer cost.** `recipe_version_costs` computes, per ingredient, the weighted average unit cost of the remaining FIFO layers across all locations, then derives total cost, cost per portion, gross profit and food cost % (cost per portion / selling price × 100). An ingredient with no remaining layers costs zero and increments `lines_without_cost`, which the UI flags. No standard cost or price list is invented.
  - **Recipes never move stock (REC-06, ADR-008).** Creating, versioning or publishing a recipe touches no stock table.
  - **Production orders are drafts until posted.** `production_orders` records date, location, actual output, optional expected output and a generated `yield_percentage`, the responsible user and notes; `production_inputs` records each consumed item and base quantity. There is no approval step because the SRS does not require one.
  - **Posting is one transaction.** `post_production_order()` locks the order, consumes every input through `post_stock_out()` (FIFO, same helper as issues, waste and count losses), records `posted_cost` per input, and creates the output layer through `post_stock_in()` at the total consumed cost divided by the output base quantity. Drafts and definitions never affect the ledger (PROD-03).
  - **Roles**: manage recipes and production = `system_admin`, `general_manager`, `executive_chef`, matching the SRS role table. No separation of duties or thresholds are invented (OD-06 still open).
  - **Menu item stays text** until the Phase 6 menu entity exists; replacing it with a foreign key is a later migration, not a new rule here (CON-07).
- **Consequences**: Migration `20261118000900_recipes_production.sql` adds the tables, costing view, seven RPCs, audit triggers, RLS and grants. Phase 7 can build theoretical consumption from published versions plus sales; outlet-scoped costing waits for the stock-location to outlet mapping.

---

## ADR-013: Restaurant Operations, VAT-Inclusive Receipts and Order Concurrency
- **Date**: 2026-11-18 | **Status**: Accepted
- **SRS Reference**: MENU-01..03, TBL-01..04, RES-01..04, ORD-01..06, KDS-01..05, RCT-01..05, AC-10, AC-11, AC-14, OD-01, OD-07..OD-10, OD-12, ADR-007, ADR-008
- **Context**: Phase 6 adds menus, tables, reservations, orders, a kitchen display and receipts. Five open decisions blocked it; the owner answered them on 2026-11-18. The menu entity also lets recipes move from a text menu-item name to a real reference.
- **Decision**:
  - **Menu and price snapshots.** `menu_items` holds code, name, category, VAT-inclusive selling price, optional recipe link and active flag. Order lines copy the item code, name and unit price at entry, so later menu edits never rewrite a closed or historical order (MENU-03, RCT-05).
  - **VAT (OD-07).** Menu prices include VAT. VAT is extracted once at order close: `vat = round(total × 15 / 115, 2)`, `subtotal = total − vat`. No service charge, no discounts and no other tax is applied because the owner selected VAT only. The rate lives in `business_settings` so a future legal change is an edit, not a code change.
  - **Receipts (OD-08).** Numbering is per outlet per business day: `<outlet code>-YYYYMMDD-####`. Numbers reset daily and are allocated atomically by `next_document_number()`. The business name, TIN, address, phone and receipt footer are editable in Settings and are snapshotted onto each receipt. Output is browser print / print-to-PDF (RCT-02); no payment credentials are handled (RCT-04).
  - **Reservations (OD-09, OD-10).** A reservation stores the number, outlet, guest name, phone, date, time, party size, optional table and special requests. Table assignment is optional. One active reservation per table and exact date/time is enforced by a partial unique index; the UI warns when the number of active reservations for an outlet, date and time exceeds the active table count. Guest profiles and cross-visit history do not exist, a deliberate deviation from RES-03; RES-01 name and phone remain.
  - **Hotel features (OD-12).** Room charges, room service and guest folios are out of scope for the prototype.
  - **Order lifecycle.** `pending → sent_to_kitchen → preparing → ready → served → closed`, plus `cancelled`. Waiters/restaurant managers/admin take, modify, send, transfer and split orders; kitchen staff/executive chef move orders to preparing/ready; waiters mark served; cashier (and managers/admin) close. Modifying or cancelling after the order is sent requires a manager. Closing requires the order to be served.
  - **Concurrency (AC-14).** Orders carry a `revision`. Every mutating RPC takes the expected revision and raises SQLSTATE `40001` on mismatch, which the UI reports as a visible refresh-and-retry conflict. Reservations rely on row locks plus status-transition validation.
  - **Table state.** Opening an order on an available or reserved table marks it occupied. Closing, cancelling, transferring away or merging away frees the table only when no other open order remains. Tables in cleaning or closed state cannot receive orders. Status changes are role-gated; a table with an open order cannot be marked available.
  - **Merge and split.** Split moves selected whole lines to a new order and requires at least one line to remain on the original. Merge moves all lines to a target order and cancels the source with an audit reason. Both record the acting user and preserve price snapshots.
  - **KDS (KDS-01..05).** The kitchen display reads orders in sent/preparing/ready states and updates them through `set_order_status()`. `orders` and `order_lines` join the `supabase_realtime` publication so connected clients receive changes; each event triggers a refetch under RLS. Offline KDS remains out of scope.
  - **Roles**: menu and table layout = System Administrator/General Manager/Restaurant Manager; table status also Waiter/Cashier; reservations and order taking = those plus Waiter; kitchen status = System Administrator/General Manager/Restaurant Manager/Executive Chef/Kitchen Staff; close = System Administrator/General Manager/Restaurant Manager/Cashier; business settings = System Administrator/General Manager.
- **Consequences**: Migration `20261118001000_restaurant_operations.sql` adds the tables, views, triggers, RLS and fifteen RPCs. Recipe costing can later join `menu_items.recipe_id`; theoretical consumption (REC-07, COST-01..03) still needs sales reporting in Phase 7. Outlet scoping of reads remains role-based because stock locations and outlets are still not linked and all test users hold every role.

---

## ADR-014: Quick POS and Cashier Order Creation
- **Date**: 2026-11-19 | **Status**: Accepted
- **SRS Reference**: ORD-01, ORD-06, SEC-ROLE-01..06, ADR-003, ADR-013
- **Context**: The original order-entry screen is a single flat form with a menu-item dropdown. Cashiers could close orders but not create them, so a cashier taking a walk-in order had to find a waiter. The owner chose to add a POS-style screen alongside the existing form and to allow cashiers to create orders.
- **Decision**:
  - A `Quick POS` panel is mounted on `/operations` immediately before the existing `OrdersPanel`; the form is retained unchanged (no breaking replacement).
  - The POS uses category chips, item cards with a quantity badge, a cart with quantity steppers, and a running total. It submits through the existing `create_order()` RPC after the same shared client validation used by the form.
  - `can_take_orders()` now includes `cashier` in addition to System Administrator, General Manager, Restaurant Manager and Waiter. Authorisation remains in PostgreSQL; the UI role mirror is UX only (ADR-003).
  - `can_update_kitchen_status()` is unchanged: a cashier can create and close an order but cannot advance it on the kitchen display.
- **Consequences**: Cashiers can now create orders that start in `pending`; a user with kitchen-status rights must send them. No new RPC or business rule was introduced. Implemented by migration `20261119001300_auto_numbering.sql` and `src/features/orders/PosPanel.tsx`.

---

## ADR-015: Database-Authoritative Automatic Numbering
- **Date**: 2026-11-19 | **Status**: Accepted
- **SRS Reference**: PR-01, PO-01, GRN-01, SIV-01, CNT-01, ADJ-01, WST-01, PROD-01, REC-01, OUT-01, SUP-01, INV-01, MENU-01, TBL-01, DATA-02, ADR-003
- **Context**: Only orders, receipts and reservations had automatic numbers; every other business document and every master-data code was typed by the user with reactive duplicate errors. The owner chose database-generated numbers for both documents and master codes.
- **Decision**:
  - Business documents use a company-wide, per-business-day sequence: `PR-YYYYMMDD-NNNN`, `PO-…`, `GRN-…`, `SIV-…`, `CNT-…`, `ADJ-…`, `WST-…`, `PRD-…`. The counter table `company_document_sequences` is keyed by `(doc_type, sequence_date)`, uses `business_today()` (OD-01), and allocates with an atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING`. Prefixes are fixed server-side; callers cannot supply one.
  - Master codes use a separate company-wide sequence: `OUT-00001`, `LOC-00001`, `SUP-00001`, `ITM-00001`, `MNU-00001`, `TBL-00001`, `RCP-00001` (and `CAT-00001` reserved). BEFORE INSERT triggers fill only a null/blank `code`; a non-blank user code is preserved and still validated. `item_categories` has no `code` column and is skipped.
  - Both allocator functions have no direct `EXECUTE` grant to `anon` or `authenticated`; only the owning `SECURITY DEFINER` workflow RPCs and triggers call them. This prevents consuming a number without creating a document.
  - The `create_*` RPC signatures no longer accept a number/code parameter. The frontend does not generate or suggest numbers.
  - A failed creation rolls back its allocation. Posted numbers are never reused or renamed; updating or deleting a draft cannot change its number.
- **Consequences**: Manual number fields and their duplicate-error mappings were removed from PR, PO, GRN, SIV, count, adjustment/waste, production and recipe forms; master-code fields became optional with an `Auto-generated` placeholder. Implemented by migration `20261119001300_auto_numbering.sql`. The existing outlet-scoped `document_sequences` for orders/receipts/reservations is unchanged.

---

## ADR-016: Draft-Only Document Editing and Deletion
- **Date**: 2026-11-19 | **Status**: Accepted
- **SRS Reference**: PR-02, PO-02, GRN-02, SIV-02, CNT-02, ADJ-02, WST-02, PROD-02, ADR-007, ADR-009, ADR-011, ADR-012, ADR-013
- **Context**: All business documents were create-once and status-advance-only. There was no way to correct a typo in an unsaved-to-final draft short of creating a second document. The owner chose edit and delete for drafts/unposted documents only.
- **Decision**:
  - Role-gated `update_*` and `delete_*` RPCs are added for purchase requests, purchase orders, GRNs, SIVs, inventory counts, inventory adjustments/waste and production orders (migration `20261119001400_draft_crud.sql`).
  - Edit gates: PR/PO/count/adjustment/waste/production require `status = 'draft'`; GRN/SIV require `posted_at is null`. All use the same `can_*` role helper as their create RPC and lock the header row (`FOR UPDATE`).
  - Line replacement reuses the create RPC's validation. Immutable fields are not even parameters: document number, id, `pr_id` for POs, `po_id` for GRNs, `kind` for adjustments/waste, all decision/approval/posting metadata and status. Count lines get a fresh ledger `system_quantity` snapshot when edited.
  - Delete removes lines then the header and is refused for any submitted, approved, posted, closed or receipt-linked document.
  - Recipe content continues to follow ADR-012 — every content change is a new immutable version. Only header metadata (`name`, `menu_item_name`, `notes`) is editable through the existing `update_recipe()`; the UI now exposes that action. Published/archived versions stay immutable.
  - No generic cancel, void or duplicate operation was added; no new status, approval threshold or separation-of-duties rule was invented (OD-06).
- **Consequences**: Posted stock/financial documents, receipts, recipe versions and the append-only audit log remain immutable. Corrections to posted records still require a new traceable transaction (ADR-007/009).

---

## ADR-017: Black and Gold Brand Theme (Gold-Forward Light UI)
- **Date**: 2026-11-19 | **Status**: Accepted
- **Context**: The prototype used a green `brand` palette across 208 utility-class usages. The owner selected a Black and Gold brand with a gold-forward but light canvas.
- **Decision**:
  - Keep the existing `brand-50…900` token keys and remap them: pale gold surfaces (`50/100/200`), deep gold focus and accents (`500/700/800/900`), near-black primary (`600`). This re-themes all existing `brand-*` usages without touching feature components.
  - `body` uses `bg-brand-50`; the active sidebar item and environment badge use `bg-brand-100 text-brand-900`; the logo tile and favicon use deep gold; `theme-color` is near-black.
  - Semantic colours are unchanged: emerald = success/posted, red/rose = error/rejected, amber = warning/draft/pending, sky/indigo = informational workflow states. No dark-canvas pass was done; white cards and slate text remain.
- **Consequences**: The change is confined to `tailwind.config.js`, `src/index.css`, `index.html`, `public/favicon.svg` and two AppShell classes. No new colour token or theme provider was introduced.

---

## ADR-018: Admin-Controlled Role Revocation
- **Date**: 2026-11-19 | **Status**: Accepted
- **Context**: User Management could assign roles through `admin_assign_role()` but had no way to remove one. The owner asked that an admin be able to revoke a single assigned role while leaving the user's other roles intact, e.g. remove `cashier` but keep `restaurant_manager`. Business roles are database state in `user_roles`; there are no role claims in the Supabase JWT.
- **Decision**:
  - Add `admin_revoke_role(p_user_id uuid, p_role_code text)` as an admin-only `SECURITY DEFINER` RPC. It is the sole application write path for role removal.
  - Revoke direct `INSERT`, `UPDATE` and `DELETE` on `user_roles` from `anon` and `authenticated`, and drop the old broad `user_roles_admin_write` RLS policy. `user_roles_select` is retained. Assignment remains through `admin_assign_role()`; the service-role seed script is unaffected.
  - Guards, confirmed by the owner: an account may never be left with zero roles; at least one **active** `system_admin` must remain in the system; self-revocation of `system_admin` is allowed only when another active admin exists. Revoke attempts are serialized with a transaction advisory lock so concurrent admins cannot bypass the guards.
  - The audit trigger now records the `user_id` as `entity_id` for join tables that have no `id` column, so role changes satisfy the AC-13 record-reference requirement.
  - After changing their own roles, an admin's in-browser role cache is refreshed through `AuthContext.refreshUser()`. Enforcement never relies on that cache: every RPC/RLS check reads PostgreSQL live.
- **Consequences**: A new migration, `20261119001500_admin_role_revocation.sql`, must be applied by the owner. Users only need a page refresh if the optional auth refresh is unavailable. Direct PostgREST deletes of `user_roles` now fail with a permission error, which is intentional.

---

## Open Decisions Log (OD-01 to OD-13)

> These require owner confirmation before the relevant phase begins. Developers must NOT invent business policy.
> See `docs/REQUIREMENTS_TRACEABILITY.md` Open Decisions Tracking table for full detail.

| ID | Status | Phase Needed By |
|:---|:---:|:---:|
| OD-01 Business timezone | ✅ **Africa/Addis_Ababa (UTC+3)** | Phase 1 |
| OD-02 Single entity vs multi-tenant | ✅ **One business entity with multiple outlets** | Phase 2 |
| OD-03 Test user role/outlet assignments | ✅ **Full/all-access for initial 3 test users** | Phase 2 |
| OD-04 Inventory costing method | ✅ **FIFO** (owner decision 2026-11-18, ADR-009) | Phase 4 |
| OD-05 Unit conversion rules | ✅ **Base units + item-specific factors** (ADR-010) | Phase 4 |
| OD-06 Approval thresholds and SoD | ✅ **Approval workflows required (yes)** | Phase 4 |
| OD-07 Taxes, service charges, discounts | ✅ **VAT 15% only; menu prices include VAT; no service charge or discounts** (ADR-013) | Phase 6 |
| OD-08 Receipt format, numbering, language, currency | ✅ **ETB; `<outlet>-YYYYMMDD-####` per outlet per business day; identity editable in Settings** (ADR-013) | Phase 6 |
| OD-09 Reservation capacity and table assignment rules | ✅ **Optional table; exact-slot double-booking blocked; overbooking warning** (ADR-013) | Phase 6 |
| OD-10 Guest profile retention and privacy rules | ✅ **Name and phone on the reservation only; no profile or history** (ADR-013) | Phase 6 |
| OD-11 Currency and decimal precision | ✅ **ETB — 2 decimal places assumed** | Phase 1 |
| OD-12 Hotel features scope | ✅ **Deferred — no room charges, room service or folios** (ADR-013) | Phase 6 |
| OD-13 Free-tier eligibility and backup/restore expectations | ✅ **Confirmed — Supabase + Cloudflare Pages free tier, no card required** | Phase 1 |

### OD-06 interim implementation (Phase 4, 2026-11-18)

Approval workflows are required, but the owner has not defined thresholds, approver roles or separation-of-duties rules. Phase 4 therefore does **not** invent an approval chain:

- Draft creation and posting are restricted to the roles named in the SRS role table (`can_post_grn()`, `can_post_siv()`, `can_manage_purchasing()`).
- Purchase request approval is restricted to `system_admin` and `general_manager` (`can_approve_purchasing()`), matching the General Manager's SRS approval authority.
- Every posting records `posted_by`/`posted_at`; every PR decision records `decided_by_name`, `decided_at` and an optional comment; every PO approval records `approved_by`/`approved_at`. The audit log keeps each event.
- **Self-approval is not blocked**: the same user who raised a request can approve it if they hold an approval role. This stays until the owner defines separation-of-duties rules or monetary thresholds.
- No amount-based thresholds exist, so all values follow the same route.
- Counts, adjustments and waste follow the same role-only approach: manage/post = admin/GM/storekeeper, approve = admin/GM. They are built but remain subject to the OD-06 decision.

### Open issue: stock location ↔ outlet mapping (2026-11-18)

`stock_locations` is a flat list with no outlet reference, so stock cannot be scoped to an outlet by RLS. Until the owner decides the mapping, stock reads and postings are limited only by role, not by outlet. This does not affect master-data outlet scoping elsewhere.
