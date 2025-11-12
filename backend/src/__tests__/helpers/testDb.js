/**
 * Test Database Helper
 * Sets up an in-memory SQLite database for testing
 */

import Database from 'better-sqlite3';
import { SCHEMA, INDEXES } from '../../database/schema.js';

let testDatabase = null;

/**
 * Initialize test database
 */
export function initTestDatabase() {
  // Create in-memory database
  testDatabase = new Database(':memory:');
  testDatabase.pragma('journal_mode = WAL');
  testDatabase.pragma('foreign_keys = ON');

  // Initialize schema
  Object.values(SCHEMA).forEach(sql => {
    testDatabase.exec(sql);
  });

  // Create indexes
  INDEXES.forEach(sql => {
    testDatabase.exec(sql);
  });

  return testDatabase;
}

/**
 * Get test database instance
 */
export function getTestDatabase() {
  if (!testDatabase) {
    throw new Error('Test database not initialized. Call initTestDatabase() first.');
  }
  return testDatabase;
}

/**
 * Close test database
 */
export function closeTestDatabase() {
  if (testDatabase) {
    testDatabase.close();
    testDatabase = null;
  }
}

/**
 * Clean all data from test database
 */
export function cleanTestDatabase() {
  if (!testDatabase) return;

  const tables = [
    'voice_commands',
    'user_patterns',
    'ai_suggestions',
    'ai_conversations',
    'automation_logs',
    'device_history',
    'scenes',
    'automations',
    'devices',
    'rooms',
    'notifications',
    'auth_audit_log',
    'failed_login_attempts',
    'users',
    'system_settings'
  ];

  tables.forEach(table => {
    try {
      testDatabase.prepare(`DELETE FROM ${table}`).run();
    } catch (error) {
      // Ignore errors for tables that don't exist
    }
  });
}

export default {
  initTestDatabase,
  getTestDatabase,
  closeTestDatabase,
  cleanTestDatabase
};
