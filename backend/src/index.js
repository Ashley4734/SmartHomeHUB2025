/**
 * Smart Home Hub - Main Application Entry Point
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import core modules
import { initDatabase, closeDatabase } from './database/db.js';
import * as auth from './auth/auth.js';
import DeviceManager from './core/deviceManager.js';
import AIService from './ai/aiService.js';
import ZigbeeProtocol from './protocols/zigbee.js';
import MatterProtocol from './protocols/matter.js';
import AutomationEngine from './automation/automationEngine.js';
import VoiceControl from './voice/voiceControl.js';
import setupRoutes from './api/routes.js';
import setupWebSocket from './websocket/websocketServer.js';
import logger from './utils/logger.js';
import requestLogger from './middleware/requestLogger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { metricsMiddleware } from './utils/metrics.js';
import metricsRoutes from './api/metricsRoutes.js';
import { securityMiddleware } from './middleware/security.js';
import { csrfProtection, csrfErrorHandler } from './middleware/csrf.js';
import { globalRateLimiter } from './middleware/rateLimiting.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

class SmartHomeHub {
  constructor() {
    this.app = express();
    this.server = null;
    this.io = null;
    this.services = {};
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      logger.info('╔════════════════════════════════════════╗');
      logger.info('║     Smart Home Hub - Initializing     ║');
      logger.info('╚════════════════════════════════════════╝');

      // Initialize database
      logger.info('📊 Initializing database...');
      initDatabase();

      // Initialize core services
      logger.info('🔧 Initializing core services...');
      this.services.auth = auth;
      this.services.deviceManager = new DeviceManager();
      this.services.aiService = new AIService();

      // Initialize protocol handlers
      logger.info('📡 Initializing protocol handlers...');
      if (process.env.ZIGBEE_ENABLED === 'true') {
        this.services.zigbeeProtocol = new ZigbeeProtocol(this.services.deviceManager);
        await this.services.zigbeeProtocol.start();
      } else {
        logger.warn('⚠️  Zigbee protocol disabled');
      }

      if (process.env.MATTER_ENABLED === 'true') {
        this.services.matterProtocol = new MatterProtocol(this.services.deviceManager);
        await this.services.matterProtocol.start();
      } else {
        logger.warn('⚠️  Matter protocol disabled');
      }

      // Initialize automation engine
      logger.info('⚙️  Initializing automation engine...');
      this.services.automationEngine = new AutomationEngine(
        this.services.deviceManager,
        this.services.aiService
      );

      // Initialize voice control
      if (process.env.VOICE_ENABLED === 'true') {
        logger.info('🎤 Initializing voice control...');
        this.services.voiceControl = new VoiceControl(
          this.services.deviceManager,
          this.services.automationEngine,
          this.services.aiService
        );
        await this.services.voiceControl.initialize();
      } else {
        logger.warn('⚠️  Voice control disabled');
      }

      // Setup Express middleware
      this.setupMiddleware();

      // Setup routes
      logger.info('🌐 Setting up API routes...');

      // Metrics endpoint (before rate limiting and auth)
      this.app.use(metricsRoutes);

      setupRoutes(this.app, this.services);

      // Setup error handlers (must be after routes)
      this.app.use(notFoundHandler);
      this.app.use(csrfErrorHandler);
      this.app.use(errorHandler);

      // Create HTTP server
      this.server = createServer(this.app);

      // Setup WebSocket
      logger.info('🔌 Setting up WebSocket server...');
      this.io = setupWebSocket(this.server, this.services);

      // Create default admin user if none exists
      await this.createDefaultAdmin();

      logger.info('✓ Smart Home Hub initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Smart Home Hub:', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Security - HTTPS redirect, HSTS, CSP, and other security headers
    this.app.use(securityMiddleware);

    // Additional security with Helmet
    this.app.use(helmet({
      contentSecurityPolicy: false, // We handle CSP ourselves
      hsts: false // We handle HSTS ourselves
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));

    // Per-user and per-IP rate limiting
    this.app.use('/api/', globalRateLimiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // CSRF protection (applied to POST, PUT, PATCH, DELETE)
    this.app.use(csrfProtection);

    // Metrics tracking
    this.app.use(metricsMiddleware);

    // Request logging
    this.app.use(requestLogger);
  }

  /**
   * Create default admin user with default password (admin123)
   */
  async createDefaultAdmin() {
    try {
      const users = auth.listUsers();
      if (users.length === 0) {
        logger.info('Creating default admin user...');

        // Use default password for development
        const defaultPassword = 'admin123';

        const admin = await auth.createUser({
          username: 'admin',
          email: 'admin@smarthome.local',
          password: defaultPassword,
          role: auth.ROLES.ADMIN,
          fullName: 'Administrator'
        });

        logger.info('╔════════════════════════════════════════════════════════════╗');
        logger.info('║             DEFAULT ADMIN CREDENTIALS                      ║');
        logger.info('╠════════════════════════════════════════════════════════════╣');
        logger.info(`║  Username: admin                                           ║`);
        logger.info(`║  Password: ${defaultPassword.padEnd(42, ' ')}║`);
        logger.info('╠════════════════════════════════════════════════════════════╣');
        logger.warn('║  ⚠️  SECURITY NOTICE:                                      ║');
        logger.warn('║  Change this password after first login                   ║');
        logger.info('╚════════════════════════════════════════════════════════════╝');
      }
    } catch (error) {
      logger.error('Failed to create default admin:', { error: error.message });
    }
  }

  /**
   * Start the server
   */
  async start() {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';

    this.server.listen(port, host, () => {
      logger.info('╔════════════════════════════════════════╗');
      logger.info('║     Smart Home Hub - Running          ║');
      logger.info('╚════════════════════════════════════════╝');
      logger.info(`🌐 Server listening on http://${host}:${port}`);
      logger.info(`📊 WebSocket server ready`);
      logger.info('Services:');
      logger.info(`  ✓ Device Manager: ${this.services.deviceManager.devices.size} devices`);
      logger.info(`  ✓ Automation Engine: ${this.services.automationEngine.automations.size} automations`);
      logger.info(`  ✓ AI Service: ${this.services.aiService.defaultProvider} provider`);
      if (this.services.zigbeeProtocol) {
        logger.info(`  ✓ Zigbee Protocol: Ready`);
      }
      if (this.services.matterProtocol) {
        logger.info(`  ✓ Matter Protocol: Ready`);
      }
      if (this.services.voiceControl) {
        logger.info(`  ✓ Voice Control: Ready`);
      }
      logger.info('Ready to accept connections! 🚀');
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down Smart Home Hub...');

    // Stop protocols
    if (this.services.zigbeeProtocol) {
      await this.services.zigbeeProtocol.stop();
    }
    if (this.services.matterProtocol) {
      await this.services.matterProtocol.stop();
    }

    // Stop voice control
    if (this.services.voiceControl) {
      this.services.voiceControl.stopListening();
    }

    // Close WebSocket
    if (this.io) {
      this.io.close();
    }

    // Close HTTP server
    if (this.server) {
      this.server.close();
    }

    // Close database
    closeDatabase();

    logger.info('✓ Smart Home Hub shut down gracefully');
    process.exit(0);
  }
}

// Create and start the application
const hub = new SmartHomeHub();

(async () => {
  try {
    await hub.initialize();
    await hub.start();

    // Handle shutdown signals
    process.on('SIGINT', () => hub.shutdown());
    process.on('SIGTERM', () => hub.shutdown());
  } catch (error) {
    logger.error('Fatal error:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
})();

export default SmartHomeHub;
