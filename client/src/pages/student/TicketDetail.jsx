import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Download, Clock, CheckCircle2, XCircle } from 'lucide-react';

const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // 💡 MOCK DATA: ดึงข้อมูลใบสมัครตาม ID
  const ticketData = {
    id: id,
    year: '2566',
    title: 'การพัฒนาผลการเรียนและติวเตอร์เพื่อนช่วยเพื่อน',
    category: 'Academic (เรียนดี)',
    description: 'จัดตั้งกลุ่มติวเตอร์เพื่อนช่วยเพื่อนในภาควิชา เพื่อทบทวนบทเรียนก่อนสอบ ส่งผลให้ค่าเฉลี่ยคะแนนสอบของเพื่อนในกลุ่มเพิ่มขึ้น 15%...',
    status: 'approved', // หรือ reject, pending
    submittedDate: '10 ม.ค. 2023',
    files: [
      { name: 'Transcript_2566.pdf', size: '1.2 MB', type: 'pdf' },
      { name: 'Certificate_Tutor.jpg', size: '0.8 MB', type: 'img' }
    ],
    timeline: [
      { step: 'Student Submitted', date: '10 ม.ค. 2023', status: 'done', note: 'ส่งใบสมัครสำเร็จ' },
      { step: 'Staff Verified', date: '12 ม.ค. 2023', status: 'done', note: 'เอกสารครบถ้วน' },
      { step: 'Sub-Dean Recommended', date: '14 ม.ค. 2023', status: 'done', note: 'เห็นสมควรส่งต่อ' },
      { step: 'Final Approved (Dean)', date: '15 ม.ค. 2023', status: 'done', note: 'อนุมัติระดับคณะเรียบร้อย' },
    ]
  };

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-2 text-gray-500 hover:text-ku-main transition font-medium"
        >
          <ArrowLeft size={20} /> กลับหน้ารวมประวัติ
        </button>
        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-sm font-mono font-bold">
          Ref: {ticketData.id}
        </span>
      </div>

      {/* Main Content */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase mb-3 border border-blue-100">
              ปีการศึกษา {ticketData.year} | {ticketData.category}
            </span>
            <h1 className="text-2xl font-bold text-gray-800 leading-tight">{ticketData.title}</h1>
          </div>
          <div className="text-right">
             {ticketData.status === 'approved' && <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-sm font-bold"><CheckCircle2 size={16}/> อนุมัติแล้ว</span>}
             {ticketData.status === 'reject' && <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-sm font-bold"><XCircle size={16}/> ถูกปฏิเสธ</span>}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-8">
          <p className="text-sm font-bold text-gray-500 mb-2 uppercase">บทคัดย่อ / คำอธิบาย</p>
          <p className="text-gray-700 leading-relaxed">{ticketData.description}</p>
        </div>

        {/* Files Section */}
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Download size={20} className="text-ku-main" /> เอกสารแนบที่ส่งไป (Submitted Files)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {ticketData.files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-white hover:border-blue-300 transition cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-500">
                  {file.type.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-700 group-hover:text-blue-600">{file.name}</p>
                  <p className="text-xs text-gray-400">{file.size}</p>
                </div>
              </div>
              <Download size={18} className="text-gray-400 group-hover:text-blue-600" />
            </div>
          ))}
        </div>

        {/* Timeline Section */}
        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Clock size={20} className="text-ku-main" /> เส้นทางการอนุมัติ (Approval Log)
        </h3>
        <div className="relative pl-4 space-y-6 border-l-2 border-gray-100 ml-3">
          {ticketData.timeline.map((log, index) => (
            <div key={index} className="relative">
              <div className="absolute -left-[21px] top-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center border-4 border-white shadow-sm z-10">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">{log.step}</p>
                <p className="text-xs text-gray-500">{log.date}</p>
                <div className="mt-1 bg-green-50/50 p-2 rounded-lg text-xs text-green-700 border border-green-100 inline-block">
                  {log.note}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default TicketDetail;