import React, { useState } from 'react';
import { Search, Edit2, CheckCircle, Save } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';

const Verification = () => {
  // Mock Data: รายการที่ผ่าน Dean มาแล้ว
  const [tickets, setTickets] = useState([
    { id: 101, name: 'Somsri Wirat', category: 'Academic', gpa: 3.85, status: 'dev_review' },
    { id: 102, name: 'Kittipong J.', category: 'Sports', gpa: 3.20, status: 'dev_review' },
    { id: 103, name: 'Wichai K.', category: 'Innovation', gpa: 3.50, status: 'dev_review' },
  ]);

  // State สำหรับการแก้ไข (Editing Mode)
  const [editingId, setEditingId] = useState(null);
  const [tempCategory, setTempCategory] = useState('');

  const handleEditClick = (ticket) => {
    setEditingId(ticket.id);
    setTempCategory(ticket.category);
  };

  const handleSave = (id) => {
    // จำลองการบันทึกข้อมูลใหม่
    setTickets(tickets.map(t => 
      t.id === id ? { ...t, category: tempCategory } : t
    ));
    setEditingId(null);
  };

  const handleVerify = (id) => {
    if(window.confirm('Confirm nomination for voting phase?')) {
        setTickets(tickets.map(t => 
            t.id === id ? { ...t, status: 'nominated' } : t
        ));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ku-main">Verification Console</h1>
          <p className="text-gray-500">Review and verify applications before voting.</p>
        </div>
        <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-lg text-sm font-medium">
            Pending Verify: {tickets.filter(t => t.status === 'dev_review').length}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
            <tr>
              <th className="p-4">Candidate</th>
              <th className="p-4">GPA</th>
              <th className="p-4">Award Category</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium text-gray-800">{ticket.name}</td>
                <td className="p-4 text-gray-600">{ticket.gpa}</td>
                
                {/* ส่วนนี้คือทีเด็ด: Admin แก้ไข Category ได้ */}
                <td className="p-4">
                  {editingId === ticket.id ? (
                    <select 
                        className="border border-ku-main rounded p-1 text-sm outline-none"
                        value={tempCategory}
                        onChange={(e) => setTempCategory(e.target.value)}
                    >
                        <option value="Academic">Academic</option>
                        <option value="Innovation">Innovation</option>
                        <option value="Sports">Sports</option>
                        <option value="Activity">Activity</option>
                    </select>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-700">
                        {ticket.category}
                    </span>
                  )}
                </td>

                <td className="p-4"><StatusBadge status={ticket.status} /></td>
                
                <td className="p-4 text-right flex justify-end gap-2">
                  {ticket.status === 'dev_review' && (
                    <>
                        {editingId === ticket.id ? (
                            <button 
                                onClick={() => handleSave(ticket.id)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded" title="Save"
                            >
                                <Save size={18} />
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleEditClick(ticket)}
                                className="p-2 text-gray-500 hover:bg-gray-100 rounded" title="Edit Category"
                            >
                                <Edit2 size={18} />
                            </button>
                        )}

                        <button 
                            onClick={() => handleVerify(ticket.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-ku-main text-white text-sm rounded-lg hover:bg-green-800"
                        >
                            <CheckCircle size={16} /> Verify
                        </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Verification;