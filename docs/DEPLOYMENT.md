# Albena RMS — Deployment Guide

**Created**: 2026-11-17 | **SRS Reference**: ARC-01..09, CON-03, CON-04, DATA-03..07, NFR-06, NFR-12, NFR-13, AC-16, AC-18

> [!CAUTION]
> This document must NEVER contain real API keys, database passwords, service-role keys or personal data. Use placeholder values only. Real values go in `.env.local` (never committed).

---

## 1. Services Overview

| Service | Purpose | Provider | Plan | Card Required? | Verified? |
|:---|:---|:---|:---|:---:|:---:|
| **Frontend hosting** | Serve React SPA globally | Cloudflare Pages | Free | No | ✅ |
| **Database + Auth** | PostgreSQL + Auth + Realtime | Supabase | Free (500MB, 50k MAU) | No | ✅ |
| **Source control** | Git repository | GitHub | Free (public repo) | No | ✅ |
| **CI/CD** | Automated builds on push | Cloudflare Pages (GitHub integration) | Free | No | ✅ |

> [!IMPORTANT]
> **OD-13 status: confirmed 2026-11-17** — Supabase and Cloudflare Pages free tiers are usable without a bank card.
> Two provider behaviours remain to be re-verified at launch (ARC-09, AC-18):
> 1. Supabase free-plan project pausing after inactivity.
> 2. Supabase free-plan backup/restore capabilities (see Section 4 below).

---

## 2. Environment Variables

### Frontend (Vite)
Variables prefixed with `VITE_` are exposed to the browser. Only use Supabase **anon/publishable** keys here — never the service-role key.

```bash
# .env.local  — DO NOT COMMIT
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_APP_NAME=Albena RMS
VITE_APP_TIMEZONE=Africa/Addis_Ababa   # OD-01: confirmed UTC+3
```

See `.env.example` for placeholder template.

### Supabase Edge Functions / Server-Side (if used)
The `service_role` key is used only in server-side Supabase Edge Functions and is set via the Supabase Dashboard environment secrets — never in the repository.

---

## 3. Cloudflare Pages Deployment

### Setup Steps (to be completed in Phase 1)
1. Connect GitHub repository `apexethiopia-cloud/albena-rms` to Cloudflare Pages.
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Set `NODE_VERSION` = `20` in the Pages environment variables (Vite 5 baseline).
5. Add the Supabase environment variables from Section 2 in the Cloudflare Pages dashboard.
6. Verify HTTPS is enabled by default (Cloudflare provides TLS automatically).
7. Confirm free plan limits: build minutes, bandwidth, concurrent builds.

### SPA routing and headers
- `public/_redirects` contains `/*  /index.html  200` so deep links such as `/inventory` resolve to the SPA.
- `public/_headers` sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and a long cache for hashed assets.
- Both files are copied into `dist/` by Vite and read by Cloudflare Pages automatically.

### Deployment URL
- **Production**: `https://albena-rms.pages.dev` (or custom domain — TBC)
- **Preview**: Auto-generated per branch/PR

---

## 4. Supabase Configuration

### Schema Migrations
- All database schema changes are tracked as migration files in `supabase/migrations/`.
- Never apply schema changes directly to production without a migration file committed to Git.
- Apply locally with `supabase db push` or via Supabase Dashboard SQL editor during early development.

### Row-Level Security
- **All tables must have RLS enabled** before any data is written.
- RLS policies are defined in migration files, not applied manually.
- The anon key is safe to expose in the browser **only because** RLS policies restrict what it can access.

### Edge Functions
- Server-side logic (if any) goes in `supabase/functions/`.
- Edge functions access the `service_role` key via Supabase secrets (not committed to Git).

---

## 5. Backup & Recovery

> [!WARNING]
> **Data-Loss Risk (DATA-07, OD-13)**: The Supabase free plan does not guarantee automated daily backups or point-in-time recovery. The owner must be aware of this limitation.

### Supabase Free Plan — Backup Capabilities (to verify)
| Capability | Supabase Free Plan | Status |
|:---|:---|:---:|
| Automated daily backups | Not included in free plan | ❌ |
| Point-in-time recovery | Not included in free plan | ❌ |
| Manual export via Dashboard | Available (pg_dump) | ✅ |
| Project pausing after inactivity | Yes — after ~1 week inactivity (verify at launch) | ⚠️ |
| Restore from backup | Not guaranteed on free plan; verify at launch | ⚠️ |

### Manual Backup Procedure (DATA-04)
Until automated backups are confirmed, perform manual exports before major changes:

```bash
# Using Supabase CLI (run from your machine, not committed)
supabase db dump --db-url "postgresql://..." > backup_YYYY-MM-DD.sql
```

Or use the Supabase Dashboard → Database → Backups section if available on free plan.

**Backup test requirement (AC-16, DATA-06)**: A restore test must be performed in a separate non-production Supabase project before prototype acceptance.

---

## 6. Security Checklist

Before each deployment to production:
- [ ] Run `git diff --cached` to confirm no secrets in staged changes (DEV-04).
- [ ] Confirm `.env.local` is in `.gitignore` and not tracked.
- [ ] Verify only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are in browser-delivered JS (ARC-03).
- [ ] Confirm all new tables have RLS enabled with correct policies (SEC-ROLE-01).
- [ ] Confirm audit log table has no DELETE/UPDATE permissions for ordinary roles (AUD-03).

---

## 7. Free-Tier Limit Monitoring (NFR-13)

| Provider | Metric | Free Limit | Current Usage | Last Checked |
|:---|:---|:---|:---|:---:|
| Supabase | Database size | 500 MB | 0 MB | — |
| Supabase | Monthly active users | 50,000 | 0 | — |
| Supabase | Storage | 1 GB | 0 | — |
| Supabase | Realtime messages | 2M / month | 0 | — |
| Cloudflare Pages | Builds / month | 500 | 0 | — |
| Cloudflare Pages | Bandwidth | Unlimited | 0 | — |

> These limits must be reviewed against the actual current provider terms before Phase 1 begins (ARC-09, AC-18).

---

## 8. Known Limitations

- No offline operation (CON-01, ARC-08).
- No payment gateway integration (CON-08, RCT-04).
- No connection to DigitalOcean/Odoo environment (CON-05).
- No guaranteed uptime SLA beyond Cloudflare/Supabase free plan terms (NFR-12).
- No automatic daily backups confirmed on free plan (DATA-05).
- Project pausing policy (Supabase) may cause cold-start delay after inactivity.
- Maximum 3 concurrent users validated in this prototype (NFR-01); higher capacity is a design goal but not an acceptance guarantee (NFR-02).
