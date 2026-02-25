import React, { createContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { authenticatedApiRequest } from '../utils/api';

const AuthContext = createContext();

export { AuthContext };

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is already logged in on app start
  useEffect(() => {
    getCurrentUser();
  }, []);

  // Get current user from API
  const getCurrentUser = async () => {
    try {
      const response = await authenticatedApiRequest('/api/auth/me');
      
      // Handle 401 explicitly without redirect
      if (response.status === 401) {
        setUser(null);
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Login with email and password
  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await authenticatedApiRequest('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        toast.success('Login successful');
        return { success: true, redirect: data.redirect };
      } else {
        toast.error(data.message || 'Login failed');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Network error. Please try again.');
      return { success: false, message: 'Network error' };
    } finally {
      setLoading(false);
    }
  };

  // Register new user
  const register = async (userData) => {
    setLoading(true);
    try {
      const response = await authenticatedApiRequest('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Registration successful! Please login.');
        return { success: true };
      } else {
        toast.error(data.message || 'Registration failed');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Network error. Please try again.');
      return { success: false, message: 'Network error' };
    } finally {
      setLoading(false);
    }
  };

  // Logout user
  const logout = async () => {
    try {
      await authenticatedApiRequest('/api/auth/logout', {
        method: 'POST',
      });
      setUser(null);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  // Change password
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await authenticatedApiRequest('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Password changed successfully');
        return { success: true };
      } else {
        toast.error(data.message || 'Failed to change password');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Change password error:', error);
      toast.error('Network error. Please try again.');
      return { success: false, message: 'Network error' };
    }
  };

  const completeProfile = async (profileData) => {
    try {
      const response = await authenticatedApiRequest('/api/auth/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        toast.success('Profile completed successfully');
        return { success: true, redirect: data.redirect };
      }

      toast.error(data.message || 'Failed to complete profile');
      return { success: false, message: data.message || 'Failed to complete profile' };
    } catch (error) {
      console.error('Complete profile error:', error);
      toast.error('Network error. Please try again.');
      return { success: false, message: 'Network error' };
    }
  };

  // Handle Google OAuth callback
  const handleGoogleCallback = async () => {
    try {
      const response = await authenticatedApiRequest('/api/auth/google-callback');
      
      // Handle 401 errors (unauthorized)
      if (response.status === 401) {
        toast.error('Google authentication failed. Please try again.');
        return { success: false, message: 'Authentication failed' };
      }
      
      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        toast.success('Google SSO login successful');
        
        // For OAuth callbacks, we should redirect immediately
        // This method is typically called from GoogleCallback.jsx which handles the redirect
        return { success: true, redirect: data.redirect };
      } else {
        toast.error(data.message || 'Google authentication failed');
        return { success: false, message: data.message || 'Authentication failed' };
      }
    } catch (error) {
      console.error('Google callback error:', error);
      toast.error('Network error. Please try again.');
      return { success: false, message: 'Network error' };
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    changePassword,
    completeProfile,
    getCurrentUser,
    handleGoogleCallback,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
export { AuthProvider };
