import normalizeMessage from './normalizeMessage';

describe('normalizeMessage', () => {
  it('infers direction and author', () => {
    const msg = normalizeMessage({ id: 1, text: 'hi', sender: 'agent' });
    expect(msg.direction).toBe('out');
    expect(msg.author).toBe('agent');
    expect(msg.isMine).toBe(true);
  });

  it('maps attachments', () => {
    const msg = normalizeMessage({ id: '1', attachments: [{ id: 'a', url: '/f.png', filename: 'f.png', mime: 'image/png' }] });
    expect(msg.attachments[0]).toEqual({ id: 'a', url: '/f.png', thumb_url: null, filename: 'f.png', mime: 'image/png' });
  });

  it('fills defaults', () => {
    const msg = normalizeMessage({});
    expect(typeof msg.id).toBe('string');
    expect(msg.text).toBe('');
    expect(Array.isArray(msg.attachments)).toBe(true);
  });
});
