/**
 * GDPR Compliance Service
 * Handles data export, deletion, and consent management
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';

// Consent types
export const CONSENT_TYPES = {
  ESSENTIAL: 'essential', // Required for service operation
  ANALYTICS: 'analytics', // Usage analytics
  PERSONALIZATION: 'personalization', // AI learning and personalization
  MARKETING: 'marketing', // Marketing communications
};

// Data processing purposes
export const PROCESSING_PURPOSES = {
  SERVICE_DELIVERY: 'service_delivery',
  SECURITY: 'security',
  ANALYTICS: 'analytics',
  PERSONALIZATION: 'personalization',
  COMMUNICATION: 'communication',
};

/**
 * Export all user data (GDPR Right to Portability)
 */
export function exportUserData(userId) {
  const db = getDatabase();
  const now = Date.now();

  // Get user profile
  const user = db.prepare(`
    SELECT id, username, email, role, full_name, created_at, updated_at, last_login
    FROM users
    WHERE id = ?
  `).get(userId);

  if (!user) {
    throw new Error('User not found');
  }

  // Get user's devices (created/modified by user)
  const devices = db.prepare(`
    SELECT id, name, type, protocol, model, manufacturer, room_id,
           state, capabilities, metadata, created_at, updated_at
    FROM devices
  `).all();

  // Get device history triggered by user
  const deviceHistory = db.prepare(`
    SELECT dh.id, dh.device_id, dh.state, dh.timestamp, d.name as device_name
    FROM device_history dh
    LEFT JOIN devices d ON dh.device_id = d.id
    WHERE dh.triggered_by = ?
    ORDER BY dh.timestamp DESC
    LIMIT 1000
  `).all(userId);

  // Get user's automations
  const automations = db.prepare(`
    SELECT id, name, description, trigger_type, trigger_config,
           conditions, actions, enabled, ai_generated, ai_metadata,
           last_triggered, trigger_count, created_at, updated_at
    FROM automations
    WHERE created_by = ?
  `).all(userId);

  // Get automation logs
  const automationLogs = db.prepare(`
    SELECT al.id, al.automation_id, al.status, al.trigger_data,
           al.actions_executed, al.error, al.timestamp, a.name as automation_name
    FROM automation_logs al
    LEFT JOIN automations a ON al.automation_id = a.id
    WHERE a.created_by = ?
    ORDER BY al.timestamp DESC
    LIMIT 1000
  `).all(userId);

  // Get user's scenes
  const scenes = db.prepare(`
    SELECT id, name, icon, description, actions, created_at, updated_at
    FROM scenes
    WHERE created_by = ?
  `).all(userId);

  // Get AI conversations
  const aiConversations = db.prepare(`
    SELECT id, provider, messages, context, intent, created_at, updated_at
    FROM ai_conversations
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);

  // Get AI suggestions
  const aiSuggestions = db.prepare(`
    SELECT id, type, title, description, suggestion_data, status,
           applied_at, created_at
    FROM ai_suggestions
    WHERE user_id = ?
  `).all(userId);

  // Get user patterns
  const userPatterns = db.prepare(`
    SELECT id, pattern_type, pattern_data, confidence, last_observed,
           occurrence_count, created_at, updated_at
    FROM user_patterns
    WHERE user_id = ?
  `).all(userId);

  // Get voice commands
  const voiceCommands = db.prepare(`
    SELECT id, command_text, intent, entities, response, success, timestamp
    FROM voice_commands
    WHERE user_id = ?
    ORDER BY timestamp DESC
    LIMIT 1000
  `).all(userId);

  // Get notifications
  const notifications = db.prepare(`
    SELECT id, title, message, type, priority, read, action_url,
           metadata, created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1000
  `).all(userId);

  // Get auth audit log
  const authAuditLog = db.prepare(`
    SELECT id, event_type, ip_address, user_agent, success,
           error_message, metadata, timestamp
    FROM auth_audit_log
    WHERE user_id = ?
    ORDER BY timestamp DESC
    LIMIT 1000
  `).all(userId);

  // Get consents
  const consents = db.prepare(`
    SELECT id, consent_type, consent_given, consent_version,
           ip_address, user_agent, given_at, withdrawn_at,
           created_at, updated_at
    FROM user_consents
    WHERE user_id = ?
  `).all(userId);

  // Get data processing log
  const dataProcessingLog = db.prepare(`
    SELECT id, processing_type, purpose, data_categories,
           legal_basis, recipient, timestamp
    FROM data_processing_log
    WHERE user_id = ?
    ORDER BY timestamp DESC
    LIMIT 1000
  `).all(userId);

  // Log the data export
  logDataProcessing(userId, 'data_export', PROCESSING_PURPOSES.SERVICE_DELIVERY,
    ['profile', 'devices', 'automations', 'ai_data', 'voice', 'notifications', 'audit_logs'],
    'user_request');

  // Build comprehensive export
  const dataExport = {
    export_info: {
      export_date: new Date(now).toISOString(),
      export_timestamp: now,
      user_id: userId,
      format_version: '1.0'
    },
    user_profile: user,
    devices: {
      all_devices: devices,
      device_history: deviceHistory
    },
    automations: {
      automations: automations,
      automation_logs: automationLogs
    },
    scenes: scenes,
    ai_data: {
      conversations: aiConversations,
      suggestions: aiSuggestions,
      learned_patterns: userPatterns
    },
    voice_control: {
      commands: voiceCommands
    },
    notifications: notifications,
    security: {
      auth_audit_log: authAuditLog
    },
    privacy: {
      consents: consents,
      data_processing_log: dataProcessingLog
    },
    metadata: {
      total_records: {
        devices: devices.length,
        device_history: deviceHistory.length,
        automations: automations.length,
        automation_logs: automationLogs.length,
        scenes: scenes.length,
        ai_conversations: aiConversations.length,
        ai_suggestions: aiSuggestions.length,
        user_patterns: userPatterns.length,
        voice_commands: voiceCommands.length,
        notifications: notifications.length,
        auth_logs: authAuditLog.length,
        consents: consents.length,
        processing_logs: dataProcessingLog.length
      }
    }
  };

  return dataExport;
}

/**
 * Delete all user data (GDPR Right to be Forgotten)
 */
export function deleteUserData(userId, requestedBy, options = {}) {
  const db = getDatabase();
  const now = Date.now();
  const requestId = uuidv4();

  // Check if user exists
  const user = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Create deletion request
  db.prepare(`
    INSERT INTO data_deletion_requests (
      id, user_id, request_type, status, requested_at, processed_by
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(requestId, userId, 'full_deletion', 'processing', now, requestedBy);

  try {
    // Delete user data in correct order to respect foreign keys
    // Note: Most tables have ON DELETE CASCADE, but we'll be explicit

    // 1. Voice commands
    const voiceDeleted = db.prepare('DELETE FROM voice_commands WHERE user_id = ?').run(userId);

    // 2. User patterns
    const patternsDeleted = db.prepare('DELETE FROM user_patterns WHERE user_id = ?').run(userId);

    // 3. AI suggestions
    const suggestionsDeleted = db.prepare('DELETE FROM ai_suggestions WHERE user_id = ?').run(userId);

    // 4. AI conversations
    const conversationsDeleted = db.prepare('DELETE FROM ai_conversations WHERE user_id = ?').run(userId);

    // 5. Notifications
    const notificationsDeleted = db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);

    // 6. Scenes
    const scenesDeleted = db.prepare('DELETE FROM scenes WHERE created_by = ?').run(userId);

    // 7. Automation logs (via cascade from automations)
    // Get automation IDs first
    const automationIds = db.prepare('SELECT id FROM automations WHERE created_by = ?')
      .all(userId)
      .map(a => a.id);

    let automationLogsDeleted = { changes: 0 };
    if (automationIds.length > 0) {
      const placeholders = automationIds.map(() => '?').join(',');
      automationLogsDeleted = db.prepare(
        `DELETE FROM automation_logs WHERE automation_id IN (${placeholders})`
      ).run(...automationIds);
    }

    // 8. Automations
    const automationsDeleted = db.prepare('DELETE FROM automations WHERE created_by = ?').run(userId);

    // 9. Device history triggered by user
    const deviceHistoryDeleted = db.prepare('DELETE FROM device_history WHERE triggered_by = ?').run(userId);

    // 10. Auth audit log
    const authAuditDeleted = db.prepare('DELETE FROM auth_audit_log WHERE user_id = ?').run(userId);

    // 11. Failed login attempts (by username/email)
    db.prepare('DELETE FROM failed_login_attempts WHERE identifier = ? OR identifier = ?')
      .run(user.username, user.email);

    // 12. User consents
    const consentsDeleted = db.prepare('DELETE FROM user_consents WHERE user_id = ?').run(userId);

    // 13. Data processing log
    const processingLogDeleted = db.prepare('DELETE FROM data_processing_log WHERE user_id = ?').run(userId);

    // 14. Finally, delete the user
    const userDeleted = db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    // Update deletion request status
    db.prepare(`
      UPDATE data_deletion_requests
      SET status = ?, processed_at = ?,
          notes = ?
      WHERE id = ?
    `).run('completed', now, JSON.stringify({
      voice_commands: voiceDeleted.changes,
      user_patterns: patternsDeleted.changes,
      ai_suggestions: suggestionsDeleted.changes,
      ai_conversations: conversationsDeleted.changes,
      notifications: notificationsDeleted.changes,
      scenes: scenesDeleted.changes,
      automation_logs: automationLogsDeleted.changes,
      automations: automationsDeleted.changes,
      device_history: deviceHistoryDeleted.changes,
      auth_audit: authAuditDeleted.changes,
      consents: consentsDeleted.changes,
      processing_log: processingLogDeleted.changes,
      user: userDeleted.changes
    }), requestId);

    return {
      success: true,
      request_id: requestId,
      deleted_at: now,
      deleted_records: {
        voice_commands: voiceDeleted.changes,
        user_patterns: patternsDeleted.changes,
        ai_suggestions: suggestionsDeleted.changes,
        ai_conversations: conversationsDeleted.changes,
        notifications: notificationsDeleted.changes,
        scenes: scenesDeleted.changes,
        automation_logs: automationLogsDeleted.changes,
        automations: automationsDeleted.changes,
        device_history: deviceHistoryDeleted.changes,
        auth_audit: authAuditDeleted.changes,
        consents: consentsDeleted.changes,
        processing_log: processingLogDeleted.changes,
        user: userDeleted.changes
      }
    };

  } catch (error) {
    // Update deletion request with error
    db.prepare(`
      UPDATE data_deletion_requests
      SET status = ?, notes = ?
      WHERE id = ?
    `).run('failed', error.message, requestId);

    throw error;
  }
}

/**
 * Record user consent
 */
export function recordConsent(userId, consentType, consentGiven, ipAddress = null, userAgent = null) {
  const db = getDatabase();
  const now = Date.now();
  const consentId = uuidv4();
  const version = '1.0'; // Privacy policy version

  // Check if consent already exists
  const existing = db.prepare(`
    SELECT id FROM user_consents
    WHERE user_id = ? AND consent_type = ?
  `).get(userId, consentType);

  if (existing) {
    // Update existing consent
    db.prepare(`
      UPDATE user_consents
      SET consent_given = ?,
          consent_version = ?,
          ip_address = ?,
          user_agent = ?,
          given_at = ?,
          withdrawn_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      consentGiven ? 1 : 0,
      version,
      ipAddress,
      userAgent,
      consentGiven ? now : null,
      consentGiven ? null : now,
      now,
      existing.id
    );

    return { id: existing.id, updated: true };
  } else {
    // Create new consent record
    db.prepare(`
      INSERT INTO user_consents (
        id, user_id, consent_type, consent_given, consent_version,
        ip_address, user_agent, given_at, withdrawn_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      consentId,
      userId,
      consentType,
      consentGiven ? 1 : 0,
      version,
      ipAddress,
      userAgent,
      consentGiven ? now : null,
      consentGiven ? null : now,
      now,
      now
    );

    return { id: consentId, created: true };
  }
}

/**
 * Get user consents
 */
export function getUserConsents(userId) {
  const db = getDatabase();

  const consents = db.prepare(`
    SELECT id, consent_type, consent_given, consent_version,
           given_at, withdrawn_at, created_at, updated_at
    FROM user_consents
    WHERE user_id = ?
  `).all(userId);

  return consents;
}

/**
 * Check if user has given consent
 */
export function hasConsent(userId, consentType) {
  const db = getDatabase();

  const consent = db.prepare(`
    SELECT consent_given
    FROM user_consents
    WHERE user_id = ? AND consent_type = ?
  `).get(userId, consentType);

  return consent ? consent.consent_given === 1 : false;
}

/**
 * Log data processing activity
 */
export function logDataProcessing(userId, processingType, purpose, dataCategories, legalBasis, recipient = null) {
  const db = getDatabase();
  const now = Date.now();

  db.prepare(`
    INSERT INTO data_processing_log (
      user_id, processing_type, purpose, data_categories,
      legal_basis, recipient, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    processingType,
    purpose,
    JSON.stringify(dataCategories),
    legalBasis,
    recipient,
    now
  );
}

/**
 * Get data processing history
 */
export function getDataProcessingHistory(userId, limit = 100) {
  const db = getDatabase();

  const history = db.prepare(`
    SELECT id, processing_type, purpose, data_categories,
           legal_basis, recipient, timestamp
    FROM data_processing_log
    WHERE user_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(userId, limit);

  return history;
}

/**
 * Get deletion requests (admin only)
 */
export function getDeletionRequests(status = null) {
  const db = getDatabase();

  let query = `
    SELECT dr.*, u.username, u.email
    FROM data_deletion_requests dr
    LEFT JOIN users u ON dr.user_id = u.id
  `;

  if (status) {
    query += ' WHERE dr.status = ?';
    return db.prepare(query + ' ORDER BY dr.requested_at DESC').all(status);
  }

  return db.prepare(query + ' ORDER BY dr.requested_at DESC').all();
}

export default {
  CONSENT_TYPES,
  PROCESSING_PURPOSES,
  exportUserData,
  deleteUserData,
  recordConsent,
  getUserConsents,
  hasConsent,
  logDataProcessing,
  getDataProcessingHistory,
  getDeletionRequests
};
