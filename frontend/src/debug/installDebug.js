import { io } from 'socket.io-client';

export function startSocketsSafe(options = {}) {
  try {
    const { url, ...rest } = options || {};
    const target = url || getSocketUrl();
    return io(target, {
      transports: ['websocket', 'polling' ],
      reconnection: true,
      ...rest,
    });
  } catch {
    const noop = () => {};
    return {
      on: noop,
      off: noop,
      emit: noop,
      close: noop,
      disconnect: noop,
    };
  }
}

export function getSocketUrl() {
  try {
    const base = window.__API_BASE_URL__ || '/api';
    return base.replace(/\/api\/?$/, '');
  } catch {
    return '';
  }
}
