import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import AuditPanel from '../components/inbox/AuditPanel.jsx';
import auditlog from './auditlog.js';

test('exports csv with header and rows', () => {
  const entries = [
    { id: '1', ts: '2020-01-01T00:00:00.000Z', kind: 'message', action: 'sent', meta: { actor: 'a', text: 'hi' } },
    { id: '2', ts: '2020-01-01T00:00:01.000Z', kind: 'media', action: 'accepted', meta: { actor: 'b', name: 'file' } },
    { id: '3', ts: '2020-01-01T00:00:02.000Z', kind: 'socket', action: 'disconnect', meta: {} },
  ];
  jest.spyOn(auditlog, 'load').mockReturnValue(entries);
  const origBlob = global.Blob;
  const blobSpy = jest.fn(() => ({}));
  global.Blob = blobSpy;
  global.URL.createObjectURL = jest.fn(() => 'blob:');

  render(<AuditPanel conversationId="c1" />);
  fireEvent.click(screen.getByTestId('audit-export-csv'));

  const csv = blobSpy.mock.calls[0][0][0];
  const lines = csv.split('\n');
  expect(lines[0]).toBe('timestamp,type,actor,summary');
  expect(lines.length).toBe(4);

  global.Blob = origBlob;
});
