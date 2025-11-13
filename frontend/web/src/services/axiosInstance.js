import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true // Important for CSRF cookies
});

let csrfToken = null;

/**
 * Fetch CSRF token from the server
 */
async function fetchCsrfToken() {
  try {
    const response = await axiosInstance.get('/api/csrf-token');
    csrfToken = response.data.csrfToken;
    return csrfToken;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    throw error;
  }
}

/**
 * Request interceptor to add CSRF token to POST/PUT/PATCH/DELETE requests
 */
axiosInstance.interceptors.request.use(
  async (config) => {
    // For state-changing methods, ensure we have a CSRF token
    if (['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
      // Fetch CSRF token if we don't have one
      if (!csrfToken) {
        await fetchCsrfToken();
      }
      // Add CSRF token to headers
      config.headers['x-csrf-token'] = csrfToken;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor to handle CSRF token errors
 */
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If we get a CSRF error and haven't retried yet, fetch a new token and retry
    if (
      error.response?.status === 403 &&
      error.response?.data?.error === 'Invalid CSRF token' &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      // Fetch a new CSRF token
      await fetchCsrfToken();

      // Update the failed request with the new token
      originalRequest.headers['x-csrf-token'] = csrfToken;

      // Retry the request
      return axiosInstance(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
