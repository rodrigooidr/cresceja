// Simple worker to mark approved suggestions as published when jobs are done.
import { pool } from '#db';

async function run() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id FROM content_suggestions
        WHERE status IN ('approved','scheduled') AND (jobs_map = '{}'::jsonb OR jobs_map IS NULL)`
    );
    for (const r of rows) {
      await client.query(
        `UPDATE content_suggestions SET status='published', published_at=now(), updated_at=now() WHERE id=$1`,
        [r.id]
      );
    }
  } finally {
    client.release();
  }
}

run().then(()=>process.exit(0)).catch(err=>{console.error(err);process.exit(1);});
