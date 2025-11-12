import React, { useEffect } from 'react';
import { useDeviceStore } from '../stores/deviceStore';
import { Home, Lightbulb, Thermometer, Activity } from 'lucide-react';

export default function Dashboard() {
  const { devices, fetchDevices } = useDeviceStore();

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const stats = {
    total: devices.length,
    online: devices.filter(d => d.online).length,
    lights: devices.filter(d => d.type === 'light').length,
    sensors: devices.filter(d => d.type === 'sensor').length
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Devices"
          value={stats.total}
          icon={<Home className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Online"
          value={stats.online}
          icon={<Activity className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Lights"
          value={stats.lights}
          icon={<Lightbulb className="w-6 h-6" />}
          color="yellow"
        />
        <StatCard
          title="Sensors"
          value={stats.sensors}
          icon={<Thermometer className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Recent Devices */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Devices</h2>
        <div className="space-y-2">
          {devices.slice(0, 5).map(device => (
            <div key={device.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium">{device.name}</p>
                <p className="text-sm text-gray-500">{device.type}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm ${device.online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {device.online ? 'Online' : 'Offline'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className={`${colors[color]} text-white p-3 rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
