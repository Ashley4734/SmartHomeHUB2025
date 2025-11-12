import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database Migration Runner
 */
export class MigrationRunner {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.migrationsDir = path.join(__dirname, '../../migrations');
    this.initMigrationsTable();
  }

  /**
   * Initialize migrations tracking table
   */
  initMigrationsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('Migrations table initialized');
  }

  /**
   * Get list of applied migrations
   */
  getAppliedMigrations() {
    const stmt = this.db.prepare('SELECT name FROM migrations ORDER BY id');
    return stmt.all().map((row) => row.name);
  }

  /**
   * Get list of pending migrations
   */
  getPendingMigrations() {
    const applied = this.getAppliedMigrations();
    const allMigrations = this.getAllMigrationFiles();
    return allMigrations.filter((migration) => !applied.includes(migration));
  }

  /**
   * Get all migration files from migrations directory
   */
  getAllMigrationFiles() {
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
      logger.info('Created migrations directory');
      return [];
    }

    return fs
      .readdirSync(this.migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();
  }

  /**
   * Read migration file content
   */
  readMigrationFile(filename) {
    const filePath = path.join(this.migrationsDir, filename);
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Apply a single migration
   */
  applyMigration(filename) {
    const sql = this.readMigrationFile(filename);

    try {
      logger.info(`Applying migration: ${filename}`);

      // Execute migration in a transaction
      this.db.transaction(() => {
        this.db.exec(sql);
        this.db
          .prepare('INSERT INTO migrations (name) VALUES (?)')
          .run(filename);
      })();

      logger.info(`✓ Migration applied: ${filename}`);
      return true;
    } catch (error) {
      logger.error(`✗ Migration failed: ${filename}`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  runPendingMigrations() {
    const pending = this.getPendingMigrations();

    if (pending.length === 0) {
      logger.info('No pending migrations');
      return { applied: 0, failed: 0 };
    }

    logger.info(`Found ${pending.length} pending migration(s)`);

    let applied = 0;
    let failed = 0;

    for (const migration of pending) {
      try {
        this.applyMigration(migration);
        applied++;
      } catch (error) {
        failed++;
        logger.error(`Stopping migration process due to error`);
        break;
      }
    }

    return { applied, failed };
  }

  /**
   * Rollback last migration
   */
  rollbackLastMigration() {
    const applied = this.getAppliedMigrations();

    if (applied.length === 0) {
      logger.warn('No migrations to rollback');
      return false;
    }

    const lastMigration = applied[applied.length - 1];

    // Check if rollback file exists
    const rollbackFile = lastMigration.replace('.sql', '.rollback.sql');
    const rollbackPath = path.join(this.migrationsDir, rollbackFile);

    if (!fs.existsSync(rollbackPath)) {
      logger.error(`Rollback file not found: ${rollbackFile}`);
      return false;
    }

    try {
      logger.info(`Rolling back migration: ${lastMigration}`);

      const sql = fs.readFileSync(rollbackPath, 'utf-8');

      this.db.transaction(() => {
        this.db.exec(sql);
        this.db
          .prepare('DELETE FROM migrations WHERE name = ?')
          .run(lastMigration);
      })();

      logger.info(`✓ Rolled back migration: ${lastMigration}`);
      return true;
    } catch (error) {
      logger.error(`✗ Rollback failed: ${lastMigration}`, {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get migration status
   */
  getStatus() {
    const applied = this.getAppliedMigrations();
    const pending = this.getPendingMigrations();

    return {
      applied: applied.length,
      pending: pending.length,
      appliedMigrations: applied,
      pendingMigrations: pending,
    };
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

export default MigrationRunner;
