
import fs from 'fs';
import path from 'path';
import url from 'url';
import { query } from '../../config/db.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const migrationsDir = __dirname;

async function run(){
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for(const f of files){
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    console.log('Running migration', f);
    await query(sql);
  }
  console.log('Migrations complete');
  process.exit(0);
}

run().catch(err=>{
  console.error(err);
  process.exit(1);
});
