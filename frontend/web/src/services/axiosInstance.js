import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// TODO: Re-enable CSRF protection after fixing backend CSRF implementation
// CSRF protection is temporarily disabled

export default axiosInstance;
