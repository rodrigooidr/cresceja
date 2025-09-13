import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChannelPicker from '../src/components/inbox/ChannelPicker.jsx';

let mockChannels = [];
let mockFeatures = { whatsapp_numbers: { enabled: true, limit: 5 } };

jest.mock('../src/contexts/OrgContext.jsx', () => ({
  useOrg: () => ({ selected: '1' }),
  OrgProvider: ({ children }) => <>{children}</>,
}));

jest.mock('../src/hooks/useOrgFeatures.js', () => () => ({ features: mockFeatures, loading: false }));

jest.mock('../src/api/inboxApi.js', () => {
  const get = jest.fn((url, config = {}) => {
    const headers = { ...(config.headers || {}) };
    const org = global.localStorage?.getItem('active_org_id');
    const ch = org ? global.localStorage?.getItem(`active_channel_id::${org}`) : null;
    if (ch) headers['X-Channel-Id'] = ch;
    const data = url.includes('/whatsapp/channels') ? mockChannels : {};
    return Promise.resolve({ data, config: { headers } });
  });
  return { __esModule: true, default: { get } };
});

const inboxApi = require('../src/api/inboxApi.js').default;

beforeEach(() => {
  localStorage.setItem('active_org_id', '1');
});

afterEach(() => {
  localStorage.clear();
  mockChannels = [];
  mockFeatures = { whatsapp_numbers: { enabled: true, limit: 5 } };
});

test('renderiza opções quando API retorna canais', async () => {
  mockChannels = [
    { id: '1', phone_e164: '+5511999999999', display_name: 'Main', provider: 'api', is_active: true },
    { id: '2', phone_e164: '+5511888888888', display_name: 'Sec', provider: 'baileys', is_active: true },
  ];
  render(<ChannelPicker />);
  const select = await screen.findByLabelText('Número WhatsApp');
  expect(select).toBeInTheDocument();
  expect(select.querySelectorAll('option')).toHaveLength(2);
});

test('persiste active_channel_id no localStorage', async () => {
  mockChannels = [
    { id: '1', phone_e164: '+5511999999999', display_name: 'Main', provider: 'api', is_active: true },
    { id: '2', phone_e164: '+5511888888888', display_name: 'Sec', provider: 'baileys', is_active: true },
  ];
  render(<ChannelPicker />);
  const select = await screen.findByLabelText('Número WhatsApp');
  fireEvent.change(select, { target: { value: '2' } });
  expect(localStorage.getItem('active_channel_id::1')).toBe('2');
});

test('fallback para primeiro ativo quando salvo não existe', async () => {
  localStorage.setItem('active_channel_id::1', '99');
  mockChannels = [
    { id: '1', phone_e164: '+5511999999999', display_name: 'Main', provider: 'api', is_active: true },
    { id: '2', phone_e164: '+5511888888888', display_name: 'Sec', provider: 'baileys', is_active: false },
  ];
  render(<ChannelPicker />);
  const select = await screen.findByLabelText('Número WhatsApp');
  expect(select.value).toBe('1');
  expect(localStorage.getItem('active_channel_id::1')).toBe('1');
});

test('exibe CTA quando não há canais', async () => {
  mockChannels = [];
  render(<ChannelPicker />);
  expect(await screen.findByText(/Nenhum número configurado/)).toBeInTheDocument();
});

test('não renderiza quando whatsapp_numbers desabilitado', async () => {
  mockFeatures = { whatsapp_numbers: { enabled: false, limit: 0 } };
  mockChannels = [
    { id: '1', phone_e164: '+5511999999999', display_name: 'Main', provider: 'api', is_active: true },
  ];
  render(<ChannelPicker />);
  expect(screen.queryByLabelText('Número WhatsApp')).toBeNull();
});

test('altera header X-Channel-Id ao trocar opção', async () => {
  mockChannels = [
    { id: '1', phone_e164: '+5511999999999', display_name: 'Main', provider: 'api', is_active: true },
    { id: '2', phone_e164: '+5511888888888', display_name: 'Sec', provider: 'baileys', is_active: true },
  ];
  render(<ChannelPicker />);
  const select = await screen.findByLabelText('Número WhatsApp');
  let res = await inboxApi.get('/test');
  expect(res.config.headers['X-Channel-Id']).toBe('1');
  fireEvent.change(select, { target: { value: '2' } });
  res = await inboxApi.get('/test');
  expect(res.config.headers['X-Channel-Id']).toBe('2');
});
