import React from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { Outlet } from 'react-router-dom';

// Layout นี้จะรับ role เข้ามาเพื่อส่งต่อให้ Sidebar
const Layout = ({ role }) => {
  return (
    <div className="bg-gray-50 min-h-screen font-sans text-gray-900">
      <Sidebar role={role} />
      <Navbar />
      
      {/* Main Content Area */}
      <main className="ml-64 pt-20 p-8 min-h-screen">
        <div className="max-w-7xl mx-auto animate-fadeIn">
            {/* เนื้อหาของแต่ละหน้าจะมาโผล่ตรงนี้ */}
            <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;