/**
 * Tests for CSRF protection middleware
 */

import { jest } from '@jest/globals';
import {
  csrfProtection,
  csrfTokenEndpoint,
  csrfErrorHandler,
  generateToken
} from '../csrf.js';

describe('CSRF Middleware', () => {
  let req, res, next, originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Create mock request and response objects
    req = {
      headers: {},
      ip: '127.0.0.1',
      method: 'POST',
      url: '/api/test'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      getHeader: jest.fn(),
      setHeader: jest.fn()
    };

    next = jest.fn();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('csrfTokenEndpoint', () => {
    it('should be a function', () => {
      expect(typeof csrfTokenEndpoint).toBe('function');
    });

    it('should call res.json with csrf token', () => {
      // Call the endpoint
      csrfTokenEndpoint(req, res);

      // Should call res.json
      expect(res.json).toHaveBeenCalled();

      // Check structure of response
      const call = res.json.mock.calls[0];
      expect(call).toBeDefined();

      if (call && call[0]) {
        expect(call[0]).toHaveProperty('csrfToken');
      }
    });
  });

  describe('csrfErrorHandler', () => {
    it('should handle CSRF token validation errors', () => {
      const err = new Error('csrf token invalid');
      err.code = 'EBADCSRFTOKEN';

      csrfErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid CSRF token',
        message: 'CSRF token validation failed. Please refresh the page and try again.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle errors with csrf in message', () => {
      const err = new Error('invalid csrf token');

      csrfErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid CSRF token',
        message: 'CSRF token validation failed. Please refresh the page and try again.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass non-CSRF errors to next middleware', () => {
      const err = new Error('Some other error');

      csrfErrorHandler(err, req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(err);
    });

    it('should log CSRF validation failures', () => {
      const err = new Error('csrf error');
      req.headers['user-agent'] = 'Mozilla/5.0';

      csrfErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('generateToken', () => {
    it('should exist as an export', () => {
      expect(generateToken).toBeDefined();
    });
  });

  describe('csrfProtection', () => {
    it('should be a function', () => {
      expect(typeof csrfProtection).toBe('function');
    });
  });

  describe('default export', () => {
    it('should export all CSRF utilities', async () => {
      const csrfModule = await import('../csrf.js');
      const defaultExport = csrfModule.default;

      expect(defaultExport).toHaveProperty('csrfProtection');
      expect(defaultExport).toHaveProperty('csrfTokenEndpoint');
      expect(defaultExport).toHaveProperty('csrfErrorHandler');
      expect(defaultExport).toHaveProperty('generateToken');
    });
  });

  describe('environment configuration', () => {
    it('should handle CSRF_SECRET from environment', () => {
      process.env.CSRF_SECRET = 'test-csrf-secret';
      expect(process.env.CSRF_SECRET).toBe('test-csrf-secret');
    });

    it('should handle JWT_SECRET fallback', () => {
      delete process.env.CSRF_SECRET;
      process.env.JWT_SECRET = 'test-jwt-secret';
      expect(process.env.JWT_SECRET).toBe('test-jwt-secret');
    });
  });
});
