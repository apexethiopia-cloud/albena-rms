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

## Open Decisions Log (OD-01 to OD-13)

> These require owner confirmation before the relevant phase begins. Developers must NOT invent business policy.
> See `docs/REQUIREMENTS_TRACEABILITY.md` Open Decisions Tracking table for full detail.

| ID | Status | Phase Needed By |
|:---|:---:|:---:|
| OD-01 Business timezone | **Open** | Phase 1 |
| OD-02 Single entity vs multi-tenant | **Open** | Phase 2 |
| OD-03 Test user role/outlet assignments | **Open** | Phase 2 |
| OD-04 Inventory costing method | **Open** | Phase 4 |
| OD-05 Unit conversion rules | **Open** | Phase 4 |
| OD-06 Approval thresholds and SoD | **Open** | Phase 4 |
| OD-07 Taxes, service charges, discounts | **Open** | Phase 6 |
| OD-08 Receipt format, numbering, language, currency | **Open** | Phase 6 |
| OD-09 Reservation capacity and table assignment rules | **Open** | Phase 6 |
| OD-10 Guest profile retention and privacy rules | **Open** | Phase 6 |
| OD-11 Currency and decimal precision | **Open** | Phase 1 |
| OD-12 Hotel features scope | **Open** | Phase 6 |
| OD-13 Free-tier eligibility and backup/restore expectations | **Open** | Phase 1 |
