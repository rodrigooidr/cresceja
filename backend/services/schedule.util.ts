// Lightweight scheduling helper for 30-day content calendars
// Requires: luxon
import { DateTime, Interval } from "luxon";

/* ----------------------------- Types & Shapes ----------------------------- */

export type Channel = "ig" | "fb";

export type Targets = {
  ig: { enabled: boolean; accountId?: string | null };
  fb: { enabled: boolean; pageId?: string | null };
};

export type TimeWindow = { start: string; end: string }; // 'HH:mm'
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type GenerateArgs = {
  orgId: string;
  monthRef: string; // 'YYYY-MM-01'
  frequency: number; // suggestions to create
  defaultTargets: Targets;
  timeWindows: TimeWindow[];
  weekdayWeights?: Partial<Record<Weekday, number>>;
  blacklistDates?: string[]; // 'YYYY-MM-DD'
  timezone?: string; // default 'America/Sao_Paulo'
  seed?: string;
};

export type PlanLimits = {
  igDaily: number;
  fbDaily: number;
};

export type ExistingJob = {
  channel: Channel;
  tsUtc: string; // ISO in UTC
};

export type ScheduleCtx = {
  plan: PlanLimits;
  minGapHoursPerChannel: number; // e.g., 6
  existingJobs: ExistingJob[]; // pending/scheduled jobs for the month
  holidays: string[]; // 'YYYY-MM-DD'
};

export type SuggestionDraft = {
  date: string;              // 'YYYY-MM-DD' (org TZ)
  time: string;              // 'HH:mm:ssZZ' (org TZ with offset, e.g. '14:05:00-03:00')
  channel_targets: Targets;  // enabled + ids
  status: "suggested" | "skipped";
  reason?: string;           // when skipped
};

/* --------------------------------- PRNG ---------------------------------- */

// Simple deterministic hash → uint32
function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// mulberry32 PRNG
function mulberry32(a: number) {
  return function rand(): number {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------- Date utils ------------------------------ */

const DOW: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; // JS-style base

function toWeekday(dt: DateTime): Weekday {
  // Luxon: 1=Mon..7=Sun
  const map: Record<number, Weekday> = {1:"mon",2:"tue",3:"wed",4:"thu",5:"fri",6:"sat",7:"sun"};
  return map[dt.weekday]!;
}

function listDaysInMonth(monthRef: string, tz: string): DateTime[] {
  const first = DateTime.fromISO(monthRef, { zone: tz }).startOf("day");
  const last  = first.endOf("month").startOf("day");
  const out: DateTime[] = [];
  for (let d = first; d <= last; d = d.plus({ days: 1 })) out.push(d);
  return out;
}

function parseHM(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  return { h, m: m || 0 };
}

function roundTo5(dt: DateTime): DateTime {
  const m = Math.round(dt.minute / 5) * 5;
  return dt.set({ minute: m, second: 0, millisecond: 0 });
}

/* --------------------------- Weighted sampling --------------------------- */

type Weighted<T> = { item: T; w: number };

function normalizeWeights<T>(arr: Weighted<T>[], jitter: () => number): void {
  // add ±5% jitter deterministically
  let sum = 0;
  for (const el of arr) {
    const j = 1 + ((jitter() - 0.5) * 0.1); // ±5%
    el.w = Math.max(0, el.w * j);
    sum += el.w;
  }
  if (sum <= 0) {
    const uniform = 1 / arr.length;
    for (const el of arr) el.w = uniform;
    return;
  }
  for (const el of arr) el.w = el.w / sum;
}

function weightedSampleWithoutReplacement<T>(arr: Weighted<T>[], k: number, rnd: () => number): T[] {
  const pool = arr.map((x) => ({ ...x }));
  const out: T[] = [];
  while (out.length < k && pool.length > 0) {
    let r = rnd();
    let acc = 0;
    let idx = -1;
    for (let i = 0; i < pool.length; i++) {
      acc += pool[i].w;
      if (r <= acc) { idx = i; break; }
    }
    if (idx < 0) idx = pool.length - 1;
    out.push(pool[idx].item);
    // remove and renormalize
    pool.splice(idx, 1);
    const s = pool.reduce((a, b) => a + b.w, 0);
    if (s > 0) for (const p of pool) p.w = p.w / s;
  }
  return out;
}

/* -------------------------- Heuristic components ------------------------- */

const DEFAULT_WEEKDAY_WEIGHTS: Record<Weekday, number> = {
  mon: 1.0, tue: 1.0, wed: 1.1, thu: 1.2, fri: 1.1, sat: 0.8, sun: 0.8,
};

function holidayBoost(dateStr: string, holidays: Set<string>): number {
  if (!holidays.has(dateStr)) return 1.0;
  return 1.2; // can tune per sector later
}

function pickTimeInWindows(
  date: DateTime,
  windows: TimeWindow[],
  rnd: () => number
): DateTime | null {
  if (!windows.length) return null;
  // Choose window weighted by duration
  const weighted: Weighted<TimeWindow>[] = windows.map((w) => {
    const { h: sh, m: sm } = parseHM(w.start);
    const { h: eh, m: em } = parseHM(w.end);
    const start = date.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
    const end   = date.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
    const dur   = Math.max(0, end.diff(start, "minutes").minutes);
    return { item: w, w: Math.max(1, dur) };
  });
  // Normalize
  const sum = weighted.reduce((a, b) => a + b.w, 0);
  for (const w of weighted) w.w = w.w / sum;

  // Pick one
  let r = rnd(); let acc = 0; let win = weighted[0].item;
  for (const w of weighted) { acc += w.w; if (r <= acc) { win = w.item; break; } }

  const { h: sh, m: sm } = parseHM(win.start);
  const { h: eh, m: em } = parseHM(win.end);
  let start = date.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
  let end   = date.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
  if (end <= start) end = start.plus({ minutes: 30 });

  // Triangular-ish distribution centered
  const u = rnd();
  const totalMin = end.diff(start, "minutes").minutes;
  const skew = (u < 0.5)
    ? Math.sqrt(2 * u) * 0.5
    : 1 - Math.sqrt(2 * (1 - u)) * 0.5;
  const offsetMin = Math.floor(totalMin * skew);
  return roundTo5(start.plus({ minutes: offsetMin }));
}

type DayLoad = {
  igCount: number;
  fbCount: number;
  igSlots: DateTime[]; // datetimes in org TZ
  fbSlots: DateTime[];
};

function ensureDay(map: Map<string, DayLoad>, dateStr: string): DayLoad {
  let v = map.get(dateStr);
  if (!v) {
    v = { igCount: 0, fbCount: 0, igSlots: [], fbSlots: [] };
    map.set(dateStr, v);
  }
  return v;
}

function withinGap(target: DateTime, slots: DateTime[], minGapH: number): boolean {
  for (const s of slots) {
    const diff = Math.abs(target.diff(s, "hours").hours);
    if (diff < minGapH) return false;
  }
  return true;
}

/* ---------------------------- Core generation ---------------------------- */

export function generateSchedule(
  args: GenerateArgs,
  ctx: ScheduleCtx
): { suggestions: SuggestionDraft[]; meta: { skipped: number } } {
  const tz = args.timezone || "America/Sao_Paulo";
  const seedStr = args.seed ?? `${args.orgId}::${args.monthRef}`;
  const rnd = mulberry32(hash32(seedStr));

  // 1) Build days of month, filter blacklist
  const monthDays = listDaysInMonth(args.monthRef, tz);
  const blacklist = new Set(args.blacklistDates || []);
  const days = monthDays.filter((d) => !blacklist.has(d.toISODate()!));
  if (!days.length) {
    return { suggestions: [], meta: { skipped: args.frequency } };
  }

  // 2) Weights (weekday * holiday boost)
  const ww = { ...DEFAULT_WEEKDAY_WEIGHTS, ...(args.weekdayWeights || {}) };
  const holidays = new Set(ctx.holidays || []);
  const weighted: Weighted<DateTime>[] = days.map((d) => ({
    item: d,
    w: (ww[toWeekday(d)] ?? 1.0) * holidayBoost(d.toISODate()!, holidays),
  }));
  normalizeWeights(weighted, rnd);

  // 3) Pick N dates (with replacement if N > days.length, but keep fair)
  const baseDates = weightedSampleWithoutReplacement(
    weighted,
    Math.min(args.frequency, weighted.length),
    rnd
  );
  const overflow = Math.max(0, args.frequency - baseDates.length);
  const extraDates: DateTime[] = [];
  for (let i = 0; i < overflow; i++) {
    // sample again with replacement for overflow
    extraDates.push(weighted[Math.floor(rnd() * weighted.length)].item);
  }
  const pickedDates = [...baseDates, ...extraDates];

  // 4) Pre-load day loads with existing jobs (converted to org TZ)
  const dayMap = new Map<string, DayLoad>();
  for (const j of ctx.existingJobs) {
    const dt = DateTime.fromISO(j.tsUtc, { zone: "utc" }).setZone(tz);
    const dateStr = dt.toISODate()!;
    const load = ensureDay(dayMap, dateStr);
    if (j.channel === "ig") {
      load.igCount += 1;
      load.igSlots.push(dt);
    } else {
      load.fbCount += 1;
      load.fbSlots.push(dt);
    }
  }

  // helpers
  const maxPer: Record<Channel, number> = { ig: ctx.plan.igDaily, fb: ctx.plan.fbDaily };
  const minGapH = ctx.minGapHoursPerChannel;
  const windows = args.timeWindows?.length ? args.timeWindows : [
    { start: "09:30", end: "12:00" },
    { start: "13:30", end: "18:30" },
    { start: "20:00", end: "22:00" },
  ];

  const suggestions: SuggestionDraft[] = [];

  // 5) Place each suggestion
  for (const baseDate of pickedDates) {
    // Clone default targets for this suggestion
    const targets: Targets = JSON.parse(JSON.stringify(args.defaultTargets || {
      ig: { enabled: true }, fb: { enabled: false }
    }));

    // Try placing in preferred date first
    const placed = tryPlaceOnDate(baseDate, targets, tz, windows, dayMap, maxPer, minGapH, rnd);

    if (placed) {
      suggestions.push(placed);
      continue;
    }

    // Fallback: search ±7 days around preferred
    const fallback = tryAdjacentDays(baseDate, 7, targets, tz, windows, dayMap, maxPer, minGapH, rnd);
    if (fallback) {
      suggestions.push(fallback);
    } else {
      suggestions.push({
        date: baseDate.toISODate()!,
        time: baseDate.set({ hour: 12, minute: 0 }).toFormat("HH:mm:ssZZ"),
        channel_targets: targets,
        status: "skipped",
        reason: "no-capacity",
      });
    }
  }

  return { suggestions, meta: { skipped: suggestions.filter(s => s.status === "skipped").length } };
}

/* ------------------------------ Placements ------------------------------- */

function tryPlaceOnDate(
  date: DateTime,
  targets: Targets,
  tz: string,
  windows: TimeWindow[],
  dayMap: Map<string, DayLoad>,
  maxPer: Record<Channel, number>,
  minGapH: number,
  rnd: () => number
): SuggestionDraft | null {
  const dateStr = date.toISODate()!;
  const load = ensureDay(dayMap, dateStr);

  // attempt up to 6 candidates per date (window choices + small jitters)
  for (let attempt = 0; attempt < 6; attempt++) {
    const cand = pickTimeInWindows(date, windows, rnd);
    if (!cand) break;

    // small ±(0|15|30) minutes jitter to ease collisions
    const jitters = [0, 15, -15, 30, -30, 45];
    const jitter = jitters[Math.floor(rnd() * jitters.length)];
    const at = roundTo5(cand.plus({ minutes: jitter })).setZone(tz);

    // per-channel validations
    if (targets.ig?.enabled) {
      if (load.igCount >= maxPer.ig) { /* over quota */ }
      else if (!withinGap(at, load.igSlots, minGapH)) { /* gap violation */ }
      else {
        // IG ok
      }
    }
    if (targets.fb?.enabled) {
      if (load.fbCount >= maxPer.fb) { /* over quota */ }
      else if (!withinGap(at, load.fbSlots, minGapH)) { /* gap violation */ }
      else {
        // FB ok
      }
    }

    // decide feasibility:
    const igOk = !targets.ig?.enabled || (load.igCount < maxPer.ig && withinGap(at, load.igSlots, minGapH));
    const fbOk = !targets.fb?.enabled || (load.fbCount < maxPer.fb && withinGap(at, load.fbSlots, minGapH));

    if (igOk && fbOk) {
      if (targets.ig?.enabled) { load.igCount++; load.igSlots.push(at); }
      if (targets.fb?.enabled) { load.fbCount++; load.fbSlots.push(at); }
      return {
        date: dateStr,
        time: at.toFormat("HH:mm:ssZZ"),
        channel_targets: targets,
        status: "suggested",
      };
    }
    // else: try another attempt (different window/jitter)
  }

  return null;
}

function tryAdjacentDays(
  base: DateTime,
  radiusDays: number,
  targets: Targets,
  tz: string,
  windows: TimeWindow[],
  dayMap: Map<string, DayLoad>,
  maxPer: Record<Channel, number>,
  minGapH: number,
  rnd: () => number
): SuggestionDraft | null {
  for (let off = 1; off <= radiusDays; off++) {
    for (const sign of [+1, -1]) {
      const d = base.plus({ days: sign * off });
      if (!isSameMonth(base, d)) continue; // keep inside month
      const placed = tryPlaceOnDate(d, targets, tz, windows, dayMap, maxPer, minGapH, rnd);
      if (placed) return placed;
    }
  }
  return null;
}

function isSameMonth(a: DateTime, b: DateTime): boolean {
  return a.year === b.year && a.month === b.month;
}

