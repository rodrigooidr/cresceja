import { io } from "socket.io-client";

let socket;

export function getSocket() {
  if (socket) return socket;

  const token = localStorage.getItem("token");
  socket = io(process.env.REACT_APP_SOCKET_URL || "/", {
    path: "/socket.io",
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 10000,
    auth: token ? { token: `Bearer ${token}` } : undefined,
  });

  // heartbeat para evitar timeouts ociosos
  let ping;
  socket.on("connect", () => {
    clearInterval(ping);
    ping = setInterval(() => {
      try { socket.emit("ping"); } catch {}
    }, 25000);
  });
  socket.on("disconnect", () => clearInterval(ping));

  return socket;
}

export function disposeSocket() {
  if (!socket) return;
  try {
    socket.removeAllListeners();
    socket.close();
  } catch {}
  socket = undefined;
}

