import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  UploadCloud
} from 'lucide-react';
import FormStepper from '../../components/FormStepper';
import FacultyDepartmentSelector from '../../components/FacultyDepartmentSelector';
import { authenticatedApiRequest } from '../../utils/api';

const AWARD_OPTIONS = [
  { value: 'activity_enrichment', label: '1.1. ด้านกิจกรรมเสริมหลักสูตร' },
  { value: 'creativity_innovation', label: '1.2. ด้านความคิดสร้างสรรค์และนวัตกรรม' },
  { value: 'good_behavior', label: '1.3. ด้านความประพฤติดี' }
];
const AWARD_VALUES = new Set(AWARD_OPTIONS.map((option) => option.value));

const BASE_REQUIRED_FILES = [
  { key: 'transcript', label: 'ใบแสดงผลการเรียน (Transcript)', icon: FileText, accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'profile_photo', label: 'รูปถ่ายหน้าตรง', icon: ImageIcon, accept: '.jpg,.jpeg,.png' }
];

const AWARD_REQUIRED_FILES = {
  activity_enrichment: [
    ...BASE_REQUIRED_FILES,
    { key: 'certificates', label: 'ใบรับรองกิจกรรม (certificate.pdf)', icon: FileText, accept: '.pdf' },
    { key: 'activity_hours_proof', label: 'รายงานกิจกรรม/สรุปชั่วโมงกิจกรรม (activity_report.pdf)', icon: FileText, accept: '.pdf' },
    { key: 'portfolio', label: 'รายละเอียดบทบาทหน้าที่และผลลัพธ์ของกิจกรรม', icon: FileText, accept: '.pdf,.doc,.docx' }
  ],
  creativity_innovation: [
    ...BASE_REQUIRED_FILES,
    { key: 'portfolio', label: 'เอกสารอธิบายผลงาน (prototype_doc.pdf)', icon: FileText, accept: '.pdf' },
    { key: 'certificates', label: 'หลักฐานผลงานหรือรางวัล (certificate.pdf)', icon: FileText, accept: '.pdf' }
  ],
  good_behavior: [
    ...BASE_REQUIRED_FILES,
    { key: 'recommendation_letter', label: 'หนังสือรับรองความประพฤติ (certificate.pdf)', icon: FileText, accept: '.pdf' },
    { key: 'activity_hours_proof', label: 'รายงานกิจกรรมจิตอาสา (activity_report.pdf)', icon: FileText, accept: '.pdf' }
  ]
};

const AWARD_OPTIONAL_FILES = {
  activity_enrichment: [
    { key: 'recommendation_letter', label: 'ภาพกิจกรรม / หนังสือรับรองเพิ่มเติม', icon: UploadCloud, accept: '.pdf,.jpg,.jpeg,.png' }
  ],
  creativity_innovation: [
    { key: 'activity_hours_proof', label: 'วิดีโอ Demo / ลิงก์สาธิต (แนบเป็นเอกสารอ้างอิง)', icon: UploadCloud, accept: '.pdf' },
    { key: 'recommendation_letter', label: 'สิทธิบัตร / งานตีพิมพ์ / Portfolio เพิ่มเติม', icon: UploadCloud, accept: '.pdf,.doc,.docx' }
  ],
  good_behavior: [
    { key: 'certificates', label: 'ภาพกิจกรรม / หลักฐานการช่วยเหลือเพิ่มเติม', icon: UploadCloud, accept: '.pdf,.jpg,.jpeg,.png' }
  ]
};

const AWARD_DESCRIPTION_PROMPTS = {
  activity_enrichment:
    'โปรดระบุ: ชื่อกิจกรรม, ประเภทกิจกรรม, ระยะเวลา, ชั่วโมงสะสม, บทบาทหน้าที่, ผลลัพธ์ที่เกิดกับมหาวิทยาลัย/สังคม และการรับรองจากอาจารย์ที่ปรึกษา',
  creativity_innovation:
    'โปรดระบุ: ชื่อผลงาน, ลักษณะผลงาน, ระดับผลงาน, รายละเอียดแนวคิดและความใหม่, Impact ที่เกิดขึ้นจริง และสถานะการใช้งานจริง/ทดลองใช้',
  good_behavior:
    'โปรดระบุ: ประวัติการทำความดี, กิจกรรมจิตอาสา, ระยะเวลาที่ทำต่อเนื่อง, การเป็นแบบอย่างที่ดี และข้อมูลหนังสือรับรอง'
};

