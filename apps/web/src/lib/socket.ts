'use client';

import { io, type Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;
let boundToken: string | null = null;

function preferredTransports(): ('websocket' | 'polling')[] {
  if (typeof document !== 'undefined' && document.body.classList.contains('low-bandwidth')) {
    return ['polling'];
  }
  return ['websocket', 'polling'];
}

export function getSocket(token: string): Socket {
  const transports = preferredTransports();
  if (socket?.connected && boundToken === token) return socket;

  socket?.disconnect();
  socket = io(WS_URL, {
    auth: { token },
    transports,
    reconnectionAttempts: 8,
    reconnectionDelay: 800,
    timeout: 12_000,
    forceNew: true,
  });
  boundToken = token;
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  boundToken = null;
}

/** Recrée le socket si le mode connexion a changé. */
export function refreshSocketTransport(token: string): Socket {
  disconnectSocket();
  return getSocket(token);
}
