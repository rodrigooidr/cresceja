import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import WhatsAppBaileysCard from '@/components/settings/WhatsAppBaileysCard.jsx';
import { renderWithRouterProviders } from '../../utils/renderWithRouterProviders.jsx';

jest.mock('@/api/integrationsApi.js', () => ({
  getProviderStatus: jest.fn(),
  connectProvider: jest.fn(),
  testProvider: jest.fn(),
  disconnectProvider: jest.fn(),
  subscribeProvider: jest.fn(),
  startBaileysQr: jest.fn(),
  stopBaileysQr: jest.fn(),
  statusBaileys: jest.fn(),
}));

jest.mock('@/api/inboxApi.js', () => {
  const get = jest.fn();
  return {
    __esModule: true,
    default: { get },
    get,
  };
});

const integrationsApi = jest.requireMock('@/api/integrationsApi.js');
const inboxApi = jest.requireMock('@/api/inboxApi.js').default;

class MockEventSource {
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
    MockEventSource.instances.push(this);
  }

  emit(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  close() {
    this.closed = true;
  }
}
MockEventSource.instances = [];

const originalEventSource = global.EventSource;

beforeAll(() => {
  global.EventSource = jest.fn((url) => new MockEventSource(url));
});

afterAll(() => {
  global.EventSource = originalEventSource;
});

beforeEach(() => {
  jest.clearAllMocks();
  MockEventSource.instances = [];
  integrationsApi.getProviderStatus.mockResolvedValue({
    integration: { provider: 'whatsapp_session', status: 'disconnected', meta: {} },
  });
  integrationsApi.statusBaileys.mockResolvedValue({ ok: true, status: 'disconnected' });
  integrationsApi.startBaileysQr.mockResolvedValue({ ok: true });
  integrationsApi.stopBaileysQr.mockResolvedValue({ ok: true });
  inboxApi.get.mockResolvedValue({ data: { feature_flags: { whatsapp_session_enabled: true } } });
});

afterEach(() => {
  MockEventSource.instances = [];
});

function lastEventSource() {
  return MockEventSource.instances[MockEventSource.instances.length - 1];
}

describe('WhatsAppBaileysCard QR flow', () => {
  test('abre modal de QR e atualiza status via SSE', async () => {
    renderWithRouterProviders(<WhatsAppBaileysCard />, {
      org: { org: { id: 'org-1', name: 'Org Teste' }, selected: 'org-1' },
    });

    const qrButton = await screen.findByTestId('whatsapp-session-qr-button');
    await waitFor(() => expect(qrButton).not.toBeDisabled());

    fireEvent.click(qrButton);

    await waitFor(() => expect(integrationsApi.startBaileysQr).toHaveBeenCalledTimes(1));

    const modal = await screen.findByTestId('whatsapp-session-qr-modal');
    expect(modal).toBeInTheDocument();

    const stream = lastEventSource();
    expect(stream).toBeDefined();
    expect(stream.url).toContain('/api/integrations/providers/whatsapp_session/qr/stream');

    stream.emit({ type: 'qr', qr: { dataUrl: 'data:image/png;base64,abc', raw: 'qr-raw' } });
    const qrImage = await screen.findByTestId('whatsapp-session-qr-image');
    expect(qrImage).toHaveAttribute('src', 'data:image/png;base64,abc');

    stream.emit({ type: 'status', status: 'connected' });

    await waitFor(() => expect(screen.queryByTestId('whatsapp-session-qr-modal')).not.toBeInTheDocument());
    expect(screen.getByText('Conectado')).toBeInTheDocument();
    await waitFor(() => expect(integrationsApi.stopBaileysQr).toHaveBeenCalled());
  });
});
