/**
 * Security Middleware - HTTPS enforcement, HSTS, and additional security headers
 */

import logger from '../utils/logger.js';

/**
 * HTTPS redirect middleware - redirects HTTP to HTTPS in production
 */
export function httpsRedirect(req, res, next) {
  // Skip if HTTPS is disabled
  if (process.env.HTTPS_ENABLED !== 'true') {
    return next();
  }

  // Skip if already using HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }

  // Only enforce in production
  if (process.env.NODE_ENV === 'production') {
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    logger.warn(`Redirecting HTTP to HTTPS: ${req.url}`);
    return res.redirect(301, httpsUrl);
  }

  next();
}

/**
 * HSTS (HTTP Strict Transport Security) middleware
 */
export function hstsMiddleware(req, res, next) {
  if (process.env.HTTPS_ENABLED === 'true' && process.env.NODE_ENV === 'production') {
    // Set HSTS header - 1 year with includeSubDomains
    const maxAge = 31536000; // 1 year in seconds
    res.setHeader('Strict-Transport-Security', `max-age=${maxAge}; includeSubDomains; preload`);
  }
  next();
}

/**
 * Additional security headers
 */
export function securityHeaders(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control iframe embedding (prevent clickjacking)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (formerly Feature Policy)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
}

/**
 * Content Security Policy middleware
 */
export function contentSecurityPolicy(req, res, next) {
  // CSP directives
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"], // Allow inline scripts for now, tighten in production
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", 'ws:', 'wss:'], // Allow WebSocket connections
    'frame-ancestors': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"]
  };

  // Build CSP header
  const cspHeader = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');

  res.setHeader('Content-Security-Policy', cspHeader);
  next();
}

/**
 * Combined security middleware
 */
export function securityMiddleware(req, res, next) {
  httpsRedirect(req, res, () => {
    hstsMiddleware(req, res, () => {
      securityHeaders(req, res, () => {
        contentSecurityPolicy(req, res, next);
      });
    });
  });
}

export default {
  httpsRedirect,
  hstsMiddleware,
  securityHeaders,
  contentSecurityPolicy,
  securityMiddleware
};
