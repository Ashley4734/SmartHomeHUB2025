/**
 * WiFi/MQTT Protocol Handler
 * Supports WiFi-based IoT devices including MQTT devices and network discovery
 */

import mqtt from 'mqtt';
import mdns from 'mdns-js';
import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

class WiFiProtocol extends EventEmitter {
  constructor(deviceManager) {
    super();
    this.deviceManager = deviceManager;
    this.mqttClient = null;
    this.mdnsBrowser = null;
    this.discoveredDevices = new Map();
    this.connectedDevices = new Map();
    this.isScanning = false;
  }

  /**
   * Start WiFi protocol handler
   */
  async start() {
    try {
      logger.info('Starting WiFi protocol handler...');

      // Connect to MQTT broker if configured
      const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
      const mqttUsername = process.env.MQTT_USERNAME;
      const mqttPassword = process.env.MQTT_PASSWORD;

      const options = {
        clientId: `smarthome_hub_${uuidv4()}`,
        clean: true,
        reconnectPeriod: 5000
      };

      if (mqttUsername && mqttPassword) {
        options.username = mqttUsername;
        options.password = mqttPassword;
      }

      this.mqttClient = mqtt.connect(mqttBrokerUrl, options);

      this.mqttClient.on('connect', () => {
        logger.info('Connected to MQTT broker');
        // Subscribe to device discovery topics
        this.mqttClient.subscribe('homeassistant/+/+/config');
        this.mqttClient.subscribe('tasmota/discovery/#');
        this.mqttClient.subscribe('espHome/#');
      });

      this.mqttClient.on('message', (topic, message) => {
        this.handleMqttMessage(topic, message);
      });

      this.mqttClient.on('error', (error) => {
        logger.error('MQTT connection error:', error);
      });

      // Setup mDNS browser for device discovery
      this.setupMdnsDiscovery();

      logger.info('WiFi protocol handler started');
    } catch (error) {
      logger.error('Failed to start WiFi protocol:', error);
      throw error;
    }
  }

  /**
   * Setup mDNS/Bonjour discovery for WiFi devices
   */
  setupMdnsDiscovery() {
    try {
      // Discover various IoT device types
      const serviceTypes = [
        { name: '_http._tcp', description: 'HTTP devices' },
        { name: '_mqtt._tcp', description: 'MQTT devices' },
        { name: '_hap._tcp', description: 'HomeKit devices' },
        { name: '_homekit._tcp', description: 'HomeKit devices' },
        { name: '_esphomelib._tcp', description: 'ESPHome devices' },
        { name: '_arduino._tcp', description: 'Arduino devices' }
      ];

      serviceTypes.forEach(({ name }) => {
        try {
          const browser = mdns.createBrowser(name);

          browser.on('ready', () => {
            logger.info(`mDNS browser ready for ${name}`);
            browser.discover();
          });

          browser.on('update', (data) => {
            this.handleMdnsDevice(data);
          });
        } catch (err) {
          logger.warn(`Failed to create mDNS browser for ${name}:`, err.message);
        }
      });
    } catch (error) {
      logger.error('Failed to setup mDNS discovery:', error);
    }
  }

  /**
   * Handle discovered mDNS device
   */
  handleMdnsDevice(data) {
    try {
      const deviceId = `wifi_${data.host || data.fullname}`;

      if (!this.discoveredDevices.has(deviceId)) {
        const device = {
          id: deviceId,
          name: data.host || data.fullname || 'Unknown WiFi Device',
          type: this.detectDeviceType(data),
          protocol: 'wifi',
          ipAddress: data.addresses?.[0] || data.address,
          port: data.port,
          manufacturer: this.detectManufacturer(data),
          model: data.txt?.md || 'Unknown',
          discoveryMethod: 'mdns',
          serviceType: data.type?.[0] || 'unknown',
          rawData: data,
          discoveredAt: Date.now()
        };

        this.discoveredDevices.set(deviceId, device);
        this.emit('device:discovered', device);
        logger.info(`Discovered WiFi device via mDNS: ${device.name} (${device.ipAddress})`);
      }
    } catch (error) {
      logger.error('Error handling mDNS device:', error);
    }
  }

