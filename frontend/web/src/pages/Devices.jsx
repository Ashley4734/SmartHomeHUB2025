import React, { useEffect, useState } from 'react';
import { useDeviceStore } from '../stores/deviceStore';
import {
  Lightbulb,
  Thermometer,
  Lock,
  Power,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Filter,
  Search,
  AlertCircle
} from 'lucide-react';

export default function Devices() {
  const { devices, fetchDevices, controlDevice, isLoading, error } = useDeviceStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || device.type === filterType;
    const matchesStatus = filterStatus === 'all' ||
                         (filterStatus === 'online' && device.online) ||
                         (filterStatus === 'offline' && !device.online);
    return matchesSearch && matchesType && matchesStatus;
  });

  const deviceTypes = [...new Set(devices.map(d => d.type))];

  const handleToggleDevice = async (device) => {
    if (device.type === 'light' || device.type === 'switch') {
      const newState = !device.state?.on;
      await controlDevice(device.id, 'toggle', { on: newState });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Devices</h1>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Device
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search devices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              {deviceTypes.map(type => (
                <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => fetchDevices()}
          className="mt-4 flex items-center gap-2 text-blue-500 hover:text-blue-600"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-gray-600">Loading devices...</p>
        </div>
      )}

      {/* Devices Grid */}
      {!isLoading && filteredDevices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDevices.map(device => (
            <DeviceCard
              key={device.id}
              device={device}
              onToggle={handleToggleDevice}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredDevices.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Lightbulb className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No devices found</h3>
          <p className="text-gray-500">
            {devices.length === 0
              ? 'Start by adding your first device'
              : 'Try adjusting your filters'}
          </p>
        </div>
      )}
    </div>
  );
}

function DeviceCard({ device, onToggle }) {
  const getDeviceIcon = (type) => {
    switch (type) {
      case 'light':
        return <Lightbulb className="w-6 h-6" />;
      case 'sensor':
      case 'temperature':
        return <Thermometer className="w-6 h-6" />;
      case 'lock':
        return <Lock className="w-6 h-6" />;
      default:
        return <Power className="w-6 h-6" />;
    }
  };

  const getDeviceColor = (type) => {
    switch (type) {
      case 'light':
        return 'bg-yellow-500';
      case 'sensor':
      case 'temperature':
        return 'bg-blue-500';
      case 'lock':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const isControllable = device.type === 'light' || device.type === 'switch';

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`${getDeviceColor(device.type)} text-white p-3 rounded-lg`}>
            {getDeviceIcon(device.type)}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{device.name}</h3>
            <p className="text-sm text-gray-500">{device.type}</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs ${device.online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
          {device.online ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Device Info */}
      <div className="space-y-2 mb-4">
        {device.manufacturer && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Manufacturer:</span>
            <span className="font-medium">{device.manufacturer}</span>
          </div>
        )}
        {device.model && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Model:</span>
            <span className="font-medium">{device.model}</span>
          </div>
        )}
        {device.room_id && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Room:</span>
            <span className="font-medium">{device.room_id}</span>
          </div>
        )}
      </div>

      {/* State Display */}
      {device.state && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          {device.type === 'light' && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`font-medium ${device.state.on ? 'text-green-600' : 'text-gray-600'}`}>
                {device.state.on ? 'On' : 'Off'}
              </span>
            </div>
          )}
          {device.type === 'sensor' && device.state.temperature !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Temperature:</span>
              <span className="font-medium">{device.state.temperature}°C</span>
            </div>
          )}
          {device.type === 'sensor' && device.state.humidity !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Humidity:</span>
              <span className="font-medium">{device.state.humidity}%</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {isControllable && device.online && (
          <button
            onClick={() => onToggle(device)}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              device.state?.on
                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {device.state?.on ? 'Turn Off' : 'Turn On'}
          </button>
        )}
        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <Edit className="w-5 h-5" />
        </button>
        <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
