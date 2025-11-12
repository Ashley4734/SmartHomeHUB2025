import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
      },

      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await axios.post(`${API_URL}/api/auth/login`, {
            username,
            password
          });

          const { user, token } = response.data;
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

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
        delete axios.defaults.headers.common['Authorization'];
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
