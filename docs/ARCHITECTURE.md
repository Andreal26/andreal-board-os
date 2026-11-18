# Architecture

Board OS is a single Next.js 15 (App Router, TypeScript) application. One container serves the UI,
the JSON API and the background scheduler; the database is Postgres — embedded PGlite on local disk with a
backup to the mounted Storage Bucket every minute (restored automatically on start), or any external Postgres via `DATABASE_URL`.

```
Browser ──► middleware.ts (session + CSRF check)
              │
              ├─► app/(dashboard)/…  server components ──► server/* services ──► db/client.ts ──► Postgres
              │                                       └──► config/* (fields, metrics, rules)
              └─► app/api/…          route handlers   ──► server/* services
instrumentation.ts ─► server/boot.ts ─► schema + first-start seed + server/scheduler.ts (daily jobs)
```

## Folder map

| Folder | What lives there | Rules of thumb |
|---|---|---|
| `app/` | **Routes only.** `(auth)/login`, `(dashboard)/…` pages, `api/…` route handlers, root layout, global CSS. | Pages fetch data through `server/*` and render `components/*`. No business logic here. |
| `components/` | React UI, grouped by feature: `layout/`, `dashboard/`, `charts/`, `records/`, `targets/`, `admin/`, `ui/`. | Files with `'use client'` run in the browser and talk to `app/api/*`. They may import `config/`, `lib/`, `types/` — never `server/` or `db/`. |
| `server/` | **Business logic / services** (Node only): auth & roles, records data access, KPI engine, board aggregation, alerts, snapshots, weekly pack, mailer, scheduler, seed, route helpers, `integrations/`. | Anything that touches the database, secrets, email or external APIs. |
| `config/` | **Declarative configuration**: department field definitions (`departments.ts`), dropdown lists (`lists.ts`), KPI definitions and dashboard layout (`metrics.ts`), RAG thresholds (`health.ts`), job timetable (`schedule.ts`). | Change behaviour here first; most changes need no code elsewhere. |
| `lib/` | **Pure utilities** shared by server and browser: formatting (₹, %, dates), periods (Indian FY), validation/normalisation, target maths, session token signing, small helpers. | No database, no Node-only APIs (except `session.ts`, which is edge-safe). |
| `types/` | Shared TypeScript types (`DeptKey`, `Field`, `Metric`, `User`, `Alert`, …). | Import types from `@/types`. |
| `db/` | `schema.sql` (applied on every start, idempotent), `client.ts` (Postgres / PGlite adapter), `migrations/` for future structural changes. | |
| `data/` | `seed/` — workbook R&D initiatives and demo vocabulary (JSON). `templates/` — CSV import templates per department. `db/` — the local database files (git-ignored). | Regenerate templates with `npm run templates`. |
| `scripts/` | CLI tasks: `seed.ts` (seed / demo data), `generate-csv-templates.ts`. | Run with `tsx`; they use the same `@/` imports. |
| `docs/` | This file, deployment, integrations and the user guide. | |
| root | `middleware.ts` (auth gate + CSRF), `instrumentation.ts` (startup hook), `Dockerfile`, `.env.example`, config files. | |

Imports always use the `@/` alias (e.g. `@/server/records`, `@/config/metrics`).

## Data model (`db/schema.sql`)

| Table | Purpose |
|---|---|
| `users` | Login, role (`admin` / `ceo` / `owner` / `viewer`), departments an owner can edit, company scope. |
| `records` | Every department row: `dept`, `company`, `data` (JSONB — fields from `config/departments.ts`), `source` (manual / import / demo / seed / zoho / meta / google_ads / linkedin), `external_id` for idempotent syncs. |
| `targets` | Monthly target per metric per company (`All`, `Andreal`, `Anderson`). |
| `dept_notes` | Owner-written status, major risk, decision needed, owner, deadline per department. |
| `snapshots` | Daily copy of every KPI per company — powers "change vs last week". |
| `alert_log` | Every alert raised by the daily digest. |
| `sync_runs` | Integration run history. |
| `job_state` | Last run of each scheduled job (prevents double runs, enables catch-up). |
| `audit_log` | Who created / updated / deleted what. |
| `app_settings` | Key/value settings, e.g. the generated session-signing secret. |

Computed fields (delay days, weighted pipeline, CPL…) are **not stored** — `withComputed()` in
`config/departments.ts` adds them whenever a record is read, so a formula change applies to all history.

## Request flow example — saving a Sales opportunity

1. `components/records/RecordForm.tsx` (client) posts JSON to `POST /api/records/sales`.
2. `middleware.ts` verifies the session cookie and that the request comes from the app's own origin.
3. `app/api/records/[dept]/route.ts` checks the role (`server/auth.ts → canEditDept`), cleans and validates
   the input (`lib/validation.ts → normalize`) and calls `server/records.ts → createRecord`.
4. `createRecord` inserts into `records` and writes `audit_log`.
5. The Executive Summary recomputes on next load: `server/board.ts → getBoard()` loads records, evaluates
   `config/metrics.ts` via `server/kpi-engine.ts`, applies targets and `config/health.ts`.

## Background jobs

`instrumentation.ts` → `server/boot.ts` runs once per server start: applies the schema, creates the first admin,
loads the workbook R&D initiatives into an empty database, and (in production) starts `server/scheduler.ts`.
The scheduler ticks every minute and runs each job in `config/schedule.ts` once per day (India time).
Admins can run any job from Settings (`POST /api/cron/<job>`).
