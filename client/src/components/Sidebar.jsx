import React from 'react';
import { Home, FileText, CheckSquare, Users, BarChart, LogOut, UserPlus } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom'; // เพิ่ม useNavigate
import { useAuth } from '../hooks/useAuth'; // ✅ 1. Import AuthContext

const Sidebar = ({ role = 'STUDENT' }) => {
  const location = useLocation();
  const navigate = useNavigate(); // ใช้สำหรับย้ายหน้า
  const { logout } = useAuth();   // ✅ 2. ดึงฟังก์ชัน logout มาใช้

  // ฟังก์ชันกดแล้วออกระบบ
  const handleLogout = () => {
    logout(); // เคลียร์ user เป็น null
    navigate('/login'); // ดีดกลับไปหน้า Login
  };

  // กำหนดเมนูตาม Role
  const menus = {
    STUDENT: [
      { name: 'แดชบอร์ด', icon: Home, path: '/student/dashboard' },
      { name: 'สร้างใบสมัครใหม่', icon: FileText, path: '/student/create' },
      { name: 'ติดตามผล', icon: BarChart, path: '/student/tracking' },
      { name: 'ประวัติ', icon: CheckSquare, path: '/student/history' },
    ],
    STAFF: [ // รวม Staff, SubDean, Dean
      { name: 'แดชบอร์ด', icon: Home, path: '/staff/dashboard' },
      { name: 'คิวรอตรวจสอบ', icon: FileText, path: '/staff/reviews' },
      { name: 'ประวัติ', icon: CheckSquare, path: '/staff/history' },
    ],
    ADMIN: [
      { name: 'แดชบอร์ด', icon: Home, path: '/admin/dashboard' },
      { name: 'ตรวจสอบสิทธิ์', icon: CheckSquare, path: '/admin/verification' },
      { name: 'ติดตาม Ticket', icon: FileText, path: '/admin/tickets' },
      { name: 'ควบคุมการลงคะแนน', icon: Users, path: '/admin/voting' },
      { name: 'สร้างบัญชี', icon: UserPlus, path: '/admin/accounts' },
    ],
    COMMITTEE: [
      { name: 'แดชบอร์ด', icon: Home, path: '/committee/dashboard' },
      { name: 'ประกาศผล', icon: FileText, path: '/committee/proclamation' },
      { name: 'ผู้เข้าชิง', icon: Users, path: '/committee/candidates' },
    ],
    PRESIDENT: [
      { name: 'แดชบอร์ด', icon: Home, path: '/committee/dashboard' },
      { name: 'ประกาศผล', icon: FileText, path: '/committee/proclamation' },
      { name: 'ผู้เข้าชิง', icon: Users, path: '/committee/candidates' },
    ]
  };

  const currentMenu = menus[role] || menus.STUDENT;

  return (
    <aside className="h-screen w-64 bg-ku-main text-white flex flex-col fixed left-0 top-0 z-50 shadow-xl">
      {/* Logo Area */}
      <div className="p-6 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-tight">นิสิตดีเด่น</h1>
        <p className="text-xs text-green-200 mt-1">มหาวิทยาลัยเกษตรศาสตร์</p>
      </div>

      {/* Menu Links */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {currentMenu.map((item, index) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={index} 
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                ${isActive 
                  ? 'bg-ku-accent text-ku-main font-bold shadow-md' 
                  : 'hover:bg-white/10 text-green-50'}`}
            >
              <item.icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 space-y-2">
        
        {/* ✅ 3. ผูกปุ่ม Logout กับฟังก์ชัน */}
        <button 
          onClick={handleLogout} 
          className="flex items-center gap-3 px-4 py-2 w-full text-left rounded-lg hover:bg-red-500/20 text-red-200 hover:text-red-100 transition-colors text-sm"
        >
          <LogOut size={18} />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;


