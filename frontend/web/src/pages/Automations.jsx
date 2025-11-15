import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import axiosInstance from '../services/axiosInstance';
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Sparkles
} from 'lucide-react';

export default function Automations() {
  const [automations, setAutomations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axiosInstance.get('/api/automations');
      setAutomations(response.data.automations);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load automations');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAutomation = async (id, enabled) => {
    try {
      await axiosInstance.patch(`/api/automations/${id}`, { enabled: !enabled });
      setAutomations(automations.map(a =>
        a.id === id ? { ...a, enabled: !enabled } : a
      ));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle automation');
    }
  };

  const triggerAutomation = async (id) => {
    try {
      await axiosInstance.post(`/api/automations/${id}/trigger`);
      alert('Automation triggered successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to trigger automation');
    }
  };

  const deleteAutomation = async (id) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;

    try {
      await axiosInstance.delete(`/api/automations/${id}`);
      setAutomations(automations.filter(a => a.id !== id));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete automation');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Automations</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            AI Create
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Automation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Automations</p>
              <p className="text-3xl font-bold mt-1">{automations.length}</p>
            </div>
            <div className="bg-blue-500 text-white p-3 rounded-lg">
              <Zap className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Active</p>
              <p className="text-3xl font-bold mt-1">
                {automations.filter(a => a.enabled).length}
              </p>
            </div>
            <div className="bg-green-500 text-white p-3 rounded-lg">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">AI Generated</p>
              <p className="text-3xl font-bold mt-1">
                {automations.filter(a => a.ai_generated).length}
              </p>
            </div>
            <div className="bg-purple-500 text-white p-3 rounded-lg">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
        </div>
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
          <p className="text-gray-600">Loading automations...</p>
        </div>
      )}

      {/* Automations List */}
      {!isLoading && automations.length > 0 && (
        <div className="space-y-4">
          {automations.map(automation => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              onToggle={toggleAutomation}
              onTrigger={triggerAutomation}
              onDelete={deleteAutomation}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && automations.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Zap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No automations yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first automation to get started
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            Create Automation
          </button>
        </div>
      )}
    </div>
  );
}

function AutomationCard({ automation, onToggle, onTrigger, onDelete }) {
  const [showDetails, setShowDetails] = useState(false);

  // Parse trigger and actions from JSON strings
  const trigger = typeof automation.trigger_config === 'string'
    ? JSON.parse(automation.trigger_config)
    : automation.trigger_config;

  const actions = typeof automation.actions === 'string'
    ? JSON.parse(automation.actions)
    : automation.actions;

  const getTriggerDescription = () => {
    switch (automation.trigger_type) {
      case 'time':
        return `At ${trigger.time || 'scheduled time'}`;
      case 'device_state':
        return `When device changes`;
      case 'schedule':
        return `On schedule: ${trigger.schedule || 'configured'}`;
      default:
        return automation.trigger_type;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-semibold">{automation.name}</h3>
              {automation.ai_generated && (
                <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI
                </span>
              )}
              <span className={`px-2 py-1 rounded-full text-xs ${
                automation.enabled
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {automation.enabled ? 'Active' : 'Inactive'}
              </span>
            </div>
            {automation.description && (
              <p className="text-gray-600 text-sm mb-3">{automation.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{getTriggerDescription()}</span>
              </div>
              {automation.last_triggered && (
                <div>
                  Last run: {new Date(automation.last_triggered).toLocaleString()}
                </div>
              )}
              {automation.trigger_count > 0 && (
                <div>
                  Executed {automation.trigger_count} times
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions Preview */}
        {showDetails && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">Actions:</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              {Array.isArray(actions) && actions.map((action, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  {action.type === 'device_control' && (
                    <span>Control device: {action.command}</span>
                  )}
                  {action.type === 'notification' && (
                    <span>Send notification: {action.message}</span>
                  )}
                  {action.type === 'delay' && (
                    <span>Wait {action.delay}ms</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(automation.id, automation.enabled)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              automation.enabled
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            } flex items-center gap-2`}
          >
            {automation.enabled ? (
              <>
                <Pause className="w-4 h-4" />
                Disable
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Enable
              </>
            )}
          </button>

          <button
            onClick={() => onTrigger(automation.id)}
            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Run Now
          </button>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            {showDetails ? 'Hide' : 'Details'}
          </button>

          <div className="flex-1"></div>

          <button
            onClick={() => {/* Edit handler */}}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Edit className="w-5 h-5" />
          </button>

          <button
            onClick={() => onDelete(automation.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
