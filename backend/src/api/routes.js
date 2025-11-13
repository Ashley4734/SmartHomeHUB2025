/**
 * REST API Routes
 */

import express from 'express';
import { authenticate, requirePermission, ROLES } from '../auth/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { authRateLimiter, aiRateLimiter } from '../middleware/rateLimiting.js';
import { bruteForceProtection } from '../middleware/bruteForceProtection.js';
import * as gdpr from '../services/gdpr.js';

export function setupRoutes(app, services) {
  const { auth, deviceManager, automationEngine, aiService, voiceControl, zigbeeProtocol, matterProtocol } = services;

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      version: '1.0.0'
    });
  });

  // Note: CSRF token endpoint is registered in index.js before CSRF middleware

  // ========== Authentication Routes ==========

  // Register new user - with stricter rate limiting
  app.post('/api/auth/register', authRateLimiter, async (req, res) => {
    try {
      const { username, email, password, fullName } = req.body;
      const user = await auth.createUser({ username, email, password, fullName });
      res.status(201).json({ user });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Login - with stricter rate limiting and brute force protection
  app.post('/api/auth/login', authRateLimiter, bruteForceProtection, async (req, res) => {
    try {
      const { username, password } = req.body;
      const result = await auth.authenticateUser(
        username,
        password,
        req.ip,
        req.headers['user-agent']
      );
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });

  // Get current user
  app.get('/api/auth/me', authenticate, (req, res) => {
    const user = auth.getUserById(req.user.id);
    res.json({ user });
  });

  // ========== User Management Routes ==========

  // List users (admin only)
  app.get('/api/users', authenticate, requirePermission('user.read'), (req, res) => {
    const users = auth.listUsers();
    res.json({ users });
  });

  // Update user
  app.patch('/api/users/:id', authenticate, async (req, res) => {
    try {
      // Users can update themselves, admins can update anyone
      if (req.user.id !== req.params.id && req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const user = await auth.updateUser(req.params.id, req.body);
      res.json({ user });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete user (admin only)
  app.delete('/api/users/:id', authenticate, requirePermission('user.delete'), (req, res) => {
    try {
      auth.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========== Device Routes ==========

  // List devices
  app.get('/api/devices', authenticate, requirePermission('device.read'), (req, res) => {
    const { protocol, type, roomId, online } = req.query;
    const filter = {};
    if (protocol) filter.protocol = protocol;
    if (type) filter.type = type;
    if (roomId) filter.roomId = roomId;
    if (online !== undefined) filter.online = parseInt(online);

    const devices = deviceManager.listDevices(filter);
    res.json({ devices });
  });

  // Get device by ID
  app.get('/api/devices/:id', authenticate, requirePermission('device.read'), (req, res) => {
    const device = deviceManager.getDevice(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json({ device });
  });

  // Control device
  app.post('/api/devices/:id/control', authenticate, requirePermission('device.control'), async (req, res) => {
    try {
      const { command, parameters } = req.body;
      const result = await deviceManager.controlDevice(req.params.id, command, parameters);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update device
  app.patch('/api/devices/:id', authenticate, requirePermission('device.update'), (req, res) => {
    try {
      const device = deviceManager.updateDevice(req.params.id, req.body);
      res.json({ device });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete device
  app.delete('/api/devices/:id', authenticate, requirePermission('device.delete'), (req, res) => {
    try {
      deviceManager.deleteDevice(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get device history
  app.get('/api/devices/:id/history', authenticate, requirePermission('device.read'), (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const history = deviceManager.getDeviceHistory(req.params.id, limit);
    res.json({ history });
  });

  // Get device statistics
  app.get('/api/devices/stats/summary', authenticate, requirePermission('device.read'), (req, res) => {
    const stats = deviceManager.getStatistics();
    res.json(stats);
  });

  // ========== Protocol Routes ==========

  // Zigbee: Enable pairing
  app.post('/api/protocols/zigbee/pairing', authenticate, requirePermission('device.create'), async (req, res) => {
    try {
      const duration = parseInt(req.body.duration) || 60;
      await zigbeeProtocol.permitJoin(duration);
      res.json({ success: true, duration });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Zigbee: Disable pairing
  app.post('/api/protocols/zigbee/pairing/stop', authenticate, requirePermission('device.create'), async (req, res) => {
    try {
      await zigbeeProtocol.stopPermitJoin();
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Matter: Start commissioning
  app.post('/api/protocols/matter/commissioning', authenticate, requirePermission('device.create'), async (req, res) => {
    try {
      const timeout = parseInt(req.body.timeout) || 180;
      const result = await matterProtocol.startCommissioning(timeout);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Matter: Commission device
  app.post('/api/protocols/matter/commission', authenticate, requirePermission('device.create'), async (req, res) => {
    try {
      const { pairingCode, deviceInfo } = req.body;
      const device = await matterProtocol.commissionDevice(pairingCode, deviceInfo);
      res.json({ device });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========== Automation Routes ==========

  // List automations
  app.get('/api/automations', authenticate, requirePermission('automation.read'), (req, res) => {
    const filter = {};
    if (req.query.enabled !== undefined) filter.enabled = parseInt(req.query.enabled);
    const automations = automationEngine.listAutomations(filter);
    res.json({ automations });
  });

  // Get automation by ID
  app.get('/api/automations/:id', authenticate, requirePermission('automation.read'), (req, res) => {
    const automation = automationEngine.automations.get(req.params.id);
    if (!automation) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    res.json({ automation });
  });

  // Create automation
  app.post('/api/automations', authenticate, requirePermission('automation.create'), (req, res) => {
    try {
      const automation = automationEngine.createAutomation({
        ...req.body,
        createdBy: req.user.id
      });
      res.status(201).json({ automation });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create automation from natural language
  app.post('/api/automations/from-text', authenticate, requirePermission('automation.create'), async (req, res) => {
    try {
      const { prompt } = req.body;
      const automation = await automationEngine.createFromNaturalLanguage(prompt, req.user.id);
      res.status(201).json({ automation });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update automation
  app.patch('/api/automations/:id', authenticate, async (req, res) => {
    try {
      const automation = automationEngine.automations.get(req.params.id);
      if (!automation) {
        return res.status(404).json({ error: 'Automation not found' });
      }

      // Check permissions
      if (automation.created_by !== req.user.id && req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updated = automationEngine.updateAutomation(req.params.id, req.body);
      res.json({ automation: updated });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete automation
  app.delete('/api/automations/:id', authenticate, (req, res) => {
    try {
      const automation = automationEngine.automations.get(req.params.id);
      if (!automation) {
        return res.status(404).json({ error: 'Automation not found' });
      }

      if (automation.created_by !== req.user.id && req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      automationEngine.deleteAutomation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Trigger automation manually
  app.post('/api/automations/:id/trigger', authenticate, requirePermission('automation.execute'), async (req, res) => {
    try {
      await automationEngine.triggerAutomation(req.params.id, {
        type: 'manual',
        triggeredBy: req.user.id,
        timestamp: Date.now()
      });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get automation logs
  app.get('/api/automations/:id/logs', authenticate, requirePermission('automation.read'), (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const logs = automationEngine.getAutomationLogs(req.params.id, limit);
    res.json({ logs });
  });

  // ========== AI Routes ==========

  // Chat with AI
  app.post('/api/ai/chat', authenticate, requirePermission('ai.interact'), async (req, res) => {
    try {
      const { messages, provider } = req.body;
      const response = await aiService.chat(messages, { provider });
      res.json(response);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Analyze patterns
  app.post('/api/ai/analyze-patterns', authenticate, requirePermission('ai.interact'), async (req, res) => {
    try {
      const { patterns, context } = req.body;
      const analysis = await aiService.analyzePatterns(patterns, context);
      res.json({ analysis });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========== Voice Control Routes ==========

  // Process voice command
  app.post('/api/voice/command', authenticate, requirePermission('voice.use'), async (req, res) => {
    try {
      const { audioData } = req.body;
      const response = await voiceControl.processVoiceCommand(audioData, req.user.id);
      res.json(response);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get voice command history
  app.get('/api/voice/history', authenticate, requirePermission('voice.use'), (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const history = voiceControl.getCommandHistory(req.user.id, limit);
    res.json({ history });
  });

  // Get voice statistics
  app.get('/api/voice/stats', authenticate, requirePermission('voice.use'), (req, res) => {
    const stats = voiceControl.getStatistics(req.user.id);
    res.json(stats);
  });

  // Start/stop listening
  app.post('/api/voice/listening/:action', authenticate, requirePermission('voice.use'), async (req, res) => {
    try {
      const { action } = req.params;
      if (action === 'start') {
        await voiceControl.startListening();
      } else if (action === 'stop') {
        voiceControl.stopListening();
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }
      res.json({ success: true, listening: voiceControl.isListening });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========== GDPR Compliance Routes ==========

  // Export user data (GDPR Right to Portability)
  app.get('/api/gdpr/export', authenticate, (req, res) => {
    try {
      // Users can export their own data, admins can export any user's data
      const targetUserId = req.query.userId || req.user.id;

      if (targetUserId !== req.user.id && req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const dataExport = gdpr.exportUserData(targetUserId);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="user-data-export-${targetUserId}-${Date.now()}.json"`);

      res.json(dataExport);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Request data deletion (GDPR Right to be Forgotten)
  app.delete('/api/gdpr/delete', authenticate, async (req, res) => {
    try {
      // Users can delete their own account, admins can delete any account
      const targetUserId = req.body.userId || req.user.id;

      if (targetUserId !== req.user.id && req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Require password confirmation for self-deletion
      if (targetUserId === req.user.id && !req.body.password) {
        return res.status(400).json({ error: 'Password confirmation required' });
      }

      // Verify password if self-deleting
      if (targetUserId === req.user.id) {
        const user = auth.getUserById(targetUserId);
        const isValid = await auth.verifyPassword(req.body.password, user.password_hash);
        if (!isValid) {
          return res.status(401).json({ error: 'Invalid password' });
        }
      }

      const result = gdpr.deleteUserData(targetUserId, req.user.id);

      res.json({
        success: true,
        message: 'User data has been permanently deleted',
        ...result
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get user consents
  app.get('/api/gdpr/consents', authenticate, (req, res) => {
    try {
      const consents = gdpr.getUserConsents(req.user.id);
      res.json({ consents });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update user consent
  app.post('/api/gdpr/consents', authenticate, (req, res) => {
    try {
      const { consentType, consentGiven } = req.body;

      if (!consentType || typeof consentGiven !== 'boolean') {
        return res.status(400).json({ error: 'Invalid consent data' });
      }

      // Validate consent type
      if (!Object.values(gdpr.CONSENT_TYPES).includes(consentType)) {
        return res.status(400).json({ error: 'Invalid consent type' });
      }

      // Cannot withdraw essential consent
      if (consentType === gdpr.CONSENT_TYPES.ESSENTIAL && !consentGiven) {
        return res.status(400).json({
          error: 'Essential consent cannot be withdrawn. Please delete your account instead.'
        });
      }

      const result = gdpr.recordConsent(
        req.user.id,
        consentType,
        consentGiven,
        req.ip,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        consent: result
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get data processing history
  app.get('/api/gdpr/processing-history', authenticate, (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const history = gdpr.getDataProcessingHistory(req.user.id, limit);
      res.json({ history });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get deletion requests (admin only)
  app.get('/api/gdpr/deletion-requests', authenticate, requirePermission('user.delete'), (req, res) => {
    try {
      const status = req.query.status;
      const requests = gdpr.getDeletionRequests(status);
      res.json({ requests });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  console.log('✓ API routes configured');
}

export default setupRoutes;
