/**
 * DeviceManager Integration Tests
 * Tests device registration, state management, and control
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import DeviceManager from '../deviceManager.js';
import { initDatabase, closeDatabase, getDatabase } from '../../database/db.js';

// Set test environment
process.env.NODE_ENV = 'test';

describe('DeviceManager - Integration Tests', () => {
  let deviceManager;

  beforeAll(() => {
    // Initialize in-memory database
    initDatabase(':memory:');
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(() => {
    // Clean up devices before each test
    const db = getDatabase();
    db.prepare('DELETE FROM devices').run();
    db.prepare('DELETE FROM device_history').run();
    db.prepare('DELETE FROM rooms').run();

    // Create fresh device manager instance
    deviceManager = new DeviceManager();
  });

  describe('Device Registration', () => {
    test('should register a new device', () => {
      const deviceData = {
        name: 'Living Room Light',
        type: 'light',
        protocol: 'zigbee',
        manufacturer: 'Philips',
        model: 'Hue Bulb',
        capabilities: ['on_off', 'brightness', 'color']
      };

      const device = deviceManager.registerDevice(deviceData);

      expect(device).toBeDefined();
      expect(device.id).toBeDefined();
      expect(device.name).toBe(deviceData.name);
      expect(device.type).toBe(deviceData.type);
      expect(device.protocol).toBe(deviceData.protocol);
      expect(device.online).toBe(1);
      expect(device.capabilities).toEqual(deviceData.capabilities);
    });

    test('should register device with IEEE address', () => {
      const device = deviceManager.registerDevice({
        name: 'Sensor 1',
        type: 'sensor',
        protocol: 'zigbee',
        ieeeAddress: '00:11:22:33:44:55:66:77'
      });

      expect(device.ieee_address).toBe('00:11:22:33:44:55:66:77');
    });

    test('should register device with room assignment', () => {
      // First create a room
      const db = getDatabase();
      const roomId = 'room-123';
      db.prepare(`
        INSERT INTO rooms (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(roomId, 'Living Room', Date.now(), Date.now());

      const device = deviceManager.registerDevice({
        name: 'Room Light',
        type: 'light',
        protocol: 'zigbee',
        roomId
      });

      expect(device.room_id).toBe(roomId);
    });

    test('should emit device:registered event', (done) => {
      deviceManager.once('device:registered', (device) => {
        expect(device).toBeDefined();
        expect(device.name).toBe('Test Device');
        done();
      });

      deviceManager.registerDevice({
        name: 'Test Device',
        type: 'light',
        protocol: 'zigbee'
      });
    });
  });

  describe('Device Retrieval', () => {
    let testDevice;

    beforeEach(() => {
      testDevice = deviceManager.registerDevice({
        name: 'Test Light',
        type: 'light',
        protocol: 'zigbee',
        ieeeAddress: 'AA:BB:CC:DD:EE:FF:00:11'
      });
    });

    test('should get device by ID', () => {
      const device = deviceManager.getDevice(testDevice.id);

      expect(device).toBeDefined();
      expect(device.id).toBe(testDevice.id);
      expect(device.name).toBe('Test Light');
    });

    test('should return null for non-existent device ID', () => {
      const device = deviceManager.getDevice('non-existent-id');
      expect(device).toBeNull();
    });

    test('should get device by IEEE address', () => {
      const device = deviceManager.getDeviceByIeeeAddress('AA:BB:CC:DD:EE:FF:00:11');

      expect(device).toBeDefined();
      expect(device.id).toBe(testDevice.id);
    });

    test('should return null for non-existent IEEE address', () => {
      const device = deviceManager.getDeviceByIeeeAddress('FF:FF:FF:FF:FF:FF:FF:FF');
      expect(device).toBeNull();
    });
  });

  describe('Device Listing and Filtering', () => {
    beforeEach(() => {
      // Register multiple devices
      deviceManager.registerDevice({
        name: 'Zigbee Light 1',
        type: 'light',
        protocol: 'zigbee'
      });

      deviceManager.registerDevice({
        name: 'Zigbee Sensor 1',
        type: 'sensor',
        protocol: 'zigbee'
      });

      deviceManager.registerDevice({
        name: 'Matter Light 1',
        type: 'light',
        protocol: 'matter'
      });
    });

    test('should list all devices', () => {
      const devices = deviceManager.listDevices();

      expect(devices).toHaveLength(3);
    });

    test('should filter devices by protocol', () => {
      const zigbeeDevices = deviceManager.listDevices({ protocol: 'zigbee' });
      const matterDevices = deviceManager.listDevices({ protocol: 'matter' });

      expect(zigbeeDevices).toHaveLength(2);
      expect(matterDevices).toHaveLength(1);
    });

    test('should filter devices by type', () => {
      const lights = deviceManager.listDevices({ type: 'light' });
      const sensors = deviceManager.listDevices({ type: 'sensor' });

      expect(lights).toHaveLength(2);
      expect(sensors).toHaveLength(1);
    });

    test('should filter devices by online status', () => {
      const allDevices = deviceManager.listDevices();
      const offlineDevice = allDevices[0];
      deviceManager.markDeviceOffline(offlineDevice.id);

      const onlineDevices = deviceManager.listDevices({ online: 1 });
      const offlineDevices = deviceManager.listDevices({ online: 0 });

      expect(onlineDevices).toHaveLength(2);
      expect(offlineDevices).toHaveLength(1);
    });

    test('should filter devices by room', () => {
      const db = getDatabase();
      const roomId = 'room-123';
      db.prepare(`
        INSERT INTO rooms (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(roomId, 'Kitchen', Date.now(), Date.now());

      deviceManager.registerDevice({
        name: 'Kitchen Light',
        type: 'light',
        protocol: 'zigbee',
        roomId
      });

      const roomDevices = deviceManager.listDevices({ roomId });

      expect(roomDevices).toHaveLength(1);
      expect(roomDevices[0].name).toBe('Kitchen Light');
    });

    test('should apply multiple filters', () => {
      const devices = deviceManager.listDevices({
        protocol: 'zigbee',
        type: 'light'
      });

      expect(devices).toHaveLength(1);
      expect(devices[0].name).toBe('Zigbee Light 1');
    });
  });

  describe('Device State Management', () => {
    let testDevice;

    beforeEach(() => {
      testDevice = deviceManager.registerDevice({
        name: 'Smart Light',
        type: 'light',
        protocol: 'zigbee',
        capabilities: ['on_off', 'brightness']
      });
    });

    test('should update device state', () => {
      const newState = { on: true, brightness: 80 };
      const state = deviceManager.updateDeviceState(testDevice.id, newState);

      expect(state).toEqual(newState);

      // Verify in memory
      const device = deviceManager.getDevice(testDevice.id);
      expect(device.state).toEqual(newState);
    });

    test('should merge state updates', () => {
      deviceManager.updateDeviceState(testDevice.id, { on: true });
      const state = deviceManager.updateDeviceState(testDevice.id, { brightness: 50 });

      expect(state).toEqual({ on: true, brightness: 50 });
    });

    test('should throw error for non-existent device', () => {
      expect(() => {
        deviceManager.updateDeviceState('non-existent', { on: true });
      }).toThrow('Device not found');
    });

    test('should emit device:state_changed event', (done) => {
      deviceManager.once('device:state_changed', (event) => {
        expect(event.deviceId).toBe(testDevice.id);
        expect(event.newState).toEqual({ on: true });
        expect(event.oldState).toEqual({});
        done();
      });

      deviceManager.updateDeviceState(testDevice.id, { on: true });
    });

    test('should log state to history', () => {
      deviceManager.updateDeviceState(testDevice.id, { on: true }, 'user-123');

      const history = deviceManager.getDeviceHistory(testDevice.id);

      expect(history).toHaveLength(1);
      expect(history[0].device_id).toBe(testDevice.id);
      expect(history[0].state).toEqual({ on: true });
      expect(history[0].triggered_by).toBe('user-123');
    });

    test('should mark device as online when state updates', () => {
      deviceManager.markDeviceOffline(testDevice.id);
      deviceManager.updateDeviceState(testDevice.id, { on: true });

      const device = deviceManager.getDevice(testDevice.id);
      expect(device.online).toBe(1);
    });
  });

  describe('Device Control', () => {
    let testDevice;

    beforeEach(() => {
      testDevice = deviceManager.registerDevice({
        name: 'Smart Bulb',
        type: 'light',
        protocol: 'zigbee'
      });
    });

    test('should send control command', async () => {
      const result = await deviceManager.controlDevice(
        testDevice.id,
        'turn_on',
        { brightness: 100 }
      );

      expect(result.success).toBe(true);
      expect(result.deviceId).toBe(testDevice.id);
      expect(result.command).toBe('turn_on');
      expect(result.parameters).toEqual({ brightness: 100 });
    });

    test('should emit device:control event', (done) => {
      deviceManager.once('device:control', (event) => {
        expect(event.deviceId).toBe(testDevice.id);
        expect(event.command).toBe('turn_off');
        done();
      });

      deviceManager.controlDevice(testDevice.id, 'turn_off');
    });

    test('should throw error for non-existent device', async () => {
      await expect(
        deviceManager.controlDevice('non-existent', 'turn_on')
      ).rejects.toThrow('Device not found');
    });
  });

  describe('Device Updates', () => {
    let testDevice;

    beforeEach(() => {
      testDevice = deviceManager.registerDevice({
        name: 'Original Name',
        type: 'light',
        protocol: 'zigbee',
        manufacturer: 'Original Mfg',
        model: 'Model 1'
      });
    });

    test('should update device name', () => {
      const updated = deviceManager.updateDevice(testDevice.id, {
        name: 'New Name'
      });

      expect(updated.name).toBe('New Name');
    });

    test('should update device room', () => {
      const db = getDatabase();
      const roomId = 'room-456';
      db.prepare(`
        INSERT INTO rooms (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(roomId, 'Bedroom', Date.now(), Date.now());

      const updated = deviceManager.updateDevice(testDevice.id, {
        room_id: roomId
      });

      expect(updated.room_id).toBe(roomId);
    });

    test('should update device metadata', () => {
      const metadata = { location: 'ceiling', height: 2.5 };
      const updated = deviceManager.updateDevice(testDevice.id, { metadata });

      expect(updated.metadata).toEqual(metadata);
    });

    test('should update device capabilities', () => {
      const capabilities = ['on_off', 'brightness', 'color', 'temperature'];
      const updated = deviceManager.updateDevice(testDevice.id, { capabilities });

      expect(updated.capabilities).toEqual(capabilities);
    });

    test('should throw error for non-existent device', () => {
      expect(() => {
        deviceManager.updateDevice('non-existent', { name: 'New' });
      }).toThrow('Device not found');
    });

    test('should throw error for no valid fields', () => {
      expect(() => {
        deviceManager.updateDevice(testDevice.id, { invalid_field: 'value' });
      }).toThrow('No valid fields to update');
    });

    test('should emit device:updated event', (done) => {
      deviceManager.once('device:updated', (device) => {
        expect(device.id).toBe(testDevice.id);
        expect(device.name).toBe('Updated Name');
        done();
      });

      deviceManager.updateDevice(testDevice.id, { name: 'Updated Name' });
    });
  });

  describe('Device Deletion', () => {
    let testDevice;

    beforeEach(() => {
      testDevice = deviceManager.registerDevice({
        name: 'Temp Device',
        type: 'sensor',
        protocol: 'zigbee'
      });
    });

    test('should delete device', () => {
      deviceManager.deleteDevice(testDevice.id);

      const device = deviceManager.getDevice(testDevice.id);
      expect(device).toBeNull();
    });

    test('should remove device from database', () => {
      deviceManager.deleteDevice(testDevice.id);

      const db = getDatabase();
      const dbDevice = db.prepare('SELECT * FROM devices WHERE id = ?').get(testDevice.id);
      expect(dbDevice).toBeUndefined();
    });

    test('should throw error for non-existent device', () => {
      expect(() => {
        deviceManager.deleteDevice('non-existent');
      }).toThrow('Device not found');
    });

    test('should emit device:deleted event', (done) => {
      deviceManager.once('device:deleted', (event) => {
        expect(event.deviceId).toBe(testDevice.id);
        expect(event.device).toBeDefined();
        done();
      });

      deviceManager.deleteDevice(testDevice.id);
    });
  });

  describe('Device Online/Offline Status', () => {
    let testDevice;

    beforeEach(() => {
      testDevice = deviceManager.registerDevice({
        name: 'Test Device',
        type: 'sensor',
        protocol: 'zigbee'
      });
    });

    test('should mark device offline', () => {
      deviceManager.markDeviceOffline(testDevice.id);

      const device = deviceManager.getDevice(testDevice.id);
      expect(device.online).toBe(0);
    });

    test('should mark device online', () => {
      deviceManager.markDeviceOffline(testDevice.id);
      deviceManager.markDeviceOnline(testDevice.id);

      const device = deviceManager.getDevice(testDevice.id);
      expect(device.online).toBe(1);
      expect(device.last_seen).toBeDefined();
    });

    test('should emit device:offline event', (done) => {
      deviceManager.once('device:offline', (event) => {
        expect(event.deviceId).toBe(testDevice.id);
        done();
      });

      deviceManager.markDeviceOffline(testDevice.id);
    });

    test('should emit device:online event', (done) => {
      deviceManager.once('device:online', (event) => {
        expect(event.deviceId).toBe(testDevice.id);
        done();
      });

      deviceManager.markDeviceOffline(testDevice.id);
      deviceManager.markDeviceOnline(testDevice.id);
    });

    test('should handle offline for non-existent device gracefully', () => {
      expect(() => {
        deviceManager.markDeviceOffline('non-existent');
      }).not.toThrow();
    });
  });

  describe('Device History', () => {
    let testDevice;

    beforeEach(() => {
      testDevice = deviceManager.registerDevice({
        name: 'Tracked Device',
        type: 'light',
        protocol: 'zigbee'
      });
    });

    test('should get device history', () => {
      deviceManager.updateDeviceState(testDevice.id, { on: true }, 'user-1');
      deviceManager.updateDeviceState(testDevice.id, { brightness: 50 }, 'user-2');
      deviceManager.updateDeviceState(testDevice.id, { on: false }, 'automation-1');

      const history = deviceManager.getDeviceHistory(testDevice.id);

      expect(history).toHaveLength(3);
      // Verify all expected triggered_by values are present
      const triggeredByValues = history.map(h => h.triggered_by);
      expect(triggeredByValues).toContain('user-1');
      expect(triggeredByValues).toContain('user-2');
      expect(triggeredByValues).toContain('automation-1');
      // Verify each history entry has required fields
      history.forEach(entry => {
        expect(entry.device_id).toBe(testDevice.id);
        expect(entry.state).toBeDefined();
        expect(entry.timestamp).toBeDefined();
      });
    });

    test('should limit history results', () => {
      // Create multiple history entries
      for (let i = 0; i < 150; i++) {
        deviceManager.updateDeviceState(testDevice.id, { count: i });
      }

      const history = deviceManager.getDeviceHistory(testDevice.id, 50);

      expect(history).toHaveLength(50);
    });

    test('should parse state JSON in history', () => {
      const state = { on: true, brightness: 75, color: '#FF0000' };
      deviceManager.updateDeviceState(testDevice.id, state);

      const history = deviceManager.getDeviceHistory(testDevice.id);

      expect(history[0].state).toEqual(state);
      expect(typeof history[0].state).toBe('object');
    });
  });

  describe('Device Statistics', () => {
    beforeEach(() => {
      // Register devices for statistics
      deviceManager.registerDevice({
        name: 'Zigbee Light 1',
        type: 'light',
        protocol: 'zigbee'
      });

      deviceManager.registerDevice({
        name: 'Zigbee Light 2',
        type: 'light',
        protocol: 'zigbee'
      });

      const sensor = deviceManager.registerDevice({
        name: 'Zigbee Sensor',
        type: 'sensor',
        protocol: 'zigbee'
      });

      deviceManager.registerDevice({
        name: 'Matter Light',
        type: 'light',
        protocol: 'matter'
      });

      // Mark one device offline
      deviceManager.markDeviceOffline(sensor.id);
    });

    test('should return total device count', () => {
      const stats = deviceManager.getStatistics();

      expect(stats.total).toBe(4);
    });

    test('should count online and offline devices', () => {
      const stats = deviceManager.getStatistics();

      expect(stats.online).toBe(3);
      expect(stats.offline).toBe(1);
    });

    test('should count devices by protocol', () => {
      const stats = deviceManager.getStatistics();

      expect(stats.byProtocol.zigbee).toBe(3);
      expect(stats.byProtocol.matter).toBe(1);
    });

    test('should count devices by type', () => {
      const stats = deviceManager.getStatistics();

      expect(stats.byType.light).toBe(3);
      expect(stats.byType.sensor).toBe(1);
    });
  });
});
