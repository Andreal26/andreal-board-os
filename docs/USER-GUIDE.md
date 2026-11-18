# User guide

## Roles
| Role | Can |
|---|---|
| **admin** | Everything: users, targets, jobs, demo data, all departments. |
| **ceo** | See everything, set targets, write department notes. |
| **owner** | Add / edit / import records of the departments assigned to them; see the summaries. |
| **viewer** | Read-only. |

A user can be locked to one company (Andreal or Anderson). HR records are visible only to admin, CEO and HR owners.

## Daily / weekly rhythm (from the workbook README)
- **Daily** — Cashflow entries, Sales follow-ups, Operations risks. Alerts arrive by email at 08:30.
- **Weekly** — each owner updates the Department Summary (risk, decision needed, owner, deadline) before the review.
  The board pack is emailed Monday 09:00 and can be printed from *Weekly board pack*.
- **Monthly** — CEO / board review of the Executive Summary; admin / CEO set next month's targets.

## Entering data
- Each department page lists its records; **+ Add record** opens the form. Fields marked **auto** are calculated.
- Required fields are marked `*`. Dropdowns use the agreed lists, so the summaries count correctly.
- **Import CSV**: download the *CSV template* (or use `data/templates/<dept>.csv`), fill it, choose *Check file*,
  then *Import*. Rows with errors are listed and skipped. Dates may be dd/mm/yyyy.
- Marketing: one row per campaign per month. Cashflow: keep receivable ageing current on open invoices
  (set the buckets to 0 once collected). Sales: leave Probability blank to use the stage default.

## Reading the dashboard
- Colours on KPI values: green = on/above target, amber = within 15%, red = more than 15% off; white = no target set.
- "now" metrics are the current state (pipeline, open jobs, receivables); "period" metrics are counted inside the
  selected period (spend, leads, collections). Targets for period metrics are pro-rated to the days elapsed.
- Department health shows **No data** until a department enters records.
