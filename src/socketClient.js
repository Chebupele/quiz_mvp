import { io } from 'socket.io-client';
import { getToken } from './api.js';

let socket;

export function getSocket() {
  if (!socket) {
    socket = io('/', {
      autoConnect: false,
    });
  }
  socket.auth = { token: getToken() };
  if (!socket.connected) socket.connect();
  return socket;
}
