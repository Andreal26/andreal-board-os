import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Tiny database adapter.
 *  - DATABASE_URL set   → real Postgres (Supabase / Neon / any) via `postgres`.
 *  - DATABASE_URL empty → embedded Postgres (PGlite) in PGLITE_DIR, with optional backups to PGLITE_BACKUP.
 * Both speak the same SQL and use $1, $2 … parameters.
 */
export type Row = Record<string, any>;

interface Driver {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
}

async function createDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const postgres = (await import('postgres')).default;
    const sql = postgres(url, {
      prepare: false, // required for Supabase / Neon poolers
      max: Number(process.env.DB_POOL_MAX || 5),
      idle_timeout: 20,
      ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
    });
    return {
      async query<T>(text: string, params: unknown[] = []) {
        return (await sql.unsafe(text, params as any[])) as unknown as T[];
      },
      async exec(text: string) {
        await sql.unsafe(text);
      },
    };
  }
  return createPglite();
}

/**
 * Embedded Postgres (PGlite).
 * The live database runs on fast local disk (PGLITE_DIR). When PGLITE_BACKUP is set — on Hugging Face
 * it points into the mounted Storage Bucket (/data) — a compressed copy is written there every minute
 * after changes and on shutdown, and restored automatically when the container starts with an empty disk.
 * (Network-mounted buckets are not safe for running a database directly, so we only store backups there.)
 */
async function createPglite(): Promise<Driver> {
  const { PGlite } = await import('@electric-sql/pglite');
  const fs = await import('node:fs');
  const dir = process.env.PGLITE_DIR || './data/db';
  const backup = process.env.PGLITE_BACKUP?.trim();
  const fresh = !fs.existsSync(path.join(dir, 'PG_VERSION'));
  fs.mkdirSync(dir, { recursive: true });

  let db: InstanceType<typeof PGlite>;
  if (fresh && backup && fs.existsSync(backup)) {
    const buf = fs.readFileSync(backup);
    db = new PGlite(dir, { loadDataDir: new Blob([buf]) });
    await db.waitReady;
    console.log(`[board-os] Restored database from backup ${backup} (${Math.round(buf.length / 1024)} KB)`);
  } else {
    db = new PGlite(dir);
    await db.waitReady;
  }

  let dirty = false;
  // Anything that is not a plain SELECT may change data → schedule a backup.
  const markDirty = (text: string) => {
    if (!/^\s*select\b/i.test(text)) dirty = true;
  };
  if (backup) startBackups(db, backup, () => dirty, () => { dirty = false; });

  return {
    async query<T>(text: string, params: unknown[] = []) {
      const res = await db.query(text, params as any[]);
      markDirty(text);
      return res.rows as T[];
    },
    async exec(text: string) {
      await db.exec(text);
      dirty = true;
    },
  };
}

function startBackups(db: { dumpDataDir: (c?: 'gzip' | 'auto' | 'none') => Promise<Blob> }, file: string, isDirty: () => boolean, clean: () => void) {
  const g2 = globalThis as unknown as { __boardBackup?: boolean };
  if (g2.__boardBackup) return;
  g2.__boardBackup = true;
  let running = false;
  const write = async (reason: string) => {
    if (running || !isDirty()) return;
    running = true;
    try {
      clean();
      const blob = await db.dumpDataDir('gzip');
      const buf = Buffer.from(await blob.arrayBuffer());
      const fs = await import('node:fs');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, file);
      console.log(`[board-os] Database backup saved (${reason}, ${Math.round(buf.length / 1024)} KB)`);
    } catch (e) {
      console.error('[board-os] Database backup failed:', e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  };
  setInterval(() => void write('scheduled'), Number(process.env.PGLITE_BACKUP_SECONDS || 60) * 1000).unref?.();
  const onExit = (sig: string) => {
    write(`shutdown ${sig}`).finally(() => process.exit(0));
  };
  process.once('SIGTERM', () => onExit('SIGTERM'));
  process.once('SIGINT', () => onExit('SIGINT'));
}

type GlobalDb = { __boardDb?: Promise<Driver> };
const g = globalThis as unknown as GlobalDb;

async function init(): Promise<Driver> {
  const driver = await createDriver();
  await driver.exec(readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8'));
  await ensureAdmin(driver);
  return driver;
}

async function ensureAdmin(driver: Driver) {
  const [{ n }] = await driver.query<{ n: number }>('SELECT count(*)::int AS n FROM users');
  if (n > 0) return;
  const email = (process.env.ADMIN_EMAIL || 'admin@andreal.in').toLowerCase();
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === 'production') {
      // Never print a password: Space logs can be public. Wait for the ADMIN_PASSWORD secret instead.
      console.warn(`[board-os] No users yet. Add an ADMIN_PASSWORD secret in the Space settings (the Space restarts) to create the admin ${email}.`);
      return;
    }
    password = 'change-me-now';
  }
  const bcrypt = (await import('bcryptjs')).default;
  const name = process.env.ADMIN_NAME || 'Board Admin';
  await driver.query(
    `INSERT INTO users (email, name, password_hash, role, departments, company)
     VALUES ($1, $2, $3, 'admin', '[]'::jsonb, 'All') ON CONFLICT (email) DO NOTHING`,
    [email, name, bcrypt.hashSync(password, 10)],
  );
  console.log(`[board-os] Created first admin user ${email}. Change the password after first login.`);
}

/** Persistent app setting (key/value), e.g. the generated session-signing secret. */
export async function getSetting(key: string, create?: () => string): Promise<string | null> {
  const row = await one<{ value: string }>(`SELECT value FROM app_settings WHERE key = $1`, [key]);
  if (row) return row.value;
  if (!create) return null;
  const value = create();
  await query(`INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, [key, value]);
  return (await one<{ value: string }>(`SELECT value FROM app_settings WHERE key = $1`, [key]))!.value;
}

function getDriver(): Promise<Driver> {
  if (!g.__boardDb) {
    g.__boardDb = init().catch((err) => {
      g.__boardDb = undefined;
      throw err;
    });
  }
  return g.__boardDb;
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const d = await getDriver();
  return d.query<T>(text, params);
}

export async function one<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function audit(userId: number | null, action: string, dept: string | null, recordId: number | null, detail?: unknown) {
  await query(
    `INSERT INTO audit_log (user_id, action, dept, record_id, detail) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, action, dept, recordId, JSON.stringify(detail ?? null)],
  );
}
