import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertTriangle, 
  UploadCloud, 
  Save, 
  FileText, 
  Image as ImageIcon, 
  CheckCircle2,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

const EditTicket = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // 💡 MOCK DATA: จำลองข้อมูลใบสมัครที่โดนตีกลับ (ดึงจาก Database จริงในอนาคต)
  const [formData, setFormData] = useState({
    id: id || 'APP-2024-001',
    category: 'Innovation', // หมวดหมู่นวัตกรรม
    title: 'นวัตกรรมเครื่องสีข้าวขนาดเล็ก',
    description: 'โครงการนี้มีวัตถุประสงค์เพื่อสร้างเครื่องสีข้าวต้นทุนต่ำสำหรับเกษตรกรรายย่อย...',
    rejectReason: 'ไฟล์ใบรับรองอาจารย์ที่ปรึกษาไม่ชัดเจน และขาดรูปถ่ายผลงานประกอบการพิจารณา โปรดแก้ไขและส่งใหม่',
    rejectedBy: 'Staff ID: ST001',
  });

  // Config: เงื่อนไขและไฟล์ที่ต้องการของแต่ละหมวดหมู่ (ดึงมาจาก CreateTicket)
  const categoryConfig = {
    'Innovation': {
      th: 'ด้านความคิดสร้างสรรค์และนวัตกรรม',
      requiredFiles: [
        { id: 'report', label: 'รายงานสรุปผลงาน/โครงงาน (Abstract)', types: 'PDF', icon: FileText, status: 'ok' },
        { id: 'photo', label: 'รูปถ่ายชิ้นงานนวัตกรรม', types: 'JPG, PNG', icon: ImageIcon, status: 'missing' },
        { id: 'advisor', label: 'ใบรับรองจากอาจารย์ที่ปรึกษา', types: 'PDF', icon: FileText, status: 'rejected' }
      ]
    },
    // หมวดอื่นๆ ซ่อนไว้ก่อนเพื่อความกระชับ
  };

  const handleSave = () => {
    // จำลองการบันทึกข้อมูล
    toast.success('อัปเดตและส่งใบสมัครใหม่เรียบร้อยแล้ว!');
    navigate('/student/dashboard');
  };

  const currentConfig = categoryConfig[formData.category];

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-6">
      
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-2 text-gray-500 hover:text-ku-main transition font-medium"
        >
          <ArrowLeft size={20} /> กลับไปหน้าหลัก
        </button>
        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-sm font-mono font-bold">
          Ref: {formData.id}
        </span>
      </div>

      <div className="mb-4">
        <h1 className="text-3xl font-black text-gray-800 tracking-tight">แก้ไขใบเสนอชื่อ</h1>
        <p className="text-gray-500 mt-1">กรุณาแก้ไขข้อมูลและเอกสารตามข้อเสนอแนะของเจ้าหน้าที่</p>
      </div>

      {/* --- REJECT REASON ALERT --- */}
      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 shadow-sm relative overflow-hidden animate-fade-in">
        <div className="absolute top-0 left-0 w-2 h-full bg-red-500"></div>
        <div className="flex items-start gap-4">
          <div className="bg-red-100 p-3 rounded-full text-red-600 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-800">ข้อเสนอแนะ / สาเหตุที่ส่งกลับแก้ไข</h3>
            <p className="text-red-700 font-medium mt-2 bg-white/50 p-4 rounded-xl border border-red-100">
              "{formData.rejectReason}"
            </p>
            <p className="text-xs text-red-500 mt-3 font-medium flex items-center gap-1">
              <Info size={14} /> ผู้ตรวจสอบ: {formData.rejectedBy}
            </p>
          </div>
        </div>
      </div>

      {/* --- EDIT FORM --- */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-8">
        
        {/* Category (Read-only ปกติหมวดหมู่จะไม่ให้เปลี่ยนแล้วถ้าส่งไปแล้ว) */}
        <div>
          <label className="block text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">ประเภทที่เสนอชื่อ (ไม่สามารถเปลี่ยนได้)</label>
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-center gap-3 text-gray-600">
             <span className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center font-bold text-gray-500">
               {formData.category.charAt(0)}
             </span>
             <span className="font-bold">{formData.category} ({currentConfig?.th})</span>
          </div>
        </div>

        {/* Text Details */}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อผลงาน / หัวข้อที่เสนอ <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              className="w-full border border-gray-300 rounded-xl p-4 text-sm focus:ring-2 focus:ring-ku-main/50 focus:border-ku-main outline-none transition"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">บทคัดย่อ / คำอธิบายแบบย่อ <span className="text-red-500">*</span></label>
            <textarea 
              rows="4"
              className="w-full border border-gray-300 rounded-xl p-4 text-sm focus:ring-2 focus:ring-ku-main/50 focus:border-ku-main outline-none transition"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
        </div>

        {/* File Upload Section (ไฮไลต์จุดที่ต้องแก้) */}
        <div className="pt-6 border-t border-gray-100">
          <div className="flex justify-between items-end mb-4">
            <h3 className="font-bold text-gray-800">จัดการเอกสารแนบ (Attachments)</h3>
            <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded border border-red-100">
              * โปรดอัปโหลดไฟล์ที่ถูกตีกลับใหม่
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentConfig?.requiredFiles.map((fileDef, idx) => (
              <div key={idx} className={`border-2 rounded-2xl p-5 transition relative
                ${fileDef.status === 'rejected' || fileDef.status === 'missing' 
                  ? 'border-red-300 bg-red-50/30' // ไฮไลต์สีแดงถ้าไฟล์มีปัญหา
                  : 'border-gray-200 bg-gray-50 opacity-75'}`}> {/* ไฟล์ที่ผ่านแล้วจะจางลง */}
                
                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                   {fileDef.status === 'ok' && <CheckCircle2 className="text-green-500" size={20} />}
                   {(fileDef.status === 'rejected' || fileDef.status === 'missing') && <AlertTriangle className="text-red-500 animate-pulse" size={20} />}
                </div>

                <div className="flex flex-col items-center text-center mt-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3
                    ${fileDef.status === 'ok' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    <fileDef.icon size={24} />
                  </div>
                  <p className="font-bold text-sm text-gray-800 mb-1">{fileDef.label}</p>
                  <p className="text-xs text-gray-500 font-mono mb-4">
                    {fileDef.status === 'ok' ? 'ไฟล์สมบูรณ์แล้ว' : 'ต้องอัปโหลดใหม่ (รองรับ: ' + fileDef.types + ')'}
                  </p>
                  
                  <button className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2
                    ${fileDef.status === 'ok' 
                      ? 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50' 
                      : 'bg-ku-main text-white hover:bg-green-800 shadow-md'}`}>
                    <UploadCloud size={16} /> 
                    {fileDef.status === 'ok' ? 'อัปโหลดใหม่ (แทนที่)' : 'เลือกไฟล์'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- ACTION BUTTONS --- */}
      <div className="flex justify-end pt-4">
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 bg-ku-main text-white px-8 py-3.5 rounded-xl hover:bg-green-800 transition-all shadow-lg shadow-green-900/20 font-bold text-lg active:scale-95"
        >
          <Save size={20} /> ยืนยันการส่งใบสมัครใหม่ (Re-Submit)
        </button>
      </div>

    </div>
  );
};

export default EditTicket;