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

  const roleRedirect = (primaryRole) => {
    const routes = {
      STUDENT: '/student/dashboard',
      STAFF: '/staff/dashboard',
      SUB_DEAN: '/staff/dashboard',
      DEAN: '/staff/dashboard',
      ADMIN: '/admin/dashboard',
      COMMITTEE: '/committee/dashboard',
      COMMITTEE_PRESIDENT: '/committee/dashboard',
    };
    return routes[primaryRole] || '/login';
  };

  useEffect(() => {
    if (!user) return;

    if (user.primary_role === 'STUDENT' && user.needs_profile_completion) {
      navigate('/auth/sso-setup');
      return;
    }

    navigate(roleRedirect(user.primary_role));
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      if (result.redirect) navigate(result.redirect);
      return;
    }

    setError(result.message || 'เข้าสู่ระบบไม่สำเร็จ');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7faf7] relative">
      <div className="absolute top-6 left-8 flex items-center">
        <img src={KULogo} alt="KU Logo" className="w-12 h-12 mr-3" />
        <div>
          <span className="text-[#1a7f42] font-bold text-xl">มหาวิทยาลัยเกษตรศาสตร์</span>
          <div className="text-[#1a7f42] text-sm opacity-80">คณะวิทยาศาสตร์</div>
        </div>
      </div>

      <div className="absolute top-6 right-8 text-gray-400 text-sm select-none">ภาษาไทย</div>

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center">
        <div className="mb-4">
          <img src={KULogo} alt="KU Logo" className="w-24 h-26" />
        </div>
        <h2 className="text-xl font-bold text-green-800 mb-1 text-center">ระบบรางวัลนิสิตดีเด่น</h2>
        <p className="text-black-700 text-sm text-center mb-4">
          <br />
          <span className="font-semibold text-grey-800">เข้าสู่ระบบด้วย KU SSO หรือ รหัสผ่าน</span>
        </p>

        <form onSubmit={handleLogin} className="w-full mt-2">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล KU</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><FaUser /></span>
              <input
                type="text"
                placeholder="เช่น example@ku.th"
                className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><FaLock /></span>
              <input
                type="password"
                placeholder="กรอกรหัสผ่าน"
                className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f42]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          {error && <div className="text-red-500 text-sm mb-2">{error}</div>}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-[#1a7f42] to-[#2d9e5a] text-white py-3 rounded-lg font-bold mt-4 hover:from-[#166a37] hover:to-[#25824a] transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'} <span className="ml-1">→</span>
          </button>

          <button
            onClick={() => {
              try {
                window.location.href = `/api/auth/google-login?redirect=${encodeURIComponent('/auth/google-callback')}`;
              } catch (oauthError) {
                console.error('Google OAuth redirect failed:', oauthError);
                alert('ไม่สามารถเปลี่ยนเส้นทางไปยัง Google OAuth ได้ กรุณาลองใหม่');
              }
            }}
            className="w-full mt-4 bg-white text-gray-700 py-3 rounded-lg font-bold border-2 border-gray-300 hover:bg-gray-50 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
          >
            <FaGoogle className="mr-2 text-red-500" />
            เข้าสู่ระบบด้วย Google (เฉพาะอีเมล KU)
          </button>
        </form>

        <button
          onClick={() => navigate('/register')}
          className="w-full mt-4 bg-white text-[#1a7f42] py-3 rounded-lg font-bold border-2 border-[#1a7f42] hover:bg-[#1a7f42] hover:text-white transition-all duration-300 transform hover:scale-105"
        >
          สมัครสมาชิกนิสิต
        </button>

        <div className="text-xs text-gray-500 mt-6 text-center">
          ต้องการความช่วยเหลือในการเข้าสู่ระบบ?
          {' '}
          <span className="text-[#1a7f42] font-medium cursor-pointer hover:underline">ติดต่อฝ่ายไอที</span>
        </div>
      </div>

      <div className="absolute bottom-4 left-0 w-full flex flex-col items-center text-xs text-gray-400 select-none">
        <div>© 2024 มหาวิทยาลัยเกษตรศาสตร์ สงวนลิขสิทธิ์</div>
      </div>
    </div>
  );
};

export default Login;
