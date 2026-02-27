/**
 * API Helper Utilities
 * Provides common functions for making authenticated API requests
 */

/**
 * Make an authenticated API request
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise} - The fetch promise
 */
export const apiRequest = async (url, options = {}) => {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const defaultOptions = {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    ...options,
  };

  return fetch(url, defaultOptions);
};

/**
 * Make an authenticated API request with session handling
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise} - The fetch promise with response handling
 */
export const authenticatedApiRequest = async (url, options = {}) => {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const defaultOptions = {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    credentials: 'include', // Include cookies for session authentication
    ...options,
  };

  const response = await fetch(url, defaultOptions);
  
  // Don't auto-redirect on 401, let calling component handle it
  // if (response.status === 401) {
  //   window.location.href = '/login';
  //   throw new Error('Authentication required');
  // }

  return response;
};

/**
 * Get current user from API
 * @returns {Promise} - Promise resolving to user data or null
 */
export const getCurrentUser = async () => {
  try {
    const response = await authenticatedApiRequest('/api/auth/me');
    if (response.ok) {
      const data = await response.json();
      return data.authenticated ? data.user : null;
    }
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Logout user
 * @returns {Promise} - Promise resolving to logout success
 */
export const logoutUser = async () => {
  try {
    const response = await authenticatedApiRequest('/api/auth/logout', {
      method: 'POST',
    });
    return response.ok;
  } catch (error) {
    console.error('Error during logout:', error);
    return false;
  }
};