  /**
   * Handle MQTT message
   */
  handleMqttMessage(topic, message) {
    try {
      const payload = message.toString();

      // Home Assistant MQTT Discovery
      if (topic.startsWith('homeassistant/')) {
        this.handleHomeAssistantDiscovery(topic, payload);
      }

      // Tasmota Discovery
      else if (topic.startsWith('tasmota/discovery/')) {
        this.handleTasmotaDiscovery(topic, payload);
      }

      // ESPHome Discovery
      else if (topic.startsWith('espHome/')) {
        this.handleEspHomeDiscovery(topic, payload);
      }
    } catch (error) {
      logger.error('Error handling MQTT message:', error);
    }
  }

  /**
   * Handle Home Assistant MQTT Discovery
   */
  handleHomeAssistantDiscovery(topic, payload) {
    try {
      const config = JSON.parse(payload);
      const parts = topic.split('/');
      const component = parts[1]; // light, switch, sensor, etc.
      const objectId = parts[2];

      const deviceId = `mqtt_${config.unique_id || objectId}`;

      if (!this.discoveredDevices.has(deviceId)) {
        const device = {
          id: deviceId,
          name: config.name || objectId,
          type: component,
          protocol: 'mqtt',
          manufacturer: config.device?.manufacturer || 'Unknown',
          model: config.device?.model || 'Unknown',
          discoveryMethod: 'mqtt_ha',
          mqttTopics: {
            command: config.command_topic,
            state: config.state_topic,
            availability: config.availability_topic
          },
          config: config,
          discoveredAt: Date.now()
        };

        this.discoveredDevices.set(deviceId, device);
        this.emit('device:discovered', device);
        logger.info(`Discovered MQTT device (HA): ${device.name}`);
      }
    } catch (error) {
      logger.error('Error handling Home Assistant discovery:', error);
    }
  }

  /**
   * Handle Tasmota Discovery
   */
  handleTasmotaDiscovery(topic, payload) {
    try {
      const config = JSON.parse(payload);
      const deviceId = `mqtt_tasmota_${config.t || config.topic}`;

      if (!this.discoveredDevices.has(deviceId)) {
        const device = {
          id: deviceId,
          name: config.fn?.[0] || config.dn || 'Tasmota Device',
          type: 'switch',
          protocol: 'mqtt',
          manufacturer: 'Tasmota',
          model: config.ty || 'Unknown',
          discoveryMethod: 'mqtt_tasmota',
          mqttTopics: {
            command: `cmnd/${config.t}/POWER`,
            state: `stat/${config.t}/POWER`,
            telemetry: `tele/${config.t}/SENSOR`
          },
          config: config,
          discoveredAt: Date.now()
        };

        this.discoveredDevices.set(deviceId, device);
        this.emit('device:discovered', device);
        logger.info(`Discovered Tasmota device: ${device.name}`);
      }
    } catch (error) {
      logger.error('Error handling Tasmota discovery:', error);
    }
  }

  /**
   * Handle ESPHome Discovery
   */
  handleEspHomeDiscovery(topic, payload) {
    try {
      const parts = topic.split('/');
      const deviceName = parts[1];
      const deviceId = `mqtt_esphome_${deviceName}`;

      if (!this.discoveredDevices.has(deviceId)) {
        const device = {
          id: deviceId,
          name: deviceName,
          type: 'sensor',
          protocol: 'mqtt',
          manufacturer: 'ESPHome',
          model: 'ESP Device',
          discoveryMethod: 'mqtt_esphome',
          mqttTopics: {
            state: topic
          },
          discoveredAt: Date.now()
        };

        this.discoveredDevices.set(deviceId, device);
        this.emit('device:discovered', device);
        logger.info(`Discovered ESPHome device: ${device.name}`);
      }
    } catch (error) {
      logger.error('Error handling ESPHome discovery:', error);
    }
  }

  /**
   * Start network scan for WiFi devices
   */
  async startDiscovery(duration = 30000) {
    logger.info(`Starting WiFi device discovery for ${duration}ms...`);
    this.isScanning = true;
    this.discoveredDevices.clear();

    // Trigger mDNS discovery
    if (this.mdnsBrowser) {
      this.mdnsBrowser.discover();
    }

    // Wait for discovery duration
    return new Promise((resolve) => {
      setTimeout(() => {
        this.isScanning = false;
        const devices = Array.from(this.discoveredDevices.values());
        logger.info(`Discovery completed. Found ${devices.length} devices`);
        resolve(devices);
      }, duration);
    });
  }

  /**
   * Stop discovery
   */
  stopDiscovery() {
    this.isScanning = false;
    logger.info('WiFi device discovery stopped');
  }

