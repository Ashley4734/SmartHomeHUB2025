import axios from 'axios';

// Determine API base URL
// Prefer explicit configuration via VITE_API_URL.
// Fall back to the local backend during development to avoid protocol mismatches
// (e.g. when the frontend is served over HTTPS but the backend only exposes HTTP).
const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// TODO: Re-enable CSRF protection after fixing backend CSRF implementation
// CSRF protection is temporarily disabled

export default axiosInstance;
