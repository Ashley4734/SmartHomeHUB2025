import { io } from 'socket.io-client';
import { useDeviceStore } from '../stores/deviceStore';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
