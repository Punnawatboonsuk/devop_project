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
        toast.success('เข้าสู่ระบบสำเร็จ');
        return { success: true, redirect: data.redirect };
      } else {
        toast.error(data.message || 'เข้าสู่ระบบไม่สำเร็จ');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('เกิดข้อผิดพลาดเครือข่าย กรุณาลองใหม่');
      return { success: false, message: 'เกิดข้อผิดพลาดเครือข่าย' };
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
        toast.success('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');
        return { success: true };
      } else {
        toast.error(data.message || 'สมัครสมาชิกไม่สำเร็จ');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('เกิดข้อผิดพลาดเครือข่าย กรุณาลองใหม่');
      return { success: false, message: 'เกิดข้อผิดพลาดเครือข่าย' };
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
      toast.success('ออกจากระบบเรียบร้อย');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('ออกจากระบบไม่สำเร็จ');
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
        toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
        return { success: true };
      } else {
        toast.error(data.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Change password error:', error);
      toast.error('เกิดข้อผิดพลาดเครือข่าย กรุณาลองใหม่');
      return { success: false, message: 'เกิดข้อผิดพลาดเครือข่าย' };
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
        toast.success('บันทึกข้อมูลโปรไฟล์สำเร็จ');
        return { success: true, redirect: data.redirect };
      }

      toast.error(data.message || 'บันทึกข้อมูลโปรไฟล์ไม่สำเร็จ');
      return { success: false, message: data.message || 'บันทึกข้อมูลโปรไฟล์ไม่สำเร็จ' };
    } catch (error) {
      console.error('Complete profile error:', error);
      toast.error('เกิดข้อผิดพลาดเครือข่าย กรุณาลองใหม่');
      return { success: false, message: 'เกิดข้อผิดพลาดเครือข่าย' };
    }
  };

  // Handle Google OAuth callback
  const handleGoogleCallback = async () => {
    try {
      const response = await authenticatedApiRequest('/api/auth/google-callback');
      
      // Handle 401 errors (unauthorized)
      if (response.status === 401) {
        toast.error('ยืนยันตัวตนด้วย Google ไม่สำเร็จ กรุณาลองใหม่');
        return { success: false, message: 'ยืนยันตัวตนไม่สำเร็จ' };
      }
      
      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        toast.success('เข้าสู่ระบบด้วย Google SSO สำเร็จ');
        
        // For OAuth callbacks, we should redirect immediately
        // This method is typically called from GoogleCallback.jsx which handles the redirect
        return { success: true, redirect: data.redirect };
      } else {
        toast.error(data.message || 'ยืนยันตัวตนด้วย Google ไม่สำเร็จ');
        return { success: false, message: data.message || 'ยืนยันตัวตนไม่สำเร็จ' };
      }
    } catch (error) {
      console.error('Google callback error:', error);
      toast.error('เกิดข้อผิดพลาดเครือข่าย กรุณาลองใหม่');
      return { success: false, message: 'เกิดข้อผิดพลาดเครือข่าย' };
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
