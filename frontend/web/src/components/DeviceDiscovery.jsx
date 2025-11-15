import React, { useState, useEffect } from 'react';
import axiosInstance from '../services/axiosInstance';
import {
  Wifi,
  X,
  RefreshCw,
  Check,
  AlertCircle,
  Radio,
  Network,
  CheckCircle
} from 'lucide-react';

export default function DeviceDiscovery({ isOpen, onClose, onDeviceAdded }) {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [error, setError] = useState(null);
  const [pairingDevice, setPairingDevice] = useState(null);

  useEffect(() => {
    if (isOpen) {
      checkScanningStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    let interval;
    if (isScanning) {
      // Poll for discovered devices while scanning
      interval = setInterval(fetchDiscoveredDevices, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isScanning]);

  const checkScanningStatus = async () => {
    try {
      const response = await axiosInstance.get('/api/protocols/wifi/discovered');
      setIsScanning(response.data.isScanning);
      setDiscoveredDevices(response.data.devices || []);
    } catch (err) {
      console.error('Failed to check scanning status:', err);
    }
  };

  const startDiscovery = async () => {
    setError(null);
    setDiscoveredDevices([]);
    setIsScanning(true);

    try {
      await axiosInstance.post('/api/protocols/wifi/discovery/start', {
        duration: 30000 // 30 seconds
      });

      // Start polling for devices
      setTimeout(() => {
        setIsScanning(false);
        fetchDiscoveredDevices();
      }, 30000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start discovery');
      setIsScanning(false);
    }
  };

  const stopDiscovery = async () => {
    try {
      await axiosInstance.post('/api/protocols/wifi/discovery/stop');
      setIsScanning(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to stop discovery');
    }
  };

  const fetchDiscoveredDevices = async () => {
    try {
      const response = await axiosInstance.get('/api/protocols/wifi/discovered');
      setDiscoveredDevices(response.data.devices || []);
    } catch (err) {
      console.error('Failed to fetch discovered devices:', err);
    }
  };

  const pairDevice = async (device) => {
    setPairingDevice(device.id);
    setError(null);

    try {
      const response = await axiosInstance.post('/api/protocols/wifi/pair', {
        deviceId: device.id,
        name: device.name,
        type: device.type
      });

      // Remove from discovered list
      setDiscoveredDevices(discoveredDevices.filter(d => d.id !== device.id));

      // Notify parent
      if (onDeviceAdded) {
        onDeviceAdded(response.data.device);
      }

      setPairingDevice(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to pair device');
      setPairingDevice(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 text-white p-2 rounded-lg">
              <Wifi className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Discover WiFi Devices</h2>
              <p className="text-sm text-gray-600">
                Find and add WiFi/MQTT IoT devices on your network
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Controls */}
          <div className="mb-6">
            <div className="flex items-center gap-4">
              {!isScanning ? (
                <button
                  onClick={startDiscovery}
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 flex items-center gap-2 font-medium"
                >
                  <Radio className="w-5 h-5" />
                  Start Scanning
                </button>
              ) : (
                <button
                  onClick={stopDiscovery}
                  className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 flex items-center gap-2 font-medium"
                >
                  <X className="w-5 h-5" />
                  Stop Scanning
                </button>
              )}

              <div className="flex items-center gap-2 text-sm">
                {isScanning && (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                    <span className="text-gray-600">Scanning network...</span>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Network className="w-4 h-4" />
                Supported Devices
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• MQTT devices (Home Assistant, Tasmota, ESPHome)</li>
                <li>• HomeKit devices</li>
                <li>• Shelly smart switches</li>
                <li>• ESP8266/ESP32 devices</li>
                <li>• Other mDNS-enabled IoT devices</li>
              </ul>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Discovered Devices */}
          {discoveredDevices.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-700 mb-3">
                Found {discoveredDevices.length} device{discoveredDevices.length !== 1 ? 's' : ''}
              </h3>
              {discoveredDevices.map((device) => (
                <DiscoveredDeviceCard
                  key={device.id}
                  device={device}
                  onPair={pairDevice}
                  isPairing={pairingDevice === device.id}
                />
              ))}
            </div>
          ) : !isScanning ? (
            <div className="text-center py-12">
              <Wifi className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No devices found
              </h3>
              <p className="text-gray-500">
                Click "Start Scanning" to search for WiFi devices on your network
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DiscoveredDeviceCard({ device, onPair, isPairing }) {
  const getDeviceIcon = (type) => {
    // Return appropriate icon based on device type
    return <Network className="w-5 h-5" />;
  };

  const getDiscoveryBadge = (method) => {
    const badges = {
      'mdns': { label: 'mDNS', color: 'bg-purple-100 text-purple-800' },
      'mqtt_ha': { label: 'MQTT (HA)', color: 'bg-blue-100 text-blue-800' },
      'mqtt_tasmota': { label: 'Tasmota', color: 'bg-green-100 text-green-800' },
      'mqtt_esphome': { label: 'ESPHome', color: 'bg-orange-100 text-orange-800' }
    };

    const badge = badges[method] || { label: method, color: 'bg-gray-100 text-gray-800' };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gray-100 p-2 rounded-lg text-gray-600">
              {getDeviceIcon(device.type)}
            </div>
            <div>
              <h4 className="font-semibold text-lg">{device.name}</h4>
              <p className="text-sm text-gray-500 capitalize">{device.type}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm mt-3">
            {device.manufacturer && (
              <div>
                <span className="text-gray-500">Manufacturer:</span>
                <span className="ml-2 font-medium">{device.manufacturer}</span>
              </div>
            )}
            {device.model && (
              <div>
                <span className="text-gray-500">Model:</span>
                <span className="ml-2 font-medium">{device.model}</span>
              </div>
            )}
            {device.ipAddress && (
              <div>
                <span className="text-gray-500">IP Address:</span>
                <span className="ml-2 font-medium font-mono">{device.ipAddress}</span>
              </div>
            )}
            <div>
              {getDiscoveryBadge(device.discoveryMethod)}
            </div>
          </div>
        </div>

        <button
          onClick={() => onPair(device)}
          disabled={isPairing}
          className="ml-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isPairing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Pairing...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Add Device
            </>
          )}
        </button>
      </div>
    </div>
  );
}
