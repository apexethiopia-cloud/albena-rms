# Albena RMS — Architecture Decision Records (ADR)

This document records key architectural, technological, and procedural decisions.

---

## ADR 001: Cloud-Native, Zero-Offline Architecture
- **Date**: 2026-11-16
- **Status**: Accepted
- **Context**: The system is designed as a live web-based prototype to be tested simultaneously by three users situated in different physical/geographic locations.
- **Decision**: Albena RMS will be implemented strictly as a cloud-native single-page web application (SPA) backed by Supabase PostgreSQL. Offline-first synchronization, local SQLite, and IndexedDB cache persistence are explicitly out of scope for this prototype.
- **Consequences**:
  - Dramatically simplifies data consistency, transaction handling, and schema migrations.
  - Eliminates multi-master conflict resolution logic.
  - Relies on continuous internet connectivity during testing sessions.

---

## ADR 002: Technology Stack & Free-Tier Strictness
- **Date**: 2026-11-16
- **Status**: Accepted
- **Context**: The project mandate requires utilizing free service tiers wherever possible, avoiding charges without explicit owner approval.
- **Decision**:
  - **Frontend**: React + TypeScript + Vite + Tailwind CSS.
  - **Backend & Database**: Supabase (PostgreSQL with built-in Auth, Realtime, and Row Level Security).
  - **Hosting**: Cloudflare Pages (Free Tier: unlimited bandwidth, automatic preview deployments).
  - **Source Control**: GitHub (Public repository).
- **Consequences**: Zero recurring infrastructure costs for prototyping. Enforces careful database schema sizing (under 500MB free quota limit) and selective real-time listener usage.

---

## ADR 003: Database-Enforced Row-Level Security (RLS) Over Client Checks
- **Date**: 2026-11-16
- **Status**: Accepted
- **Context**: Three users with different organizational responsibilities (Manager, Chef/Inventory, Cashier/Server) will access the same shared database concurrently across locations.
- **Decision**: Every table must enable PostgreSQL Row Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Authorization rules, role checks, and branch tenant isolation will be enforced natively within PostgreSQL policies based on `auth.uid()` and user profile role associations. Frontend permission gates are strictly for user experience (UI display) and never treated as a security boundary.
- **Consequences**: Completely secures the database even if client-side code is bypassed or public Supabase anon keys are inspected.

---

## ADR 004: Public Repository Secret Isolation Policy
- **Date**: 2026-11-16
- **Status**: Accepted
- **Context**: The Git repository is hosted publicly on GitHub (`apexethiopia-cloud/albena-rms`).
- **Decision**:
  - Absolutely zero API secrets, database passwords, private keys, or Supabase `service_role` keys will be committed to the repository.
  - `.gitignore` explicitly excludes `.env*` files with exceptions only for `.env.example`.
  - Frontend code will strictly consume public Vite environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  - All mock or seed data must contain non-sensitive, fictional test data.
- **Consequences**: Protects against credential compromise while maintaining open collaboration.
