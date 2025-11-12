/**
 * Advanced Rate Limiting Middleware
 * Per-user and per-IP rate limiting with different tiers
 */

import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

/**
 * Generate key for rate limiting based on user ID or IP
 */
function generateKey(req) {
  // If user is authenticated, use user ID
  if (req.user && req.user.id) {
    return `user:${req.user.id}`;
  }

  // Fall back to IP address for unauthenticated requests
  return `ip:${req.ip || req.connection.remoteAddress}`;
}

/**
 * Custom rate limit handler
 */
function rateLimitHandler(req, res) {
  const identifier = req.user ? `user:${req.user.username}` : `ip:${req.ip}`;

  logger.warn('Rate limit exceeded', {
    identifier,
    ip: req.ip,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent']
  });

  res.status(429).json({
    error: 'Too Many Requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: res.getHeader('Retry-After')
  });
}

/**
 * Global rate limiter - applies to all API requests
 */
export const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/api/metrics';
  }
});

/**
 * Authentication rate limiter - stricter limits for login attempts
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Track by IP for login attempts
    return `auth:${req.ip}`;
  },
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * Per-user rate limiter - authenticated users
 * More generous limits for authenticated users
 */
export const userRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes for authenticated users
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user && req.user.id) {
      // Give admins higher limits
      if (req.user.role === 'admin') {
        return null; // Skip rate limiting for admins
      }
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip}`;
  },
  handler: rateLimitHandler,
});

/**
 * AI endpoint rate limiter - expensive operations
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 AI requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
});

/**
 * Strict rate limiter for sensitive operations
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
});

export default {
  globalRateLimiter,
  authRateLimiter,
  userRateLimiter,
  aiRateLimiter,
  strictRateLimiter
};
