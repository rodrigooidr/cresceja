#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '#db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlFile = path.join(__dirname, '../db/migrations/alltables.sql');

async function run() {
  console.log(`Recreating tables using ${sqlFile}`);
  const sql = fs.readFileSync(sqlFile, 'utf8');
  await query(sql);
  console.log('All tables recreated successfully');
}

run().catch((err) => {
  console.error('Error recreating tables:', err);
  process.exit(1);
});
