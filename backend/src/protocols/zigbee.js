/**
 * Zigbee Protocol Integration
 * Uses zigbee-herdsman for direct Zigbee communication
 */

import ZigbeeHerdsman from 'zigbee-herdsman';
import EventEmitter from 'events';
import path from 'path';
import fs from 'fs';

class ZigbeeProtocol extends EventEmitter {
  constructor(deviceManager) {
    super();
    this.deviceManager = deviceManager;
    this.controller = null;
    this.permitJoinTimeout = null;
    this.isStarted = false;

    // Ensure data directory exists
    const dataPath = './backend/data/zigbee';
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }

    this.config = {
      serialPort: {
        path: process.env.ZIGBEE_PORT || '/dev/ttyUSB0',
        adapter: process.env.ZIGBEE_ADAPTER || 'zStack3x0'
      },
      databasePath: path.join(dataPath, 'database.db'),
      databaseBackupPath: path.join(dataPath, 'database.db.backup'),
      network: {
        panID: parseInt(process.env.ZIGBEE_PAN_ID || '0x1a62'),
        channelList: [parseInt(process.env.ZIGBEE_CHANNEL || '11')],
        extendedPanID: [0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD],
        networkKey: [0x01, 0x03, 0x05, 0x07, 0x09, 0x0B, 0x0D, 0x0F, 0x00, 0x02, 0x04, 0x06, 0x08, 0x0A, 0x0C, 0x0D]
      },
      acceptJoiningDeviceHandler: (ieeeAddr) => {
        console.log(`Device ${ieeeAddr} wants to join`);
        return true;
      }
    };

