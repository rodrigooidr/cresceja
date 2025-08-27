import channelIconBySlug from './channelIcons';

describe('channelIconBySlug', () => {
  it('returns icon for known channel', () => {
    expect(channelIconBySlug.whatsapp).toBe('lucide:whatsapp');
  });
  it('returns icon for instagram', () => {
    expect(channelIconBySlug.instagram).toBe('lucide:instagram');
  });
  it('falls back to default', () => {
    const slug = 'unknown-channel';
    expect(channelIconBySlug[slug] || channelIconBySlug.default).toBe('lucide:message-circle');
  });
});
