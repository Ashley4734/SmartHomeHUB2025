#!/usr/bin/env node

/**
 * Database Migration CLI Tool
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { MigrationRunner } from '../src/database/migrationRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, '../data/smart-home.db');

function printUsage() {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Smart Home Hub - Migration Tool     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log('Usage:');
  console.log('  npm run migrate up       - Run pending migrations');
  console.log('  npm run migrate down     - Rollback last migration');
  console.log('  npm run migrate status   - Show migration status');
  console.log('  npm run migrate create <name> - Create new migration file');
  console.log('');
}

async function runMigrations() {
  const runner = new MigrationRunner(DB_PATH);
  const result = runner.runPendingMigrations();

  if (result.applied > 0) {
    console.log(`\n✓ Applied ${result.applied} migration(s)`);
  }

  if (result.failed > 0) {
    console.error(`\n✗ ${result.failed} migration(s) failed`);
    process.exit(1);
  }

  runner.close();
}

async function rollbackMigration() {
  const runner = new MigrationRunner(DB_PATH);
  const success = runner.rollbackLastMigration();

  if (success) {
    console.log('\n✓ Rollback completed');
  } else {
    console.error('\n✗ Rollback failed');
    process.exit(1);
  }

  runner.close();
}

async function showStatus() {
  const runner = new MigrationRunner(DB_PATH);
  const status = runner.getStatus();

  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║      Migration Status                 ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`Database: ${DB_PATH}`);
  console.log(`Applied migrations: ${status.applied}`);
  console.log(`Pending migrations: ${status.pending}`);
  console.log('');

  if (status.appliedMigrations.length > 0) {
    console.log('Applied:');
    status.appliedMigrations.forEach((migration) => {
      console.log(`  ✓ ${migration}`);
    });
    console.log('');
  }

  if (status.pendingMigrations.length > 0) {
    console.log('Pending:');
    status.pendingMigrations.forEach((migration) => {
      console.log(`  ○ ${migration}`);
    });
    console.log('');
  }

  runner.close();
}

async function createMigration(name) {
  if (!name) {
    console.error('Error: Migration name is required');
    console.log('Usage: npm run migrate create <name>');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const sanitizedName = name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const filename = `${timestamp}-${sanitizedName}.sql`;
  const rollbackFilename = `${timestamp}-${sanitizedName}.rollback.sql`;

  const migrationsDir = path.join(__dirname, '../migrations');
  const { default: fs } = await import('fs');

  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const migrationPath = path.join(migrationsDir, filename);
  const rollbackPath = path.join(migrationsDir, rollbackFilename);

  const migrationTemplate = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   name TEXT NOT NULL,
--   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );
`;

  const rollbackTemplate = `-- Rollback for: ${name}
-- Created: ${new Date().toISOString()}

-- Add your rollback SQL here
-- Example:
-- DROP TABLE IF EXISTS example;
`;

  fs.writeFileSync(migrationPath, migrationTemplate);
  fs.writeFileSync(rollbackPath, rollbackTemplate);

  console.log('');
  console.log('✓ Migration files created:');
  console.log(`  ${filename}`);
  console.log(`  ${rollbackFilename}`);
  console.log('');
}

async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'up':
        await runMigrations();
        break;

      case 'down':
        await rollbackMigration();
        break;

      case 'status':
        await showStatus();
        break;

      case 'create':
        await createMigration(process.argv[3]);
        break;

      default:
        printUsage();
    }
  } catch (error) {
    console.error('\nMigration failed:', error.message);
    process.exit(1);
  }
}

main();
