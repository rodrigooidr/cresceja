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
