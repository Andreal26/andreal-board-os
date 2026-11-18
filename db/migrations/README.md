# Migrations

`db/schema.sql` is applied on every start and only uses `CREATE … IF NOT EXISTS`, so new tables and
indexes can simply be added there.

For changes that alter existing tables (rename a column, change a type, backfill data), add a numbered
SQL file here — e.g. `001_add_budget_owner.sql` — and run it once against the database
(Supabase SQL editor, `psql`, or a one-off script). Department fields never need a migration: they
live in the JSONB `records.data` column and are defined in `config/departments.ts`.
