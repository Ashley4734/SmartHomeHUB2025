/**
 * CSRF Protection Middleware
 */

import { doubleCsrf } from 'csrf-csrf';
import logger from '../utils/logger.js';

/**
 * Configure CSRF protection
 */
const doubleCsrfUtil = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET || 'csrf-secret-change-in-production',
  cookieName: process.env.NODE_ENV === 'production' ? '__Host-psifi.x-csrf-token' : 'x-csrf-token',
  cookieOptions: {
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

const {
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrfUtil;

/**
 * CSRF protection middleware
 */
export const csrfProtection = doubleCsrfProtection;

/**
 * Generate CSRF token endpoint middleware
 */
export function csrfTokenEndpoint(req, res) {
  const token = generateCsrfToken(req, res);
  res.json({ csrfToken: token });
}

/**
 * Custom CSRF error handler
 */
export function csrfErrorHandler(err, req, res, next) {
  if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('csrf')) {
    logger.warn('CSRF token validation failed', {
      ip: req.ip,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent']
    });

    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token validation failed. Please refresh the page and try again.'
    });
  }
  next(err);
}

/**
 * Export generateCsrfToken for use in other modules
 */
export { generateCsrfToken };

export default {
  csrfProtection,
  csrfTokenEndpoint,
  csrfErrorHandler,
  generateCsrfToken
};
