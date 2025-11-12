/**
 * Database Connection and Initialization
 */

import Database from 'better-sqlite3';
import { SCHEMA, INDEXES } from './schema.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;

/**
 * Initialize the database
 */
export function initDatabase(dbPath = process.env.DATABASE_PATH || './data/smart-home.db') {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Open database connection
    db = new Database(dbPath);

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create tables
    for (const [tableName, tableSchema] of Object.entries(SCHEMA)) {
      db.exec(tableSchema);
      console.log(`✓ Table ${tableName} initialized`);
    }

    // Create indexes
    for (const index of INDEXES) {
      db.exec(index);
    }
    console.log('✓ Indexes created');

    // Initialize default settings
    initializeDefaultSettings();

    console.log('✓ Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Get database instance
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('✓ Database connection closed');
  }
}

/**
 * Initialize default system settings
 */
function initializeDefaultSettings() {
  const settings = [
    { key: 'system.initialized', value: 'true', description: 'System initialization flag' },
    { key: 'system.version', value: '1.0.0', description: 'System version' },
    { key: 'ai.learning_enabled', value: 'true', description: 'Enable AI pattern learning' },
    { key: 'ai.suggestions_enabled', value: 'true', description: 'Enable AI suggestions' },
    { key: 'voice.enabled', value: 'false', description: 'Voice control enabled' },
    { key: 'notifications.enabled', value: 'true', description: 'Notifications enabled' }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO system_settings (key, value, description, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  const now = Date.now();
  for (const setting of settings) {
    stmt.run(setting.key, setting.value, setting.description, now);
  }
}

/**
 * Run database migrations
 */
export function runMigrations() {
  // Placeholder for future migrations
  const migrations = [];

  for (const migration of migrations) {
    try {
      db.exec(migration.sql);
      console.log(`✓ Migration ${migration.name} applied`);
    } catch (error) {
      console.error(`✗ Migration ${migration.name} failed:`, error);
    }
  }
}

export default {
  initDatabase,
  getDatabase,
  closeDatabase,
  runMigrations
};
