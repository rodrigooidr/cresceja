import {
  loadSnippets,
  saveSnippets,
  upsertSnippet,
  deleteSnippet,
  searchSnippets,
  applyVariables,
  importSnippets,
  exportSnippets,
} from './snippets';

describe('snippets utils', () => {
  beforeEach(() => localStorage.clear());

  it('load/save persist', () => {
    const st = upsertSnippet({ v: 1, items: [] }, { title: 'A', content: 'a', shortcut: 'aa' });
    saveSnippets(st);
    const loaded = loadSnippets();
    expect(loaded.items[0].title).toBe('A');
  });

  it('upsert dedupe and shortcut conflict', () => {
    let st = { v: 1, items: [] };
    st = upsertSnippet(st, { title: 'A', content: '1', shortcut: 's' });
    st = upsertSnippet(st, { title: 'B', content: '2', shortcut: 's' });
    expect(st.items.find((i) => i.title === 'B').shortcut).toBe('s-2');
    st = upsertSnippet(st, { title: 'A', content: '3' });
    expect(st.items.length).toBe(2);
    expect(st.items.find((i) => i.title === 'A').content).toBe('3');
  });

  it('delete removes', () => {
    let st = { v: 1, items: [] };
    st = upsertSnippet(st, { title: 'A', content: '1' });
    const id = st.items[0].id;
    st = deleteSnippet(st, id);
    expect(st.items.length).toBe(0);
  });

  it('import/export', () => {
    let st = { v: 1, items: [ { id: 'a', title: 'A', content: 'a', updated_at: '2020-01-01' } ] };
    const json = JSON.stringify({ v: 1, items: [
      { title: 'A', content: 'a2', updated_at: '2021-01-01' },
      { title: 'B', content: 'b' },
    ] });
    const r = importSnippets(st, json);
    expect(r.imported).toBe(1);
    expect(r.updated).toBe(1);
    expect(r.state.items.length).toBe(2);
    const exported = exportSnippets(r.state);
    expect(JSON.parse(exported).items.length).toBe(2);
  });

  it('invalid import throws', () => {
    expect(() => importSnippets({ v: 1, items: [] }, 'x')).toThrow();
  });

  it('search and apply variables', () => {
    const st = {
      v: 1,
      items: [
        { id: '1', title: 'Hello', content: 'Hi {first_name}', shortcut: 'h', updated_at: '1' },
      ],
    };
    const res = searchSnippets(st.items, 'h');
    expect(res.length).toBe(1);
    const applied = applyVariables('Oi {first_name}', { name: 'Alice Doe', phone_e164: '1', email: 'a@a' });
    expect(applied).toBe('Oi Alice');
  });
});
