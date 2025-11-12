/**
 * Voice Control System
 * Handles wake word detection, speech-to-text, and voice command processing
 */

import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';

class VoiceControl extends EventEmitter {
  constructor(deviceManager, automationEngine, aiService) {
    super();
    this.deviceManager = deviceManager;
    this.automationEngine = automationEngine;
    this.aiService = aiService;
    this.isEnabled = false;
    this.isListening = false;
    this.wakeWordDetector = null;
    this.currentSession = null;

    this.config = {
      wakeWord: process.env.VOICE_WAKE_WORD || 'hey_hub',
      sttProvider: process.env.VOICE_STT_PROVIDER || 'whisper',
      ttsEnabled: process.env.VOICE_TTS_ENABLED === 'true',
      language: 'en-US',
      timeout: 5000 // Command timeout in ms
    };
  }

  /**
   * Initialize voice control
   */
  async initialize() {
    try {
      console.log('Initializing voice control system...');

      // In a production environment, this would:
      // 1. Initialize Porcupine for wake word detection
      // 2. Setup microphone input
      // 3. Initialize STT service (Whisper, Google, etc.)
      // 4. Initialize TTS if enabled

      this.isEnabled = true;
      console.log('✓ Voice control initialized');
      console.log(`  Wake word: ${this.config.wakeWord}`);
      console.log(`  STT provider: ${this.config.sttProvider}`);

      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize voice control:', error);
      console.warn('Voice control will continue in stub mode');
    }
  }

  /**
   * Start listening for wake word
   */
  async startListening() {
    if (!this.isEnabled) {
      throw new Error('Voice control not enabled');
    }

    if (this.isListening) {
      console.log('Already listening for wake word');
      return;
    }

    console.log('👂 Listening for wake word...');
    this.isListening = true;
    this.emit('listening:started');

    // In production, this would start the wake word detector
    // For now, this is a stub that can be triggered via API
  }

  /**
   * Stop listening
   */
  stopListening() {
    if (!this.isListening) return;

    console.log('Stopped listening for wake word');
    this.isListening = false;
    this.emit('listening:stopped');
  }

  /**
   * Handle wake word detected
   */
  onWakeWordDetected() {
    console.log('🎤 Wake word detected!');
    this.emit('wake_word:detected');

    // Start voice command session
    this.startCommandSession();
  }

  /**
   * Start a voice command session
   */
  startCommandSession() {
    this.currentSession = {
      id: uuidv4(),
      startTime: Date.now(),
      state: 'listening'
    };

    console.log('Started voice command session');
    this.emit('session:started', this.currentSession);

    // Set timeout for command
    setTimeout(() => {
      if (this.currentSession && this.currentSession.state === 'listening') {
        this.endCommandSession('timeout');
      }
    }, this.config.timeout);
  }

  /**
   * End voice command session
   */
  endCommandSession(reason = 'completed') {
    if (!this.currentSession) return;

    console.log(`Voice command session ended: ${reason}`);
    this.emit('session:ended', { session: this.currentSession, reason });
    this.currentSession = null;
  }

