// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [username, setUsername] = useState('');
  const { login, user } = useAuth(); // ดึง user ออกมาด้วยเพื่อรอเช็ค
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

  const handleLogin = (e) => {
    e.preventDefault();
    // แค่สั่ง login พอ ไม่ต้องสั่ง navigate ตรงนี้แล้ว ให้ useEffect ข้างบนทำงานแทน
    login(username, 'password'); 
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-96 border border-gray-100">
        <h1 className="text-2xl font-black text-ku-main mb-2 text-center tracking-tight">
          Nisit Deeden
        </h1>
        <p className="text-center text-gray-500 text-sm mb-6">ระบบคัดเลือกนิสิตดีเด่น มก.</p>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Username (Mock Test)
            </label>
            <input 
              type="text" 
              placeholder="Try: student, staff, admin"
              className="w-full border border-gray-300 p-3 rounded-xl mt-1 outline-none focus:ring-2 focus:ring-ku-main/50 focus:border-ku-main transition"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <div className="bg-blue-50 p-3 rounded-lg mt-3 border border-blue-100">
              <p className="text-xs text-blue-800 font-medium mb-1">Role ที่มีให้ทดสอบพิมพ์:</p>
              <ul className="text-[11px] text-blue-600 font-mono space-y-0.5 ml-2">
                <li>• student</li>
                <li>• staff / sub_dean / dean</li>
                <li>• admin</li>
                <li>• committee / president</li>
              </ul>
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
            Sign In to System
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
