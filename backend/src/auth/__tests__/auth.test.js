/**
 * Auth Module Unit Tests
 */

import { jest } from '@jest/globals';
import * as auth from '../auth.js';

// Mock dependencies
jest.unstable_mockModule('../database/db.js', () => ({
  getDatabase: jest.fn()
}));

jest.unstable_mockModule('../../middleware/bruteForceProtection.js', () => ({
  recordFailedAttempt: jest.fn(),
  resetFailedAttempts: jest.fn(),
  logAuthEvent: jest.fn()
}));

const { getDatabase } = await import('../database/db.js');
const { recordFailedAttempt, resetFailedAttempts, logAuthEvent } = await import('../../middleware/bruteForceProtection.js');

describe('Auth Module', () => {
  let mockDb;
  let mockPrepare;
  let mockRun;
  let mockGet;
  let mockAll;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock database methods
    mockRun = jest.fn().mockReturnThis();
    mockGet = jest.fn();
    mockAll = jest.fn();
    mockPrepare = jest.fn(() => ({
      run: mockRun,
      get: mockGet,
      all: mockAll
    }));

    mockDb = {
      prepare: mockPrepare
    };

    getDatabase.mockReturnValue(mockDb);
  });

  describe('Password Hashing', () => {
    test('should hash password successfully', async () => {
      const password = 'testPassword123';
      const hash = await auth.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toHaveLength(60); // bcrypt hash length
    });

    test('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await auth.hashPassword(password);
      const isValid = await auth.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword';
      const hash = await auth.hashPassword(password);
      const isValid = await auth.verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });
  });

  describe('Token Generation and Verification', () => {
    test('should generate valid JWT token', () => {
      const user = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user'
      };

      const token = auth.generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT structure
    });

    test('should verify valid token', () => {
      const user = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user'
      };

      const token = auth.generateToken(user);
      const decoded = auth.verifyToken(token);

      expect(decoded.id).toBe(user.id);
      expect(decoded.username).toBe(user.username);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
    });

    test('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        auth.verifyToken(invalidToken);
      }).toThrow('Invalid or expired token');
    });
  });

  describe('User Creation', () => {
    test('should create new user successfully', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        role: 'user',
        fullName: 'New User'
      };

      // Mock: no existing user
      mockGet.mockReturnValue(null);

      const user = await auth.createUser(userData);

      expect(user).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
      expect(user.fullName).toBe(userData.fullName);
      expect(user.id).toBeDefined();

      // Verify database calls
      expect(mockPrepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });

    test('should throw error if username already exists', async () => {
      const userData = {
        username: 'existinguser',
        email: 'newemail@example.com',
        password: 'password123'
      };

      // Mock: existing user
      mockGet.mockReturnValue({ id: 'existing-id' });

      await expect(auth.createUser(userData)).rejects.toThrow(
        'User with this username or email already exists'
      );
    });

    test('should throw error if email already exists', async () => {
      const userData = {
        username: 'newusername',
        email: 'existing@example.com',
        password: 'password123'
      };

      // Mock: existing user
      mockGet.mockReturnValue({ id: 'existing-id' });

      await expect(auth.createUser(userData)).rejects.toThrow(
        'User with this username or email already exists'
      );
    });

    test('should default role to USER if not specified', async () => {
      const userData = {
        username: 'defaultuser',
        email: 'default@example.com',
        password: 'password123'
      };

      mockGet.mockReturnValue(null);

      const user = await auth.createUser(userData);

      expect(user.role).toBe(auth.ROLES.USER);
    });
  });

  describe('User Authentication', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      password_hash: null, // Will be set in beforeEach
      role: 'user',
      full_name: 'Test User',
      is_active: 1
    };

    beforeEach(async () => {
      mockUser.password_hash = await auth.hashPassword('correctPassword');
    });

    test('should authenticate user with correct credentials', async () => {
      mockGet
        .mockReturnValueOnce(mockUser); // SELECT user

      const result = await auth.authenticateUser(
        'testuser',
        'correctPassword',
        '127.0.0.1',
        'Jest Test Agent'
      );

      expect(result).toBeDefined();
      expect(result.user.username).toBe(mockUser.username);
      expect(result.token).toBeDefined();

      // Verify brute force protection integration
      expect(resetFailedAttempts).toHaveBeenCalledWith(mockUser.username);
      expect(logAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          username: mockUser.username,
          eventType: 'login_success',
          success: true
        })
      );
    });

    test('should reject authentication with incorrect password', async () => {
      mockGet
        .mockReturnValueOnce(mockUser); // SELECT user

      await expect(
        auth.authenticateUser('testuser', 'wrongPassword', '127.0.0.1', 'Jest Test Agent')
      ).rejects.toThrow('Invalid credentials');

      // Verify brute force protection integration
      expect(recordFailedAttempt).toHaveBeenCalledWith(mockUser.username);
      expect(logAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          username: mockUser.username,
          eventType: 'login_failed',
          success: false,
          errorMessage: 'Invalid password'
        })
      );
    });

    test('should reject authentication for non-existent user', async () => {
      mockGet.mockReturnValue(null); // User not found

      await expect(
        auth.authenticateUser('nonexistent', 'password', '127.0.0.1', 'Jest Test Agent')
      ).rejects.toThrow('Invalid credentials');

      // Verify brute force protection integration
      expect(recordFailedAttempt).toHaveBeenCalledWith('nonexistent');
      expect(logAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'nonexistent',
          eventType: 'login_failed',
          success: false,
          errorMessage: 'User not found'
        })
      );
    });

    test('should reject authentication for inactive user', async () => {
      const inactiveUser = { ...mockUser, is_active: 0 };
      mockGet.mockReturnValue(null); // Query filters by is_active = 1

      await expect(
        auth.authenticateUser('testuser', 'correctPassword', '127.0.0.1', 'Jest Test Agent')
      ).rejects.toThrow('Invalid credentials');
    });

    test('should authenticate with email instead of username', async () => {
      mockGet
        .mockReturnValueOnce(mockUser); // SELECT user

      const result = await auth.authenticateUser(
        'test@example.com',
        'correctPassword',
        '127.0.0.1',
        'Jest Test Agent'
      );

      expect(result).toBeDefined();
      expect(result.user.email).toBe(mockUser.email);
    });
  });

  describe('User Management', () => {
    test('should get user by ID', () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        full_name: 'Test User',
        created_at: Date.now(),
        last_login: Date.now(),
        is_active: 1
      };

      mockGet.mockReturnValue(mockUser);

      const user = auth.getUserById('user-123');

      expect(user).toEqual(mockUser);
      expect(mockPrepare).toHaveBeenCalled();
    });

    test('should list all users', () => {
      const mockUsers = [
        { id: 'user-1', username: 'user1' },
        { id: 'user-2', username: 'user2' }
      ];

      mockAll.mockReturnValue(mockUsers);

      const users = auth.listUsers();

      expect(users).toEqual(mockUsers);
      expect(users).toHaveLength(2);
    });

    test('should update user successfully', async () => {
      const userId = 'user-123';
      const updates = {
        email: 'newemail@example.com',
        full_name: 'Updated Name'
      };

      const updatedUser = {
        id: userId,
        ...updates
      };

      mockGet.mockReturnValue(updatedUser);

      const result = await auth.updateUser(userId, updates);

      expect(result).toEqual(updatedUser);
      expect(mockRun).toHaveBeenCalled();
    });

    test('should update user password', async () => {
      const userId = 'user-123';
      const updates = {
        password: 'newPassword123'
      };

      mockGet.mockReturnValue({ id: userId });

      await auth.updateUser(userId, updates);

      expect(mockRun).toHaveBeenCalled();
      // Password should be hashed
      const callArgs = mockRun.mock.calls[0];
      expect(callArgs[0]).not.toBe(updates.password);
    });

    test('should throw error when updating with no valid fields', async () => {
      const userId = 'user-123';
      const updates = {
        invalid_field: 'value'
      };

      await expect(auth.updateUser(userId, updates)).rejects.toThrow(
        'No valid fields to update'
      );
    });

    test('should delete user', () => {
      const userId = 'user-123';

      auth.deleteUser(userId);

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalledWith(userId);
    });
  });

  describe('Permissions', () => {
    test('should grant admin all permissions', () => {
      expect(auth.hasPermission(auth.ROLES.ADMIN, 'device.read')).toBe(true);
      expect(auth.hasPermission(auth.ROLES.ADMIN, 'device.write')).toBe(true);
      expect(auth.hasPermission(auth.ROLES.ADMIN, 'user.delete')).toBe(true);
      expect(auth.hasPermission(auth.ROLES.ADMIN, 'system.config')).toBe(true);
    });

    test('should grant user specific permissions', () => {
      expect(auth.hasPermission(auth.ROLES.USER, 'device.read')).toBe(true);
      expect(auth.hasPermission(auth.ROLES.USER, 'device.control')).toBe(true);
      expect(auth.hasPermission(auth.ROLES.USER, 'automation.read')).toBe(true);
    });

    test('should deny user admin permissions', () => {
      expect(auth.hasPermission(auth.ROLES.USER, 'user.delete')).toBe(false);
      expect(auth.hasPermission(auth.ROLES.USER, 'system.config')).toBe(false);
    });

    test('should handle wildcard permissions', () => {
      expect(auth.hasPermission(auth.ROLES.ADMIN, 'device.anything')).toBe(true);
      expect(auth.hasPermission(auth.ROLES.USER, 'scene.execute')).toBe(true);
    });

    test('should deny guest most permissions', () => {
      expect(auth.hasPermission(auth.ROLES.GUEST, 'device.read')).toBe(true);
      expect(auth.hasPermission(auth.ROLES.GUEST, 'automation.create')).toBe(false);
      expect(auth.hasPermission(auth.ROLES.GUEST, 'user.read')).toBe(false);
    });
  });

  describe('Middleware', () => {
    test('authenticate middleware should extract token and attach user', () => {
      const req = {
        headers: {
          authorization: 'Bearer validtoken'
        }
      };
      const res = {};
      const next = jest.fn();

      // Mock verifyToken to return decoded user
      jest.spyOn(auth, 'verifyToken').mockReturnValue({
        id: 'user-123',
        username: 'testuser',
        role: 'user'
      });

      auth.authenticate(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-123');
      expect(next).toHaveBeenCalled();
    });

    test('authenticate middleware should reject missing token', () => {
      const req = {
        headers: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      auth.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    test('authenticate middleware should reject invalid token', () => {
      const req = {
        headers: {
          authorization: 'Bearer invalidtoken'
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      jest.spyOn(auth, 'verifyToken').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      auth.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('requirePermission middleware should allow with sufficient permission', () => {
      const req = {
        user: { role: 'admin' }
      };
      const res = {};
      const next = jest.fn();

      const middleware = auth.requirePermission('device.read');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('requirePermission middleware should deny without permission', () => {
      const req = {
        user: { role: 'guest' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = auth.requirePermission('user.delete');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    test('requirePermission middleware should deny without user', () => {
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = auth.requirePermission('device.read');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
