import { toggle, rangeToggle, isAllPageSelected, selectAllPage, clearAllPage, clearOnFilterChange } from './selection.js';

describe('selection helpers', () => {
  test('toggle simple', () => {
    let set = new Set();
    set = toggle(set, 1);
    expect(Array.from(set)).toEqual([1]);
    set = toggle(set, 1);
    expect(Array.from(set)).toEqual([]);
  });

  test('range toggle with different anchors', () => {
    const ids = ['a','b','c','d'];
    let set = new Set();
    set = rangeToggle(set, ids, 'a', 'c');
    expect(Array.from(set)).toEqual(['a','b','c']);
    set = rangeToggle(set, ids, 'b', 'd');
    expect(Array.from(set)).toEqual(['a','b','c','d']);
    set = rangeToggle(set, ids, 'a', 'd');
    expect(Array.from(set)).toEqual([]); // all toggled off
  });

  test('select/clear page and detection', () => {
    const vis = [1,2,3];
    let set = new Set([1]);
    expect(isAllPageSelected(vis, set)).toBe(false);
    set = selectAllPage(vis, set);
    expect(isAllPageSelected(vis, set)).toBe(true);
    set = clearAllPage(vis, set);
    expect(Array.from(set)).toEqual([]);
  });

  test('clear on filter change', () => {
    const set = new Set([1,2]);
    const cleared = clearOnFilterChange(set);
    expect(cleared.size).toBe(0);
    expect(set.size).toBe(2);
  });
});
