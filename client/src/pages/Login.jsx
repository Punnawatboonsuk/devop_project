// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaLock } from 'react-icons/fa';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();

  // ✅ ใช้ useEffect รอฟังว่าเมื่อไหร่ที่ user เปลี่ยนสถานะ (Login สำเร็จ) ค่อยย้ายหน้า
  useEffect(() => {
    if (user) {
      if (user.primary_role === 'STUDENT') navigate('/student/dashboard');
      else if (user.primary_role === 'STAFF') navigate('/staff/dashboard');
      else if (user.primary_role === 'ADMIN') navigate('/admin/verification');
      else if (user.primary_role === 'COMMITTEE') navigate('/committee/dashboard');
      else if (user.primary_role === 'COMMITTEE_PRESIDENT') navigate('/president/proclaim');
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
        <div className="w-8 h-8 bg-[#1a7f42] rounded-full flex items-center justify-center mr-2">
          {/* Placeholder for KU logo */}
          <span className="text-white font-bold text-lg">K</span>
        </div>
        <span className="text-[#1a7f42] font-semibold text-lg">Kasetsart University</span>
      </div>

      {/* Language switcher */}
      <div className="absolute top-6 right-8 text-gray-400 text-sm select-none">TH / EN</div>

      {/* Login Card */}
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center">
        {/* KU SSO Logo */}
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 shadow">
          <span className="text-xl font-bold text-[#1a7f42]">KU</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">KU SSO Login</h2>
        <p className="text-green-700 text-sm text-center mb-1">Sign in to access<br /><span className="font-semibold text-green-800">Nisit Deeden Award System</span></p>

        <form onSubmit={handleLogin} className="w-full mt-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nontri Account</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><FaUser /></span>
              <input
                type="text"
                placeholder="e.g. b64xxxxxxxx"
                className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>
          <div className="mb-2">
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
          <button type="submit" className="w-full bg-[#1a7f42] text-white py-2 rounded-lg font-bold mt-2 hover:bg-green-900 transition disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
            {loading ? "Signing In..." : "Sign In"} <span className="ml-1">→</span>
          </button>
        </form>
        <button
          onClick={() => navigate('/register')}
          className="w-full mt-2 bg-gray-200 text-[#1a7f42] py-2 rounded-lg font-bold hover:bg-gray-300 transition"
        >Register as Student</button>
        <div className="text-xs text-gray-400 mt-4 text-center">Need help logging in?</div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 w-full flex flex-col items-center text-xs text-gray-400 select-none">
        <div>© 2024 Kasetsart University. All rights reserved.</div>
      </div>
    </div>
  );
};

export default Login;