  /**
   * Add/pair a discovered device
   */
  async pairDevice(deviceId, config = {}) {
    const discoveredDevice = this.discoveredDevices.get(deviceId);
    if (!discoveredDevice) {
      throw new Error('Device not found in discovery list');
    }

    try {
      // Create device in device manager
      const device = await this.deviceManager.registerDevice({
        name: config.name || discoveredDevice.name,
        type: config.type || discoveredDevice.type,
        protocol: 'wifi',
        manufacturer: discoveredDevice.manufacturer,
        model: discoveredDevice.model,
        ipAddress: discoveredDevice.ipAddress,
        metadata: {
          discoveryMethod: discoveredDevice.discoveryMethod,
          mqttTopics: discoveredDevice.mqttTopics,
          serviceType: discoveredDevice.serviceType,
          config: discoveredDevice.config
        }
      });

      // Subscribe to MQTT topics if it's an MQTT device
      if (discoveredDevice.mqttTopics) {
        this.subscribeToDevice(device.id, discoveredDevice.mqttTopics);
      }

      this.connectedDevices.set(device.id, device);
      logger.info(`Paired WiFi device: ${device.name}`);

      return device;
    } catch (error) {
      logger.error('Failed to pair device:', error);
      throw error;
    }
  }

  /**
   * Subscribe to MQTT topics for a device
   */
  subscribeToDevice(deviceId, topics) {
    if (!this.mqttClient || !this.mqttClient.connected) {
      return;
    }

    if (topics.state) {
      this.mqttClient.subscribe(topics.state);
    }
    if (topics.availability) {
      this.mqttClient.subscribe(topics.availability);
    }
    if (topics.telemetry) {
      this.mqttClient.subscribe(topics.telemetry);
    }

    logger.info(`Subscribed to MQTT topics for device ${deviceId}`);
  }

  /**
   * Control WiFi/MQTT device
   */
  async controlDevice(deviceId, command, parameters) {
    const device = this.connectedDevices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    const topics = device.metadata?.mqttTopics;
    if (!topics || !topics.command) {
      throw new Error('Device does not support MQTT control');
    }

    let payload;

    // Build command payload based on device type
    switch (command) {
      case 'toggle':
      case 'turn_on':
        payload = parameters.on ? 'ON' : 'OFF';
        break;
      case 'set_brightness':
        payload = JSON.stringify({ brightness: parameters.brightness });
        break;
      case 'set_color':
        payload = JSON.stringify({ color: parameters.color });
        break;
      default:
        payload = JSON.stringify(parameters);
    }

    return new Promise((resolve, reject) => {
      this.mqttClient.publish(topics.command, payload, (error) => {
        if (error) {
          logger.error(`Failed to send command to ${deviceId}:`, error);
          reject(error);
        } else {
          logger.info(`Command sent to ${deviceId}: ${command}`);
          resolve({ success: true });
        }
      });
    });
  }

  /**
   * Detect device type from mDNS data
   */
  detectDeviceType(data) {
    const serviceType = data.type?.[0] || '';
    const name = (data.host || data.fullname || '').toLowerCase();

    if (name.includes('light') || name.includes('bulb')) return 'light';
    if (name.includes('switch') || name.includes('plug')) return 'switch';
    if (name.includes('sensor') || name.includes('temperature')) return 'sensor';
    if (name.includes('camera')) return 'camera';
    if (name.includes('lock')) return 'lock';
    if (serviceType.includes('hap')) return 'homekit';

    return 'unknown';
  }

  /**
   * Detect manufacturer from mDNS data
   */
  detectManufacturer(data) {
    const name = (data.host || data.fullname || '').toLowerCase();
    const txt = data.txt || {};

    if (name.includes('shelly')) return 'Shelly';
    if (name.includes('tasmota')) return 'Tasmota';
    if (name.includes('esphome')) return 'ESPHome';
    if (name.includes('sonoff')) return 'Sonoff';
    if (name.includes('tuya')) return 'Tuya';
    if (txt.md?.includes('Philips')) return 'Philips Hue';

    return 'Unknown';
  }

  /**
   * Get list of discovered devices
   */
  getDiscoveredDevices() {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Stop WiFi protocol handler
   */
  async stop() {
    logger.info('Stopping WiFi protocol handler...');

    if (this.mqttClient) {
      this.mqttClient.end();
    }

    if (this.mdnsBrowser) {
      // mDNS cleanup if needed
    }

    this.isScanning = false;
    logger.info('WiFi protocol handler stopped');
  }
}

export default WiFiProtocol;
