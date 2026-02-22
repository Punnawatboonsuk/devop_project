import React, { useState } from 'react';
import { Search, Filter, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';

const StaffDashboard = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState(''); // ✅ เพิ่ม State สำหรับค้นหา

  // Mock Data: จำลองรายการทั้งหมดในระบบ
  const allTickets = [
    { id: 101, student: 'Somchai K.', category: 'Academic', status: 'submit_by_staff', date: '2024-02-15' },
    { id: 102, student: 'Araya J.', category: 'Innovation', status: 'submit_by_subdean', date: '2024-02-16' },
    { id: 103, student: 'Wichai R.', category: 'Good Conduct', status: 'submit_by_dean', date: '2024-02-17' },
    { id: 104, student: 'Nattapong S.', category: 'Activity', status: 'submit_by_staff', date: '2024-02-17' },
    { id: 105, student: 'Mana Rakdee', category: 'Innovation', status: 'submit_by_staff', date: '2024-02-18' },
  ];

  // ✅ Logic: กรองข้อมูลตาม Role และ Search Term
  const getFilteredData = () => {
    let data = [];
    
    // 1. กรองตาม Role
    switch (user?.role) {
      case 'STAFF': data = allTickets.filter(t => t.status === 'submit_by_staff'); break;
      case 'SUB_DEAN': data = allTickets.filter(t => t.status === 'submit_by_subdean'); break;
      case 'DEAN': data = allTickets.filter(t => t.status === 'submit_by_dean'); break;
      default: data = [];
    }

    // 2. กรองตามคำค้นหา (ถ้ามี)
    if (searchTerm) {
      data = data.filter(item => 
        item.student.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.id.toString().includes(searchTerm)
      );
    }

    return data;
  };

  const pendingList = getFilteredData();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-ku-main">Portal สำหรับ {user?.role}</h1>
          <p className="text-gray-500 text-sm">ตรวจสอบและอนุมัติใบสมัครนิสิตดีเด่น</p>
        </div>
        <div className="bg-ku-light px-4 py-2 rounded-lg border border-ku-main/20">
          <span className="text-ku-main font-bold">งานคงค้าง: {pendingList.length} รายการ</span>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="ค้นหาชื่อนิสิต หรือ ID..." 
              value={searchTerm} // ✅ ผูกค่ากับ State
              onChange={(e) => setSearchTerm(e.target.value)} // ✅ อัปเดต State เมื่อพิมพ์
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-ku-main outline-none transition" 
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100 transition">
            <Filter size={18} /> ตัวกรอง
          </button>
        </div>

        <table className="w-full text-left">
          <thead className="bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">นิสิตผู้สมัคร</th>
              <th className="px-6 py-4">ด้านที่สมัคร</th>
              <th className="px-6 py-4">วันที่ส่ง</th>
              <th className="px-6 py-4">สถานะปัจจุบัน</th>
              <th className="px-6 py-4 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pendingList.length > 0 ? pendingList.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-6 py-4 font-bold text-gray-800">{item.student}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{item.date}</td>
                <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                <td className="px-6 py-4 text-right">
                  <Link to={`/staff/review/${item.id}`} className="inline-flex items-center gap-1 text-ku-main font-bold text-sm hover:underline">
                    ตรวจสอบ <ArrowRight size={16} />
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="px-6 py-10 text-center text-gray-400 italic">
                  {searchTerm ? 'ไม่พบข้อมูลที่ค้นหา' : 'ไม่มีรายการที่รอการตรวจสอบในขณะนี้'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffDashboard;