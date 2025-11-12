import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Home, Cpu, Zap, Mic, Settings, LogOut } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuthStore();

  const navItems = [
    { to: '/', icon: <Home className="w-5 h-5" />, label: 'Dashboard' },
    { to: '/devices', icon: <Cpu className="w-5 h-5" />, label: 'Devices' },
    { to: '/automations', icon: <Zap className="w-5 h-5" />, label: 'Automations' },
    { to: '/voice', icon: <Mic className="w-5 h-5" />, label: 'Voice' },
    { to: '/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600">Smart Home Hub</h1>
        </div>

        <nav className="px-4 space-y-2">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{user?.username}</p>
              <p className="text-xs text-gray-500">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-600 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        <Outlet />
      </main>
    </div>
  );
}
