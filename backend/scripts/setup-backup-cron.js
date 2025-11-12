#!/usr/bin/env node

/**
 * Setup automated database backups using cron
 * This script can be run standalone or imported by the main application
 */

import { CronJob } from 'cron';
import { backupDatabase, cleanupOldBackups } from './backup-database.js';
import logger from '../src/utils/logger.js';

/**
 * Setup automated database backup cron job
 * Default: Daily at 2:00 AM
 */
export function setupBackupCron(schedule = '0 2 * * *') {
  const job = new CronJob(
    schedule,
    async () => {
      try {
        logger.info('Starting scheduled database backup...');
        await backupDatabase();
        cleanupOldBackups();
        logger.info('Scheduled database backup completed successfully');
      } catch (error) {
        logger.error('Scheduled database backup failed:', {
          error: error.message,
          stack: error.stack,
        });
      }
    },
    null,
    true,
    'UTC'
  );

  logger.info(`Database backup cron job scheduled: ${schedule}`);
  return job;
}

/**
 * Setup backup on application exit
 */
export function setupBackupOnExit() {
  const backupOnExit = async () => {
    try {
      logger.info('Creating backup before shutdown...');
      await backupDatabase();
      logger.info('Pre-shutdown backup completed');
    } catch (error) {
      logger.error('Pre-shutdown backup failed:', { error: error.message });
    }
  };

  process.on('SIGTERM', backupOnExit);
  process.on('SIGINT', backupOnExit);

  logger.info('Pre-shutdown backup handler registered');
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Setting up database backup cron job...');
  console.log('Schedule: Daily at 2:00 AM UTC');
  console.log('Press Ctrl+C to stop');
  setupBackupCron();
}
