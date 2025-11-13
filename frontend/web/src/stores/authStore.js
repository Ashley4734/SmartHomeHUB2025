import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axiosInstance from '../services/axiosInstance';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      initialize: () => {
        const token = get().token;
        if (token) {
          axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
      },

      login: async (identifier, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await axiosInstance.post('/api/auth/login', {
            identifier,
            password
          });

          const { user, token } = response.data;
          axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          set({ user, token, isLoading: false });
          return true;
        } catch (error) {
          set({
            error: error.response?.data?.error || 'Login failed',
            isLoading: false
          });
          return false;
        }
      },

      logout: () => {
        delete axiosInstance.defaults.headers.common['Authorization'];
        set({ user: null, token: null });
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token })
    }
  )
);
