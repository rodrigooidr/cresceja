import { toPatchDateTimeJS } from '../src/pages/marketing/ContentCalendar.jsx';

test('formats date/time to Sao Paulo', () => {
  const start = new Date('2024-05-01T12:00:00Z');
  const { date, time } = toPatchDateTimeJS(start);
  expect(date).toBe('2024-05-01');
  expect(time).toBe('09:00:00-03:00');
});
