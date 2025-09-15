import db from '../../db/index.js';

export async function createImportRun({ orgId, channelAccountId, windowStart, windowEnd }) {
  const { rows } = await db.query(
    `INSERT INTO import_runs (org_id, channel_account_id, window_start, window_end)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [orgId, channelAccountId, windowStart, windowEnd]
  );
  return rows[0];
}

export async function bumpImportCounters(runId, { messages = 0, attachments = 0 }) {
  await db.query(
    `UPDATE import_runs
       SET messages_imported = messages_imported + $1,
           attachments_imported = attachments_imported + $2
     WHERE id=$3`,
    [messages, attachments, runId]
  );
}

export async function finishImportRun(runId, errorOrNull) {
  if (errorOrNull) {
    await db.query(
      `UPDATE import_runs
          SET finished_at = now(),
              errors = errors || $2::jsonb
        WHERE id=$1`,
      [runId, JSON.stringify([String(errorOrNull.message || errorOrNull)])]
    );
  } else {
    await db.query(`UPDATE import_runs SET finished_at = now() WHERE id=$1`, [runId]);
  }
}

export async function getLastImportRun(orgId, channelAccountId) {
  const { rows } = await db.query(
    `SELECT * FROM import_runs
      WHERE org_id=$1 AND channel_account_id=$2
   ORDER BY finished_at DESC NULLS LAST, started_at DESC
      LIMIT 1`,
    [orgId, channelAccountId]
  );
  return rows[0] || null;
}
