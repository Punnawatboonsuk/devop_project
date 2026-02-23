import React, { useState } from 'react';
import FormStepper from '../../components/FormStepper';
import { ArrowRight, ArrowLeft, UploadCloud, Info, CheckCircle2, FileText, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CreateTicket = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({ category: '', title: '', description: '' });

  // 💡 Config: เงื่อนไขและไฟล์ที่ต้องการของแต่ละหมวดหมู่
  const categoryConfig = {
    'Academic': {
      th: 'ด้านการเรียนดี',
      terms: ['ต้องมีเกรดเฉลี่ยสะสม (GPAX) ไม่ต่ำกว่า 3.50', 'ต้องไม่เคยทุจริตการสอบ', 'แนบใบแสดงผลการเรียน (Transcript) ล่าสุด'],
      requiredFiles: [
        { id: 'transcript', label: 'ใบแสดงผลการเรียน (Transcript)', types: 'PDF', icon: FileText },
        { id: 'cert', label: 'เกียรติบัตรที่เกี่ยวข้อง (ถ้ามี)', types: 'PDF, JPG', icon: ImageIcon }
      ]
    },
    'Innovation': {
      th: 'ด้านความคิดสร้างสรรค์และนวัตกรรม',
      terms: ['เป็นผลงานที่สร้างสรรค์ขึ้นใหม่หรือต่อยอดให้ดีขึ้น', 'ผลงานต้องเคยผ่านการประกวดหรือนำไปใช้งานจริง', 'ต้องมีรูปถ่ายผลงานที่เห็นได้ชัดเจน'],
      requiredFiles: [
        { id: 'report', label: 'รายงานสรุปผลงาน/โครงงาน (Abstract)', types: 'PDF', icon: FileText },
        { id: 'photo', label: 'รูปถ่ายชิ้นงานนวัตกรรม', types: 'JPG, PNG', icon: ImageIcon },
        { id: 'advisor', label: 'ใบรับรองจากอาจารย์ที่ปรึกษา', types: 'PDF', icon: FileText }
      ]
    },
    'Activity': {
      th: 'ด้านกิจกรรมเสริมหลักสูตร',
      terms: ['มีชั่วโมงกิจกรรมทรานสคริปต์กิจกรรมไม่น้อยกว่า 100 ชั่วโมง', 'มีตำแหน่งเป็นผู้นำหรือคณะกรรมการชมรม', 'ต้องแนบทรานสคริปต์กิจกรรม'],
      requiredFiles: [
        { id: 'activity_transcript', label: 'ทรานสคริปต์กิจกรรม (Activity Transcript)', types: 'PDF', icon: FileText },
        { id: 'photo', label: 'รูปถ่ายขณะปฏิบัติกิจกรรม', types: 'JPG, PNG', icon: ImageIcon }
      ]
    }
  };

  const handleNext = () => {
    // Validation เบื้องต้น
    if (currentStep === 1 && !formData.category) return alert('โปรดเลือกประเภทรางวัลก่อน');
    if (currentStep === 2 && (!formData.title || !formData.description)) return alert('โปรดกรอกข้อมูลให้ครบถ้วน');
    
    if (currentStep < 3) setCurrentStep(curr => curr + 1);
    else navigate('/student/dashboard'); // Submit เสร็จกลับหน้าหลัก
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(curr => curr - 1);
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-2">เสนอชื่อเข้าพิจารณา</h1>
        <p className="text-gray-500">ระบบคัดเลือกนิสิตดีเด่น มหาวิทยาลัยเกษตรศาสตร์</p>
      </div>
      
      <FormStepper currentStep={currentStep} />

      <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-gray-100 min-h-[450px] mt-8">
        
        {/* ================= STEP 1: CATEGORY & TERMS ================= */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-ku-main text-white flex items-center justify-center text-sm">1</span>
              เลือกประเภทรางวัลที่ต้องการเสนอชื่อ
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.keys(categoryConfig).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFormData({ ...formData, category: cat })}
                  className={`p-6 rounded-2xl border-2 text-left transition-all group
                    ${formData.category === cat 
                      ? 'border-ku-main bg-ku-light ring-4 ring-ku-main/10' 
                      : 'border-gray-200 hover:border-ku-main hover:shadow-md'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg
                      ${formData.category === cat ? 'bg-ku-main text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-ku-light group-hover:text-ku-main'}`}>
                      {cat.charAt(0)}
                    </span>
                    {formData.category === cat && <CheckCircle2 className="text-ku-main" size={24} />}
                  </div>
                  <span className="font-bold text-gray-800 text-lg block">{cat}</span>
                  <span className="text-sm text-gray-500">{categoryConfig[cat].th}</span>
                </button>
              ))}
            </div>

            {/* แสดงเงื่อนไขเมื่อมีการเลือก Category */}
            {formData.category && (
              <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-6 animate-fade-in">
                <h3 className="text-blue-800 font-bold flex items-center gap-2 mb-4">
                  <Info size={20} /> เงื่อนไขการลงสมัครหมวด {formData.category}
                </h3>
                <ul className="space-y-2">
                  {categoryConfig[formData.category].terms.map((term, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-blue-900">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                      <span>{term}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 2: DETAILS & FILE UPLOAD ================= */}
        {currentStep === 2 && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-ku-main text-white flex items-center justify-center text-sm">2</span>
              รายละเอียด และ เอกสารแนบ
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อผลงาน / หัวข้อที่เสนอ (Project Title) <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-xl p-4 text-sm focus:ring-2 focus:ring-ku-main/50 focus:border-ku-main outline-none transition"
                  placeholder="เช่น นวัตกรรมเครื่องคัดแยกทุเรียนด้วย AI"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">บทคัดย่อ / คำอธิบายแบบย่อ (Abstract) <span className="text-red-500">*</span></label>
                <textarea 
                  rows="4"
                  className="w-full border border-gray-300 rounded-xl p-4 text-sm focus:ring-2 focus:ring-ku-main/50 focus:border-ku-main outline-none transition"
                  placeholder="อธิบายผลงาน หรือ กิจกรรมของคุณให้คณะกรรมการเข้าใจสั้นๆ..."
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
            </div>

            {/* Dynamic File Upload Section */}
            <div className="pt-6 border-t border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4">อัปโหลดหลักฐานตามเงื่อนไข (Required Files)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryConfig[formData.category].requiredFiles.map((fileDef, idx) => (
                  <div key={idx} className="border-2 border-dashed border-gray-200 rounded-2xl p-6 hover:border-ku-main hover:bg-gray-50 transition cursor-pointer group flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600 mb-3 transition">
                      <fileDef.icon size={24} />
                    </div>
                    <p className="font-bold text-sm text-gray-700 mb-1">{fileDef.label}</p>
                    <p className="text-xs text-gray-400 font-mono mb-3">รองรับ: {fileDef.types}</p>
                    <button className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg group-hover:bg-ku-main group-hover:text-white transition">
                      เลือกไฟล์
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: REVIEW ================= */}
        {currentStep === 3 && (
          <div className="text-center py-8 animate-fade-in max-w-lg mx-auto">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border-4 border-white ring-1 ring-green-100">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-3 tracking-tight">ตรวจสอบข้อมูลก่อนส่ง</h2>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              กรุณาตรวจสอบข้อมูลให้ถี่ถ้วน เมื่อกดส่งแล้วคุณจะไม่สามารถแก้ไขเอกสารได้จนกว่าจะมีการร้องขอจากเจ้าหน้าที่
            </p>
            
            <div className="bg-gray-50 p-6 rounded-2xl text-left border border-gray-100 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase">ประเภทที่สมัคร</p>
                  <p className="font-bold text-ku-main">{formData.category} ({categoryConfig[formData.category].th})</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase">ชื่อผลงาน</p>
                  <p className="font-bold text-gray-800">{formData.title}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase">หลักฐานที่แนบ</p>
                  <p className="text-sm font-medium text-gray-600 flex items-center gap-1 mt-1">
                    <CheckCircle2 size={14} className="text-green-500"/> อัปโหลดครบถ้วน ({categoryConfig[formData.category].requiredFiles.length} ไฟล์)
                  </p>
                </div>
            </div>
          </div>
        )}

      </div>

      {/* --- Navigation Buttons --- */}
      <div className="flex justify-between mt-8">
        <button 
          onClick={handleBack}
          disabled={currentStep === 1}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all
            ${currentStep === 1 ? 'text-gray-300 cursor-not-allowed opacity-50' : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm'}`}
        >
          <ArrowLeft size={18} /> ย้อนกลับ
        </button>

        <button 
          onClick={handleNext}
          className="flex items-center gap-2 bg-ku-main text-white px-8 py-3 rounded-xl hover:bg-green-800 transition-all shadow-lg shadow-green-900/20 font-bold active:scale-95"
        >
          {currentStep === 3 ? 'ยืนยันการส่งใบสมัคร' : 'ขั้นตอนถัดไป'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default CreateTicket;