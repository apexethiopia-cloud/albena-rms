# Supabase — Albena RMS backend

Phase 2–4 schema, RLS policies and seed data live here. Every change must be a committed
migration file (ARC-05); never edit the remote database by hand.

## 1. Apply migrations

### Option A — Supabase CLI (preferred)

```bash
supabase link --project-ref naxhjpmaovnuplfjdgdu
supabase db push
```

### Option B — SQL editor

Paste each file from `supabase/migrations/` into the Supabase SQL editor **in filename order**
and run it. All migrations are idempotent and safe to re-run.

## 2. Create the three test users

Auth users cannot be created with the publishable (anon) key. Use one of:

### Option A — Dashboard

Supabase Dashboard → Authentication → Users → **Add user** (email + password, auto-confirm).
Repeat for three accounts. A profile row is created automatically by the
`on_auth_user_created` trigger.

### Option B — Local script

```bash
# .env.local must contain SUPABASE_SERVICE_ROLE_KEY (never commit it)
node scripts/seed-test-users.mjs
```

The script reads:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
TEST_USER_1_EMAIL=...
TEST_USER_1_PASSWORD=...
TEST_USER_2_EMAIL=...
TEST_USER_2_PASSWORD=...
TEST_USER_3_EMAIL=...
TEST_USER_3_PASSWORD=...
```

It creates the accounts (idempotently), assigns roles and grants all five outlets,
matching OD-03 ("full/all-access for the initial three test users").

## 3. Schema map

### Phase 2 — identity and outlets

| Table | Purpose | RLS |
| :--- | :--- | :--- |
| `roles` | Role catalogue; role code is the permission unit | read: active users · write: admin |
| `user_profiles` | Business profile per auth user, active/disabled status | read: self + management · update: self (name only) or admin |
| `user_roles` | Role assignments | read: self + management · writes only through `admin_assign_role()` / `admin_revoke_role()` |
| `outlets` | Single entity, multiple outlets (OD-02) | read: active users · write: admin |
| `user_outlet_scopes` | Outlet access per user | read: self + admin · write: admin |
| `audit_logs` | Append-only audit trail | read: admin/GM/auditor · no write policy |

### Phase 3 — master data (migrations 0003/0004, applied 2026-11-18)

| Table | Purpose | RLS |
| :--- | :--- | :--- |
| `stock_locations` | Stores that hold stock (INV-03) | read: active users · write: admin/GM |
| `item_categories` | User-maintainable categories (INV-02) | read: active users · write: admin/GM |
| `units` | Unit catalogue; `base_factor NULL` means the size is item-specific (ADR-010) | read: active users · write: admin/GM |
| `item_unit_conversions` | Per-item factor from a purchase unit to the base unit | read: active users · write: admin/GM/purchasing/storekeeper/chef |
| `suppliers` | Supplier master (SUP-01..03) | read: active users · write: admin/GM/purchasing |
| `items` | Item master; balances never live here (ADR-007) | read: active users · write: admin/GM/purchasing/storekeeper/chef |

Seed data: 4 stock locations, 9 item categories, and the unit catalogue. Only kg→g and L→ml
carry a fixed factor. Box, carton and sack have `base_factor = NULL` and must be given an
explicit factor per item — the system never invents one (CON-07).

## 4. Authorization rules worth remembering

- Helper functions (`is_active_user`, `has_role`, `is_admin`) are `SECURITY DEFINER` so
  policies never recurse into `user_roles`/`user_profiles` RLS.
- A signed-in user with no `user_profiles` row sees nothing: `is_active_user()` returns false.
- Disabling an account takes effect on the next request; historical records keep the attribution
  (SEC-ROLE-05).
- `audit_logs` is written only by triggers. `authenticated` has no INSERT/UPDATE/DELETE grant. For join tables without an `id`, the trigger records the `user_id` as the entity reference.
- Role revocation (`admin_revoke_role`) keeps at least one role on the account and at least one active `system_admin` in the system; self-revocation follows the same rule. Direct table writes are revoked to prevent bypass (ADR-018).

## 5. AC-02 negative test

Run `supabase/tests/ac02_rls_negative_test.sql` in the Supabase SQL editor (as the project owner).
It is read-only in effect: everything runs inside a transaction that is rolled back at the end.
It checks anon/authenticated denials, RPC privilege boundaries and role-gated writes, and it
reports the currently missing outlet-scope RLS predicates as an explicit AC-02 gap. No keys,
passwords or personal data are stored in the file. See `docs/TESTING.md` section 10.
