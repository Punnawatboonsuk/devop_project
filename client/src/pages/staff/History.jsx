import React, { useState } from 'react';
import { 
  Search, 
  Download, 
  CheckCircle, 
  XCircle, 
  Filter, 
  Eye, 
  Calendar,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge';

const StaffHistory = () => {
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'APPROVED', 'REJECTED'
  const [searchTerm, setSearchTerm] = useState('');

  // --- Mock Data: ประวัติการดำเนินการที่ผ่านมา ---
  const historyData = [
    { 
      id: 201, 
      student: 'นายวิชัย รักเรียน', 
      studentId: '6420115521',
      category: 'Good Conduct (ความประพฤติดี)', 
      status: 'approved', 
      actionDate: '2024-02-10', 
      actionBy: 'Verified', 
      note: 'เอกสารครบถ้วน' 
    },
    { 
      id: 202, 
      student: 'นางสาวมานี มีใจ', 
      studentId: '6420334102',
      category: 'Academic (เรียนดี)', 
      status: 'reject', 
      actionDate: '2024-02-11', 
      actionBy: 'Rejected', 
      note: 'เกรดเฉลี่ยไม่ถึงเกณฑ์ 3.00' 
    },
    { 
      id: 203, 
      student: 'นายสมศรี ดีเสมอ', 
      studentId: '6410552147',
      category: 'Innovation (นวัตกรรม)', 
      status: 'approved', 
      actionDate: '2024-02-12', 
      actionBy: 'Recommended', 
      note: '-' 
    },
    { 
      id: 204, 
      student: 'นายนรุตม์ สุดหล่อ', 
      studentId: '6430214588',
      category: 'Activity (กิจกรรม)', 
      status: 'approved', 
      actionDate: '2024-02-14', 
      actionBy: 'Final Approve', 
      note: 'ประธานชมรมดีเด่น' 
    },
    { 
      id: 205, 
      student: 'นางสาวกานดา น่ารัก', 
      studentId: '6420998741',
      category: 'Academic (เรียนดี)', 
      status: 'reject', 
      actionDate: '2024-02-15', 
      actionBy: 'Rejected', 
      note: 'เอกสารรับรองไม่ชัดเจน' 
    },
  ];

  // --- Logic: กรองข้อมูล (Filter & Search) ---
  const getDisplayData = () => {
    return historyData.filter(item => {
      // 1. Filter by Tab Status
      const statusMatch = 
        filter === 'ALL' ? true : 
        filter === 'APPROVED' ? item.status === 'approved' : 
        item.status === 'reject';

      // 2. Filter by Search Text (Name or ID)
      const searchLower = searchTerm.toLowerCase();
      const searchMatch = 
        item.student.toLowerCase().includes(searchLower) || 
        item.studentId.includes(searchLower);

      return statusMatch && searchMatch;
    });
  };

  const displayedList = getDisplayData();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="text-ku-main" /> ประวัติการดำเนินการ (Action History)
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            รายการใบสมัครทั้งหมดที่คุณได้ทำการ ตรวจสอบ, อนุมัติ หรือ ปฏิเสธ ไปแล้ว
          </p>
        </div>
        
        {/* Export Button */}
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition shadow-sm">
          <Download size={18} /> Export CSV
        </button>
      </div>

      {/* --- Controls Section (Tabs & Search) --- */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
        
        {/* Status Tabs */}
        <div className="flex p-1 bg-gray-100 rounded-xl w-full md:w-auto">
          <button 
            onClick={() => setFilter('ALL')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'ALL' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ทั้งหมด
          </button>
          <button 
            onClick={() => setFilter('APPROVED')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${filter === 'APPROVED' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-green-600'}`}
          >
            <CheckCircle size={16} /> อนุมัติ
          </button>
          <button 
            onClick={() => setFilter('REJECTED')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${filter === 'REJECTED' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-red-600'}`}
          >
            <XCircle size={16} /> ตีกลับ
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อนิสิต หรือ รหัสนิสิต..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ku-main/50 focus:border-ku-main transition" 
          />
        </div>
      </div>

      {/* --- Table Section --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">นิสิตผู้สมัคร</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ด้านที่สมัคร</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">วันที่ทำรายการ</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ผลการพิจารณา</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">หมายเหตุ</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">ดูข้อมูล</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayedList.length > 0 ? (
              displayedList.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                  {/* Student Info */}
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{item.student}</p>
                      <p className="text-xs text-gray-400 font-mono">{item.studentId}</p>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
                      <FileText size={12} />
                      {item.category}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                    {item.actionDate}
                  </td>

                  {/* Result/Action */}
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border
                      ${item.status === 'approved' 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {item.status === 'approved' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {item.actionBy}
                    </div>
                  </td>

                  {/* Note */}
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {item.note || '-'}
                  </td>

                  {/* Action Button */}
                  <td className="px-6 py-4 text-right">
                    <Link 
                      to={`/staff/review/${item.id}`} // ลิงก์ไปดูรายละเอียดเก่า (อาจต้องปรับ ReviewTicket ให้รองรับโหมด ReadOnly)
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-ku-main hover:text-white transition"
                      title="ดูรายละเอียด"
                    >
                      <Eye size={16} />
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-300">
                    <Filter size={48} className="mb-3 opacity-50" />
                    <p className="text-lg font-bold text-gray-400">ไม่พบรายการประวัติ</p>
                    <p className="text-sm">ลองเปลี่ยนตัวกรอง หรือค้นหาด้วยคำสำคัญอื่น</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="flex justify-between items-center text-xs text-gray-400 px-2">
        <p>แสดงผล {displayedList.length} รายการ จากทั้งหมด {historyData.length} รายการ</p>
        <p>ข้อมูลย้อนหลัง 1 ปีการศึกษา</p>
      </div>
    </div>
  );
};

export default StaffHistory;