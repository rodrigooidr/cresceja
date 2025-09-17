import { DateTime, Interval } from 'luxon';

function dayKey(dt) {
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[dt.weekday % 7];
}

export function withinBusinessHours(dateTime, businessHours) {
  if (!businessHours) return true;
  const ranges = businessHours?.[dayKey(dateTime)] || [];
  if (!Array.isArray(ranges) || !ranges.length) return false;
  return ranges.some((range) => {
    if (!range?.start || !range?.end) return false;
    const start = DateTime.fromISO(`${dateTime.toISODate()}T${range.start}`, {
      zone: dateTime.zone,
    });
    const end = DateTime.fromISO(`${dateTime.toISODate()}T${range.end}`, {
      zone: dateTime.zone,
    });
    return dateTime >= start && dateTime.plus({ minutes: 1 }) <= end;
  });
}

export function addBuffers(interval, pre = 0, post = 0) {
  return Interval.fromDateTimes(
    interval.start.minus({ minutes: pre }),
    interval.end.plus({ minutes: post })
  );
}

export function nextSlots({
  fromISO,
  durationMin,
  count = 3,
  busy = [],
  leadMin = 120,
  bh = null,
  tz = 'America/Sao_Paulo',
  stepMin = 15,
}) {
  const output = [];
  let cursor = DateTime.fromISO(fromISO, { zone: tz });
  if (!cursor.isValid) {
    cursor = DateTime.now().setZone(tz);
  }

  const lead = DateTime.now().setZone(tz).plus({ minutes: leadMin });
  if (cursor < lead) cursor = lead;

  const duration = { minutes: durationMin };

  const busyIntervals = busy
    .map((item) => {
      const start = DateTime.fromISO(item.start, { zone: tz });
      const end = DateTime.fromISO(item.end, { zone: tz });
      if (!start.isValid || !end.isValid) return null;
      return Interval.fromDateTimes(start, end);
    })
    .filter(Boolean);

  const maxIterations = 500;
  let iterations = 0;

  while (output.length < count && iterations < maxIterations) {
    iterations += 1;
    const candidate = Interval.fromDateTimes(cursor, cursor.plus(duration));
    const fitsBusinessHours = withinBusinessHours(candidate.start, bh);
    const conflict = busyIntervals.some((busyInterval) => busyInterval.overlaps(candidate));
    if (fitsBusinessHours && !conflict) {
      output.push({
        start: candidate.start.toISO(),
        end: candidate.end.toISO(),
      });
    }
    cursor = cursor.plus({ minutes: stepMin });
  }

  return output;
}

export default { nextSlots, addBuffers, withinBusinessHours };