  /**
   * Process voice command (speech-to-text + AI processing)
   */
  async processVoiceCommand(audioData, userId) {
    try {
      if (!this.currentSession) {
        this.startCommandSession();
      }

      this.currentSession.state = 'processing';
      this.emit('processing:started');

      // Step 1: Convert speech to text
      const text = await this.speechToText(audioData);
      console.log(`Transcribed: "${text}"`);

      if (!text || text.trim().length === 0) {
        return this.createVoiceResponse(
          "I didn't catch that. Could you please repeat?",
          userId,
          text,
          false
        );
      }

      // Step 2: Process command with AI
      const devices = this.deviceManager.listDevices();
      const context = {
        devices: devices.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          state: d.state,
          capabilities: d.capabilities
        }))
      };

      const aiResponse = await this.aiService.processVoiceCommand(text, context);

      // Step 3: Execute command based on intent
      let response;
      switch (aiResponse.intent) {
        case 'control':
          response = await this.executeDeviceControl(aiResponse.entities, userId);
          break;

        case 'query':
          response = await this.executeDeviceQuery(aiResponse.entities);
          break;

        case 'automation':
          response = await this.executeAutomationCommand(aiResponse.entities, text, userId);
          break;

        default:
          response = aiResponse.response || "I'm not sure how to help with that.";
      }

      // Step 4: Log and return response
      const voiceResponse = this.createVoiceResponse(response, userId, text, true, aiResponse.intent);

      // End session
      this.endCommandSession('completed');

      return voiceResponse;
    } catch (error) {
      console.error('Failed to process voice command:', error);
      this.endCommandSession('error');

      return this.createVoiceResponse(
        "Sorry, I encountered an error processing your command.",
        userId,
        '',
        false
      );
    }
  }

  /**
   * Convert speech to text
   */
  async speechToText(audioData) {
    // In production, this would use:
    // - Whisper (local or API)
    // - Google Cloud Speech-to-Text
    // - Azure Speech Services
    // - etc.

    // For now, return stub text
    // In a real implementation, you'd process the audioData buffer
    console.log('Converting speech to text...');
    return "turn on the living room lights";
  }

  /**
   * Execute device control command
   */
  async executeDeviceControl(entities, userId) {
    try {
      const { device: deviceName, action, value } = entities;

      // Find device by name
      const devices = this.deviceManager.listDevices();
      const device = devices.find(d =>
        d.name.toLowerCase().includes(deviceName.toLowerCase())
      );

      if (!device) {
        return `I couldn't find a device named ${deviceName}.`;
      }

      // Map action to command
      let command, parameters = {};

      switch (action) {
        case 'on':
          command = 'turn_on';
          break;
        case 'off':
          command = 'turn_off';
          break;
        case 'set':
          command = 'set_brightness';
          parameters = { brightness: value };
          break;
        default:
          return `I don't know how to ${action} the ${deviceName}.`;
      }

      // Execute command
      await this.deviceManager.controlDevice(device.id, command, parameters);

      return `Done! I've turned ${action === 'on' ? 'on' : action === 'off' ? 'off' : 'set'} the ${device.name}.`;
    } catch (error) {
      console.error('Device control failed:', error);
      return "Sorry, I couldn't control that device.";
    }
  }

  /**
   * Execute device query
   */
  async executeDeviceQuery(entities) {
    try {
      const { device: deviceName, property } = entities;

      const devices = this.deviceManager.listDevices();
      const device = devices.find(d =>
        d.name.toLowerCase().includes(deviceName.toLowerCase())
      );

      if (!device) {
        return `I couldn't find a device named ${deviceName}.`;
      }

      const state = device.state;

      if (property === 'state') {
        return `The ${device.name} is ${state.state || 'unknown'}.`;
      } else if (property === 'temperature') {
        return `The temperature is ${state.temperature}°C.`;
      } else if (property === 'humidity') {
        return `The humidity is ${state.humidity}%.`;
      } else {
        return `The ${device.name} is currently ${JSON.stringify(state)}.`;
      }
    } catch (error) {
      console.error('Device query failed:', error);
      return "Sorry, I couldn't get that information.";
    }
  }

  /**
   * Execute automation command
   */
  async executeAutomationCommand(entities, originalText, userId) {
    try {
      // Check if user wants to create a new automation
      if (originalText.includes('create') || originalText.includes('make') || originalText.includes('set up')) {
        const automation = await this.automationEngine.createFromNaturalLanguage(originalText, userId);
        return `I've created a new automation called "${automation.name}".`;
      }

      // Check if user wants to trigger a scene or automation
      const automations = this.automationEngine.listAutomations();
      const automation = automations.find(a =>
        originalText.toLowerCase().includes(a.name.toLowerCase())
      );

      if (automation) {
        await this.automationEngine.triggerAutomation(automation.id, {
          type: 'voice',
          command: originalText
        });
        return `I've triggered the ${automation.name} automation.`;
      }

      return "I'm not sure which automation you want to run.";
    } catch (error) {
      console.error('Automation command failed:', error);
      return "Sorry, I couldn't execute that automation.";
    }
  }

  /**
   * Create voice response object
   */
  createVoiceResponse(text, userId, command, success, intent = null) {
    const db = getDatabase();

    // Log voice command
    db.prepare(`
      INSERT INTO voice_commands (user_id, command_text, intent, response, success, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, command, intent, text, success ? 1 : 0, Date.now());

    const response = {
      text,
      success,
      intent,
      timestamp: Date.now()
    };

    // Text-to-speech if enabled
    if (this.config.ttsEnabled) {
      response.audio = this.textToSpeech(text);
    }

    this.emit('response', response);
    return response;
  }

  /**
   * Convert text to speech
   */
  textToSpeech(text) {
    // In production, this would use:
    // - Google Text-to-Speech
    // - Amazon Polly
    // - Azure Speech Services
    // - Local TTS engine

    console.log(`TTS: "${text}"`);
    return null; // Would return audio buffer
  }

  /**
   * Get voice command history
   */
  getCommandHistory(userId, limit = 50) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM voice_commands
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(userId, limit);
  }

  /**
   * Get voice control statistics
   */
  getStatistics(userId = null) {
    const db = getDatabase();

    let stats = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      successRate: 0,
      byIntent: {}
    };

    const query = userId
      ? 'SELECT * FROM voice_commands WHERE user_id = ?'
      : 'SELECT * FROM voice_commands';

    const commands = userId
      ? db.prepare(query).all(userId)
      : db.prepare(query).all();

    stats.totalCommands = commands.length;
    stats.successfulCommands = commands.filter(c => c.success).length;
    stats.failedCommands = commands.filter(c => !c.success).length;
    stats.successRate = stats.totalCommands > 0
      ? (stats.successfulCommands / stats.totalCommands) * 100
      : 0;

    // Count by intent
    for (const command of commands) {
      if (command.intent) {
        stats.byIntent[command.intent] = (stats.byIntent[command.intent] || 0) + 1;
      }
    }

    return stats;
  }
}

export default VoiceControl;
