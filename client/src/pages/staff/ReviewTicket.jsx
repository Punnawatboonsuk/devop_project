import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  User, 
  Clock, 
  Download,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import ActionModal from '../../components/ActionModal';
import StudentHistory from '../../components/StudentHistory';
import toast from 'react-hot-toast';

const ReviewTicket = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth(); 
  const [modalType, setModalType] = useState(null);

  // --- Mock Data ---
  const ticketData = {
    id: id,
    title: 'นวัตกรรมเครื่องสีข้าวขนาดเล็กระดับชุมชน (Community Rice Miller)',
    category: 'Innovation (นวัตกรรม)',
    description: 'โครงการนี้มีวัตถุประสงค์เพื่อสร้างเครื่องสีข้าวต้นทุนต่ำสำหรับเกษตรกรรายย่อยในจังหวัดสุพรรณบุรี โดยใช้วัสดุหาได้ง่ายในท้องถิ่น และประหยัดพลังงานกว่าเครื่องทั่วไป 30%...',
    student: {
      id: '642xxxxxxx',
      name: 'นายสมชาย ขยันเรียน',
      faculty: 'วิศวกรรมศาสตร์',
      department: 'วิศวกรรมเครื่องกล',
      gpa: '3.75',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Somchai'
    },
    files: [
      { name: 'Project_Full_Report.pdf', size: '2.5 MB', type: 'pdf' },
      { name: 'Certificate_Award.jpg', size: '1.2 MB', type: 'img' },
      { name: 'Advisor_Recommendation.pdf', size: '0.8 MB', type: 'pdf' }
    ],
    submittedDate: '15 Feb 2024',
    // 💡 ลองเปลี่ยนค่านี้เป็น 'approved' หรือ 'submit_by_dean' เพื่อทดสอบ Read-Only Mode
    currentStatus: 'submit_by_staff' 
  };

  // ✅ Logic: เช็คว่า User คนนี้มีสิทธิ์กดปุ่มหรือไม่?
  const isActionable = () => {
    // 1. ถ้ารายการจบไปแล้ว (Approved / Rejected) -> ห้ามแก้
    if (['approved', 'reject', 'announced'].includes(ticketData.currentStatus)) return false;

    // 2. ถ้าสถานะปัจจุบัน ตรงกับหน้าที่รับผิดชอบของ User -> ให้แก้ได้
    if (user?.role === 'STAFF' && ticketData.currentStatus === 'submit_by_staff') return true;
    if (user?.role === 'SUB_DEAN' && ticketData.currentStatus === 'submit_by_subdean') return true;
    if (user?.role === 'DEAN' && ticketData.currentStatus === 'submit_by_dean') return true;

    // 3. กรณีอื่น (เช่น Staff เข้ามาดูงานของ Dean) -> Read Only
    return false;
  };

  const getActionLabel = () => {
    switch (user?.role) {
      case 'STAFF': return 'ตรวจสอบความถูกต้อง (Verify)';
      case 'SUB_DEAN': return 'เสนอเพื่ออนุมัติ (Recommend)';
      case 'DEAN': return 'อนุมัติขั้นสุดท้าย (Final Approve)';
      default: return 'Approve';
    }
  };

  const getButtonColor = () => {
    if (user?.role === 'DEAN') return 'bg-purple-600 hover:bg-purple-700 shadow-purple-900/20';
    return 'bg-ku-main hover:bg-green-800 shadow-green-900/10';
  };

  const handleConfirm = (reason) => {
    console.log(`Action: ${modalType} by ${user?.role}, Reason: ${reason}`);
    if (modalType === 'approve') toast.success(`${getActionLabel()} สำเร็จ!`);
    else toast.error('ส่งกลับแก้ไข (Rejected) เรียบร้อย');
    setModalType(null);
    navigate('/staff/dashboard');
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between sticky top-0 bg-gray-50/90 backdrop-blur-sm z-30 py-4 border-b border-gray-200">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-ku-main transition font-medium">
          <ArrowLeft size={20} /> กลับไปหน้ารายการ
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ticket ID</span>
          <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-mono font-bold">#{id}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ================= LEFT COLUMN ================= */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Info Card */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3 border border-blue-100">
                {ticketData.category}
              </span>
              <h1 className="text-2xl font-bold text-gray-800 leading-tight">{ticketData.title}</h1>
            </div>
            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-8">
              <img src={ticketData.student.image} alt="student" className="w-14 h-14 rounded-full bg-white shadow-sm border border-gray-100" />
              <div className="flex-1">
                <p className="font-bold text-gray-800 text-lg">{ticketData.student.name}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><User size={14}/> {ticketData.student.id}</span>
                  <span>|</span><span>{ticketData.student.faculty}</span><span>|</span><span>{ticketData.student.department}</span>
                </div>
              </div>
              <div className="text-right pl-4 border-l border-gray-300">
                <p className="text-xs text-gray-400 font-bold uppercase">GPAX</p>
                <p className="font-black text-ku-main text-2xl">{ticketData.student.gpa}</p>
              </div>
            </div>
            <div className="prose max-w-none text-gray-600">
              <h3 className="text-gray-800 font-bold text-lg mb-3 flex items-center gap-2"><FileText size={20} className="text-ku-main"/> รายละเอียดโครงการ</h3>
              <p className="leading-relaxed bg-white p-4 rounded-lg border border-gray-100 shadow-inner">{ticketData.description}</p>
            </div>
          </div>

          {/* 2. Files Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Download size={20} className="text-ku-main" /> เอกสารแนบ (Attachments)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ticketData.files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition cursor-pointer group">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${file.type === 'pdf' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{file.type.toUpperCase()}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-700 truncate group-hover:text-blue-700">{file.name}</p>
                      <p className="text-xs text-gray-400">{file.size}</p>
                    </div>
                  </div>
                  <Download size={18} className="text-gray-300 group-hover:text-blue-600" />
                </div>
              ))}
            </div>
          </div>

          {/* 3. Approval Timeline */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><Clock size={20} className="text-ku-main" /> เส้นทางการอนุมัติ (Approval Log)</h3>
            <div className="relative pl-4 space-y-8 border-l-2 border-gray-200 ml-3">
              <div className="relative">
                <div className="absolute -left-[21px] top-0 w-8 h-8 rounded-full bg-ku-main text-white flex items-center justify-center border-4 border-white shadow-sm z-10"><span className="text-xs font-bold">1</span></div>
                <div><p className="text-sm font-bold text-gray-800">Student Submitted</p><p className="text-xs text-gray-500">{ticketData.submittedDate}</p></div>
              </div>
              <div className="relative">
                <div className={`absolute -left-[21px] top-0 w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10 ${['SUB_DEAN', 'DEAN'].includes(user?.role) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {['SUB_DEAN', 'DEAN'].includes(user?.role) ? <CheckCircle2 size={16}/> : <span className="text-xs font-bold">2</span>}
                </div>
                <div>
                  <p className={`text-sm font-bold ${['SUB_DEAN', 'DEAN'].includes(user?.role) ? 'text-gray-800' : 'text-gray-400'}`}>Staff Verification</p>
                  {['SUB_DEAN', 'DEAN'].includes(user?.role) ? <div className="mt-2 bg-green-50 p-3 rounded-lg text-xs text-green-800 border border-green-100">"Verified: เอกสารครบถ้วน"<br/><span className="font-bold opacity-75">- Staff ID: ST001</span></div> : <p className="text-xs text-gray-400">Waiting...</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN (Action) ================= */}
        <div className="lg:col-span-4 space-y-6">
          <div className="sticky top-24 space-y-6">
            
            {/* ✅ Action Panel with Read-Only Logic */}
            <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
              <div className={`h-2 w-full ${user?.role === 'DEAN' ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-ku-main to-ku-accent'}`}></div>
              <div className="p-6">
                <div className="mb-6 text-center">
                  <h3 className="font-bold text-gray-800 text-lg">การจัดการคำร้อง</h3>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold mt-2">
                    <User size={12} /> Role: {user?.role}
                  </div>
                </div>

                {/* ✅ ถ้า Actionable -> โชว์ปุ่ม, ถ้าไม่ -> โชว์ Status Banner */}
                {isActionable() ? (
                  <div className="space-y-3">
                    <button onClick={() => setModalType('approve')} className={`w-full py-4 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${getButtonColor()}`}>
                      <CheckCircle2 size={20} /> {getActionLabel()}
                    </button>
                    <button onClick={() => setModalType('reject')} className="w-full py-4 bg-white text-red-600 border-2 border-red-100 hover:bg-red-50 hover:border-red-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95">
                      <XCircle size={20} /> ส่งกลับแก้ไข (Reject)
                    </button>
                    <p className="text-[10px] text-gray-400 text-center mt-4">*การอนุมัติจะถูกบันทึกในระบบ Audit Log ทันที</p>
                  </div>
                ) : (
                  <div className={`p-4 rounded-xl border text-center font-bold text-sm
                    ${['approved', 'announced'].includes(ticketData.currentStatus) ? 'bg-green-50 text-green-700 border-green-200' : 
                      ticketData.currentStatus === 'reject' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {['approved', 'announced'].includes(ticketData.currentStatus) ? '✅ อนุมัติ/ประกาศผลแล้ว' : 
                     ticketData.currentStatus === 'reject' ? '❌ ถูกปฏิเสธ/ตีกลับแล้ว' : '🔒 อยู่ในขั้นตอนการพิจารณาอื่น'}
                  </div>
                )}
              </div>
            </div>

            <StudentHistory studentId={ticketData.student.id} />

            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex gap-3 items-start">
              <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-orange-800"><strong>ข้อควรระวัง:</strong> โปรดตรวจสอบเอกสารแนบให้ครบถ้วนก่อนทำการอนุมัติ</div>
            </div>
          </div>
        </div>
      </div>

      <ActionModal 
        isOpen={!!modalType} 
        type={modalType} 
        onClose={() => setModalType(null)} 
        onConfirm={handleConfirm}
        title={modalType === 'approve' ? `ยืนยัน: ${getActionLabel()}` : 'ระบุเหตุผลที่ปฏิเสธ'}
      />
    </div>
  );
};

export default ReviewTicket;