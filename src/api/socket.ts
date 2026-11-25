import { io } from 'socket.io-client'
import { SOCKET_BASE_URL } from '../config/server'

export const socket = io(SOCKET_BASE_URL, {
  autoConnect: false,
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  withCredentials: false,
})