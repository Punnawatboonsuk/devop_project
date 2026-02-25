import React, { createContext, useContext, useState } from 'react';
import toast from 'react-hot-toast';

// ✅ 1. เติมคำว่า export ตรงนี้ เพื่อให้ไฟล์อื่นดึงไปใช้ได้
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = (usernameInput, password) => {
    const username = usernameInput.toLowerCase().trim();
    console.log("Attempting Login with:", username);

    if (username === 'student') {
      setUser({ name: 'Nattapong S.', role: 'STUDENT', id: '643xxxxx' });
      toast.success('Login Success: Student');
      return true;
    } 
    else if (username === 'staff') {
      setUser({ name: 'Dr. Somsak', role: 'STAFF', id: 'st001' });
      toast.success('Login Success: Staff');
      return true;
    }
    else if (username === 'sub_dean') {
      setUser({ name: 'Asst. Prof. Malee', role: 'SUB_DEAN', id: 'sd001' });
      toast.success('Login Success: Sub-Dean');
      return true;
    }
    else if (username === 'dean') {
      setUser({ name: 'Assoc. Prof. Dean', role: 'DEAN', id: 'dn001' });
      toast.success('Login Success: Dean');
      return true;
    }
    else if (username === 'admin') {
      setUser({ name: 'Admin Officer', role: 'ADMIN', id: 'ad001' });
      toast.success('Login Success: Admin');
      return true;
    }
    else if (username === 'committee') {
      setUser({ name: 'Prof. Somchai', role: 'COMMITTEE', id: 'cm001' });
      toast.success('Login Success: Committee');
      return true;
    }
    else if (username === 'president') {
      setUser({ name: 'President', role: 'PRESIDENT', id: 'pr001' });
      toast.success('Login Success: President');
      return true;
    }
    else {
      console.log("Login Failed");
      toast.error('User not found');
      return false;
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
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// ✅ 2. Export useAuth ไว้ใช้งานด้วย
export const useAuth = () => useContext(AuthContext);