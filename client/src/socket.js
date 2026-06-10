import { io } from 'socket.io-client';

const socket = io('/', {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log('[Socket.io] Connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('[Socket.io] Disconnected:', reason);
});

socket.on('connect_error', (err) => {
  console.warn('[Socket.io] Connection error:', err.message);
});

export default socket;