const AWARD_CONDITIONS = {
  activity_enrichment: [
    'ต้องมีชั่วโมงกิจกรรมตามเกณฑ์ที่มหาวิทยาลัยกำหนด',
    'ต้องมีบทบาทชัดเจน (ไม่ใช่แค่เข้าร่วม)'
  ],
  creativity_innovation: [
    'ต้องเป็นผลงานที่นิสิตมีส่วนสร้างจริง',
    'ต้องแสดงความใหม่หรือการแก้ปัญหาอย่างชัดเจน'
  ],
  good_behavior: [
    'ต้องไม่มีประวัติวินัยนิสิต',
    'ต้องแสดงความต่อเนื่องของพฤติกรรมดี ไม่ใช่ทำครั้งเดียว'
  ]
};

const CLOSED_PHASES = new Set(['CLOSED_NOMINATION', 'REVIEW_END', 'VOTING', 'VOTING_END', 'CERTIFICATE']);
const ACTIVE_STATUSES = new Set(['draft', 'submitted_by_student', 'reviewed_by_staff', 'reviewed_by_subdean', 'reviewed_by_dean', 'approved', 'returned']);
const REAPPLY_ALLOWED_STATUSES = new Set(['rejected', 'returned', 'not_approved', 'expired', 'dq']);

async function parseMessage(response, fallback) {
  try {
    const data = await response.json();
    return data?.message || fallback;
  } catch {
    return fallback;
  }
}

