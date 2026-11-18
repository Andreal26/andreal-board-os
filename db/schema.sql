-- ─────────────────────────────────────────────────────────────
-- Andreal Board OS — database schema (PostgreSQL)
-- Idempotent: applied automatically on every start by db/client.ts (CREATE … IF NOT EXISTS).
-- Department rows live in one `records` table as JSONB, so fields can be added or renamed in
-- config/departments.ts without a migration. Put future structural changes in db/migrations/.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer',      -- admin | ceo | owner | viewer
  departments   JSONB NOT NULL DEFAULT '[]'::jsonb,  -- department keys an owner may edit
  company       TEXT NOT NULL DEFAULT 'All',         -- All | Andreal | Anderson
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS records (
  id          SERIAL PRIMARY KEY,
  dept        TEXT NOT NULL,                 -- operations | sales | marketing | hr | cashflow | rnd
  company     TEXT NOT NULL,                 -- Andreal | Anderson
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  source      TEXT NOT NULL DEFAULT 'manual',-- manual | import | zoho | meta | google_ads | linkedin | seed
  external_id TEXT,
  created_by  INT,
  updated_by  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS records_dept_company_idx ON records (dept, company);
CREATE UNIQUE INDEX IF NOT EXISTS records_external_idx ON records (dept, source, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS targets (
  id      SERIAL PRIMARY KEY,
  company TEXT NOT NULL,          -- All | Andreal | Anderson
  metric  TEXT NOT NULL,          -- metric id from config/metrics.ts
  month   TEXT NOT NULL,          -- YYYY-MM
  value   DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company, metric, month)
);

CREATE TABLE IF NOT EXISTS dept_notes (
  dept            TEXT PRIMARY KEY,
  status          TEXT,
  major_risk      TEXT,
  decision_needed TEXT,
  owner           TEXT,
  deadline        TEXT,
  notes           TEXT,
  updated_by      INT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS snapshots (
  id        SERIAL PRIMARY KEY,
  snap_date DATE NOT NULL,
  company   TEXT NOT NULL,
  metrics   JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snap_date, company)
);

CREATE TABLE IF NOT EXISTS alert_log (
  id         SERIAL PRIMARY KEY,
  run_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  rule       TEXT NOT NULL,
  severity   TEXT NOT NULL,
  dept       TEXT NOT NULL,
  company    TEXT,
  record_id  INT,
  message    TEXT NOT NULL,
  emailed_to TEXT
);
CREATE INDEX IF NOT EXISTS alert_log_run_idx ON alert_log (run_at);

CREATE TABLE IF NOT EXISTS sync_runs (
  id          SERIAL PRIMARY KEY,
  integration TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'running', -- running | ok | error | skipped
  rows        INT NOT NULL DEFAULT 0,
  message     TEXT
);

CREATE TABLE IF NOT EXISTS job_state (
  job          TEXT PRIMARY KEY,           -- sync | snapshot | alerts | weekly
  last_run_on  TEXT,                       -- YYYY-MM-DD (India time)
  last_status  TEXT,
  last_message TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id        SERIAL PRIMARY KEY,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id   INT,
  action    TEXT NOT NULL,
  dept      TEXT,
  record_id INT,
  detail    JSONB
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,                    -- e.g. auth_secret (generated when AUTH_SECRET is not set)
  value TEXT NOT NULL
);
