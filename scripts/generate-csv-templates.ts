/**
 * Writes an empty CSV template per department to data/templates/ (header row = field labels).
 * Run after changing config/departments.ts:  npm run templates
 * The same templates can be downloaded in the app from each department page ("CSV template").
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEPARTMENTS, DEPT_KEYS } from '@/config/departments';

const dir = path.join(process.cwd(), 'data', 'templates');
mkdirSync(dir, { recursive: true });
const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
for (const d of DEPT_KEYS) {
  const cols = DEPARTMENTS[d].fields.filter((f) => !f.compute).map((f) => esc(f.label));
  writeFileSync(path.join(dir, `${d}.csv`), '﻿' + cols.join(',') + '\n');
  console.log(`✓ data/templates/${d}.csv (${cols.length} columns)`);
}
