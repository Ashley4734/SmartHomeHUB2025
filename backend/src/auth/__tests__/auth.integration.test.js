/**
 * Auth Module Integration Tests
 * Tests the auth module with a real in-memory database
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import * as auth from '../auth.js';
import { initDatabase, closeDatabase, getDatabase } from '../../database/db.js';

// Set test environment
process.env.JWT_SECRET = 'test-secret-key-for-jest-testing';
process.env.NODE_ENV = 'test';

describe('Auth Module - Integration Tests', () => {
  beforeAll(() => {
    // Initialize in-memory database for testing
    initDatabase(':memory:');
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(() => {
    // Clean up tables in correct order to respect foreign key constraints
    // Delete child tables first, then parent tables
    const db = getDatabase();
    db.prepare('DELETE FROM user_consents').run();
    db.prepare('DELETE FROM data_processing_log').run();
    db.prepare('DELETE FROM auth_audit_log').run();
    db.prepare('DELETE FROM failed_login_attempts').run();
    db.prepare('DELETE FROM users').run();
  });

  describe('Password Hashing', () => {
    test('should hash password', async () => {
      const password = 'testPassword123';
      const hash = await auth.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    test('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await auth.hashPassword(password);
      const isValid = await auth.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const hash = await auth.hashPassword(password);
      const isValid = await auth.verifyPassword('wrongPassword', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('JWT Tokens', () => {
    test('should generate and verify token', () => {
      const user = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user'
      };

      const token = auth.generateToken(user);
      const decoded = auth.verifyToken(token);

      expect(decoded.id).toBe(user.id);
      expect(decoded.username).toBe(user.username);
    });

    test('should reject invalid token', () => {
      expect(() => {
        auth.verifyToken('invalid.token');
      }).toThrow();
    });
  });

  describe('User Creation', () => {
    test('should create user', async () => {
      const userData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        fullName: 'New User'
      };

      const user = await auth.createUser(userData);

      expect(user.id).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(auth.ROLES.USER);
    });

    test('should reject duplicate username', async () => {
      await auth.createUser({
        username: 'duplicate',
        email: 'first@example.com',
        password: 'pass123'
      });

      await expect(
        auth.createUser({
          username: 'duplicate',
          email: 'second@example.com',
          password: 'pass123'
        })
      ).rejects.toThrow();
    });
  });

  describe('Authentication', () => {
    const password = 'testPass123';

    beforeEach(async () => {
      await auth.createUser({
        username: 'authtest',
        email: 'auth@test.com',
        password,
        fullName: 'Auth Test'
      });
    });

    test('should authenticate with correct credentials', async () => {
      const result = await auth.authenticateUser(
        'authtest',
        password,
        '127.0.0.1',
        'Test'
      );

      expect(result.user.username).toBe('authtest');
      expect(result.token).toBeDefined();
    });

    test('should reject wrong password', async () => {
      await expect(
        auth.authenticateUser('authtest', 'wrongpass', '127.0.0.1', 'Test')
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('Permissions', () => {
    test('admin has all permissions', () => {
      expect(auth.hasPermission(auth.ROLES.ADMIN, 'device.read')).toBe(true);
      expect(auth.hasPermission(auth.ROLES.ADMIN, 'user.delete')).toBe(true);
    });

    test('user has limited permissions', () => {
      expect(auth.hasPermission(auth.ROLES.USER, 'device.read')).toBe(true);
      expect(auth.hasPermission(auth.ROLES.USER, 'user.delete')).toBe(false);
    });

    test('guest has minimal permissions', () => {
      expect(auth.hasPermission(auth.ROLES.GUEST, 'device.read')).toBe(true);
      expect(auth.hasPermission(auth.ROLES.GUEST, 'automation.create')).toBe(false);
    });
  });

  describe('Middleware', () => {
    let validToken;

    beforeEach(async () => {
      const user = await auth.createUser({
        username: 'middleware',
        email: 'mid@test.com',
        password: 'pass123'
      });
      validToken = auth.generateToken(user);
    });

    test('authenticate middleware accepts valid token', () => {
      const req = {
        headers: { authorization: `Bearer ${validToken}` }
      };
      const res = {};
      let called = false;
      const next = () => { called = true; };

      auth.authenticate(req, res, next);

      expect(req.user).toBeDefined();
      expect(called).toBe(true);
    });

    test('authenticate middleware rejects missing token', () => {
      const req = { headers: {} };
      let statusCode;
      let nextCalled = false;
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: () => {}
      };
      const next = () => { nextCalled = true; };

      auth.authenticate(req, res, next);

      expect(statusCode).toBe(401);
      expect(nextCalled).toBe(false);
    });

    test('requirePermission allows with permission', () => {
      const req = { user: { role: auth.ROLES.ADMIN } };
      const res = {};
      let called = false;
      const next = () => { called = true; };

      const middleware = auth.requirePermission('device.read');
      middleware(req, res, next);

      expect(called).toBe(true);
    });

    test('requirePermission denies without permission', () => {
      const req = { user: { role: auth.ROLES.GUEST } };
      let statusCode;
      let nextCalled = false;
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: () => {}
      };
      const next = () => { nextCalled = true; };

      const middleware = auth.requirePermission('user.delete');
      middleware(req, res, next);

      expect(statusCode).toBe(403);
      expect(nextCalled).toBe(false);
    });
  });
});
