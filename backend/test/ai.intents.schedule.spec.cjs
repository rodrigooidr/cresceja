/* eslint-env jest */

let detectAction;
let parseDateParts;
let parseTime;
let findPersonHint;
let findServiceHint;
let isConfirm;
let isDeny;

beforeAll(async () => {
  ({
    detectAction,
    parseDateParts,
    parseTime,
    findPersonHint,
    findServiceHint,
    isConfirm,
    isDeny,
  } = await import('../services/ai/intents.schedule.js'));
});

describe('intents.schedule', () => {
  test('detecta ações', () => {
    expect(detectAction('quero agendar para amanhã')).toBe('schedule');
    expect(detectAction('preciso remarcar')).toBe('reschedule');
    expect(detectAction('pode cancelar')).toBe('cancel');
  });

  test('extrai data e hora', () => {
    expect(parseDateParts('23/09/2025')).toBe('2025-09-23');
    expect(parseDateParts('dia 7', new Date('2025-09-10'))).toBe('2025-09-07');
    expect(parseTime('às 14h')).toBe('14:00');
    expect(parseTime('14:30')).toBe('14:30');
    expect(parseTime('9h15')).toBe('09:15');
  });

  test('person/service hints', () => {
    expect(findPersonHint('com o Rodrigo')).toMatch(/Rodrigo/i);
    expect(findServiceHint('quero uma consulta')).toBe('consulta');
  });

  test('confirma/nega', () => {
    expect(isConfirm('confirmar')).toBe(true);
    expect(isDeny('prefiro outro')).toBe(true);
  });
});
