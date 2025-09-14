import { getBrazilHolidays } from './ai/holidays.br.js';
import { generateSuggestion } from './ai/text.js';

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatDate(date) {
  return date.toISOString().slice(0,10);
}

export async function generateCampaign(db, orgId, {
  title,
  monthRef,
  defaultTargets = {},
  frequency = 30,
  profile = {},
  blacklistDates = [],
  timeWindows = [],
  timezone = 'America/Sao_Paulo',
  userId = null,
}) {
  const strategy = { profile, blacklistDates, timeWindows, timezone };
  const { rows:[camp] } = await db.query(
    `INSERT INTO content_campaigns (org_id,title,month_ref,default_targets,strategy_json,created_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [orgId, title, monthRef, JSON.stringify(defaultTargets||{}), JSON.stringify(strategy), userId]
  );
  const campaignId = camp.id;

  const start = new Date(monthRef);
  const year = start.getUTCFullYear();
  const holidays = new Set(getBrazilHolidays(year));
  const disabled = new Set(blacklistDates);

  const suggestions = [];
  let current = new Date(start);
  while (suggestions.length < frequency && current.getUTCMonth() === start.getUTCMonth()) {
    const dStr = formatDate(current);
    if (!disabled.has(dStr) && !holidays.has(dStr)) {
      const copy = await generateSuggestion({ prompt: JSON.stringify({ profile }) });
      const { rows:[sug] } = await db.query(
        `INSERT INTO content_suggestions (campaign_id,org_id,date,channel_targets,copy_json,ai_prompt_json)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id,date,status,copy_json`,
        [campaignId, orgId, dStr, JSON.stringify(defaultTargets||{}), JSON.stringify(copy), JSON.stringify({ profile })]
      );
      suggestions.push(sug);
    }
    current = addDays(current,1);
  }
  return { campaignId, suggestions };
}

// Checks if a suggestion can be edited. If it has approved/scheduled jobs,
// ensure all related jobs are still pending.
export async function ensureEditable(db, orgId, suggestionId) {
  const { rows:[sug] } = await db.query(
    'SELECT status, jobs_map FROM content_suggestions WHERE org_id=$1 AND id=$2',
    [orgId, suggestionId]
  );
  if (!sug) return { error: 'not_found' };
  if (['approved','scheduled'].includes(sug.status) && sug.jobs_map && Object.keys(sug.jobs_map).length) {
    for (const [channel, jobId] of Object.entries(sug.jobs_map)) {
      if (!jobId) continue;
      const table = channel === 'instagram' ? 'instagram_publish_jobs' : 'facebook_publish_jobs';
      const { rows:[job] } = await db.query(`SELECT status FROM ${table} WHERE org_id=$1 AND id=$2`, [orgId, jobId]);
      if (!job || job.status !== 'pending') return { error: 'job_locked' };
    }
    return { pendingJobs: sug.jobs_map };
  }
  return { pendingJobs: null };
}

// Cancels provided jobs by marking them as canceled.
export async function cancelJobs(db, orgId, jobs) {
  for (const [channel, jobId] of Object.entries(jobs || {})) {
    if (!jobId) continue;
    const table = channel === 'instagram' ? 'instagram_publish_jobs' : 'facebook_publish_jobs';
    await db.query(`UPDATE ${table} SET status='canceled', updated_at=now() WHERE org_id=$1 AND id=$2`, [orgId, jobId]);
  }
}
