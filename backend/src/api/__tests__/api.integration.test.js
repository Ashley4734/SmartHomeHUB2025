/**
 * API Integration Tests
 * Tests API endpoints with a real server and database
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { initDatabase, closeDatabase, getDatabase } from '../../database/db.js';
import * as auth from '../../auth/auth.js';
import DeviceManager from '../../core/deviceManager.js';
import setupRoutes from '../routes.js';

// Set test environment
process.env.JWT_SECRET = 'test-secret-key-for-api-testing';
process.env.NODE_ENV = 'test';
process.env.CSRF_SECRET = 'test-csrf-secret';

describe('API Integration Tests', () => {
  let app;
  let adminUser;
  let adminToken;
  let regularUser;
  let regularToken;
  let deviceManager;

  beforeAll(async () => {
    // Initialize database
    initDatabase(':memory:');

    // Create Express app
    app = express();
    app.use(express.json());

    // Initialize services
    deviceManager = new DeviceManager();

    const services = {
      auth,
      deviceManager,
      automationEngine: { automations: new Map() }, // Mock
      aiService: {}, // Mock
      voiceControl: null
    };

    // Setup routes
    setupRoutes(app, services);

    // Create test users
    adminUser = await auth.createUser({
      username: 'admin',
      email: 'admin@test.com',
      password: 'admin123',
      role: auth.ROLES.ADMIN
    });
    adminToken = auth.generateToken(adminUser);

    regularUser = await auth.createUser({
      username: 'user',
      email: 'user@test.com',
      password: 'user123',
      role: auth.ROLES.USER
    });
    regularToken = auth.generateToken(regularUser);
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(() => {
    // Clean up devices before each test
    const db = getDatabase();
    db.prepare('DELETE FROM devices').run();
    db.prepare('DELETE FROM device_history').run();
    deviceManager.devices.clear();
    deviceManager.loadDevices();
  });

  describe('Health Check', () => {
    test('GET /api/health should return OK', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/auth/register should create new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'newuser@test.com',
          password: 'password123',
          fullName: 'New User'
        })
        .expect(201);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe('newuser');
      expect(response.body.user.email).toBe('newuser@test.com');
    });

    test('POST /api/auth/register should reject duplicate username', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'admin',
          email: 'another@test.com',
          password: 'password123'
        })
        .expect(400);
    });

    test('POST /api/auth/login should authenticate user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'user',
          password: 'user123'
        })
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.token).toBeDefined();
      expect(response.body.user.username).toBe('user');
    });

    test('POST /api/auth/login should authenticate using email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@test.com',
          password: 'user123'
        })
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe('user@test.com');
    });

    test('POST /api/auth/login should reject wrong password', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'user',
          password: 'wrongpassword'
        })
        .expect(401);
    });

    test('GET /api/auth/me should return current user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe('user');
    });

    test('GET /api/auth/me should reject without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('User Management Endpoints', () => {
    test('GET /api/users should list users (admin only)', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users).toBeDefined();
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    test('GET /api/users should reject non-admin', async () => {
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    test('PATCH /api/users/:id should update user', async () => {
      const response = await request(app)
        .patch(`/api/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          full_name: 'Updated Name'
        })
        .expect(200);

      expect(response.body.user.full_name).toBe('Updated Name');
    });

    test('PATCH /api/users/:id should reject unauthorized update', async () => {
      await request(app)
        .patch(`/api/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          full_name: 'Hacker'
        })
        .expect(403);
    });

    test('DELETE /api/users/:id should delete user (admin only)', async () => {
      const testUser = await auth.createUser({
        username: 'deleteme',
        email: 'deleteme@test.com',
        password: 'pass123'
      });

      await request(app)
        .delete(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const deleted = auth.getUserById(testUser.id);
      expect(deleted).toBeUndefined();
    });
  });

  describe('Device Endpoints', () => {
    let testDevice;

    beforeEach(() => {
      testDevice = deviceManager.registerDevice({
        name: 'Test Light',
        type: 'light',
        protocol: 'zigbee',
        manufacturer: 'Philips',
        model: 'Hue Bulb'
      });
    });

    test('GET /api/devices should list devices', async () => {
      const response = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(response.body.devices).toBeDefined();
      expect(Array.isArray(response.body.devices)).toBe(true);
      expect(response.body.devices.length).toBe(1);
    });

    test('GET /api/devices should filter by protocol', async () => {
      deviceManager.registerDevice({
        name: 'Matter Device',
        type: 'sensor',
        protocol: 'matter'
      });

      const response = await request(app)
        .get('/api/devices?protocol=zigbee')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(response.body.devices.length).toBe(1);
      expect(response.body.devices[0].protocol).toBe('zigbee');
    });

    test('GET /api/devices/:id should get device by ID', async () => {
      const response = await request(app)
        .get(`/api/devices/${testDevice.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(response.body.device).toBeDefined();
      expect(response.body.device.id).toBe(testDevice.id);
      expect(response.body.device.name).toBe('Test Light');
    });

    test('GET /api/devices/:id should return 404 for non-existent device', async () => {
      await request(app)
        .get('/api/devices/non-existent-id')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(404);
    });

    test('Should be able to register device directly through deviceManager', () => {
      // Note: Device registration happens through protocol-specific routes
      // or directly through deviceManager in production
      const device = deviceManager.registerDevice({
        name: 'New Device',
        type: 'sensor',
        protocol: 'zigbee',
        manufacturer: 'Xiaomi',
        model: 'Temperature Sensor'
      });

      expect(device).toBeDefined();
      expect(device.name).toBe('New Device');
      expect(device.type).toBe('sensor');
    });

    test('POST /api/devices/:id/control should control device', async () => {
      const response = await request(app)
        .post(`/api/devices/${testDevice.id}/control`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          command: 'turn_on',
          parameters: { brightness: 100 }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('PATCH /api/devices/:id should update device (admin)', async () => {
      const response = await request(app)
        .patch(`/api/devices/${testDevice.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Light'
        })
        .expect(200);

      expect(response.body.device.name).toBe('Updated Light');
    });

    test('PATCH /api/devices/:id should reject non-admin', async () => {
      await request(app)
        .patch(`/api/devices/${testDevice.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Unauthorized Update'
        })
        .expect(403);
    });

    test('DELETE /api/devices/:id should delete device (admin)', async () => {
      await request(app)
        .delete(`/api/devices/${testDevice.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const deleted = deviceManager.getDevice(testDevice.id);
      expect(deleted).toBeNull();
    });

    test('GET /api/devices/:id/history should get device history', async () => {
      // Update device state to create history
      deviceManager.updateDeviceState(testDevice.id, { on: true }, regularUser.id);
      deviceManager.updateDeviceState(testDevice.id, { brightness: 50 }, regularUser.id);

      const response = await request(app)
        .get(`/api/devices/${testDevice.id}/history`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(response.body.history).toBeDefined();
      expect(Array.isArray(response.body.history)).toBe(true);
      expect(response.body.history.length).toBeGreaterThan(0);
    });

    test('GET /api/devices/stats/summary should return device statistics', async () => {
      deviceManager.registerDevice({
        name: 'Device 2',
        type: 'sensor',
        protocol: 'matter'
      });

      const response = await request(app)
        .get('/api/devices/stats/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.total).toBeDefined();
      expect(response.body.total).toBe(2);
      expect(response.body.byProtocol).toBeDefined();
    });
  });

  describe('Authorization', () => {
    test('Should reject requests without token', async () => {
      await request(app)
        .get('/api/devices')
        .expect(401);
    });

    test('Should reject requests with invalid token', async () => {
      await request(app)
        .get('/api/devices')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('Should reject unauthorized actions', async () => {
      // Regular user trying to access admin endpoint
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });
  });

  describe('Error Handling', () => {
    test('Should return 404 for non-existent routes', async () => {
      await request(app)
        .get('/api/non-existent-route')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(404);
    });

    test('Should handle errors for non-existent devices', async () => {
      // Try to control a non-existent device
      await request(app)
        .post('/api/devices/non-existent-device-id/control')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          command: 'turn_on',
          parameters: { brightness: 50 }
        })
        .expect(400);
    });
  });
});
