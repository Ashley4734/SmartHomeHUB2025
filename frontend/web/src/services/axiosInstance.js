import axios from 'axios';

// Determine API base URL
// Prefer explicit configuration via VITE_API_URL.
// In development, use empty string to go through Vite's proxy configuration
// In production, use empty string to make relative requests (handled by nginx)
const API_URL = import.meta.env.VITE_API_URL || '';

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// TODO: Re-enable CSRF protection after fixing backend CSRF implementation
// CSRF protection is temporarily disabled

export default axiosInstance;
