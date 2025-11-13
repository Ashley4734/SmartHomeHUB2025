/**
 * Brute Force Protection and Authentication Audit Logging
 */

import { getDatabase } from '../database/db.js';
import logger from '../utils/logger.js';

// Configuration
const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_DURATION_MS = parseInt(process.env.LOCKOUT_DURATION_MS) || 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = parseInt(process.env.ATTEMPT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes

/**
 * Log authentication event to audit log
 */
export function logAuthEvent(eventData) {
  const db = getDatabase();
  const {
    userId = null,
    username = null,
    eventType,
    ipAddress = null,
    userAgent = null,
    success,
    errorMessage = null,
    metadata = null
  } = eventData;

  try {
    db.prepare(`
      INSERT INTO auth_audit_log
      (user_id, username, event_type, ip_address, user_agent, success, error_message, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      username,
      eventType,
      ipAddress,
      userAgent,
      success ? 1 : 0,
      errorMessage,
      metadata ? JSON.stringify(metadata) : null,
      Date.now()
    );

    logger.info('Auth event logged', {
      eventType,
      username,
      success,
      ipAddress
    });
  } catch (error) {
    // Log the error but don't throw - audit logging should not break authentication flow
    logger.error('Failed to log auth event', {
      error: error.message,
      code: error.code,
      eventType,
      username
    });
  }
}

/**
 * Check if account/IP is locked due to too many failed attempts
 */
export function isLocked(identifier) {
  const db = getDatabase();
  const now = Date.now();

  try {
    const record = db.prepare(`
      SELECT attempt_count, locked_until, last_attempt
      FROM failed_login_attempts
      WHERE identifier = ?
    `).get(identifier);

    if (!record) {
      return false;
    }

    // Check if lock has expired
    if (record.locked_until && record.locked_until > now) {
      return true;
    }

    // Check if attempts are within the window and exceed the limit
    const attemptAge = now - record.last_attempt;
    if (attemptAge < ATTEMPT_WINDOW_MS && record.attempt_count >= MAX_FAILED_ATTEMPTS) {
      return true;
    }

    // Reset if outside the window
    if (attemptAge >= ATTEMPT_WINDOW_MS) {
      db.prepare(`
        UPDATE failed_login_attempts
        SET attempt_count = 0, locked_until = NULL
        WHERE identifier = ?
      `).run(identifier);
      return false;
    }

    return false;
  } catch (error) {
    logger.error('Failed to check lock status', { error: error.message, identifier });
    return false; // Fail open to prevent lockout of all users
  }
}

/**
 * Get remaining lockout time in seconds
 */
export function getRemainingLockoutTime(identifier) {
  const db = getDatabase();
  const now = Date.now();

  try {
    const record = db.prepare(`
      SELECT locked_until
      FROM failed_login_attempts
      WHERE identifier = ?
    `).get(identifier);

    if (!record || !record.locked_until) {
      return 0;
    }

    const remaining = Math.max(0, record.locked_until - now);
    return Math.ceil(remaining / 1000); // Convert to seconds
  } catch (error) {
    logger.error('Failed to get lockout time', { error: error.message });
    return 0;
  }
}

/**
 * Record failed login attempt
 */
export function recordFailedAttempt(identifier) {
  const db = getDatabase();
  const now = Date.now();

  try {
    // Check if record exists
    const existing = db.prepare(`
      SELECT id, attempt_count, last_attempt
      FROM failed_login_attempts
      WHERE identifier = ?
    `).get(identifier);

    if (existing) {
      // Check if attempts are within the window
      const attemptAge = now - existing.last_attempt;
      let newCount = existing.attempt_count + 1;

      // Reset count if outside the window
      if (attemptAge >= ATTEMPT_WINDOW_MS) {
        newCount = 1;
      }

      // Calculate lockout time if threshold reached
      let lockedUntil = null;
      if (newCount >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = now + LOCKOUT_DURATION_MS;
        logger.warn('Account locked due to failed attempts', {
          identifier,
          attemptCount: newCount,
          lockedUntilDate: new Date(lockedUntil).toISOString()
        });
      }

      db.prepare(`
        UPDATE failed_login_attempts
        SET attempt_count = ?, locked_until = ?, last_attempt = ?
        WHERE identifier = ?
      `).run(newCount, lockedUntil, now, identifier);
    } else {
      // Create new record - use INSERT OR REPLACE to handle race conditions
      try {
        db.prepare(`
          INSERT INTO failed_login_attempts (identifier, attempt_count, last_attempt)
          VALUES (?, 1, ?)
        `).run(identifier, now);
      } catch (insertError) {
        // Handle UNIQUE constraint violation (race condition)
        if (insertError.code === 'SQLITE_CONSTRAINT' || insertError.message.includes('UNIQUE constraint failed')) {
          // Record was created by another concurrent request, retry the update path
          logger.debug('Concurrent insert detected, retrying update', { identifier });
          const retry = db.prepare(`
            SELECT id, attempt_count, last_attempt
            FROM failed_login_attempts
            WHERE identifier = ?
          `).get(identifier);

          if (retry) {
            const attemptAge = now - retry.last_attempt;
            let newCount = attemptAge >= ATTEMPT_WINDOW_MS ? 1 : retry.attempt_count + 1;
            let lockedUntil = newCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_DURATION_MS : null;

            db.prepare(`
              UPDATE failed_login_attempts
              SET attempt_count = ?, locked_until = ?, last_attempt = ?
              WHERE identifier = ?
            `).run(newCount, lockedUntil, now, identifier);
          }
        } else {
          throw insertError;
        }
      }
    }
  } catch (error) {
    logger.error('Failed to record failed attempt', {
      error: error.message,
      code: error.code,
      identifier
    });
  }
}

/**
 * Reset failed login attempts (on successful login)
 */
export function resetFailedAttempts(identifier) {
  const db = getDatabase();

  try {
    db.prepare(`
      DELETE FROM failed_login_attempts
      WHERE identifier = ?
    `).run(identifier);

    logger.info('Failed attempts reset', { identifier });
  } catch (error) {
    logger.error('Failed to reset attempts', { error: error.message });
  }
}

/**
 * Brute force protection middleware
 */
export function bruteForceProtection(req, res, next) {
  const identifier = req.body.identifier || req.body.username || req.body.email || req.ip;

  if (isLocked(identifier)) {
    const remainingTime = getRemainingLockoutTime(identifier);

    logAuthEvent({
      username: req.body.username || req.body.email || req.body.identifier,
      eventType: 'login_blocked',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: false,
      errorMessage: 'Account locked due to too many failed attempts',
      metadata: { remainingLockoutSeconds: remainingTime }
    });

    return res.status(429).json({
      error: 'Account Locked',
      message: `Too many failed login attempts. Account is locked for ${remainingTime} seconds.`,
      retryAfter: remainingTime
    });
  }

  next();
}

/**
 * Cleanup old audit logs (run periodically)
 */
export function cleanupOldAuditLogs(retentionDays = 90) {
  const db = getDatabase();
  const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

  try {
    const result = db.prepare(`
      DELETE FROM auth_audit_log
      WHERE timestamp < ?
    `).run(cutoffTime);

    logger.info('Cleaned up old audit logs', { deletedRows: result.changes });
    return result.changes;
  } catch (error) {
    logger.error('Failed to cleanup audit logs', { error: error.message });
    return 0;
  }
}

export default {
  logAuthEvent,
  isLocked,
  getRemainingLockoutTime,
  recordFailedAttempt,
  resetFailedAttempts,
  bruteForceProtection,
  cleanupOldAuditLogs
};
