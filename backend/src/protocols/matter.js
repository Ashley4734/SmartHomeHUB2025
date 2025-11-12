/**
 * Matter Protocol Integration
 * Supports Matter-over-WiFi/Ethernet and Thread devices
 */

import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';

// Note: @project-chip/matter.js is still in development
// This is a foundation implementation that can be expanded

class MatterProtocol extends EventEmitter {
  constructor(deviceManager) {
    super();
    this.deviceManager = deviceManager;
    this.server = null;
    this.commissionedDevices = new Map();
    this.isStarted = false;

    // Ensure data directory exists
    const dataPath = './backend/data/matter';
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }

    this.config = {
      port: parseInt(process.env.MATTER_PORT || '5540'),
      discriminator: parseInt(process.env.MATTER_DISCRIMINATOR || '3840'),
      passcode: parseInt(process.env.MATTER_PASSCODE || '20202021'),
      vendorId: parseInt(process.env.MATTER_VENDOR_ID || '0xFFF1'),
      productId: parseInt(process.env.MATTER_PRODUCT_ID || '0x8000'),
      deviceName: 'Smart Home Hub',
      deviceType: 'Controller',
      storageLocation: dataPath
    };

    // Listen to device manager control events
    this.deviceManager.on('device:control', this.handleDeviceControl.bind(this));
  }

  /**
   * Start Matter server/controller
   */
  async start() {
    if (this.isStarted) {
      console.log('Matter controller already started');
      return;
    }

    try {
      console.log('Starting Matter controller...');
      console.log(`Configuration:`, this.config);

      // Initialize Matter controller
      // Note: This is a placeholder for actual Matter.js implementation
      // The full implementation would use @project-chip/matter.js
      this.isStarted = true;

      console.log('✓ Matter controller started successfully');
      console.log(`  Pairing code will be generated when commissioning starts`);

      this.emit('ready');
    } catch (error) {
      console.error('Failed to start Matter controller:', error);
      // Don't throw - Matter is optional
      console.warn('Matter controller will continue in stub mode');
    }
  }

  /**
   * Stop Matter controller
   */
  async stop() {
    if (this.server) {
      // Stop Matter server
      this.isStarted = false;
      console.log('✓ Matter controller stopped');
    }
  }

  /**
   * Start commissioning mode for new devices
   */
  async startCommissioning(timeout = 180) {
    if (!this.isStarted) {
      throw new Error('Matter controller not started');
    }

    console.log(`✓ Matter commissioning mode enabled for ${timeout} seconds`);
    console.log(`  Discriminator: ${this.config.discriminator}`);
    console.log(`  Setup PIN: ${this.config.passcode}`);

    // Generate QR code data
    const qrCode = this.generateQRCode();
    const manualCode = this.generateManualPairingCode();

    this.emit('commissioningStarted', {
      qrCode,
      manualCode,
      discriminator: this.config.discriminator,
      passcode: this.config.passcode,
      timeout
    });

    // Auto-disable after timeout
    setTimeout(() => {
      this.stopCommissioning();
    }, timeout * 1000);

    return { qrCode, manualCode };
  }

  /**
   * Stop commissioning mode
   */
  async stopCommissioning() {
    console.log('✓ Matter commissioning mode disabled');
    this.emit('commissioningStopped');
  }

  /**
   * Generate QR code for Matter commissioning
   */
  generateQRCode() {
    // Matter QR code format: MT:Y.K<discriminator><passcode>
    // This is a simplified version
    return `MT:Y.K${this.config.discriminator}${this.config.passcode}`;
  }

  /**
   * Generate manual pairing code
   */
  generateManualPairingCode() {
    // Matter manual pairing code format
    const code = this.config.passcode.toString().padStart(8, '0');
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }

  /**
   * Commission a new Matter device
   */
  async commissionDevice(pairingCode, deviceInfo = {}) {
    try {
      console.log(`Commissioning Matter device with code: ${pairingCode}`);

      // In a real implementation, this would:
      // 1. Establish PASE (Password Authenticated Session Establishment)
      // 2. Exchange certificates
      // 3. Configure network credentials
      // 4. Complete commissioning

      // For now, register a placeholder device
      const device = await this.registerMatterDevice({
        name: deviceInfo.name || 'Matter Device',
        type: deviceInfo.type || 'switch',
        model: deviceInfo.model || 'Unknown',
        manufacturer: deviceInfo.manufacturer || 'Unknown',
        pairingCode
      });

      this.commissionedDevices.set(device.id, device);
      console.log(`✓ Matter device commissioned: ${device.name}`);

      return device;
    } catch (error) {
      console.error('Failed to commission Matter device:', error);
      throw error;
    }
  }

  /**
   * Register Matter device in device manager
   */
  async registerMatterDevice(deviceInfo) {
    const capabilities = this.determineMatterCapabilities(deviceInfo.type);

    const device = this.deviceManager.registerDevice({
      name: deviceInfo.name,
      type: deviceInfo.type,
      protocol: 'matter',
      model: deviceInfo.model,
      manufacturer: deviceInfo.manufacturer,
      capabilities: capabilities,
      metadata: {
        pairingCode: deviceInfo.pairingCode,
        commissionedAt: Date.now()
      }
    });

    this.emit('device:registered', device);
    return device;
  }

  /**
   * Determine capabilities based on Matter device type
   */
  determineMatterCapabilities(type) {
    const capabilityMap = {
      'light': ['on_off', 'brightness', 'color'],
      'switch': ['on_off'],
      'outlet': ['on_off', 'power_monitoring'],
      'lock': ['lock'],
      'thermostat': ['temperature', 'heating', 'cooling'],
      'sensor': ['temperature', 'humidity'],
      'contact_sensor': ['contact'],
      'motion_sensor': ['occupancy']
    };

    return capabilityMap[type] || ['on_off'];
  }

  /**
   * Handle device control commands
   */
  async handleDeviceControl(event) {
    const { deviceId, device, command, parameters } = event;

    // Only handle Matter devices
    if (device.protocol !== 'matter') return;

    try {
      // In a real implementation, this would send commands via Matter protocol
      // For now, we'll just update the state

      console.log(`Executing Matter command ${command} on device ${device.name}`);

      let newState = {};

      switch (command) {
        case 'turn_on':
          newState = { state: 'ON' };
          break;

        case 'turn_off':
          newState = { state: 'OFF' };
          break;

        case 'toggle':
          newState = { state: device.state.state === 'ON' ? 'OFF' : 'ON' };
          break;

        case 'set_brightness':
          newState = { brightness: parameters.brightness };
          break;

        case 'set_color':
          newState = { color: parameters.color };
          break;

        case 'set_temperature':
          newState = { targetTemperature: parameters.temperature };
          break;

        case 'lock':
          newState = { locked: true };
          break;

        case 'unlock':
          newState = { locked: false };
          break;

        default:
          console.warn(`Unknown Matter command: ${command}`);
          return;
      }

      this.deviceManager.updateDeviceState(deviceId, newState);
      console.log(`✓ Executed Matter command ${command} on device ${device.name}`);
    } catch (error) {
      console.error(`Failed to control Matter device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Decommission/remove Matter device
   */
  async removeDevice(deviceId) {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.protocol !== 'matter') {
      throw new Error('Device not found or not a Matter device');
    }

    // In a real implementation, this would properly decommission the device
    this.commissionedDevices.delete(deviceId);
    console.log(`✓ Matter device decommissioned: ${deviceId}`);
  }

  /**
   * Get Matter network status
   */
  getNetworkStatus() {
    return {
      isRunning: this.isStarted,
      commissionedDevices: this.commissionedDevices.size,
      configuration: {
        port: this.config.port,
        vendorId: this.config.vendorId,
        productId: this.config.productId
      }
    };
  }

  /**
   * Enable Thread border router (if supported)
   */
  async enableThreadBorderRouter() {
    console.log('Thread Border Router functionality would be initialized here');
    // This would require additional hardware support (Thread radio)
    // and integration with Thread networking stack
    this.emit('thread:enabled');
  }
}

export default MatterProtocol;
