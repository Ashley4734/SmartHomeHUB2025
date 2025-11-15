import React, { useState, useEffect } from 'react';
import axiosInstance from '../services/axiosInstance';
import {
  Mic,
  MicOff,
  Volume2,
  MessageSquare,
  History,
  RefreshCw,
  AlertCircle,
  Settings,
  TrendingUp
} from 'lucide-react';

export default function Voice() {
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [commandHistory, setCommandHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [textCommand, setTextCommand] = useState('');

  useEffect(() => {
    fetchCommandHistory();
    fetchStats();
  }, []);

  const fetchCommandHistory = async () => {
    try {
      const response = await axiosInstance.get('/api/voice/history?limit=10');
      setCommandHistory(response.data.history);
    } catch (err) {
      console.error('Failed to load command history:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axiosInstance.get('/api/voice/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const toggleListening = async () => {
    setError(null);
    try {
      const action = isListening ? 'stop' : 'start';
      await axiosInstance.post(`/api/voice/listening/${action}`);
      setIsListening(!isListening);
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${isListening ? 'stop' : 'start'} listening`);
    }
  };

  const sendTextCommand = async (e) => {
    e.preventDefault();
    if (!textCommand.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.post('/api/voice/command', {
        audioData: textCommand // In a real implementation, this would be audio data
      });

      setCommandHistory([
        {
          id: Date.now(),
          command_text: textCommand,
          response: response.data.response,
          success: 1,
          timestamp: Date.now()
        },
        ...commandHistory
      ]);

      setTextCommand('');
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process command');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Voice Control</h1>
        <button className="text-gray-600 hover:text-gray-800">
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Commands</p>
                <p className="text-3xl font-bold mt-1">{stats.totalCommands || 0}</p>
              </div>
              <div className="bg-blue-500 text-white p-3 rounded-lg">
                <MessageSquare className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Success Rate</p>
                <p className="text-3xl font-bold mt-1">
                  {stats.successRate ? `${Math.round(stats.successRate)}%` : '0%'}
                </p>
              </div>
              <div className="bg-green-500 text-white p-3 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Status</p>
                <p className="text-lg font-bold mt-1">
                  {isListening ? 'Listening' : 'Ready'}
                </p>
              </div>
              <div className={`${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-500'} text-white p-3 rounded-lg`}>
                {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Control Panel */}
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center">
          {/* Voice Input Button */}
          <button
            onClick={toggleListening}
            className={`mx-auto mb-6 w-32 h-32 rounded-full flex items-center justify-center transition-all ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 shadow-xl animate-pulse'
                : 'bg-blue-500 hover:bg-blue-600 shadow-lg'
            }`}
          >
            {isListening ? (
              <MicOff className="w-16 h-16 text-white" />
            ) : (
              <Mic className="w-16 h-16 text-white" />
            )}
          </button>

          <h2 className="text-2xl font-bold mb-2">
            {isListening ? 'Listening...' : 'Tap to speak'}
          </h2>
          <p className="text-gray-600 mb-6">
            {isListening
              ? 'Say your command now'
              : 'Click the microphone to start voice control'}
          </p>

          {/* Text Command Input */}
          <div className="max-w-2xl mx-auto">
            <form onSubmit={sendTextCommand} className="flex gap-2">
              <input
                type="text"
                value={textCommand}
                onChange={(e) => setTextCommand(e.target.value)}
                placeholder="Or type a command here..."
                disabled={isLoading}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={isLoading || !textCommand.trim()}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  'Send'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Example Commands */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Example Commands
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'Turn on the living room lights',
            'Set bedroom temperature to 72 degrees',
            'What is the current temperature?',
            'Turn off all lights',
            'Lock the front door',
            'Run good night automation'
          ].map((command, index) => (
            <button
              key={index}
              onClick={() => setTextCommand(command)}
              className="text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors"
            >
              <Volume2 className="w-4 h-4 inline mr-2 text-blue-500" />
              {command}
            </button>
          ))}
        </div>
      </div>

      {/* Command History */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <History className="w-5 h-5" />
            Recent Commands
          </h3>
          <button
            onClick={fetchCommandHistory}
            className="text-blue-500 hover:text-blue-600 text-sm flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {commandHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No command history yet</p>
            <p className="text-sm">Try saying a command to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {commandHistory.map((cmd) => (
              <CommandHistoryItem key={cmd.id} command={cmd} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommandHistoryItem({ command }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span className="font-medium">{command.command_text}</span>
          </div>
          {command.response && (
            <div className="flex items-start gap-2 mt-2 text-sm text-gray-600">
              <Volume2 className="w-4 h-4 text-green-500 mt-0.5" />
              <span>{command.response}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs ${
            command.success
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {command.success ? 'Success' : 'Failed'}
          </span>
        </div>
      </div>
      <div className="text-xs text-gray-500">
        {new Date(command.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
