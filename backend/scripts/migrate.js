// backend/scripts/migrate.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '#db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const dir = path.resolve(__dirname, '../db/migrations');
  const files = (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migrations found.');
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS public.__migrations (
      id serial primary key,
      filename text unique not null,
      applied_at timestamptz not null default now()
    );
  `);

  const done = new Set(
    (await query(`SELECT filename FROM public.__migrations ORDER BY filename`)).rows
      .map(r => r.filename)
  );

  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    console.log('Applying', f, '...');
    await query('BEGIN');
    try {
      await query(sql);
      await query('INSERT INTO public.__migrations(filename) VALUES($1)', [f]);
      await query('COMMIT');
      console.log('Applied', f);
    } catch (e) {
      await query('ROLLBACK');
      console.error('FAILED', f, e);
      process.exit(1);
    }
  }

  console.log('Migrations complete.');
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
