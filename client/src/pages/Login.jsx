// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaLock, FaGoogle } from 'react-icons/fa';
import KULogo from '../assets/KU_Logo_PNG.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();

  // ✅ ใช้ useEffect รอฟังว่าเมื่อไหร่ที่ user เปลี่ยนสถานะ (Login สำเร็จ) ค่อยย้ายหน้า
  useEffect(() => {
    if (user) {
      if (user.primary_role === 'STUDENT' && user.needs_profile_completion) navigate('/auth/sso-setup');
      else if (user.primary_role === 'STUDENT') navigate('/student/dashboard');
      // ✅ ครอบคลุมสายอนุมัติระดับคณะทั้งหมดให้อยู่ Layout เดียวกัน
      else if (['STAFF', 'SUB_DEAN', 'DEAN'].includes(user.role)) {
        navigate('/staff/dashboard');
      } 
      else if (user.role === 'ADMIN') {
        navigate('/admin/verification');
      } 
      else if (user.role === 'COMMITTEE') {
        navigate('/committee/vote');
      } 
      else if (user.role === 'PRESIDENT') {
        navigate('/president/proclaim');
      }
    }
  }, [user, navigate]); // ทำงานทุกครั้งที่ user หรือ navigate เปลี่ยนแปลง

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    const result = await login(email, password);
    if (!result.success) {
      setError(result.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7faf7] relative">
      {/* Top left logo and university name */}
      <div className="absolute top-6 left-8 flex items-center">
        <img src={KULogo} alt="KU Logo" className="w-12 h-12 mr-3" />
          <div>
          <span className="text-[#1a7f42] font-bold text-xl">Kasetsart University</span>
          <div className="text-[#1a7f42] text-sm opacity-80">Faculty of Science</div>
        </div>
      </div>

      {/* Language switcher */}
      <div className="absolute top-6 right-8 text-gray-400 text-sm select-none">TH / EN</div>

      {/* Login Card */}
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center">
        {/* KU SSO Logo */}
        <div className="mb-4">
          <img src={KULogo} alt="KU Logo" className="w-24 h-26" />
        </div>
        <h2 className="text-xl font-bold text-green-800 mb-1 text-center">Nisit Deeden Award System</h2>
        <p className="text-black-700 text-sm text-center mb-4"><br /><span className="font-semibold text-grey-800">KU SSO Login</span></p>

        <form onSubmit={handleLogin} className="w-full mt-2">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">KU Email</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><FaUser /></span>
            <input 
              type="text" 
                placeholder="e.g. example@ku.th"
                className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              required
                disabled={loading}
              />
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><FaLock /></span>
              <input
                type="password"
                placeholder="Enter your password"
                className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>
          {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
          <button type="submit" className="w-full bg-gradient-to-r from-[#1a7f42] to-[#2d9e5a] text-white py-3 rounded-lg font-bold mt-4 hover:from-[#166a37] hover:to-[#25824a] transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
            {loading ? "Signing In..." : "Sign In"} <span className="ml-1">→</span>
          </button>
          
          {/* Google OAuth Button */}
          <button
            onClick={() => {
              // Use proper redirect to Google OAuth through backend
              try {
                // Redirect to backend Google OAuth endpoint
                window.location.href = `/api/auth/google-login?redirect=${encodeURIComponent('/auth/google-callback')}`;
              } catch (error) {
                console.error('Google OAuth redirect failed:', error);
                alert('Unable to redirect to Google OAuth. Please try again.');
              }
            }}
            className="w-full mt-4 bg-white text-gray-700 py-3 rounded-lg font-bold border-2 border-gray-300 hover:bg-gray-50 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
          >
            <FaGoogle className="mr-2 text-red-500" />
            Login with Google (KU Email Only)
          </button>
        </form>
        <button
          onClick={() => navigate('/register')}
          className="w-full mt-4 bg-white text-[#1a7f42] py-3 rounded-lg font-bold border-2 border-[#1a7f42] hover:bg-[#1a7f42] hover:text-white transition-all duration-300 transform hover:scale-105"
        >Register as Student</button>
        <div className="text-xs text-gray-500 mt-6 text-center">Need help logging in? <span className="text-[#1a7f42] font-medium cursor-pointer hover:underline">Contact IT Support</span></div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 w-full flex flex-col items-center text-xs text-gray-400 select-none">
        <div>© 2024 Kasetsart University. All rights reserved.</div>
      </div>
    </div>
  );
};

export default Login;
