import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import AuditPanel from '../components/inbox/AuditPanel.jsx';
import auditlog from './auditlog.js';

const CID = 'c1';

beforeEach(() => {
  auditlog.clear(CID);
  sessionStorage.clear();
});

test('render basic panel', () => {
  auditlog.append(CID, { kind: 'message', action: 'sent' });
  render(<AuditPanel conversationId={CID} />);
  expect(screen.getByTestId('audit-panel')).toBeInTheDocument();
});

test('filter by type', () => {
  const now = new Date().toISOString();
  auditlog.save(CID, [
    { id: '1', ts: now, kind: 'message', action: 'sent' },
    { id: '2', ts: now, kind: 'media', action: 'accepted' },
  ]);
  render(<AuditPanel conversationId={CID} />);
  expect(screen.getAllByTestId('audit-item').length).toBe(2);
  fireEvent.click(screen.getByTestId('audit-filter-media'));
  expect(screen.getAllByTestId('audit-item').length).toBe(1);
});

test('search filters list', () => {
  const now = new Date().toISOString();
  auditlog.save(CID, [
    { id: '1', ts: now, kind: 'message', action: 'sent' },
    { id: '2', ts: now, kind: 'media', action: 'accepted' },
  ]);
  render(<AuditPanel conversationId={CID} />);
  expect(screen.getAllByTestId('audit-item').length).toBe(2);
  fireEvent.change(screen.getByTestId('audit-search'), { target: { value: 'accepted' } });
  expect(screen.getAllByTestId('audit-item').length).toBe(1);
});

test('export json triggers download', () => {
  auditlog.append(CID, { kind: 'message', action: 'sent' });
  const json = '[{"a":1}]';
  jest.spyOn(auditlog, 'exportJson').mockReturnValue(json);
  const origBlob = global.Blob;
  const blobSpy = jest.fn(() => ({}));
  global.Blob = blobSpy;
  global.URL.createObjectURL = jest.fn(() => 'blob:');
  render(<AuditPanel conversationId={CID} />);
  fireEvent.click(screen.getByTestId('audit-export'));
  expect(auditlog.exportJson).toHaveBeenCalledWith(CID);
  expect(blobSpy).toHaveBeenCalledWith([json], { type: 'application/json' });
  global.Blob = origBlob;
});

test('clear removes entries', () => {
  auditlog.append(CID, { kind: 'message', action: 'sent' });
  window.confirm = jest.fn(() => true);
  render(<AuditPanel conversationId={CID} />);
  fireEvent.click(screen.getByTestId('audit-clear'));
  expect(auditlog.load(CID)).toHaveLength(0);
  expect(screen.queryAllByTestId('audit-item').length).toBe(0);
});
