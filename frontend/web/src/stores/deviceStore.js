import { create } from 'zustand';
import axiosInstance from '../services/axiosInstance';

export const useDeviceStore = create((set, get) => ({
  devices: [],
  isLoading: false,
  error: null,

  fetchDevices: async (filter = {}) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams(filter);
      const response = await axiosInstance.get(`/api/devices?${params}`);
      set({ devices: response.data.devices, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  controlDevice: async (deviceId, command, parameters = {}) => {
    try {
      await axiosInstance.post(`/api/devices/${deviceId}/control`, {
        command,
        parameters
      });
      return true;
    } catch (error) {
      set({ error: error.message });
      return false;
    }
  },

  updateDevice: (device) => {
    set((state) => ({
      devices: state.devices.map(d => d.id === device.id ? device : d)
    }));
  },

  updateDeviceState: (deviceId, newState) => {
    set((state) => ({
      devices: state.devices.map(d =>
        d.id === deviceId ? { ...d, state: { ...d.state, ...newState } } : d
      )
    }));
  },

  addDevice: (device) => {
    set((state) => ({ devices: [...state.devices, device] }));
  },

  removeDevice: (deviceId) => {
    set((state) => ({
      devices: state.devices.filter(d => d.id !== deviceId)
    }));
  }
}));
