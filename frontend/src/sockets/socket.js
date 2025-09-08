// src/sockets/socket.js
import { io } from "socket.io-client";
import { API_BASE_URL, getAuthToken } from "../api/inboxApi";

function pickOriginFromApi(base) {
  try { return base.replace(/\/api\/?$/, ""); } catch { return base; }
}

export function makeSocket() {
  const origin = pickOriginFromApi(API_BASE_URL);
  const token = getAuthToken();
  const socket = io(origin, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    auth: token ? { token } : undefined,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    timeout: 10000,
    autoConnect: true,
  });
  return socket;
}
export default makeSocket;
