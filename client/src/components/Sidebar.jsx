import React from 'react';
import { Home, FileText, CheckSquare, Users, BarChart, LogOut, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ role = 'STUDENT' }) => {
  const location = useLocation();

  // กำหนดเมนูตาม Role
  const menus = {
    STUDENT: [
      { name: 'Dashboard', icon: Home, path: '/student/dashboard' },
      { name: 'My Applications', icon: FileText, path: '/student/applications' },
      { name: 'Tracking', icon: BarChart, path: '/student/tracking' },
      { name: 'History', icon: CheckSquare, path: '/student/history' },
    ],
    STAFF: [
      { name: 'Dashboard', icon: Home, path: '/staff/dashboard' },
      { name: 'Pending Reviews', icon: FileText, path: '/staff/reviews' },
      { name: 'History', icon: CheckSquare, path: '/staff/history' },
    ],
    ADMIN: [
      { name: 'Dashboard', icon: Home, path: '/admin/dashboard' },
      { name: 'Verification', icon: CheckSquare, path: '/admin/verification' },
      { name: 'Voting Control', icon: Users, path: '/admin/voting' },
      { name: 'Reports', icon: FileText, path: '/admin/reports' },
    ],
    COMMITTEE: [
      { name: 'Dashboard', icon: Home, path: '/committee/dashboard' },
      { name: 'Vote Candidates', icon: Users, path: '/committee/vote' },
    ]
  };

  const currentMenu = menus[role] || menus.STUDENT;

  return (
    <aside className="h-screen w-64 bg-ku-main text-white flex flex-col fixed left-0 top-0 z-50 shadow-xl">
      {/* Logo Area */}
      <div className="p-6 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-tight">Nisit Deeden</h1>
        <p className="text-xs text-green-200 mt-1">Kasetsart University</p>
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
        <Link to="/settings" className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-white/5 text-sm text-green-200">
            <Settings size={18} />
            <span>Settings</span>
        </Link>
        <button className="flex items-center gap-3 px-4 py-2 w-full text-left rounded-lg hover:bg-red-500/20 text-red-200 hover:text-red-100 transition-colors text-sm">
          <LogOut size={18} />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;