#!/usr/bin/env node

/**
 * Database Backup Script
 * Automatically backs up the SQLite database with compression and rotation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/smart-home.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '30', 10);

/**
 * Create backup directory if it doesn't exist
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`✓ Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Generate backup filename with timestamp
 */
function getBackupFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `smart-home-${timestamp}.db.gz`;
}

/**
 * Compress and backup the database
 */
async function backupDatabase() {
  try {
    console.log('Starting database backup...');

    // Check if database exists
    if (!fs.existsSync(DB_PATH)) {
      throw new Error(`Database not found at: ${DB_PATH}`);
    }

    ensureBackupDir();

    const backupFilename = getBackupFilename();
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    // Get database size
    const stats = fs.statSync(DB_PATH);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Database size: ${sizeMB} MB`);

    // Create compressed backup
    const source = fs.createReadStream(DB_PATH);
    const destination = fs.createWriteStream(backupPath);
    const gzip = createGzip({ level: 9 });

    await pipeline(source, gzip, destination);

    // Get backup size
    const backupStats = fs.statSync(backupPath);
    const backupSizeMB = (backupStats.size / (1024 * 1024)).toFixed(2);
    const compressionRatio = ((1 - backupStats.size / stats.size) * 100).toFixed(2);

    console.log(`✓ Backup created: ${backupFilename}`);
    console.log(`  Compressed size: ${backupSizeMB} MB (${compressionRatio}% compression)`);

    return backupPath;
  } catch (error) {
    console.error('Backup failed:', error.message);
    throw error;
  }
}

/**
 * Clean up old backups beyond the retention limit
 */
function cleanupOldBackups() {
  try {
    console.log('Cleaning up old backups...');

    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((file) => file.startsWith('smart-home-') && file.endsWith('.db.gz'))
      .map((file) => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_BACKUPS) {
      const filesToDelete = files.slice(MAX_BACKUPS);
      let deletedSize = 0;

      filesToDelete.forEach((file) => {
        const stats = fs.statSync(file.path);
        deletedSize += stats.size;
        fs.unlinkSync(file.path);
        console.log(`  Deleted old backup: ${file.name}`);
      });

      const deletedSizeMB = (deletedSize / (1024 * 1024)).toFixed(2);
      console.log(`✓ Cleaned up ${filesToDelete.length} old backups (${deletedSizeMB} MB freed)`);
    } else {
      console.log(`✓ No cleanup needed (${files.length}/${MAX_BACKUPS} backups)`);
    }
  } catch (error) {
    console.error('Cleanup failed:', error.message);
    // Don't throw - cleanup failure shouldn't stop the backup
  }
}

/**
 * List all backups
 */
function listBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      console.log('No backups found.');
      return;
    }

    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((file) => file.startsWith('smart-home-') && file.endsWith('.db.gz'))
      .map((file) => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: (stats.size / (1024 * 1024)).toFixed(2),
          date: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (files.length === 0) {
      console.log('No backups found.');
      return;
    }

    console.log(`\nFound ${files.length} backup(s):\n`);
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.name}`);
      console.log(`   Size: ${file.size} MB`);
      console.log(`   Date: ${file.date}`);
      console.log('');
    });

    const totalSize = files.reduce((sum, file) => sum + parseFloat(file.size), 0);
    console.log(`Total backup size: ${totalSize.toFixed(2)} MB`);
  } catch (error) {
    console.error('Failed to list backups:', error.message);
  }
}

/**
 * Restore database from backup
 */
async function restoreDatabase(backupFile) {
  try {
    console.log(`Restoring database from: ${backupFile}`);

    const backupPath = path.isAbsolute(backupFile)
      ? backupFile
      : path.join(BACKUP_DIR, backupFile);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    // Create backup of current database before restoring
    if (fs.existsSync(DB_PATH)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const currentBackupPath = path.join(BACKUP_DIR, `pre-restore-${timestamp}.db`);
      fs.copyFileSync(DB_PATH, currentBackupPath);
      console.log(`✓ Created backup of current database: pre-restore-${timestamp}.db`);
    }

    // Decompress and restore
    const { createGunzip } = await import('zlib');
    const source = fs.createReadStream(backupPath);
    const destination = fs.createWriteStream(DB_PATH);
    const gunzip = createGunzip();

    await pipeline(source, gunzip, destination);

    console.log('✓ Database restored successfully');
  } catch (error) {
    console.error('Restore failed:', error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  const command = process.argv[2];

  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║    Smart Home Hub - Database Backup   ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  try {
    switch (command) {
      case 'backup':
        await backupDatabase();
        cleanupOldBackups();
        break;

      case 'list':
        listBackups();
        break;

      case 'restore':
        const backupFile = process.argv[3];
        if (!backupFile) {
          console.error('Error: Please specify a backup file to restore');
          console.log('Usage: node backup-database.js restore <backup-filename>');
          process.exit(1);
        }
        await restoreDatabase(backupFile);
        break;

      default:
        console.log('Usage:');
        console.log('  node backup-database.js backup          - Create a new backup');
        console.log('  node backup-database.js list            - List all backups');
        console.log('  node backup-database.js restore <file>  - Restore from backup');
        console.log('');
        console.log('Configuration (via .env):');
        console.log(`  DB_PATH:      ${DB_PATH}`);
        console.log(`  BACKUP_DIR:   ${BACKUP_DIR}`);
        console.log(`  MAX_BACKUPS:  ${MAX_BACKUPS}`);
        console.log('');
    }
  } catch (error) {
    console.error('\nBackup operation failed!');
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { backupDatabase, restoreDatabase, listBackups, cleanupOldBackups };