    // Listen to device manager control events
    this.deviceManager.on('device:control', this.handleDeviceControl.bind(this));
  }

  /**
   * Start Zigbee controller
   */
  async start() {
    if (this.isStarted) {
      console.log('Zigbee controller already started');
      return;
    }

    try {
      console.log('Starting Zigbee controller...');
      console.log(`Serial port: ${this.config.serialPort.path}`);

      this.controller = new ZigbeeHerdsman.Controller(this.config);

      // Register event handlers
      this.controller.on('deviceJoined', this.onDeviceJoined.bind(this));
      this.controller.on('deviceLeave', this.onDeviceLeave.bind(this));
      this.controller.on('message', this.onMessage.bind(this));
      this.controller.on('deviceAnnounce', this.onDeviceAnnounce.bind(this));

      // Start controller
      await this.controller.start();
      this.isStarted = true;

      console.log('✓ Zigbee controller started successfully');

      // Load existing devices
      await this.loadExistingDevices();

      this.emit('ready');
    } catch (error) {
      console.error('Failed to start Zigbee controller:', error);
      throw error;
    }
  }

  /**
   * Stop Zigbee controller
   */
  async stop() {
    if (this.controller) {
      await this.controller.stop();
      this.isStarted = false;
      console.log('✓ Zigbee controller stopped');
    }
  }

  /**
   * Load existing Zigbee devices
   */
  async loadExistingDevices() {
    const devices = this.controller.getDevices();
    console.log(`Found ${devices.length} Zigbee devices`);

    for (const device of devices) {
      if (device.type === 'Coordinator') continue;

      const existing = this.deviceManager.getDeviceByIeeeAddress(device.ieeeAddr);
      if (!existing) {
        await this.registerDevice(device);
      }
    }
  }

  /**
   * Enable device pairing
   */
  async permitJoin(duration = 60) {
    if (!this.controller) {
      throw new Error('Zigbee controller not started');
    }

    await this.controller.permitJoin(true);
    console.log(`✓ Zigbee pairing enabled for ${duration} seconds`);

    // Auto-disable after duration
    if (this.permitJoinTimeout) {
      clearTimeout(this.permitJoinTimeout);
    }

    this.permitJoinTimeout = setTimeout(async () => {
      await this.controller.permitJoin(false);
      console.log('✓ Zigbee pairing disabled');
      this.emit('permitJoinChanged', false);
    }, duration * 1000);

    this.emit('permitJoinChanged', true);
    return true;
  }

  /**
   * Disable device pairing
   */
  async stopPermitJoin() {
    if (!this.controller) return;

    if (this.permitJoinTimeout) {
      clearTimeout(this.permitJoinTimeout);
      this.permitJoinTimeout = null;
    }

    await this.controller.permitJoin(false);
    console.log('✓ Zigbee pairing disabled');
    this.emit('permitJoinChanged', false);
  }

  /**
   * Handle device joined event
   */
  async onDeviceJoined(device) {
    console.log(`Device joined: ${device.ieeeAddr}`);
    await this.registerDevice(device);
  }

  /**
   * Handle device leave event
   */
  onDeviceLeave(event) {
    console.log(`Device left: ${event.ieeeAddr}`);
    const device = this.deviceManager.getDeviceByIeeeAddress(event.ieeeAddr);
    if (device) {
      this.deviceManager.markDeviceOffline(device.id);
    }
  }

  /**
   * Handle device announce event
   */
  onDeviceAnnounce(event) {
    console.log(`Device announced: ${event.device.ieeeAddr}`);
    const device = this.deviceManager.getDeviceByIeeeAddress(event.device.ieeeAddr);
    if (device) {
      this.deviceManager.markDeviceOnline(device.id);
    }
  }

  /**
   * Handle incoming messages from devices
   */
  async onMessage(message) {
    const { device, endpoint, type, cluster, data } = message;

    // Skip coordinator messages
    if (device.type === 'Coordinator') return;

    const managedDevice = this.deviceManager.getDeviceByIeeeAddress(device.ieeeAddr);
    if (!managedDevice) return;

    // Parse state changes
    const state = this.parseZigbeeMessage(cluster, data, managedDevice);
    if (state && Object.keys(state).length > 0) {
      this.deviceManager.updateDeviceState(managedDevice.id, state);
    }
  }

  /**
   * Parse Zigbee message to device state
   */
  parseZigbeeMessage(cluster, data, device) {
    const state = {};

    switch (cluster) {
      case 'genOnOff':
        if (data.onOff !== undefined) {
          state.state = data.onOff === 1 ? 'ON' : 'OFF';
        }
        break;

      case 'genLevelCtrl':
        if (data.currentLevel !== undefined) {
          state.brightness = Math.round((data.currentLevel / 254) * 100);
        }
        break;

      case 'lightingColorCtrl':
        if (data.colorTemperature !== undefined) {
          state.colorTemp = data.colorTemperature;
        }
        if (data.currentX !== undefined && data.currentY !== undefined) {
          state.color = { x: data.currentX, y: data.currentY };
        }
        break;

      case 'msTemperatureMeasurement':
        if (data.measuredValue !== undefined) {
          state.temperature = data.measuredValue / 100;
        }
        break;

      case 'msRelativeHumidity':
        if (data.measuredValue !== undefined) {
          state.humidity = data.measuredValue / 100;
        }
        break;

      case 'msOccupancySensing':
        if (data.occupancy !== undefined) {
          state.occupancy = data.occupancy === 1;
        }
        break;

      case 'msIlluminanceMeasurement':
        if (data.measuredValue !== undefined) {
          state.illuminance = Math.pow(10, (data.measuredValue - 1) / 10000);
        }
        break;
    }

    return state;
  }

  /**
   * Register Zigbee device
   */
  async registerDevice(zigbeeDevice) {
    const capabilities = this.extractCapabilities(zigbeeDevice);
    const deviceType = this.determineDeviceType(zigbeeDevice, capabilities);

    const device = this.deviceManager.registerDevice({
      name: zigbeeDevice.modelID || `Zigbee Device ${zigbeeDevice.ieeeAddr.slice(-4)}`,
      type: deviceType,
      protocol: 'zigbee',
      ieeeAddress: zigbeeDevice.ieeeAddr,
      model: zigbeeDevice.modelID,
      manufacturer: zigbeeDevice.manufacturerName,
      firmwareVersion: zigbeeDevice.softwareBuildID,
      capabilities: capabilities,
      metadata: {
        networkAddress: zigbeeDevice.networkAddress,
        powerSource: zigbeeDevice.powerSource,
        interviewCompleted: zigbeeDevice.interviewCompleted
      }
    });

    console.log(`✓ Registered Zigbee device: ${device.name}`);
    this.emit('device:registered', device);
    return device;
  }

  /**
   * Extract device capabilities from Zigbee device
   */
  extractCapabilities(zigbeeDevice) {
    const capabilities = [];
    const endpoints = zigbeeDevice.endpoints || [];

    for (const endpoint of endpoints) {
      const clusters = [
        ...(endpoint.inputClusters || []),
        ...(endpoint.outputClusters || [])
      ];

      if (clusters.includes(6)) capabilities.push('on_off'); // genOnOff
      if (clusters.includes(8)) capabilities.push('brightness'); // genLevelCtrl
      if (clusters.includes(768)) capabilities.push('color'); // lightingColorCtrl
      if (clusters.includes(1026)) capabilities.push('temperature'); // msTemperatureMeasurement
      if (clusters.includes(1029)) capabilities.push('humidity'); // msRelativeHumidity
      if (clusters.includes(1030)) capabilities.push('pressure'); // msPressureMeasurement
      if (clusters.includes(1024)) capabilities.push('illuminance'); // msIlluminanceMeasurement
      if (clusters.includes(1280)) capabilities.push('occupancy'); // msOccupancySensing
    }

    return [...new Set(capabilities)];
  }

  /**
   * Determine device type
   */
  determineDeviceType(zigbeeDevice, capabilities) {
    if (capabilities.includes('on_off') && capabilities.includes('brightness')) {
      return 'light';
    } else if (capabilities.includes('on_off')) {
      return 'switch';
    } else if (capabilities.includes('temperature') || capabilities.includes('humidity')) {
      return 'sensor';
    } else if (capabilities.includes('occupancy')) {
      return 'motion_sensor';
    }
    return 'unknown';
  }

  /**
   * Handle device control commands
   */
  async handleDeviceControl(event) {
    const { deviceId, device, command, parameters } = event;

    // Only handle Zigbee devices
    if (device.protocol !== 'zigbee') return;

    try {
      const zigbeeDevice = this.controller.getDeviceByIeeeAddr(device.ieee_address);
      if (!zigbeeDevice) {
        throw new Error(`Zigbee device not found: ${device.ieee_address}`);
      }

      const endpoint = zigbeeDevice.endpoints[0];

      switch (command) {
        case 'turn_on':
          await endpoint.command('genOnOff', 'on', {});
          this.deviceManager.updateDeviceState(deviceId, { state: 'ON' });
          break;

        case 'turn_off':
          await endpoint.command('genOnOff', 'off', {});
          this.deviceManager.updateDeviceState(deviceId, { state: 'OFF' });
          break;

        case 'toggle':
          await endpoint.command('genOnOff', 'toggle', {});
          const currentState = device.state.state === 'ON' ? 'OFF' : 'ON';
          this.deviceManager.updateDeviceState(deviceId, { state: currentState });
          break;

        case 'set_brightness':
          const level = Math.round((parameters.brightness / 100) * 254);
          await endpoint.command('genLevelCtrl', 'moveToLevel', { level, transtime: 0 });
          this.deviceManager.updateDeviceState(deviceId, { brightness: parameters.brightness });
          break;

        case 'set_color_temp':
          await endpoint.command('lightingColorCtrl', 'moveToColorTemp', {
            colortemp: parameters.colorTemp,
            transtime: 0
          });
          this.deviceManager.updateDeviceState(deviceId, { colorTemp: parameters.colorTemp });
          break;

        default:
          console.warn(`Unknown Zigbee command: ${command}`);
      }

      console.log(`✓ Executed Zigbee command ${command} on device ${device.name}`);
    } catch (error) {
      console.error(`Failed to control Zigbee device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Remove device from network
   */
  async removeDevice(ieeeAddress) {
    const zigbeeDevice = this.controller.getDeviceByIeeeAddr(ieeeAddress);
    if (zigbeeDevice) {
      await zigbeeDevice.removeFromNetwork();
      console.log(`✓ Removed Zigbee device: ${ieeeAddress}`);
    }
  }
}

export default ZigbeeProtocol;
