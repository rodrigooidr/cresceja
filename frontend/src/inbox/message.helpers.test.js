import { normalizeDirection, isMineMessage } from './message.helpers';

describe('message helpers', () => {
  test('normalizeDirection', () => {
    expect(normalizeDirection('outbound')).toBe('out');
    expect(normalizeDirection('OUT')).toBe('out');
    expect(normalizeDirection('inbound')).toBe('in');
    expect(normalizeDirection('IN')).toBe('in');
    expect(normalizeDirection('other')).toBe('other');
  });

  test('isMineMessage prioritizes sender', () => {
    expect(isMineMessage({ sender: 'agent' })).toBe(true);
    expect(isMineMessage({ sender: 'contact' })).toBe(false);
    expect(isMineMessage({ direction: 'outbound' })).toBe(true);
    expect(isMineMessage({ direction: 'in' })).toBe(false);
  });
});
