import React from 'react';
import { Bell, User } from 'lucide-react';

const Navbar = ({ userArgs = { name: 'Nattapong S.', role: 'Student' } }) => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 fixed top-0 left-64 right-0 z-40">
      {/* Left: Breadcrumb or Title (Optional) */}
      <div className="text-sm text-gray-500">
        Academic Year 2024 / <span className="text-ku-main font-semibold">Semester 1</span>
      </div>

      {/* Right: User Profile */}
      <div className="flex items-center gap-6">
        <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-800">{userArgs.name}</p>
            <p className="text-xs text-gray-500 uppercase">{userArgs.role}</p>
          </div>
          <div className="w-10 h-10 bg-ku-light text-ku-main rounded-full flex items-center justify-center font-bold border border-ku-main">
            <User size={20} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;