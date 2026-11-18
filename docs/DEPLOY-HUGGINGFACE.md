# Deploying to a Hugging Face Space

The repository root is a ready Docker Space: `README.md` carries the Space metadata (`sdk: docker`,
`app_port: 7860`) and `Dockerfile` builds and runs the app.

## 1. Create the Space
huggingface.co → **New Space** → SDK **Docker** → *Blank* → visibility **Private** (recommended — HF then asks for a
Hugging Face login before anyone reaches the app's own login page).

## 2. Storage — required
Hugging Face has retired the old "Persistent storage". Use a **Storage Bucket** instead:
Space → Settings → **Storage Buckets** → *Mount a bucket* → create a new bucket (e.g. `andreal-board-os-data`) →
mount path **`/data`** → **read-write**. Buckets are free up to Hugging Face's free storage allowance; the backup is only a few MB.

How the data is kept safe: the live database runs on the Space's fast local disk, and a compressed backup is written to
`/data/board-os-db.tar.gz` (the bucket) within a minute of any change. When the Space restarts or rebuilds, the app
restores the latest backup automatically. Network buckets are not suitable for running a database directly, which is why
only the backup lives there. **Without a mounted bucket, every restart wipes all data.**

Alternative: create a free Postgres on Supabase or Neon and add its connection string as the `DATABASE_URL` secret
(use the *pooled* URL). Then no bucket is needed.

## 3. Keep it awake
Free *CPU basic* hardware sleeps after 48 hours without visits and cannot be set to "Don't sleep"; on paid hardware set
Settings → **Sleep time** → *Don't sleep*, so the 06:00 – 09:00 jobs run on time. (A sleeping Space wakes on the next visit;
jobs missed that day run then.)

## 4. Variables and secrets
Space → Settings → **Variables and secrets**:

| Name | Type | Notes |
|---|---|---|
| `ADMIN_PASSWORD` | **Secret — required** | Password of the first admin. Used only while the database has no users. (It is never printed: Space logs can be public.) |
| `ADMIN_EMAIL` | Variable | Default `admin@andreal.in` |
| `APP_URL` | Variable | `https://<user>-<space>.hf.space` so email links work |
| `AUTH_SECRET` | Secret, optional | If empty, generated once and stored in the database |

Email (free Gmail SMTP): `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS` (a Gmail **App Password**,
not your normal password), `MAIL_FROM`, `BOARD_EMAILS` (comma-separated). Everything else: see `.env.example`.

## 5. Push the code
```bash
git clone https://huggingface.co/spaces/<user>/<space>
cp -r andreal-board/. <space>/            # include Dockerfile, README.md and dot-files
cd <space>
git add . && git commit -m "Board OS" && git push
```
(Or upload the files in the Space's *Files* tab.) The build takes ~3–5 minutes; the Space then starts on port 7860.

## 6. First login
Open `https://<user>-<space>.hf.space` (works inside the huggingface.co page too), sign in with `ADMIN_EMAIL` and the
`ADMIN_PASSWORD` you set, then
Settings → **Change my password** → add users → Targets → start entering data.

## Updating
Push new commits — the Space rebuilds automatically. Data on `/data` (or in your external Postgres) is kept.

## Backups
- The bucket always holds the latest `board-os-db.tar.gz` (download it from the bucket page to keep an offline copy).
- Export each department as CSV from its page.
- With an external Postgres, use your provider's backups.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Data disappears after restart | No Storage Bucket mounted at `/data` (read-write). Check the logs for `Database backup saved` / `Restored database`. |
| "No admin account yet" on login | Add the `ADMIN_PASSWORD` secret; the Space restarts and creates the admin. |
| Forgot the admin password | Another admin resets it in Settings → Users. `ADMIN_PASSWORD` is only used when there are no users. |
| "Cross-site request blocked" | Set `APP_URL` to the exact `https://…hf.space` address. |
| No emails | Check Settings → System (SMTP status) and the Space logs (`[mail:dry-run]` means SMTP isn't set). |
| Jobs didn't run | Space was asleep — set Sleep time to *Don't sleep*; check Settings → Scheduled jobs. |
