import React from 'react';
import { History, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

const StudentHistory = ({ studentId }) => {
  // Mock Data: จำลองประวัติการสมัครของนิสิตคนนี้ในอดีต (หรือรายการอื่นในปีนี้)
  const history = [
    {
      id: 'TKT-2023-005',
      year: '2023',
      category: 'Academic',
      status: 'approved',
      result: 'Winner',
      date: '10 Feb 2023'
    },
    {
      id: 'TKT-2024-001',
      year: '2024',
      category: 'Innovation',
      status: 'reject',
      result: 'Document Missing',
      date: '15 Jan 2024'
    }
  ];

  const getStatusIcon = (status) => {
    switch(status) {
      case 'approved': return <CheckCircle size={16} className="text-green-500" />;
      case 'reject': return <XCircle size={16} className="text-red-500" />;
      default: return <Clock size={16} className="text-gray-400" />;
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
        <History size={20} className="text-ku-main" /> ประวัติการสมัครของนิสิต (Student History)
      </h3>

      <div className="space-y-4">
        {history.length > 0 ? history.map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition">
            <div className="mt-1">{getStatusIcon(item.status)}</div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <p className="text-sm font-bold text-gray-800">{item.category}</p>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.year}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Status: <span className="capitalize">{item.status}</span></p>
              
              {/* กรณีถูก Reject หรือได้รางวัล ให้แสดงเหตุผล/ผลลัพธ์ */}
              {item.result && (
                <div className={`mt-2 text-xs p-2 rounded flex items-center gap-2
                  ${item.status === 'reject' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                  {item.status === 'reject' ? <AlertCircle size={12} /> : <CheckCircle size={12} />}
                  {item.result}
                </div>
              )}
            </div>
          </div>
        )) : (
          <p className="text-sm text-gray-400 text-center py-4">ไม่พบประวัติการสมัครก่อนหน้า</p>
        )}
      </div>
    </div>
  );
};

export default StudentHistory;