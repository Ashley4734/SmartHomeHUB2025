/**
 * Database Schema Definition
 * SQLite database schema for Smart Home Hub
 */

export const SCHEMA = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      full_name TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login INTEGER,
      is_active INTEGER DEFAULT 1
    )
  `,

  devices: `
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      protocol TEXT NOT NULL,
      ieee_address TEXT UNIQUE,
      model TEXT,
      manufacturer TEXT,
      firmware_version TEXT,
      room_id TEXT,
      state TEXT,
      capabilities TEXT,
      metadata TEXT,
      online INTEGER DEFAULT 0,
      last_seen INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
    )
  `,

  rooms: `
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      floor TEXT,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `,

  automations: `
    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      trigger_type TEXT NOT NULL,
      trigger_config TEXT NOT NULL,
      conditions TEXT,
      actions TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_by TEXT NOT NULL,
      ai_generated INTEGER DEFAULT 0,
      ai_metadata TEXT,
      last_triggered INTEGER,
      trigger_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  scenes: `
    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      description TEXT,
      actions TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  device_history: `
    CREATE TABLE IF NOT EXISTS device_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      state TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      triggered_by TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    )
  `,

  automation_logs: `
    CREATE TABLE IF NOT EXISTS automation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      automation_id TEXT NOT NULL,
      status TEXT NOT NULL,
      trigger_data TEXT,
      actions_executed TEXT,
      error TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
    )
  `,

  ai_conversations: `
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      messages TEXT NOT NULL,
      context TEXT,
      intent TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  ai_suggestions: `
    CREATE TABLE IF NOT EXISTS ai_suggestions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      suggestion_data TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      applied_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `,

  user_patterns: `
    CREATE TABLE IF NOT EXISTS user_patterns (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      pattern_type TEXT NOT NULL,
      pattern_data TEXT NOT NULL,
      confidence REAL NOT NULL,
      last_observed INTEGER NOT NULL,
      occurrence_count INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `,

  voice_commands: `
    CREATE TABLE IF NOT EXISTS voice_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      command_text TEXT NOT NULL,
      intent TEXT,
      entities TEXT,
      response TEXT,
      success INTEGER DEFAULT 1,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  system_settings: `
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at INTEGER NOT NULL
    )
  `,

  notifications: `
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      read INTEGER DEFAULT 0,
      action_url TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  auth_audit_log: `
    CREATE TABLE IF NOT EXISTS auth_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      username TEXT,
      event_type TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      success INTEGER NOT NULL,
      error_message TEXT,
      metadata TEXT,
      timestamp INTEGER NOT NULL
    )
  `,

  failed_login_attempts: `
    CREATE TABLE IF NOT EXISTS failed_login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL,
      attempt_count INTEGER DEFAULT 1,
      locked_until INTEGER,
      last_attempt INTEGER NOT NULL,
      UNIQUE(identifier)
    )
  `
};

export const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_devices_protocol ON devices(protocol)',
  'CREATE INDEX IF NOT EXISTS idx_devices_room ON devices(room_id)',
  'CREATE INDEX IF NOT EXISTS idx_devices_online ON devices(online)',
  'CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(enabled)',
  'CREATE INDEX IF NOT EXISTS idx_automations_created_by ON automations(created_by)',
  'CREATE INDEX IF NOT EXISTS idx_device_history_device ON device_history(device_id)',
  'CREATE INDEX IF NOT EXISTS idx_device_history_timestamp ON device_history(timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_automation_logs_automation ON automation_logs(automation_id)',
  'CREATE INDEX IF NOT EXISTS idx_automation_logs_timestamp ON automation_logs(timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_suggestions(status)',
  'CREATE INDEX IF NOT EXISTS idx_user_patterns_user ON user_patterns(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_voice_commands_user ON voice_commands(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_voice_commands_timestamp ON voice_commands(timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)',
  'CREATE INDEX IF NOT EXISTS idx_auth_audit_user ON auth_audit_log(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_auth_audit_timestamp ON auth_audit_log(timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_failed_login_identifier ON failed_login_attempts(identifier)'
];