const CreateTicket = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [round, setRound] = useState(null);
  const [gateLoading, setGateLoading] = useState(true);
  const [gateMessage, setGateMessage] = useState('');

  const [formData, setFormData] = useState({
    award_type: '',
    full_name_thai: '',
    gender: '',
    faculty: '',
    department: '',
    academic_year: '',
    semester: 1,
    gpa: '',
    portfolio_description: '',
    achievements: '',
    activity_hours: ''
  });

  const [files, setFiles] = useState({
    transcript: null,
    portfolio: null,
    activity_hours_proof: null,
    profile_photo: null,
    recommendation_letter: null,
    certificates: null
  });

  useEffect(() => {
    const loadRoundAndGuard = async () => {
      try {
        setGateLoading(true);
        setGateMessage('');
        const [userResponse, phaseResponse, ticketsResponse] = await Promise.all([
          authenticatedApiRequest('/api/auth/me'),
          authenticatedApiRequest('/api/auth/phase'),
          authenticatedApiRequest('/api/tickets/me')
        ]);

        if (userResponse.ok) {
          const userData = await userResponse.json();
          const profile = userData?.user || {};
          setFormData((prev) => ({
            ...prev,
            faculty: profile.faculty || prev.faculty,
            department: profile.department || prev.department
          }));
        }

        if (phaseResponse.ok) {
          const data = await phaseResponse.json();
          const phaseCode = String(data?.phase || '').toUpperCase();
          if (CLOSED_PHASES.has(phaseCode)) {
            setGateMessage('ขณะนี้ไม่อยู่ในช่วงเปิดรับสมัคร โปรดติดตามประกาศรอบถัดไป');
          }

          if (data?.round) {
            setRound(data.round);
            setFormData((prev) => ({
              ...prev,
              academic_year: String(data.round.academic_year),
              semester: Number.parseInt(data.round.semester, 10) || 1
            }));
          }
        }

        if (ticketsResponse.ok) {
          const ticketsData = await ticketsResponse.json();
          const tickets = Array.isArray(ticketsData?.tickets) ? ticketsData.tickets : [];
          const sortedTickets = [...tickets].sort(
            (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
          );
          const activeTicket =
            sortedTickets.find((ticket) => ACTIVE_STATUSES.has(String(ticket.status || '').toLowerCase())) || null;
          const activeStatus = String(activeTicket?.status || '').toLowerCase();

          if (activeTicket && !REAPPLY_ALLOWED_STATUSES.has(activeStatus)) {
            setGateMessage('คุณมีใบสมัครที่อยู่ระหว่างดำเนินการอยู่แล้ว กรุณาติดตามผลหรือรอให้รายการปัจจุบันสิ้นสุดก่อน');
          }
        }
      } catch {
        // Keep form usable if guard check fails
      } finally {
        setGateLoading(false);
      }
    };

    loadRoundAndGuard();
  }, []);

  const selectedAward = useMemo(
    () => AWARD_OPTIONS.find((opt) => opt.value === formData.award_type),
    [formData.award_type]
  );
  const requiredFiles = useMemo(
    () => AWARD_REQUIRED_FILES[formData.award_type] || BASE_REQUIRED_FILES,
    [formData.award_type]
  );
  const optionalFiles = useMemo(
    () => AWARD_OPTIONAL_FILES[formData.award_type] || [],
    [formData.award_type]
  );
  const descriptionPrompt = useMemo(
    () => AWARD_DESCRIPTION_PROMPTS[formData.award_type] || 'โปรดกรอกข้อมูลที่เกี่ยวข้องให้ครบถ้วน',
    [formData.award_type]
  );
  const awardConditions = useMemo(
    () => AWARD_CONDITIONS[formData.award_type] || [],
    [formData.award_type]
  );

  const handleFileChange = (key, event) => {
    const file = event.target.files?.[0] || null;
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const validateStepOne = () => {
    const awardType = String(formData.award_type || '').trim();
    if (!awardType || !AWARD_VALUES.has(awardType)) return 'กรุณาเลือกประเภทรางวัล';
    return '';
  };

  const validateStepTwo = () => {
    if (!formData.full_name_thai.trim()) return 'กรุณากรอกชื่อ-นามสกุลภาษาไทย';
    if (!['male', 'female'].includes(String(formData.gender || '').toLowerCase())) return 'กรุณาเลือกเพศ';
    if (!formData.faculty.trim()) return 'กรุณาเลือกคณะ';
    if (!formData.department.trim()) return 'กรุณาเลือกภาควิชา';
    if (!formData.gpa || Number.isNaN(Number.parseFloat(formData.gpa))) return 'กรุณากรอก GPA';
    if (!formData.portfolio_description.trim()) return 'กรุณากรอกคำอธิบายผลงาน';
    if (!formData.achievements.trim()) return 'กรุณากรอกผลงานที่ได้รับ';
    if (formData.award_type === 'activity_enrichment' && !formData.activity_hours.trim()) {
      return 'Activity hours is required for ด้านกิจกรรมเสริมหลักสูตร.';
    }

    for (const requiredFile of requiredFiles) {
      if (!files[requiredFile.key]) {
        return `กรุณาอัปโหลดไฟล์ที่จำเป็น: ${requiredFile.label}`;
      }
    }

    return '';
  };

  const handleNext = async () => {
    setError('');

    if (currentStep === 1) {
      const validationError = validateStepOne();
      if (validationError) {
        setError(validationError);
        return;
      }
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      const validationError = validateStepTwo();
      if (validationError) {
        setError(validationError);
        return;
      }
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      await submitTicket();
    }
  };

  const handleBack = () => {
    setError('');
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const submitTicket = async ({ submitNow = true } = {}) => {
    if (submitNow) {
      setSubmitting(true);
    } else {
      setSavingDraft(true);
    }
    setError('');

    try {
      const stepOneError = validateStepOne();
      if (stepOneError) {
        setError(stepOneError);
        return;
      }

      const stepTwoError = validateStepTwo();
      if (stepTwoError) {
        setError(stepTwoError);
        return;
      }

      const awardType = String(formData.award_type || '').trim();

      const createPayload = {
        award_type: awardType,
        full_name_thai: formData.full_name_thai.trim(),
        gender: formData.gender,
        faculty: formData.faculty.trim(),
        department: formData.department.trim(),
        academic_year: Number.parseInt(formData.academic_year, 10),
        semester: Number.parseInt(formData.semester, 10),
        gpa: Number.parseFloat(formData.gpa),
        portfolio_description: formData.portfolio_description.trim(),
        achievements: formData.achievements.trim(),
        activity_hours: awardType === 'activity_enrichment' ? formData.activity_hours.trim() : '',
        ...(round?.id ? { round_id: round.id } : {})
      };

      const createResponse = await authenticatedApiRequest('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(createPayload)
      });

      if (!createResponse.ok) {
        throw new Error(await parseMessage(createResponse, 'ไม่สามารถสร้างใบสมัครฉบับร่างได้'));
      }

      const created = await createResponse.json();
      const ticketId = created?.ticket?.id;
      if (!ticketId) {
        throw new Error('สร้างใบสมัครแล้ว แต่ไม่พบรหัสใบสมัคร');
      }

      const uploadFormData = new FormData();
      requiredFiles.forEach((requiredFile) => {
        uploadFormData.append(requiredFile.key, files[requiredFile.key]);
      });
      optionalFiles.forEach((optionalFile) => {
        if (files[optionalFile.key]) {
          uploadFormData.append(optionalFile.key, files[optionalFile.key]);
        }
      });

      const uploadResponse = await fetch(`/api/uploads/ticket/${ticketId}`, {
        method: 'POST',
        credentials: 'include',
        body: uploadFormData
      });

      if (!uploadResponse.ok) {
        throw new Error(await parseMessage(uploadResponse, 'ไม่สามารถอัปโหลดไฟล์ได้'));
      }

      if (submitNow) {
        const submitResponse = await authenticatedApiRequest(`/api/tickets/${ticketId}/submit`, {
          method: 'POST'
        });

        if (!submitResponse.ok) {
          throw new Error(await parseMessage(submitResponse, 'ไม่สามารถส่งใบสมัครได้'));
        }
      }

      navigate('/student/dashboard');
    } catch (submitError) {
      setError(submitError.message || 'ไม่สามารถส่งใบสมัครได้');
    } finally {
      if (submitNow) {
        setSubmitting(false);
      } else {
        setSavingDraft(false);
      }
    }
  };

  if (gateLoading) {
    return (
      <div className="max-w-4xl mx-auto pb-10">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-gray-600 flex items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" /> กำลังตรวจสอบเงื่อนไขการสมัคร...
        </div>
      </div>
    );
  }

  if (gateMessage) {
    return (
      <div className="max-w-4xl mx-auto pb-10 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-2">สร้างใบสมัครใหม่</h1>
          <p className="text-gray-500">ยังไม่สามารถสร้างใบสมัครได้ในขณะนี้</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          {gateMessage}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => navigate('/student/tracking')}
            className="px-5 py-2.5 rounded-lg bg-ku-main text-white hover:bg-green-800 transition"
          >
            ไปหน้าติดตามผล
          </button>
          <button
            type="button"
            onClick={() => navigate('/student/history')}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
          >
            ไปหน้าประวัติ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-2">สร้างใบสมัครนิสิต</h1>
        <p className="text-gray-500">ส่งคำขอพร้อมเอกสารหลักฐานที่จำเป็น</p>
      </div>

      <FormStepper currentStep={currentStep} />

      <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-gray-100 min-h-[450px] mt-8">
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">1. เลือกประเภทรางวัล</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AWARD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, award_type: option.value }))}
                  className={`p-5 rounded-2xl border-2 text-left transition ${
                    formData.award_type === option.value
                      ? 'border-ku-main bg-ku-light'
                      : 'border-gray-200 hover:border-ku-main'
                  }`}
                >
                  <p className="font-bold text-gray-800">{option.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">2. รายละเอียดและเอกสาร</h2>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              หมายเหตุ: แต่ละประเภทรางวัลต้องใช้ข้อมูล/ไฟล์ต่างกัน เช่น ด้านกิจกรรมเสริมหลักสูตรต้องแนบหลักฐานชั่วโมงกิจกรรม
            </p>
            <div className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="font-semibold">Prompt ข้อมูลที่ต้องมี</p>
              <p className="mt-1">{descriptionPrompt}</p>
            </div>
            {awardConditions.length > 0 && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="font-semibold">เงื่อนไขพิจารณา</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {awardConditions.map((condition) => (
                    <li key={condition}>{condition}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">เพศ</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm bg-white"
                >
                  <option value="">เลือกเพศ</option>
                  <option value="male">ชาย</option>
                  <option value="female">หญิง</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อ-นามสกุล (ภาษาไทย)</label>
                <input
                  type="text"
                  value={formData.full_name_thai}
                  onChange={(e) => setFormData((prev) => ({ ...prev, full_name_thai: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm"
                  placeholder="เช่น สมชาย ใจดี (ไม่มีคำนำหน้า)"
                />
              </div>
            </div>

            <div className="pt-1">
              <FacultyDepartmentSelector
                selectedFaculty={formData.faculty}
                selectedDepartment={formData.department}
                onFacultyChange={(faculty) => setFormData((prev) => ({ ...prev, faculty }))}
                onDepartmentChange={(department) => setFormData((prev) => ({ ...prev, department }))}
                facultyError=""
                departmentError=""
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">ปีการศึกษา</label>
                <input
                  type="text"
                  value={round?.academic_year || formData.academic_year || '-'}
                  disabled
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">ระบบกำหนดปีการศึกษาอัตโนมัติตามรอบที่เปิดอยู่</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">ภาคเรียน</label>
                <input
                  type="text"
                  value={round?.semester || formData.semester || '-'}
                  disabled
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">ระบบกำหนดภาคเรียนอัตโนมัติตามรอบที่เปิดอยู่</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">เกรดเฉลี่ย (GPA)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="4"
                value={formData.gpa}
                onChange={(e) => setFormData((prev) => ({ ...prev, gpa: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl p-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">คำอธิบายผลงาน</label>
              <textarea
                rows={4}
                value={formData.portfolio_description}
                onChange={(e) => setFormData((prev) => ({ ...prev, portfolio_description: e.target.value }))}
                placeholder={descriptionPrompt}
                className="w-full border border-gray-300 rounded-xl p-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ผลงานที่ได้รับ</label>
              <textarea
                rows={4}
                value={formData.achievements}
                onChange={(e) => setFormData((prev) => ({ ...prev, achievements: e.target.value }))}
                placeholder="สรุปผลลัพธ์ที่เป็นรูปธรรม เช่น รางวัล, ผลกระทบ, การนำไปใช้จริง, หรือหลักฐานสนับสนุน"
                className="w-full border border-gray-300 rounded-xl p-3 text-sm"
              />
            </div>

            {formData.award_type === 'activity_enrichment' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">ชั่วโมงกิจกรรม</label>
                <input
                  type="number"
                  min="0"
                  value={formData.activity_hours}
                  onChange={(e) => setFormData((prev) => ({ ...prev, activity_hours: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm"
                />
              </div>
            )}

            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-bold text-gray-800 mb-3">เอกสารที่จำเป็น</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requiredFiles.map((fileDef) => (
                  <label key={fileDef.key} className="border rounded-xl p-4 flex items-center gap-3 cursor-pointer">
                    <fileDef.icon size={18} className="text-ku-main" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-700">{fileDef.label}</p>
                      <p className="text-xs text-gray-500">{files[fileDef.key]?.name || 'ยังไม่ได้เลือกไฟล์'}</p>
                    </div>
                    <input
                      type="file"
                      accept={fileDef.accept}
                      onChange={(event) => handleFileChange(fileDef.key, event)}
                      className="hidden"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-3">เอกสารเพิ่มเติม (ถ้ามี)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {optionalFiles.map((fileDef) => (
                  <label key={fileDef.key} className="border rounded-xl p-4 flex items-center gap-3 cursor-pointer">
                    <fileDef.icon size={18} className="text-gray-500" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-700">{fileDef.label}</p>
                      <p className="text-xs text-gray-500">{files[fileDef.key]?.name || 'ยังไม่ได้เลือกไฟล์'}</p>
                    </div>
                    <input
                      type="file"
                      accept={fileDef.accept}
                      onChange={(event) => handleFileChange(fileDef.key, event)}
                      className="hidden"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="max-w-xl mx-auto py-8 space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center text-gray-800">ตรวจทานก่อนส่ง</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
              <p><span className="font-semibold">รางวัล:</span> {selectedAward?.label || '-'}</p>
              <p><span className="font-semibold">การศึกษา:</span> {formData.academic_year} / ภาคเรียน {formData.semester}</p>
              <p><span className="font-semibold">เกรดเฉลี่ย:</span> {formData.gpa}</p>
              {formData.award_type === 'activity_enrichment' && (
                <p><span className="font-semibold">ชั่วโมงกิจกรรม:</span> {formData.activity_hours || '-'}</p>
              )}
              <p><span className="font-semibold">เอกสารที่แนบ:</span> {requiredFiles.filter((f) => files[f.key]).length}/{requiredFiles.length}</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
          {error}
        </div>
      )}

      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 1 || submitting || savingDraft}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition ${
            currentStep === 1 || submitting || savingDraft
              ? 'text-gray-300 cursor-not-allowed opacity-50'
              : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm'
          }`}
        >
          <ArrowLeft size={18} /> ย้อนกลับ
        </button>

        <div className="flex items-center gap-3">
          {currentStep === 3 && (
            <button
              type="button"
              onClick={() => submitTicket({ submitNow: false })}
              disabled={submitting || savingDraft}
              className="flex items-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-xl hover:bg-amber-600 transition shadow-lg font-bold disabled:opacity-60"
            >
              {savingDraft ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> กำลังบันทึกร่าง...
                </>
              ) : (
                'บันทึกฉบับร่าง'
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={submitting || savingDraft}
            className="flex items-center gap-2 bg-ku-main text-white px-8 py-3 rounded-xl hover:bg-green-800 transition shadow-lg font-bold disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> กำลังส่ง...
              </>
            ) : (
              <>
                {currentStep === 3 ? 'ส่งใบสมัคร' : 'ถัดไป'} <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTicket;
