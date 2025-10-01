import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS = [
  '../../migrations/2025-09-29_organizations_and_plan_credits.sql',
  '../../db/migrations/20250930_integrations_core.sql',
];

function stripUnsupportedBlocks(sql) {
  return sql.replace(/DO \$\$[\s\S]*?\$\$;/g, '');
}

export async function runMigrations({ db }) {
  for (const relativePath of MIGRATIONS) {
    const filePath = resolve(__dirname, relativePath);
    const raw = await readFile(filePath, 'utf8');
    const sql = stripUnsupportedBlocks(raw);
    if (!sql.trim()) continue;
    await db.query(sql);
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const { createTestDb } = await import('./db.mem.mjs');
  const testDb = createTestDb();
  await runMigrations({ db: testDb });
  await testDb.close();
}
