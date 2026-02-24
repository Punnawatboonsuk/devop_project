import React, { useState } from 'react';
import { Search, Eye, Calendar, FileText, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge';

const StudentHistory = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // 💡 MOCK DATA: ประวัติการส่งใบสมัครของนิสิตคนนี้
  const myHistory = [
    { 
      id: 'APP-2024-001', 
      year: '2567',
      title: 'นวัตกรรมเครื่องสีข้าวขนาดเล็กระดับชุมชน',
      category: 'Innovation (นวัตกรรม)', 
      status: 'reject', 
      submitDate: '15 ก.พ. 2024' 
    },
    { 
      id: 'APP-2023-142', 
      year: '2566',
      title: 'การพัฒนาผลการเรียนและติวเตอร์เพื่อนช่วยเพื่อน',
      category: 'Academic (เรียนดี)', 
      status: 'approved', 
      submitDate: '10 ม.ค. 2023' 
    },
    { 
      id: 'APP-2023-089', 
      year: '2566',
      title: 'ประธานค่ายอาสาพัฒนาชนบท',
      category: 'Activity (กิจกรรม)', 
      status: 'approved', 
      submitDate: '05 ม.ค. 2023' 
    }
  ];

  // Logic ค้นหา
  const filteredHistory = myHistory.filter(item => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      
      {/* --- Header --- */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="text-ku-main" /> ประวัติการเสนอชื่อ (My Applications)
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            รายการใบสมัครทั้งหมดที่คุณเคยส่งเข้าร่วมโครงการนิสิตดีเด่น
          </p>
        </div>
      </div>

      {/* --- Search & Filter --- */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="ค้นหาจากชื่อผลงาน หรือ รหัสใบสมัคร..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ku-main/50 focus:border-ku-main transition" 
          />
        </div>
      </div>

      {/* --- History Table --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">ปีการศึกษา</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">รายละเอียดผลงาน</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">วันที่ส่ง</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">สถานะล่าสุด</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">ดูข้อมูล</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-6 py-4 font-bold text-gray-700">{item.year}</td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400 font-mono">{item.id}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">
                          {item.category}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.submitDate}</td>
                  <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      to={`/student/ticket/${item.id}`} 
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition text-sm font-bold gap-1"
                    >
                      <Eye size={16} /> รายละเอียด
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                  ไม่พบประวัติการส่งใบสมัคร
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentHistory;