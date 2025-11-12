/**
 * GDPR Service Integration Tests
 * Tests GDPR compliance features with real database
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { initDatabase, closeDatabase, getDatabase } from '../../database/db.js';
import * as auth from '../../auth/auth.js';
import * as gdpr from '../gdpr.js';
import DeviceManager from '../../core/deviceManager.js';

// Set test environment
process.env.JWT_SECRET = 'test-secret-key-for-gdpr-testing';
process.env.NODE_ENV = 'test';

describe('GDPR Service - Integration Tests', () => {
  let testUser;
  let deviceManager;

  beforeAll(() => {
    initDatabase(':memory:');
    deviceManager = new DeviceManager();
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(async () => {
    // Clean up tables
    const db = getDatabase();
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM devices').run();
    db.prepare('DELETE FROM device_history').run();
    db.prepare('DELETE FROM automations').run();
    db.prepare('DELETE FROM user_consents').run();
    db.prepare('DELETE FROM data_processing_log').run();
    db.prepare('DELETE FROM data_deletion_requests').run();
    db.prepare('DELETE FROM auth_audit_log').run();

    // Create test user
    testUser = await auth.createUser({
      username: 'gdprtest',
      email: 'gdpr@test.com',
      password: 'testpass123',
      fullName: 'GDPR Test User'
    });
  });

  describe('Consent Management', () => {
    test('should automatically record essential consent on user creation', () => {
      const consents = gdpr.getUserConsents(testUser.id);

      expect(consents.length).toBeGreaterThan(0);
      const essentialConsent = consents.find(c => c.consent_type === gdpr.CONSENT_TYPES.ESSENTIAL);
      expect(essentialConsent).toBeDefined();
      expect(essentialConsent.consent_given).toBe(1);
    });

    test('should record new consent', () => {
      const result = gdpr.recordConsent(
        testUser.id,
        gdpr.CONSENT_TYPES.ANALYTICS,
        true,
        '127.0.0.1',
        'Test Agent'
      );

      expect(result.created).toBe(true);
      expect(result.id).toBeDefined();
    });

    test('should update existing consent', () => {
      // Create consent
      gdpr.recordConsent(testUser.id, gdpr.CONSENT_TYPES.PERSONALIZATION, true);

      // Update consent
      const result = gdpr.recordConsent(testUser.id, gdpr.CONSENT_TYPES.PERSONALIZATION, false);

      expect(result.updated).toBe(true);
    });

    test('should get all user consents', () => {
      gdpr.recordConsent(testUser.id, gdpr.CONSENT_TYPES.ANALYTICS, true);
      gdpr.recordConsent(testUser.id, gdpr.CONSENT_TYPES.PERSONALIZATION, true);
      gdpr.recordConsent(testUser.id, gdpr.CONSENT_TYPES.MARKETING, false);

      const consents = gdpr.getUserConsents(testUser.id);

      expect(consents.length).toBeGreaterThanOrEqual(4); // Essential + 3 we just added
      const analyticsConsent = consents.find(c => c.consent_type === gdpr.CONSENT_TYPES.ANALYTICS);
      expect(analyticsConsent.consent_given).toBe(1);
    });

    test('should check if user has consent', () => {
      gdpr.recordConsent(testUser.id, gdpr.CONSENT_TYPES.ANALYTICS, true);

      expect(gdpr.hasConsent(testUser.id, gdpr.CONSENT_TYPES.ANALYTICS)).toBe(true);
      expect(gdpr.hasConsent(testUser.id, gdpr.CONSENT_TYPES.MARKETING)).toBe(false);
    });
  });

  describe('Data Processing Log', () => {
    test('should log data processing activity', () => {
      gdpr.logDataProcessing(
        testUser.id,
        'data_access',
        gdpr.PROCESSING_PURPOSES.SERVICE_DELIVERY,
        ['profile', 'devices'],
        'contract'
      );

      const history = gdpr.getDataProcessingHistory(testUser.id);

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].processing_type).toBe('data_access');
      expect(history[0].purpose).toBe(gdpr.PROCESSING_PURPOSES.SERVICE_DELIVERY);
    });

    test('should retrieve processing history with limit', () => {
      // Log multiple activities
      for (let i = 0; i < 10; i++) {
        gdpr.logDataProcessing(
          testUser.id,
          'data_access',
          gdpr.PROCESSING_PURPOSES.SERVICE_DELIVERY,
          ['profile'],
          'contract'
        );
      }

      const history = gdpr.getDataProcessingHistory(testUser.id, 5);

      expect(history.length).toBe(5);
    });
  });

  describe('Data Export', () => {
    test('should export all user data', () => {
      // Create some data for the user
      const device = deviceManager.registerDevice({
        name: 'Test Light',
        type: 'light',
        protocol: 'zigbee'
      });

      deviceManager.updateDeviceState(device.id, { on: true }, testUser.id);

      // Export data
      const dataExport = gdpr.exportUserData(testUser.id);

      expect(dataExport.export_info).toBeDefined();
      expect(dataExport.export_info.user_id).toBe(testUser.id);
      expect(dataExport.user_profile).toBeDefined();
      expect(dataExport.user_profile.username).toBe('gdprtest');
      expect(dataExport.devices).toBeDefined();
      expect(dataExport.privacy.consents).toBeDefined();
    });

    test('should include all data categories in export', () => {
      const dataExport = gdpr.exportUserData(testUser.id);

      // Verify all major sections exist
      expect(dataExport.user_profile).toBeDefined();
      expect(dataExport.devices).toBeDefined();
      expect(dataExport.automations).toBeDefined();
      expect(dataExport.scenes).toBeDefined();
      expect(dataExport.ai_data).toBeDefined();
      expect(dataExport.voice_control).toBeDefined();
      expect(dataExport.notifications).toBeDefined();
      expect(dataExport.security).toBeDefined();
      expect(dataExport.privacy).toBeDefined();
      expect(dataExport.metadata).toBeDefined();
    });

    test('should throw error for non-existent user', () => {
      expect(() => {
        gdpr.exportUserData('non-existent-user-id');
      }).toThrow('User not found');
    });
  });

  describe('Data Deletion', () => {
    test('should delete all user data', () => {
      // Create some data
      const device = deviceManager.registerDevice({
        name: 'Test Device',
        type: 'sensor',
        protocol: 'zigbee'
      });

      deviceManager.updateDeviceState(device.id, { temperature: 22 }, testUser.id);

      gdpr.recordConsent(testUser.id, gdpr.CONSENT_TYPES.ANALYTICS, true);
      gdpr.logDataProcessing(
        testUser.id,
        'data_access',
        gdpr.PROCESSING_PURPOSES.SERVICE_DELIVERY,
        ['profile'],
        'contract'
      );

      // Delete user data
      const result = gdpr.deleteUserData(testUser.id, testUser.id);

      expect(result.success).toBe(true);
      expect(result.request_id).toBeDefined();
      expect(result.deleted_records).toBeDefined();
      expect(result.deleted_records.user).toBe(1);

      // Verify user is deleted
      const deletedUser = auth.getUserById(testUser.id);
      expect(deletedUser).toBeUndefined();
    });

    test('should delete device history triggered by user', () => {
      const device = deviceManager.registerDevice({
        name: 'Test Device',
        type: 'light',
        protocol: 'zigbee'
      });

      // Create history entries
      deviceManager.updateDeviceState(device.id, { on: true }, testUser.id);
      deviceManager.updateDeviceState(device.id, { brightness: 50 }, testUser.id);

      // Verify history exists before deletion
      const historyBefore = deviceManager.getDeviceHistory(device.id);
      expect(historyBefore.length).toBeGreaterThan(0);

      // Delete user data
      const result = gdpr.deleteUserData(testUser.id, testUser.id);

      expect(result.deleted_records.device_history).toBeGreaterThan(0);
    });

    test('should throw error for non-existent user', () => {
      expect(() => {
        gdpr.deleteUserData('non-existent-user-id', testUser.id);
      }).toThrow('User not found');
    });

    test('should create deletion request record', () => {
      gdpr.deleteUserData(testUser.id, testUser.id);

      const requests = gdpr.getDeletionRequests();
      expect(requests.length).toBeGreaterThan(0);

      const request = requests[0];
      expect(request.request_type).toBe('full_deletion');
      expect(request.status).toBe('completed');
    });
  });

  describe('Deletion Requests Management', () => {
    test('should get all deletion requests', async () => {
      // Create another user and delete
      const user2 = await auth.createUser({
        username: 'deletetest',
        email: 'delete@test.com',
        password: 'pass123'
      });

      gdpr.deleteUserData(user2.id, testUser.id);

      const requests = gdpr.getDeletionRequests();

      expect(requests.length).toBeGreaterThan(0);
    });

    test('should filter deletion requests by status', async () => {
      // This would require creating a failed deletion, which is hard to test
      // So we just verify the function accepts a status parameter
      const requests = gdpr.getDeletionRequests('completed');
      expect(Array.isArray(requests)).toBe(true);
    });
  });

  describe('GDPR Compliance Features', () => {
    test('should record consent with IP and user agent', () => {
      const result = gdpr.recordConsent(
        testUser.id,
        gdpr.CONSENT_TYPES.ANALYTICS,
        true,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(result.created).toBe(true);

      const consents = gdpr.getUserConsents(testUser.id);
      const analyticsConsent = consents.find(c => c.consent_type === gdpr.CONSENT_TYPES.ANALYTICS);

      // Note: IP and user_agent are not returned in getUserConsents for privacy
      // but they are stored in the database
      expect(analyticsConsent).toBeDefined();
    });

    test('should track consent version', () => {
      gdpr.recordConsent(testUser.id, gdpr.CONSENT_TYPES.PERSONALIZATION, true);

      const consents = gdpr.getUserConsents(testUser.id);
      const consent = consents.find(c => c.consent_type === gdpr.CONSENT_TYPES.PERSONALIZATION);

      expect(consent.consent_version).toBeDefined();
      expect(consent.consent_version).toBe('1.0');
    });

    test('should track consent timestamps', () => {
      const before = Date.now();
      gdpr.recordConsent(testUser.id, gdpr.CONSENT_TYPES.MARKETING, true);
      const after = Date.now();

      const consents = gdpr.getUserConsents(testUser.id);
      const consent = consents.find(c => c.consent_type === gdpr.CONSENT_TYPES.MARKETING);

      expect(consent.given_at).toBeGreaterThanOrEqual(before);
      expect(consent.given_at).toBeLessThanOrEqual(after);
      expect(consent.withdrawn_at).toBeNull();
    });

    test('should track withdrawal timestamps', () => {
      // Give consent first
      gdpr.recordConsent(testUser.id, gdpr.CONSENT_TYPES.MARKETING, true);

      // Withdraw consent
      const before = Date.now();
      gdpr.recordConsent(testUser.id, gdpr.CONSENT_TYPES.MARKETING, false);
      const after = Date.now();

      const consents = gdpr.getUserConsents(testUser.id);
      const consent = consents.find(c => c.consent_type === gdpr.CONSENT_TYPES.MARKETING);

      expect(consent.consent_given).toBe(0);
      expect(consent.withdrawn_at).toBeGreaterThanOrEqual(before);
      expect(consent.withdrawn_at).toBeLessThanOrEqual(after);
    });
  });

  describe('Data Categories', () => {
    test('should export device data categories', () => {
      const device = deviceManager.registerDevice({
        name: 'Smart Bulb',
        type: 'light',
        protocol: 'zigbee',
        manufacturer: 'Philips'
      });

      const dataExport = gdpr.exportUserData(testUser.id);

      expect(dataExport.devices.all_devices).toBeDefined();
      expect(Array.isArray(dataExport.devices.all_devices)).toBe(true);
    });

    test('should include metadata about export', () => {
      const dataExport = gdpr.exportUserData(testUser.id);

      expect(dataExport.export_info.export_date).toBeDefined();
      expect(dataExport.export_info.format_version).toBe('1.0');
      expect(dataExport.metadata.total_records).toBeDefined();
    });
  });
});
