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
      if (user.role === 'STUDENT') navigate('/student/dashboard');
      else if (user.role === 'STAFF') navigate('/staff/dashboard');
      else if (user.role === 'ADMIN') navigate('/admin/verification');
      else if (user.role === 'COMMITTEE') navigate('/committee/vote');
      else if (user.role === 'PRESIDENT') navigate('/president/proclaim');
    }
  }, [user, navigate]); // ทำงานทุกครั้งที่ user หรือ navigate เปลี่ยนแปลง

  const handleLogin = (e) => {
    e.preventDefault();
    // แค่สั่ง login พอ ไม่ต้องสั่ง navigate ตรงนี้แล้ว ให้ useEffect ข้างบนทำงานแทน
    login(username, 'password'); 
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96">
        <h1 className="text-2xl font-bold text-ku-main mb-6 text-center">Nisit Deeden Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username (Mock)</label>
            <input 
              type="text" 
              placeholder="Try: student, staff, admin"
              className="w-full border p-2 rounded mt-1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">*พิมพ์ 'student', 'staff', 'admin' เพื่อทดสอบ</p>
          </div>
          <button type="submit" className="w-full bg-ku-main text-white py-2 rounded font-bold hover:bg-green-800">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;