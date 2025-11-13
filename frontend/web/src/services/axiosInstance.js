import axios from 'axios';

// In development, use empty baseURL to leverage Vite's proxy
// In production, VITE_API_URL should be set to the actual API URL
const API_URL = import.meta.env.VITE_API_URL || '';

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// TODO: Re-enable CSRF protection after fixing backend CSRF implementation
// CSRF protection is temporarily disabled

export default axiosInstance;
