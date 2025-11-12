/**
 * WebSocket Server for Real-time Communication
 */

import { Server } from 'socket.io';
import { verifyToken } from '../auth/auth.js';

export function setupWebSocket(server, services) {
  const { deviceManager, automationEngine, voiceControl, zigbeeProtocol, matterProtocol } = services;

  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const user = verifyToken(token);
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Handle client connections
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id} (${socket.user.username})`);

    // Send initial state
    socket.emit('initial_state', {
      devices: deviceManager.listDevices(),
      automations: automationEngine.listAutomations(),
      timestamp: Date.now()
    });

    // ========== Device Events ==========

    // Device state changed
    deviceManager.on('device:state_changed', (event) => {
      io.emit('device:state_changed', event);
    });

    // Device registered
    deviceManager.on('device:registered', (device) => {
      io.emit('device:registered', device);
    });

    // Device updated
    deviceManager.on('device:updated', (device) => {
      io.emit('device:updated', device);
    });

    // Device deleted
    deviceManager.on('device:deleted', (event) => {
      io.emit('device:deleted', event);
    });

    // Device online/offline
    deviceManager.on('device:online', (event) => {
      io.emit('device:online', event);
    });

    deviceManager.on('device:offline', (event) => {
      io.emit('device:offline', event);
    });

    // ========== Automation Events ==========

    // Automation triggered
    automationEngine.on('automation:triggered', (event) => {
      io.emit('automation:triggered', event);
    });

    // Automation created
    automationEngine.on('automation:created', (automation) => {
      io.emit('automation:created', automation);
    });

    // Automation updated
    automationEngine.on('automation:updated', (automation) => {
      io.emit('automation:updated', automation);
    });

    // Automation deleted
    automationEngine.on('automation:deleted', (automation) => {
      io.emit('automation:deleted', automation);
    });

    // Automation error
    automationEngine.on('automation:error', (event) => {
      io.emit('automation:error', event);
    });

    // ========== Protocol Events ==========

    // Zigbee pairing
    zigbeeProtocol.on('permitJoinChanged', (enabled) => {
      io.emit('zigbee:pairing_changed', { enabled });
    });

    zigbeeProtocol.on('device:registered', (device) => {
      io.emit('zigbee:device_discovered', device);
    });

    // Matter commissioning
    matterProtocol.on('commissioningStarted', (data) => {
      io.emit('matter:commissioning_started', data);
    });

    matterProtocol.on('commissioningStopped', () => {
      io.emit('matter:commissioning_stopped');
    });

    matterProtocol.on('device:registered', (device) => {
      io.emit('matter:device_commissioned', device);
    });

    // ========== Voice Control Events ==========

    // Wake word detected
    voiceControl.on('wake_word:detected', () => {
      io.emit('voice:wake_word_detected');
    });

    // Session started
    voiceControl.on('session:started', (session) => {
      io.emit('voice:session_started', session);
    });

    // Session ended
    voiceControl.on('session:ended', (event) => {
      io.emit('voice:session_ended', event);
    });

    // Processing started
    voiceControl.on('processing:started', () => {
      io.emit('voice:processing_started');
    });

    // Response
    voiceControl.on('response', (response) => {
      io.emit('voice:response', response);
    });

    // ========== Client Commands ==========

    // Subscribe to specific device updates
    socket.on('subscribe:device', (deviceId) => {
      socket.join(`device:${deviceId}`);
      console.log(`${socket.user.username} subscribed to device ${deviceId}`);
    });

    // Unsubscribe from device updates
    socket.on('unsubscribe:device', (deviceId) => {
      socket.leave(`device:${deviceId}`);
      console.log(`${socket.user.username} unsubscribed from device ${deviceId}`);
    });

    // Request device list
    socket.on('get:devices', (filter) => {
      const devices = deviceManager.listDevices(filter || {});
      socket.emit('devices:list', devices);
    });

    // Request automation list
    socket.on('get:automations', (filter) => {
      const automations = automationEngine.listAutomations(filter || {});
      socket.emit('automations:list', automations);
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // ========== Disconnect ==========

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id} (${socket.user.username})`);
    });
  });

  console.log('✓ WebSocket server configured');
  return io;
}

export default setupWebSocket;
