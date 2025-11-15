import { io } from 'socket.io-client';
import { useDeviceStore } from '../stores/deviceStore';

// Dynamically determine socket URL based on environment
// In production/development, connect to the same host the frontend is served from
const getSocketURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Use the current window location to construct the socket URL
  // This ensures WebSocket connects to the correct server when accessed remotely
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const host = window.location.hostname;
    const port = '3000'; // Backend port
    return `${protocol}://${host}:${port}`;
  }

  return 'http://localhost:3000';
};

const SOCKET_URL = getSocketURL();

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    // Device events
    this.socket.on('device:state_changed', (event) => {
      useDeviceStore.getState().updateDeviceState(event.deviceId, event.newState);
    });

    this.socket.on('device:registered', (device) => {
      useDeviceStore.getState().addDevice(device);
    });

    this.socket.on('device:updated', (device) => {
      useDeviceStore.getState().updateDevice(device);
    });

    this.socket.on('device:deleted', (event) => {
      useDeviceStore.getState().removeDevice(event.deviceId);
    });

    // Automation events
    this.socket.on('automation:triggered', (event) => {
      this.emit('automation:triggered', event);
    });

    // Voice events
    this.socket.on('voice:wake_word_detected', () => {
      this.emit('voice:wake_word_detected');
    });

    this.socket.on('voice:response', (response) => {
      this.emit('voice:response', response);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }
}

export const socketService = new SocketService();
