---
title: Andreal Board OS
emoji: 📊
colorFrom: gray
colorTo: red
sdk: docker
app_port: 7860
pinned: false
---

# Andreal · Anderson — Board OS

CEO / Controller / Board control system built from the **Board Dashboard (05_2026)** workbook:
six department modules (Operations, Sales, Marketing, HR, Cashflow / Accounts, R&D), an Executive Summary,
a Department Summary, monthly targets, exception alerts, a weekly board pack, and integrations with
Zoho CRM, Meta, Google Ads and LinkedIn. Runs as a **Hugging Face Space (Docker)**.

**Stack:** Next.js 15 · TypeScript · PostgreSQL (embedded PGlite or external) · Tailwind CSS · Recharts · Nodemailer

---

## Project structure

```
andreal-board/
├── app/                         # Routes only (Next.js App Router)
│   ├── (auth)/login/            #   Sign-in page
│   ├── (dashboard)/             #   Signed-in area (shared sidebar layout)
│   │   ├── page.tsx             #     Executive summary
│   │   ├── departments/         #     Department summary
│   │   ├── d/[dept]/            #     Department data: list · new · [id] edit
│   │   ├── targets/             #     Monthly targets
│   │   ├── alerts/              #     Exception alerts
│   │   ├── reports/weekly/      #     Weekly board pack (print / PDF)
│   │   └── settings/            #     Users, jobs, integrations, demo data, audit
│   ├── api/                     #   JSON API (records, import, export, targets, users, cron, auth…)
│   ├── layout.tsx · globals.css · icon.svg · not-found.tsx
│
├── components/                  # React UI, grouped by feature
│   ├── layout/                  #   Shell (sidebar), NavLink, FilterBar
│   ├── dashboard/               #   KpiCard, StatusBadges (RAG), DeptNotesEditor
│   ├── charts/                  #   BoardCharts (pipeline, funnel, cash, ageing, jobs)
│   ├── records/                 #   RecordTable, RecordForm, ImportDialog
│   ├── targets/                 #   TargetsEditor
│   ├── admin/                   #   UsersAdmin, ChangePassword, RunJobButton, DemoDataButtons
│   └── ui/                      #   Small shared widgets (PrintButton)
│
├── server/                      # Business logic / services (Node only)
│   ├── auth.ts                  #   Login, sessions, roles & permissions
│   ├── records.ts               #   Department records data access
│   ├── kpi-engine.ts            #   Evaluates metrics, targets, health, CEO questions, chart data
│   ├── board.ts                 #   Assembles everything a dashboard page needs
│   ├── alerts.ts                #   Exception rules + daily digest email
│   ├── snapshots.ts             #   Daily KPI snapshots (week-on-week change)
│   ├── weekly-pack.ts           #   Weekly board pack email
│   ├── scheduler.ts             #   Built-in daily job runner (India time)
│   ├── mailer.ts                #   SMTP email
│   ├── seed.ts                  #   Workbook R&D + demo data loaders
│   ├── boot.ts                  #   Startup: schema, first admin, seed, scheduler
│   ├── route-helpers.ts         #   Shared helpers for API route handlers
│   └── integrations/            #   zoho · meta · google-ads · linkedin (+ registry, shared)
│
├── config/                      # Declarative configuration — change behaviour here first
│   ├── departments.ts           #   All fields of the 6 departments + auto-calculations
│   ├── lists.ts                 #   Dropdown values (from Lists_Do_Not_Delete)
│   ├── metrics.ts               #   KPI definitions + Executive Summary layout
│   ├── health.ts                #   RAG thresholds per department
│   └── schedule.ts              #   Job timetable
│
├── lib/                         # Pure utilities (server + browser)
│   ├── format.ts                #   ₹ / % / date formatting (Indian style)
│   ├── periods.ts               #   WTD / MTD / QTD / FYTD (April–March)
│   ├── validation.ts            #   Input cleaning & validation (forms, CSV, integrations)
│   ├── kpi-utils.ts             #   Target attainment maths
│   ├── session.ts               #   Signed session token (edge-safe)
│   └── utils.ts                 #   Number / date helpers
│
├── types/index.ts               # Shared TypeScript types
├── db/                          # Database
│   ├── schema.sql               #   Tables (applied automatically, idempotent)
│   ├── client.ts                #   Postgres / PGlite adapter
│   └── migrations/              #   Future structural changes
├── data/                        # Data files
│   ├── seed/                    #   workbook-rnd.json · demo-vocabulary.json
│   ├── templates/               #   CSV import templates, one per department
│   └── db/                      #   Local database files (git-ignored)
├── scripts/                     # CLI: seed.ts · generate-csv-templates.ts
├── docs/                        # ARCHITECTURE · DEPLOY-HUGGINGFACE · INTEGRATIONS · USER-GUIDE
├── public/                      # Static files
├── middleware.ts                # Auth gate + CSRF protection
├── instrumentation.ts           # Server startup hook → server/boot.ts
├── Dockerfile · .dockerignore   # Hugging Face Space image (port 7860)
└── .env.example                 # Every setting, documented
```

Imports use the `@/` alias (`@/server/records`, `@/config/metrics`, `@/types`). Full details: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Quick start (local)

```bash
npm install
npm run db:demo      # local database in data/db + admin user + workbook R&D + demo rows
npm run dev          # http://localhost:3000 — admin@andreal.in / change-me-now
```

| Script | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript check |
| `npm run db:seed` | Schema + admin + workbook R&D initiatives |
| `npm run db:demo` | …plus demo rows (marked `demo`) |
| `npm run db:seed -- --clear-demo` | Remove demo rows |
| `npm run templates` | Regenerate `data/templates/*.csv` after changing `config/departments.ts` |

The local embedded database allows one process at a time — stop `npm run dev` before running seed scripts.

## Deploy

On your Hugging Face Space: Docker SDK · mount a **Storage Bucket at `/data`** (read-write — the database backs up there
every minute and restores on restart) · add the `ADMIN_PASSWORD` secret and `ADMIN_EMAIL` / `APP_URL` variables ·
push this folder. Step by step: **[docs/DEPLOY-HUGGINGFACE.md](docs/DEPLOY-HUGGINGFACE.md)**.

## More
- **[docs/USER-GUIDE.md](docs/USER-GUIDE.md)** — roles, daily/weekly rhythm, entering and importing data, reading the dashboard
- **[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)** — Zoho CRM, Meta, Google Ads, LinkedIn setup (off until enabled)
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — folders, data model, request flow, background jobs

## Common changes

| To change… | Edit |
|---|---|
| Department fields / auto-calculations | `config/departments.ts` (no migration needed), then `npm run templates` |
| Dropdown values | `config/lists.ts` |
| KPIs and the Executive Summary layout | `config/metrics.ts` |
| Health (RAG) thresholds | `config/health.ts` |
| Alert rules | `server/alerts.ts` |
| Job times | `SCHEDULE_*` env vars (`config/schedule.ts`) |
| Brand colours / fonts | `tailwind.config.ts`, `app/globals.css` |
