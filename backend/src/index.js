/**
 * Smart Home Hub - Main Application Entry Point
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
      console.log('');
      console.log('╔════════════════════════════════════════╗');
      console.log('║     Smart Home Hub - Initializing     ║');
      console.log('╚════════════════════════════════════════╝');
      console.log('');

      // Initialize database
      console.log('📊 Initializing database...');
      initDatabase();

      // Initialize core services
      console.log('🔧 Initializing core services...');
      this.services.auth = auth;
      this.services.deviceManager = new DeviceManager();
      this.services.aiService = new AIService();

      // Initialize protocol handlers
      console.log('📡 Initializing protocol handlers...');
      if (process.env.ZIGBEE_ENABLED === 'true') {
        this.services.zigbeeProtocol = new ZigbeeProtocol(this.services.deviceManager);
        await this.services.zigbeeProtocol.start();
      } else {
        console.log('⚠️  Zigbee protocol disabled');
      }

      if (process.env.MATTER_ENABLED === 'true') {
        this.services.matterProtocol = new MatterProtocol(this.services.deviceManager);
        await this.services.matterProtocol.start();
      } else {
        console.log('⚠️  Matter protocol disabled');
      }

      // Initialize automation engine
      console.log('⚙️  Initializing automation engine...');
      this.services.automationEngine = new AutomationEngine(
        this.services.deviceManager,
        this.services.aiService
      );

      // Initialize voice control
      if (process.env.VOICE_ENABLED === 'true') {
        console.log('🎤 Initializing voice control...');
        this.services.voiceControl = new VoiceControl(
          this.services.deviceManager,
          this.services.automationEngine,
          this.services.aiService
        );
        await this.services.voiceControl.initialize();
      } else {
        console.log('⚠️  Voice control disabled');
      }

      // Setup Express middleware
      this.setupMiddleware();

      // Setup routes
      console.log('🌐 Setting up API routes...');
      setupRoutes(this.app, this.services);

      // Create HTTP server
      this.server = createServer(this.app);

      // Setup WebSocket
      console.log('🔌 Setting up WebSocket server...');
      this.io = setupWebSocket(this.server, this.services);

      // Create default admin user if none exists
      await this.createDefaultAdmin();

      console.log('');
      console.log('✓ Smart Home Hub initialized successfully');
      console.log('');
    } catch (error) {
      console.error('Failed to initialize Smart Home Hub:', error);
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Security
    this.app.use(helmet());

    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }

  /**
   * Create default admin user
   */
  async createDefaultAdmin() {
    try {
      const users = auth.listUsers();
      if (users.length === 0) {
        console.log('Creating default admin user...');
        const admin = await auth.createUser({
          username: 'admin',
          email: 'admin@smarthome.local',
          password: 'admin123', // Change this in production!
          role: auth.ROLES.ADMIN,
          fullName: 'Administrator'
        });
        console.log('✓ Default admin user created');
        console.log('  Username: admin');
        console.log('  Password: admin123');
        console.log('  ⚠️  IMPORTANT: Change the default password immediately!');
      }
    } catch (error) {
      console.error('Failed to create default admin:', error);
    }
  }

  /**
   * Start the server
   */
  async start() {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';

    this.server.listen(port, host, () => {
      console.log('╔════════════════════════════════════════╗');
      console.log('║     Smart Home Hub - Running          ║');
      console.log('╚════════════════════════════════════════╝');
      console.log('');
      console.log(`🌐 Server listening on http://${host}:${port}`);
      console.log(`📊 WebSocket server ready`);
      console.log('');
      console.log('Services:');
      console.log(`  ✓ Device Manager: ${this.services.deviceManager.devices.size} devices`);
      console.log(`  ✓ Automation Engine: ${this.services.automationEngine.automations.size} automations`);
      console.log(`  ✓ AI Service: ${this.services.aiService.defaultProvider} provider`);
      if (this.services.zigbeeProtocol) {
        console.log(`  ✓ Zigbee Protocol: Ready`);
      }
      if (this.services.matterProtocol) {
        console.log(`  ✓ Matter Protocol: Ready`);
      }
      if (this.services.voiceControl) {
        console.log(`  ✓ Voice Control: Ready`);
      }
      console.log('');
      console.log('Ready to accept connections! 🚀');
      console.log('');
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('');
    console.log('Shutting down Smart Home Hub...');

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

    console.log('✓ Smart Home Hub shut down gracefully');
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
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();

export default SmartHomeHub;
