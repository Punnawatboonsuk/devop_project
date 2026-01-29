import React from 'react';
import { Filter, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge'; // อย่าลืม path

const StaffDashboard = () => {
  // Mock Data: รายการที่ส่งเข้ามา
  const pendingTickets = [
    { id: 1, studentId: '6430214521', name: 'Somsri Wirat', category: 'Academic', submittedDate: '2024-01-28', status: 'submit_by_staff' },
    { id: 2, studentId: '6430559281', name: 'Kittipong J.', category: 'Innovation', submittedDate: '2024-01-29', status: 'submit_by_staff' },
    { id: 3, studentId: '6430112233', name: 'Naree S.', category: 'Activity', submittedDate: '2024-01-30', status: 'submit_by_subdean' }, // คนนี้สถานะไปไกลแล้ว
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-ku-main">Pending Approvals</h1>
            <p className="text-gray-500">Manage student award applications.</p>
        </div>
        <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
                <Filter size={18} /> Filter
            </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input 
            type="text" 
            placeholder="Search by Student ID or Name..." 
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ku-main focus:border-transparent outline-none"
        />
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                    <th className="p-4">Student Info</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Submission Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Action</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {pendingTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                            <div className="font-bold text-gray-800">{ticket.name}</div>
                            <div className="text-xs text-gray-500">ID: {ticket.studentId}</div>
                        </td>
                        <td className="p-4 text-sm text-gray-600">{ticket.category}</td>
                        <td className="p-4 text-sm text-gray-600">{ticket.submittedDate}</td>
                        <td className="p-4">
                            <StatusBadge status={ticket.status} />
                        </td>
                        <td className="p-4 text-right">
                            <Link 
                                to={`/staff/review/${ticket.id}`}
                                className="inline-block px-4 py-1.5 bg-ku-main text-white text-sm font-medium rounded-lg hover:bg-green-800 transition"
                            >
                                Review
                            </Link>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffDashboard;