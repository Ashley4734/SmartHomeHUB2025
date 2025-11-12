/**
 * Tests for security middleware
 */

import { jest } from '@jest/globals';
import {
  httpsRedirect,
  hstsMiddleware,
  securityHeaders,
  contentSecurityPolicy,
  securityMiddleware
} from '../security.js';

describe('Security Middleware', () => {
  let req, res, next, originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Create mock request and response objects
    req = {
      secure: false,
      headers: {},
      url: '/test',
      method: 'GET'
    };

    res = {
      redirect: jest.fn(),
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('httpsRedirect', () => {
    it('should call next() when HTTPS is disabled', () => {
      process.env.HTTPS_ENABLED = 'false';

      httpsRedirect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should call next() when request is already secure', () => {
      process.env.HTTPS_ENABLED = 'true';
      req.secure = true;

      httpsRedirect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should call next() when x-forwarded-proto is https', () => {
      process.env.HTTPS_ENABLED = 'true';
      req.headers['x-forwarded-proto'] = 'https';

      httpsRedirect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should redirect to HTTPS in production', () => {
      process.env.HTTPS_ENABLED = 'true';
      process.env.NODE_ENV = 'production';
      req.headers.host = 'example.com';

      httpsRedirect(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith(301, 'https://example.com/test');
      expect(next).not.toHaveBeenCalled();
    });

    it('should not redirect in development', () => {
      process.env.HTTPS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      httpsRedirect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe('hstsMiddleware', () => {
    it('should set HSTS header in production with HTTPS enabled', () => {
      process.env.HTTPS_ENABLED = 'true';
      process.env.NODE_ENV = 'production';

      hstsMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
      expect(next).toHaveBeenCalled();
    });

    it('should not set HSTS header in development', () => {
      process.env.HTTPS_ENABLED = 'true';
      process.env.NODE_ENV = 'development';

      hstsMiddleware(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should not set HSTS header when HTTPS is disabled', () => {
      process.env.HTTPS_ENABLED = 'false';
      process.env.NODE_ENV = 'production';

      hstsMiddleware(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('securityHeaders', () => {
    it('should set all required security headers', () => {
      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
      expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(res.setHeader).toHaveBeenCalledWith('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      expect(next).toHaveBeenCalled();
    });

    it('should call next() after setting headers', () => {
      securityHeaders(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('contentSecurityPolicy', () => {
    it('should set Content-Security-Policy header', () => {
      contentSecurityPolicy(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'self'")
      );
      expect(next).toHaveBeenCalled();
    });

    it('should include script-src directive', () => {
      contentSecurityPolicy(req, res, next);

      const cspCall = res.setHeader.mock.calls.find(call => call[0] === 'Content-Security-Policy');
      expect(cspCall[1]).toContain("script-src 'self' 'unsafe-inline'");
    });

    it('should include style-src directive', () => {
      contentSecurityPolicy(req, res, next);

      const cspCall = res.setHeader.mock.calls.find(call => call[0] === 'Content-Security-Policy');
      expect(cspCall[1]).toContain("style-src 'self' 'unsafe-inline'");
    });

    it('should include img-src directive', () => {
      contentSecurityPolicy(req, res, next);

      const cspCall = res.setHeader.mock.calls.find(call => call[0] === 'Content-Security-Policy');
      expect(cspCall[1]).toContain("img-src 'self' data: https:");
    });

    it('should include connect-src directive for WebSocket', () => {
      contentSecurityPolicy(req, res, next);

      const cspCall = res.setHeader.mock.calls.find(call => call[0] === 'Content-Security-Policy');
      expect(cspCall[1]).toContain("connect-src 'self' ws: wss:");
    });

    it('should include frame-ancestors directive', () => {
      contentSecurityPolicy(req, res, next);

      const cspCall = res.setHeader.mock.calls.find(call => call[0] === 'Content-Security-Policy');
      expect(cspCall[1]).toContain("frame-ancestors 'self'");
    });

    it('should include base-uri directive', () => {
      contentSecurityPolicy(req, res, next);

      const cspCall = res.setHeader.mock.calls.find(call => call[0] === 'Content-Security-Policy');
      expect(cspCall[1]).toContain("base-uri 'self'");
    });

    it('should include form-action directive', () => {
      contentSecurityPolicy(req, res, next);

      const cspCall = res.setHeader.mock.calls.find(call => call[0] === 'Content-Security-Policy');
      expect(cspCall[1]).toContain("form-action 'self'");
    });
  });

  describe('securityMiddleware', () => {
    it('should apply all security middlewares in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.HTTPS_ENABLED = 'false';

      securityMiddleware(req, res, next);

      // Should set security headers and CSP
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.any(String)
      );
      expect(next).toHaveBeenCalled();
    });

    it('should apply all security middlewares in production with HTTPS', () => {
      process.env.NODE_ENV = 'production';
      process.env.HTTPS_ENABLED = 'true';
      req.secure = true;

      securityMiddleware(req, res, next);

      // Should set HSTS in production
      expect(res.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
      // Should set security headers
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      // Should set CSP
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.any(String)
      );
      expect(next).toHaveBeenCalled();
    });

    it('should redirect to HTTPS in production when not secure', () => {
      process.env.NODE_ENV = 'production';
      process.env.HTTPS_ENABLED = 'true';
      req.headers.host = 'example.com';

      securityMiddleware(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith(301, 'https://example.com/test');
      // next() should not be called because redirect happens first
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('default export', () => {
    it('should export all middleware functions', async () => {
      const securityModule = await import('../security.js');
      const defaultExport = securityModule.default;

      expect(defaultExport).toHaveProperty('httpsRedirect');
      expect(defaultExport).toHaveProperty('hstsMiddleware');
      expect(defaultExport).toHaveProperty('securityHeaders');
      expect(defaultExport).toHaveProperty('contentSecurityPolicy');
      expect(defaultExport).toHaveProperty('securityMiddleware');
    });
  });
});
