import { render, screen } from '@testing-library/react';
import MessageItem from '../src/pages/inbox/components/MessageItem.jsx';
import normalizeMessage from '../src/inbox/normalizeMessage.js';

function makeMessage() {
  return normalizeMessage({
    id: 'm1',
    direction: 'in',
    sender: 'contact',
    attachments_json: [
      {
        storage_key: 'org_test/2024/file.jpg',
        remote_url: 'https://cdn.example.com/file.jpg',
        mime: 'image/jpeg',
        type: 'image',
      },
    ],
  });
}

test('renders media attachment using local endpoint', () => {
  const msg = makeMessage();
  render(<MessageItem msg={msg} registerRef={() => {}} />);
  const img = screen.getByRole('img');
  expect(img.getAttribute('src')).toContain('/media/m1/0');
  const link = screen.getByRole('link');
  expect(link.getAttribute('href')).toContain('/media/m1/0');
});
