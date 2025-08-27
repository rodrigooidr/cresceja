import normalizeMessage from './normalizeMessage';
import { apiUrl } from '../utils/apiUrl';

describe('normalizeMessage', () => {
  it('handles basic text message', () => {
    const raw = { id: '1', text: 'hi', created_at: '2020-01-01' };
    const msg = normalizeMessage(raw);
    expect(msg).toMatchObject({ id: '1', type: 'text', text: 'hi', from: 'customer' });
  });

  it('infers from outbound flag', () => {
    const raw = { id: '2', text: 'ok', is_outbound: true };
    const msg = normalizeMessage(raw);
    expect(msg.from).toBe('agent');
  });

  it('preserves attachments and audio', () => {
    const raw = {
      id: '3',
      type: 'audio',
      audio_url: '/a.mp3',
      attachments: [{ id: 'a', url: '/f', thumb_url: '/t' }],
    };
    const msg = normalizeMessage(raw);
    expect(msg.audio_url).toBe(apiUrl('/a.mp3'));
    expect(msg.attachments[0]).toMatchObject({
      url: apiUrl('/f'),
      thumb_url: apiUrl('/t'),
    });
  });
  it('normalizes attachment URLs', () => {
    const raw = { id: '5', attachments: [{ id: 'x', url: '/x' }] };
    const msg = normalizeMessage(raw);
    expect(msg.attachments[0].url).toBe(apiUrl('/x'));
  });

  it('handles group meta', () => {
    const raw = { id: '4', group_meta: { group_id: 'g1' } };
    const msg = normalizeMessage(raw);
    expect(msg.group_meta).toEqual({ group_id: 'g1' });
  });
    
  it('does not return bare API base when urls are missing', () => {
    const raw = { id: '6', attachments: [{ id: 'z' }] }; // sem url/thumb_url
    const msg = normalizeMessage(raw);
    expect(msg.attachments[0].url).toBeUndefined();
    expect(msg.attachments[0].thumb_url).toBeUndefined();
    expect(msg.audio_url).toBeUndefined();
  });
});
