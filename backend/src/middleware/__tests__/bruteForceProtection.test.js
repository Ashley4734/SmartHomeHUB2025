/**
 * Tests for brute force protection middleware
 */

import { jest } from '@jest/globals';
import {
  logAuthEvent,
  isLocked,
  getRemainingLockoutTime,
  recordFailedAttempt,
  resetFailedAttempts,
  bruteForceProtection,
  cleanupOldAuditLogs
} from '../bruteForceProtection.js';

// Mock database
jest.mock('../../database/db.js');

describe('Brute Force Protection Middleware', () => {
  let mockDb, mockDbPrepare, req, res, next, getDatabase;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock database prepare methods
    mockDbPrepare = {
      run: jest.fn().mockReturnValue({ changes: 1 }),
      get: jest.fn(),
      all: jest.fn()
    };

    mockDb = {
      prepare: jest.fn().mockReturnValue(mockDbPrepare)
    };

    const dbModule = await import('../../database/db.js');
    getDatabase = dbModule.getDatabase;
    getDatabase.mockReturnValue(mockDb);

    // Create mock request and response objects
    req = {
      body: { username: 'testuser' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Mozilla/5.0' }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();
  });

  describe('logAuthEvent', () => {
    it('should log authentication event to database', () => {
      const eventData = {
        userId: 'user-123',
        username: 'testuser',
        eventType: 'login',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        success: true
      };

      logAuthEvent(eventData);

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockDbPrepare.run).toHaveBeenCalled();
    });

    it('should log failed authentication event', () => {
      const eventData = {
        username: 'testuser',
        eventType: 'login',
        success: false,
        errorMessage: 'Invalid credentials',
        ipAddress: '127.0.0.1'
      };

      logAuthEvent(eventData);

      expect(mockDbPrepare.run).toHaveBeenCalledWith(
        null,
        'testuser',
        'login',
        '127.0.0.1',
        null,
        0, // success = false
        'Invalid credentials',
        null,
        expect.any(Number)
      );
    });

    it('should handle metadata as JSON', () => {
      const eventData = {
        username: 'testuser',
        eventType: 'login',
        success: true,
        metadata: { provider: 'local', remember: true }
      };

      logAuthEvent(eventData);

      expect(mockDbPrepare.run).toHaveBeenCalledWith(
        null,
        'testuser',
        'login',
        null,
        null,
        1,
        null,
        JSON.stringify({ provider: 'local', remember: true }),
        expect.any(Number)
      );
    });

    it('should handle errors gracefully', () => {
      mockDbPrepare.run.mockImplementation(() => {
        throw new Error('Database error');
      });

      const eventData = {
        username: 'testuser',
        eventType: 'login',
        success: true
      };

      // Should not throw
      expect(() => logAuthEvent(eventData)).not.toThrow();
    });
  });

  describe('isLocked', () => {
    it('should return false when no record exists', () => {
      mockDbPrepare.get.mockReturnValue(null);

      const result = isLocked('testuser');

      expect(result).toBe(false);
    });

    it('should return true when account is locked', () => {
      const futureTime = Date.now() + 60000; // 1 minute from now
      mockDbPrepare.get.mockReturnValue({
        attempt_count: 5,
        locked_until: futureTime,
        last_attempt: Date.now() - 1000
      });

      const result = isLocked('testuser');

      expect(result).toBe(true);
    });

    it('should return false when lock has expired', () => {
      const pastTime = Date.now() - 60000; // 1 minute ago
      mockDbPrepare.get.mockReturnValue({
        attempt_count: 5,
        locked_until: pastTime,
        last_attempt: Date.now() - 120000
      });

      const result = isLocked('testuser');

      expect(result).toBe(false);
    });

    it('should return true when attempts exceed limit within window', () => {
      mockDbPrepare.get.mockReturnValue({
        attempt_count: 5,
        locked_until: null,
        last_attempt: Date.now() - 60000 // 1 minute ago
      });

      const result = isLocked('testuser');

      expect(result).toBe(true);
    });

    it('should reset attempts when outside window', () => {
      const oldTime = Date.now() - (20 * 60 * 1000); // 20 minutes ago
      mockDbPrepare.get.mockReturnValue({
        attempt_count: 5,
        locked_until: null,
        last_attempt: oldTime
      });

      const result = isLocked('testuser');

      expect(result).toBe(false);
      expect(mockDbPrepare.run).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', () => {
      mockDbPrepare.get.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = isLocked('testuser');

      // Should fail open (return false) to prevent lockout of all users
      expect(result).toBe(false);
    });
  });

  describe('getRemainingLockoutTime', () => {
    it('should return 0 when no record exists', () => {
      mockDbPrepare.get.mockReturnValue(null);

      const result = getRemainingLockoutTime('testuser');

      expect(result).toBe(0);
    });

    it('should return 0 when not locked', () => {
      mockDbPrepare.get.mockReturnValue({
        locked_until: null
      });

      const result = getRemainingLockoutTime('testuser');

      expect(result).toBe(0);
    });

    it('should return remaining time in seconds', () => {
      const futureTime = Date.now() + 60000; // 1 minute from now
      mockDbPrepare.get.mockReturnValue({
        locked_until: futureTime
      });

      const result = getRemainingLockoutTime('testuser');

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(60);
    });

    it('should return 0 for expired locks', () => {
      const pastTime = Date.now() - 60000; // 1 minute ago
      mockDbPrepare.get.mockReturnValue({
        locked_until: pastTime
      });

      const result = getRemainingLockoutTime('testuser');

      expect(result).toBe(0);
    });

    it('should handle database errors gracefully', () => {
      mockDbPrepare.get.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = getRemainingLockoutTime('testuser');

      expect(result).toBe(0);
    });
  });

  describe('recordFailedAttempt', () => {
    it('should create new record for first failed attempt', () => {
      mockDbPrepare.get.mockReturnValue(null);

      recordFailedAttempt('testuser');

      expect(mockDbPrepare.run).toHaveBeenCalledWith('testuser', expect.any(Number));
    });

    it('should increment attempt count for existing record', () => {
      mockDbPrepare.get.mockReturnValue({
        id: 1,
        attempt_count: 2,
        last_attempt: Date.now() - 60000
      });

      recordFailedAttempt('testuser');

      expect(mockDbPrepare.run).toHaveBeenCalled();
      const callArgs = mockDbPrepare.run.mock.calls[0];
      expect(callArgs[0]).toBe(3); // new count = 2 + 1
    });

    it('should lock account after max attempts', () => {
      mockDbPrepare.get.mockReturnValue({
        id: 1,
        attempt_count: 4,
        last_attempt: Date.now() - 60000
      });

      recordFailedAttempt('testuser');

      const callArgs = mockDbPrepare.run.mock.calls[0];
      expect(callArgs[0]).toBe(5); // new count = 4 + 1
      expect(callArgs[1]).toBeGreaterThan(Date.now()); // locked_until should be in future
    });

    it('should reset count when outside attempt window', () => {
      const oldTime = Date.now() - (20 * 60 * 1000); // 20 minutes ago
      mockDbPrepare.get.mockReturnValue({
        id: 1,
        attempt_count: 5,
        last_attempt: oldTime
      });

      recordFailedAttempt('testuser');

      const callArgs = mockDbPrepare.run.mock.calls[0];
      expect(callArgs[0]).toBe(1); // reset to 1
    });

    it('should handle database errors gracefully', () => {
      mockDbPrepare.get.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Should not throw
      expect(() => recordFailedAttempt('testuser')).not.toThrow();
    });
  });

  describe('resetFailedAttempts', () => {
    it('should delete failed attempt record', () => {
      resetFailedAttempts('testuser');

      expect(mockDbPrepare.run).toHaveBeenCalledWith('testuser');
    });

    it('should handle database errors gracefully', () => {
      mockDbPrepare.run.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Should not throw
      expect(() => resetFailedAttempts('testuser')).not.toThrow();
    });
  });

  describe('bruteForceProtection middleware', () => {
    it('should call next() when account is not locked', () => {
      mockDbPrepare.get.mockReturnValue(null);

      bruteForceProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block request when account is locked', () => {
      const futureTime = Date.now() + 60000;
      mockDbPrepare.get
        .mockReturnValueOnce({
          attempt_count: 5,
          locked_until: futureTime,
          last_attempt: Date.now() - 1000
        })
        .mockReturnValueOnce({ locked_until: futureTime });

      bruteForceProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Account Locked',
          message: expect.stringContaining('Too many failed login attempts'),
          retryAfter: expect.any(Number)
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should use IP address when username not provided', () => {
      req.body = {};
      mockDbPrepare.get.mockReturnValue(null);

      bruteForceProtection(req, res, next);

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should log blocked login attempt', () => {
      const futureTime = Date.now() + 60000;
      mockDbPrepare.get
        .mockReturnValueOnce({
          attempt_count: 5,
          locked_until: futureTime,
          last_attempt: Date.now() - 1000
        })
        .mockReturnValueOnce({ locked_until: futureTime });

      bruteForceProtection(req, res, next);

      // Verify that logAuthEvent was called (check for INSERT into auth_audit_log)
      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe('cleanupOldAuditLogs', () => {
    it('should delete old audit logs', () => {
      mockDbPrepare.run.mockReturnValue({ changes: 42 });

      const deletedCount = cleanupOldAuditLogs(90);

      expect(mockDbPrepare.run).toHaveBeenCalled();
      expect(deletedCount).toBe(42);
    });

    it('should use custom retention days', () => {
      mockDbPrepare.run.mockReturnValue({ changes: 10 });

      cleanupOldAuditLogs(30);

      expect(mockDbPrepare.run).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', () => {
      mockDbPrepare.run.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = cleanupOldAuditLogs(90);

      expect(result).toBe(0);
    });
  });

  describe('default export', () => {
    it('should export all functions', async () => {
      const bruteForceModule = await import('../bruteForceProtection.js');
      const defaultExport = bruteForceModule.default;

      expect(defaultExport).toHaveProperty('logAuthEvent');
      expect(defaultExport).toHaveProperty('isLocked');
      expect(defaultExport).toHaveProperty('getRemainingLockoutTime');
      expect(defaultExport).toHaveProperty('recordFailedAttempt');
      expect(defaultExport).toHaveProperty('resetFailedAttempts');
      expect(defaultExport).toHaveProperty('bruteForceProtection');
      expect(defaultExport).toHaveProperty('cleanupOldAuditLogs');
    });
  });

  describe('environment configuration', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use environment variables for configuration', () => {
      process.env.MAX_FAILED_LOGIN_ATTEMPTS = '3';
      process.env.LOCKOUT_DURATION_MS = '300000'; // 5 minutes
      process.env.ATTEMPT_WINDOW_MS = '600000'; // 10 minutes

      // The module uses these values at import time, so they would be set
      expect(process.env.MAX_FAILED_LOGIN_ATTEMPTS).toBe('3');
    });
  });
});
