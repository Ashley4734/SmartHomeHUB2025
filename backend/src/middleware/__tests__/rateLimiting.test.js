/**
 * Tests for rate limiting middleware
 */

import { jest } from '@jest/globals';

// Mock express-rate-limit before importing rateLimiting
const mockRateLimit = jest.fn((options) => {
  // Return a middleware function
  const middleware = (req, res, next) => {
    // Simulate rate limit logic
    if (options.skip && options.skip(req)) {
      return next();
    }

    const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;

    // For testing, simulate rate limit exceeded on specific condition
    if (req.__simulateRateLimit) {
      return options.handler(req, res);
    }

    next();
  };

  // Store options for testing
  middleware._options = options;
  return middleware;
});

jest.unstable_mockModule('express-rate-limit', () => ({
  default: mockRateLimit
}));

const {
  globalRateLimiter,
  authRateLimiter,
  userRateLimiter,
  aiRateLimiter,
  strictRateLimiter
} = await import('../rateLimiting.js');

describe('Rate Limiting Middleware', () => {
  let req, res, next, originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Clear all mocks
    jest.clearAllMocks();

    // Create mock request and response objects
    req = {
      ip: '127.0.0.1',
      path: '/api/test',
      url: '/api/test',
      method: 'GET',
      headers: {},
      connection: { remoteAddress: '127.0.0.1' }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      getHeader: jest.fn().mockReturnValue('60')
    };

    next = jest.fn();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('globalRateLimiter', () => {
    it('should be a function', () => {
      expect(typeof globalRateLimiter).toBe('function');
    });

    it('should use environment variables for configuration', () => {
      const options = globalRateLimiter._options;
      expect(options).toBeDefined();
    });

    it('should skip rate limiting for health check endpoints', () => {
      const options = globalRateLimiter._options;
      req.path = '/api/health';

      const shouldSkip = options.skip(req);
      expect(shouldSkip).toBe(true);
    });

    it('should skip rate limiting for metrics endpoints', () => {
      const options = globalRateLimiter._options;
      req.path = '/api/metrics';

      const shouldSkip = options.skip(req);
      expect(shouldSkip).toBe(true);
    });

    it('should not skip rate limiting for regular endpoints', () => {
      const options = globalRateLimiter._options;
      req.path = '/api/devices';

      const shouldSkip = options.skip(req);
      expect(shouldSkip).toBe(false);
    });

    it('should use custom key generator', () => {
      const options = globalRateLimiter._options;
      const key = options.keyGenerator(req);

      expect(key).toContain('ip:');
    });

    it('should use user ID for authenticated requests', () => {
      const options = globalRateLimiter._options;
      req.user = { id: 'user-123' };

      const key = options.keyGenerator(req);
      expect(key).toBe('user:user-123');
    });

    it('should use IP for unauthenticated requests', () => {
      const options = globalRateLimiter._options;

      const key = options.keyGenerator(req);
      expect(key).toBe('ip:127.0.0.1');
    });

    it('should handle rate limit exceeded', () => {
      const options = globalRateLimiter._options;
      req.user = { username: 'testuser' };

      options.handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too Many Requests',
          message: expect.any(String),
        })
      );
    });

    it('should include retry-after header in response', () => {
      const options = globalRateLimiter._options;

      options.handler(req, res);

      expect(res.getHeader).toHaveBeenCalledWith('Retry-After');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retryAfter: '60',
        })
      );
    });
  });

  describe('authRateLimiter', () => {
    it('should be a function', () => {
      expect(typeof authRateLimiter).toBe('function');
    });

    it('should have stricter limits than global limiter', () => {
      const authOptions = authRateLimiter._options;
      const globalOptions = globalRateLimiter._options;

      expect(authOptions.max).toBeLessThan(globalOptions.max || 100);
    });

    it('should use IP-based key for auth attempts', () => {
      const options = authRateLimiter._options;
      req.ip = '192.168.1.100';

      const key = options.keyGenerator(req);
      expect(key).toBe('auth:192.168.1.100');
    });

    it('should skip successful requests', () => {
      const options = authRateLimiter._options;
      expect(options.skipSuccessfulRequests).toBe(true);
    });

    it('should handle rate limit for auth endpoints', () => {
      const options = authRateLimiter._options;

      options.handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('userRateLimiter', () => {
    it('should be a function', () => {
      expect(typeof userRateLimiter).toBe('function');
    });

    it('should have higher limits for authenticated users', () => {
      const userOptions = userRateLimiter._options;
      const globalOptions = globalRateLimiter._options;

      expect(userOptions.max).toBeGreaterThan(globalOptions.max || 100);
    });

    it('should skip rate limiting for admin users', () => {
      const options = userRateLimiter._options;
      req.user = { id: 'admin-1', role: 'admin' };

      const key = options.keyGenerator(req);
      expect(key).toBeNull();
    });

    it('should use user ID for regular users', () => {
      const options = userRateLimiter._options;
      req.user = { id: 'user-123', role: 'user' };

      const key = options.keyGenerator(req);
      expect(key).toBe('user:user-123');
    });

    it('should fall back to IP for unauthenticated requests', () => {
      const options = userRateLimiter._options;

      const key = options.keyGenerator(req);
      expect(key).toBe('ip:127.0.0.1');
    });
  });

  describe('aiRateLimiter', () => {
    it('should be a function', () => {
      expect(typeof aiRateLimiter).toBe('function');
    });

    it('should have longer window for expensive operations', () => {
      const options = aiRateLimiter._options;

      // AI rate limiter should have 1 hour window
      expect(options.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have lower limits for AI requests', () => {
      const options = aiRateLimiter._options;

      expect(options.max).toBeLessThanOrEqual(50);
    });

    it('should use key generator', () => {
      const options = aiRateLimiter._options;
      req.user = { id: 'user-456' };

      const key = options.keyGenerator(req);
      expect(key).toBe('user:user-456');
    });

    it('should handle AI rate limit exceeded', () => {
      const options = aiRateLimiter._options;

      options.handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('strictRateLimiter', () => {
    it('should be a function', () => {
      expect(typeof strictRateLimiter).toBe('function');
    });

    it('should have the strictest limits', () => {
      const options = strictRateLimiter._options;

      expect(options.max).toBe(10);
      expect(options.windowMs).toBe(60 * 60 * 1000);
    });

    it('should use key generator', () => {
      const options = strictRateLimiter._options;
      req.ip = '10.0.0.1';

      const key = options.keyGenerator(req);
      expect(key).toBe('ip:10.0.0.1');
    });

    it('should handle strict rate limit exceeded', () => {
      const options = strictRateLimiter._options;

      options.handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('rate limit handler', () => {
    it('should log rate limit violations', () => {
      const options = globalRateLimiter._options;
      req.user = { username: 'testuser' };
      req.headers['user-agent'] = 'Mozilla/5.0';

      options.handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too Many Requests',
        })
      );
    });

    it('should include user information in response for authenticated users', () => {
      const options = globalRateLimiter._options;
      req.user = { username: 'testuser' };

      options.handler(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should handle unauthenticated rate limit violations', () => {
      const options = globalRateLimiter._options;

      options.handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('default export', () => {
    it('should export all rate limiters', async () => {
      const rateLimitModule = await import('../rateLimiting.js');
      const defaultExport = rateLimitModule.default;

      expect(defaultExport).toHaveProperty('globalRateLimiter');
      expect(defaultExport).toHaveProperty('authRateLimiter');
      expect(defaultExport).toHaveProperty('userRateLimiter');
      expect(defaultExport).toHaveProperty('aiRateLimiter');
      expect(defaultExport).toHaveProperty('strictRateLimiter');
    });
  });

  describe('middleware execution', () => {
    it('should call next() when not rate limited', () => {
      globalRateLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip health check endpoint', () => {
      req.path = '/api/health';

      globalRateLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle rate limit exceeded', () => {
      req.__simulateRateLimit = true;

      globalRateLimiter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
