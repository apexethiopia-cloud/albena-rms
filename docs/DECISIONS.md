# Albena RMS — Architecture Decision Records (ADR)

**Updated**: 2026-11-17 to reflect SRS v3.0 approval

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
| OD-07 Taxes, service charges, discounts | **Open** | Phase 6 |
| OD-08 Receipt format, numbering, language, currency | ✅ **ETB (Ethiopian Birr)** — numbering/format TBC | Phase 6 |
| OD-09 Reservation capacity and table assignment rules | **Open** | Phase 6 |
| OD-10 Guest profile retention and privacy rules | **Open** | Phase 6 |
| OD-11 Currency and decimal precision | ✅ **ETB — 2 decimal places assumed** | Phase 1 |
| OD-12 Hotel features scope | **Open** | Phase 6 |
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
