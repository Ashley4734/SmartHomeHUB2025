/**
 * Device Management System
 * Handles device registration, state management, and control
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import EventEmitter from 'events';

class DeviceManager extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map(); // In-memory device cache
    this.loadDevices();
  }

  /**
   * Load devices from database into memory
   */
  loadDevices() {
    const db = getDatabase();
    const devices = db.prepare('SELECT * FROM devices').all();

    for (const device of devices) {
      this.devices.set(device.id, {
        ...device,
        state: device.state ? JSON.parse(device.state) : {},
        capabilities: device.capabilities ? JSON.parse(device.capabilities) : [],
        metadata: device.metadata ? JSON.parse(device.metadata) : {}
      });
    }

    console.log(`✓ Loaded ${devices.length} devices into memory`);
  }

  /**
   * Register a new device
   */
  registerDevice({
    name,
    type,
    protocol,
    ieeeAddress = null,
    model = null,
    manufacturer = null,
    firmwareVersion = null,
    roomId = null,
    capabilities = [],
    metadata = {}
  }) {
    const db = getDatabase();
    const deviceId = uuidv4();
    const now = Date.now();

    const device = {
      id: deviceId,
      name,
      type,
      protocol,
      ieee_address: ieeeAddress,
      model,
      manufacturer,
      firmware_version: firmwareVersion,
      room_id: roomId,
      state: JSON.stringify({}),
      capabilities: JSON.stringify(capabilities),
      metadata: JSON.stringify(metadata),
      online: 1,
      last_seen: now,
      created_at: now,
      updated_at: now
    };

    db.prepare(`
      INSERT INTO devices (
        id, name, type, protocol, ieee_address, model, manufacturer,
        firmware_version, room_id, state, capabilities, metadata,
        online, last_seen, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      device.id, device.name, device.type, device.protocol, device.ieee_address,
      device.model, device.manufacturer, device.firmware_version, device.room_id,
      device.state, device.capabilities, device.metadata, device.online,
      device.last_seen, device.created_at, device.updated_at
    );

    // Add to memory
    this.devices.set(deviceId, {
      ...device,
      state: {},
      capabilities,
      metadata
    });

    this.emit('device:registered', device);
    console.log(`✓ Device registered: ${name} (${deviceId})`);

    return this.getDevice(deviceId);
  }

  /**
   * Update device state
   */
  updateDeviceState(deviceId, newState, triggeredBy = null) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const db = getDatabase();
    const now = Date.now();

    // Merge states
    const currentState = typeof device.state === 'string' ? JSON.parse(device.state) : device.state;
    const updatedState = { ...currentState, ...newState };

    // Update database
    db.prepare(`
      UPDATE devices
      SET state = ?, last_seen = ?, updated_at = ?, online = 1
      WHERE id = ?
    `).run(JSON.stringify(updatedState), now, now, deviceId);

    // Update memory
    device.state = updatedState;
    device.last_seen = now;
    device.online = 1;
    device.updated_at = now;

    // Log history
    this.logDeviceHistory(deviceId, updatedState, triggeredBy);

    // Emit event
    this.emit('device:state_changed', {
      deviceId,
      oldState: currentState,
      newState: updatedState,
      triggeredBy
    });

    return updatedState;
  }

  /**
   * Control device (send command)
   */
  async controlDevice(deviceId, command, parameters = {}) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    // Emit control event (protocol handlers will listen)
    this.emit('device:control', {
      deviceId,
      device,
      command,
      parameters
    });

    return { success: true, deviceId, command, parameters };
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId) {
    return this.devices.get(deviceId) || null;
  }

  /**
   * Get device by IEEE address
   */
  getDeviceByIeeeAddress(ieeeAddress) {
    for (const device of this.devices.values()) {
      if (device.ieee_address === ieeeAddress) {
        return device;
      }
    }
    return null;
  }

  /**
   * List all devices
   */
  listDevices(filter = {}) {
    let devices = Array.from(this.devices.values());

    if (filter.protocol) {
      devices = devices.filter(d => d.protocol === filter.protocol);
    }

    if (filter.type) {
      devices = devices.filter(d => d.type === filter.type);
    }

    if (filter.roomId) {
      devices = devices.filter(d => d.room_id === filter.roomId);
    }

    if (filter.online !== undefined) {
      devices = devices.filter(d => d.online === filter.online);
    }

    return devices;
  }

  /**
   * Update device info
   */
  updateDevice(deviceId, updates) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const db = getDatabase();
    const allowedFields = ['name', 'room_id', 'model', 'manufacturer', 'firmware_version'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.capabilities) {
      fields.push('capabilities = ?');
      values.push(JSON.stringify(updates.capabilities));
    }

    if (updates.metadata) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(deviceId);

    db.prepare(`UPDATE devices SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    // Reload device
    const updated = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId);
    this.devices.set(deviceId, {
      ...updated,
      state: JSON.parse(updated.state || '{}'),
      capabilities: JSON.parse(updated.capabilities || '[]'),
      metadata: JSON.parse(updated.metadata || '{}')
    });

    this.emit('device:updated', this.devices.get(deviceId));
    return this.devices.get(deviceId);
  }

  /**
   * Delete device
   */
  deleteDevice(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const db = getDatabase();
    db.prepare('DELETE FROM devices WHERE id = ?').run(deviceId);
    this.devices.delete(deviceId);

    this.emit('device:deleted', { deviceId, device });
    console.log(`✓ Device deleted: ${deviceId}`);
  }

  /**
   * Mark device as offline
   */
  markDeviceOffline(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) return;

    const db = getDatabase();
    db.prepare('UPDATE devices SET online = 0, updated_at = ? WHERE id = ?')
      .run(Date.now(), deviceId);

    device.online = 0;
    this.emit('device:offline', { deviceId, device });
  }

  /**
   * Mark device as online
   */
  markDeviceOnline(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) return;

    const db = getDatabase();
    const now = Date.now();
    db.prepare('UPDATE devices SET online = 1, last_seen = ?, updated_at = ? WHERE id = ?')
      .run(now, now, deviceId);

    device.online = 1;
    device.last_seen = now;
    this.emit('device:online', { deviceId, device });
  }

  /**
   * Log device state to history
   */
  logDeviceHistory(deviceId, state, triggeredBy = null) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO device_history (device_id, state, timestamp, triggered_by)
      VALUES (?, ?, ?, ?)
    `).run(deviceId, JSON.stringify(state), Date.now(), triggeredBy);
  }

  /**
   * Get device history
   */
  getDeviceHistory(deviceId, limit = 100) {
    const db = getDatabase();
    const history = db.prepare(`
      SELECT * FROM device_history
      WHERE device_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(deviceId, limit);

    return history.map(h => ({
      ...h,
      state: JSON.parse(h.state)
    }));
  }

  /**
   * Get device statistics
   */
  getStatistics() {
    const devices = Array.from(this.devices.values());
    return {
      total: devices.length,
      online: devices.filter(d => d.online).length,
      offline: devices.filter(d => !d.online).length,
      byProtocol: {
        zigbee: devices.filter(d => d.protocol === 'zigbee').length,
        matter: devices.filter(d => d.protocol === 'matter').length
      },
      byType: devices.reduce((acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

export default DeviceManager;
