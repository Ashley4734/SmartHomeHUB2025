import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { requestLogger } from '../requestLogger.js';

describe('Request Logger Middleware', () => {
  let req;
  let res;
  let next;
  let originalSend;

  beforeEach(() => {
    // Setup mock request
    req = {
      method: 'GET',
      url: '/api/devices',
      ip: '127.0.0.1',
      get: jest.fn((header) => {
        if (header === 'user-agent') {
          return 'Mozilla/5.0 (Test Browser)';
        }
        return null;
      }),
    };

    // Setup mock response
    originalSend = jest.fn();
    res = {
      statusCode: 200,
      send: originalSend,
    };

    // Setup mock next
    next = jest.fn();
  });

  test('should call next middleware', () => {
    requestLogger(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('should wrap the send function', () => {
    requestLogger(req, res, next);

    expect(res.send).toBeDefined();
    expect(typeof res.send).toBe('function');
    expect(res.send).not.toBe(originalSend);
  });

  test('should preserve original send functionality', () => {
    const testData = { message: 'test data' };

    requestLogger(req, res, next);

    // Call the wrapped send
    res.send(testData);

    // Verify original send was called
    expect(originalSend).toHaveBeenCalledWith(testData);
  });

  test('should call user-agent header getter', () => {
    requestLogger(req, res, next);

    expect(req.get).toHaveBeenCalledWith('user-agent');
  });

  test('should handle POST requests', () => {
    req.method = 'POST';
    req.url = '/api/devices';

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('should handle missing user agent', () => {
    req.get = jest.fn(() => undefined);

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('should handle different status codes', () => {
    requestLogger(req, res, next);

    res.statusCode = 500;
    res.send('Internal Server Error');

    expect(originalSend).toHaveBeenCalled();
  });

  test('should handle different URLs', () => {
    req.url = '/api/users/profile';

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('should handle different HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    methods.forEach((method) => {
      const mockNext = jest.fn();
      req.method = method;

      requestLogger(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  test('should handle requests with different IPs', () => {
    req.ip = '192.168.1.100';

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('should handle multiple requests independently', () => {
    // First request
    const req1 = { ...req, url: '/api/request1' };
    const res1 = { statusCode: 200, send: jest.fn() };
    const next1 = jest.fn();
    requestLogger(req1, res1, next1);

    // Second request
    const req2 = { ...req, url: '/api/request2' };
    const res2 = { statusCode: 200, send: jest.fn() };
    const next2 = jest.fn();
    requestLogger(req2, res2, next2);

    expect(next1).toHaveBeenCalled();
    expect(next2).toHaveBeenCalled();
  });

  test('should allow chaining after send', () => {
    requestLogger(req, res, next);

    // Call send and verify it returns properly
    const result = res.send('test');

    expect(result).toBeUndefined(); // send doesn't return anything in our mock
  });

  test('should work with different response data types', () => {
    requestLogger(req, res, next);

    // Test with object
    res.send({ success: true });
    expect(originalSend).toHaveBeenCalledWith({ success: true });

    // Test with string
    originalSend.mockClear();
    requestLogger(req, res, next);
    res.send('text response');
    expect(originalSend).toHaveBeenCalledWith('text response');
  });

  test('should handle requests without IP', () => {
    delete req.ip;

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
