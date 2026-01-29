import React from 'react';
import StatusTimeline from '../../components/StatusTimeline';
import { FileText, Calendar } from 'lucide-react';

const Tracking = () => {
  // Mock Data: ข้อมูลใบสมัครที่ส่งไปแล้ว
  const application = {
    id: 'APP-2024-001',
    title: 'AI for Durian Grading',
    category: 'Innovation',
    submitDate: '28 Jan 2024',
    currentStatus: 'submit_by_dean', // ลองเปลี่ยนสถานะตรงนี้เล่นดูได้ครับ (เช่น 'approved', 'reject')
    history: [
      { status: 'Draft Created', date: '27 Jan 2024', by: 'Nattapong S.' },
      { status: 'Submitted', date: '28 Jan 2024', by: 'Nattapong S.' },
      { status: 'Advisor Verified', date: '29 Jan 2024', by: 'Dr. Somsak' },
      { status: 'Head of Dept. Approved', date: '30 Jan 2024', by: 'Asst. Prof. Malee' },
    ]
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ku-main">Application Tracking</h1>
        <p className="text-gray-500">Monitor the status of your submission.</p>
      </div>

      {/* Card Info */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-6">
          <div>
            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
              {application.category}
            </span>
            <h2 className="text-xl font-bold text-gray-800 mt-2">{application.title}</h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1"><FileText size={16} /> Ref: {application.id}</span>
              <span className="flex items-center gap-1"><Calendar size={16} /> Submitted: {application.submitDate}</span>
            </div>
          </div>
        </div>

        {/* Timeline Component ที่เราทำไว้ */}
        <div className="py-4">
          <StatusTimeline currentStatus={application.currentStatus} />
        </div>
      </div>

      {/* History Log (Optional) */}
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-4">Activity Log</h3>
        <div className="space-y-4">
          {application.history.map((log, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="font-medium text-gray-600">{log.status}</span>
              <div className="text-right">
                <span className="text-gray-500 block">{log.date}</span>
                <span className="text-xs text-gray-400">by {log.by}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Tracking;