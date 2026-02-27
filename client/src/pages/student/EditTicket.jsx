import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Send, Trash2, UploadCloud } from 'lucide-react';
import { authenticatedApiRequest } from '../../utils/api';
import FacultyDepartmentSelector from '../../components/FacultyDepartmentSelector';

const AWARD_LABELS = {
  activity_enrichment: '1.1. ด้านกิจกรรมเสริมหลักสูตร',
  creativity_innovation: '1.2. ด้านความคิดสร้างสรรค์และนวัตกรรม',
  good_behavior: '1.3. ด้านความประพฤติดี'
};

const BASE_REQUIRED_FILES = [
  { key: 'transcript', label: 'ใบแสดงผลการเรียน (Transcript)', accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'profile_photo', label: 'รูปถ่ายหน้าตรง', accept: '.jpg,.jpeg,.png' }
];

const AWARD_REQUIRED_FILES = {
  activity_enrichment: [
    ...BASE_REQUIRED_FILES,
    { key: 'certificates', label: 'ใบรับรองกิจกรรม (certificate.pdf)', accept: '.pdf' },
    { key: 'activity_hours_proof', label: 'รายงานกิจกรรม/สรุปชั่วโมงกิจกรรม (activity_report.pdf)', accept: '.pdf' },
    { key: 'portfolio', label: 'รายละเอียดบทบาทหน้าที่และผลลัพธ์ของกิจกรรม', accept: '.pdf,.doc,.docx' }
  ],
  creativity_innovation: [
    ...BASE_REQUIRED_FILES,
    { key: 'portfolio', label: 'เอกสารอธิบายผลงาน (prototype_doc.pdf)', accept: '.pdf' },
    { key: 'certificates', label: 'หลักฐานผลงานหรือรางวัล (certificate.pdf)', accept: '.pdf' }
  ],
  good_behavior: [
    ...BASE_REQUIRED_FILES,
    { key: 'recommendation_letter', label: 'หนังสือรับรองความประพฤติ (certificate.pdf)', accept: '.pdf' },
    { key: 'activity_hours_proof', label: 'รายงานกิจกรรมจิตอาสา (activity_report.pdf)', accept: '.pdf' }
  ]
};

const AWARD_OPTIONAL_FILES = {
  activity_enrichment: [
    { key: 'recommendation_letter', label: 'ภาพกิจกรรม / หนังสือรับรองเพิ่มเติม', accept: '.pdf,.jpg,.jpeg,.png' }
  ],
  creativity_innovation: [
    { key: 'activity_hours_proof', label: 'วิดีโอ Demo / ลิงก์สาธิต (แนบเป็นเอกสารอ้างอิง)', accept: '.pdf' },
    { key: 'recommendation_letter', label: 'สิทธิบัตร / งานตีพิมพ์ / Portfolio เพิ่มเติม', accept: '.pdf,.doc,.docx' }
  ],
  good_behavior: [{ key: 'certificates', label: 'ภาพกิจกรรม / หลักฐานการช่วยเหลือเพิ่มเติม', accept: '.pdf,.jpg,.jpeg,.png' }]
};

const EDITABLE_STATUSES = new Set(['draft', 'returned']);

const EditTicket = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState({});
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

  useEffect(() => {
    const loadTicket = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await authenticatedApiRequest(`/api/tickets/${id}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || 'ไม่สามารถโหลดข้อมูลใบสมัครได้');
        }
        const payload = await response.json();
        const currentTicket = payload?.ticket || null;
        if (!currentTicket) throw new Error('ไม่พบข้อมูลใบสมัคร');
        setTicket(currentTicket);
        setFiles(Array.isArray(payload?.files) ? payload.files : []);
        setFormData({
          award_type: currentTicket.award_type || '',
          full_name_thai: currentTicket.full_name_thai || currentTicket.full_name || '',
          gender: currentTicket.gender || '',
          faculty: currentTicket.faculty || '',
          department: currentTicket.department || '',
          academic_year: String(currentTicket.academic_year || ''),
          semester: Number.parseInt(currentTicket.semester, 10) || 1,
          gpa: String(currentTicket.gpa || ''),
          portfolio_description: currentTicket.portfolio_description || '',
          achievements: currentTicket.achievements || '',
          activity_hours: currentTicket.activity_hours || ''
        });
      } catch (loadError) {
        setError(loadError.message || 'ไม่สามารถโหลดข้อมูลใบสมัครได้');
      } finally {
        setLoading(false);
      }
    };
    loadTicket();
  }, [id]);

  const normalizedStatus = String(ticket?.status || '').toLowerCase();
  const canEdit = EDITABLE_STATUSES.has(normalizedStatus);
  const canDeleteDraft = normalizedStatus === 'draft';

  const requiredFiles = useMemo(
    () => AWARD_REQUIRED_FILES[formData.award_type] || BASE_REQUIRED_FILES,
    [formData.award_type]
  );
  const optionalFiles = useMemo(
    () => AWARD_OPTIONAL_FILES[formData.award_type] || [],
    [formData.award_type]
  );

  const existingByCategory = useMemo(() => {
    const result = new Map();
    files.forEach((file) => {
      const key = String(file.file_category || '');
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(file.original_name);
    });
    return result;
  }, [files]);

  const hasCategoryFile = (key) => {
    const existing = (existingByCategory.get(key) || []).length > 0;
    return existing || !!selectedFiles[key];
  };

  const validate = () => {
    if (!formData.full_name_thai.trim()) return 'กรุณากรอกชื่อ-นามสกุลภาษาไทย';
    if (!['male', 'female'].includes(String(formData.gender || '').toLowerCase())) return 'กรุณาเลือกเพศ';
    if (!formData.faculty.trim()) return 'กรุณาเลือกคณะ';
    if (!formData.department.trim()) return 'กรุณาเลือกภาควิชา';
    if (!formData.gpa || Number.isNaN(Number.parseFloat(formData.gpa))) return 'กรุณากรอก GPA';
    if (!formData.portfolio_description.trim()) return 'กรุณากรอกคำอธิบายผลงาน';
    if (!formData.achievements.trim()) return 'กรุณากรอกผลงานที่ได้รับ';
    if (formData.award_type === 'activity_enrichment' && !String(formData.activity_hours || '').trim()) {
      return 'กรุณากรอกชั่วโมงกิจกรรม';
    }
    for (const required of requiredFiles) {
      if (!hasCategoryFile(required.key)) return `กรุณาแนบเอกสาร: ${required.label}`;
    }
    return '';
  };

  const handleFileChange = (key, event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFiles((prev) => ({ ...prev, [key]: file }));
  };

  const saveTicket = async ({ submitNow }) => {
    if (!ticket || !canEdit) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    if (submitNow) setSubmitting(true);
    else setSaving(true);
    try {
      const patchResponse = await authenticatedApiRequest(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          award_type: formData.award_type,
          full_name_thai: formData.full_name_thai.trim(),
          gender: formData.gender,
          faculty: formData.faculty.trim(),
          department: formData.department.trim(),
          academic_year: Number.parseInt(formData.academic_year, 10),
          gpa: Number.parseFloat(formData.gpa),
          portfolio_description: formData.portfolio_description.trim(),
          achievements: formData.achievements.trim(),
          activity_hours: formData.award_type === 'activity_enrichment' ? String(formData.activity_hours || '').trim() : ''
        })
      });
      if (!patchResponse.ok) {
        const payload = await patchResponse.json().catch(() => ({}));
        throw new Error(payload?.message || 'ไม่สามารถบันทึกข้อมูลได้');
      }

      const uploadFormData = new FormData();
      [...requiredFiles, ...optionalFiles].forEach((fileDef) => {
        if (selectedFiles[fileDef.key]) uploadFormData.append(fileDef.key, selectedFiles[fileDef.key]);
      });
      if (Array.from(uploadFormData.keys()).length > 0) {
        const uploadResponse = await fetch(`/api/uploads/ticket/${ticket.id}`, {
          method: 'POST',
          credentials: 'include',
          body: uploadFormData
        });
        if (!uploadResponse.ok) {
          const payload = await uploadResponse.json().catch(() => ({}));
          throw new Error(payload?.message || 'ไม่สามารถอัปโหลดไฟล์ได้');
        }
      }

      if (submitNow) {
        const submitResponse = await authenticatedApiRequest(`/api/tickets/${ticket.id}/submit`, { method: 'POST' });
        if (!submitResponse.ok) {
          const payload = await submitResponse.json().catch(() => ({}));
          throw new Error(payload?.message || 'ไม่สามารถส่งใบสมัครได้');
        }
      }

      navigate(`/student/ticket/${ticket.id}`);
    } catch (saveError) {
      setError(saveError.message || 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      if (submitNow) setSubmitting(false);
      else setSaving(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!ticket || !canDeleteDraft) return;
    const confirmed = window.confirm('ยืนยันการลบฉบับร่างนี้? หลังลบแล้วคุณสามารถสร้างใบสมัครใหม่และเลือกประเภทรางวัลใหม่ได้');
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    try {
      const response = await authenticatedApiRequest(`/api/tickets/${ticket.id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || 'ไม่สามารถลบฉบับร่างได้');
      }
      navigate('/student/create');
    } catch (deleteError) {
      setError(deleteError.message || 'ไม่สามารถลบฉบับร่างได้');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto pb-10">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-gray-600 flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" /> กำลังโหลดข้อมูลใบสมัคร...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-ku-main transition font-medium">
          <ArrowLeft size={20} /> กลับ
        </button>
        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-sm font-mono font-bold">Ref: #{id}</span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">{error}</div>}

      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-xl">
          ใบสมัครนี้ไม่สามารถแก้ไขได้แล้ว (สถานะปัจจุบัน: {ticket?.status || '-'})
        </div>
      )}

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
        <div className="text-sm text-gray-500">
          ประเภทรางวัล: <span className="font-semibold text-gray-800">{AWARD_LABELS[formData.award_type] || formData.award_type || '-'}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">เพศ</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl p-3 text-sm bg-white"
              disabled={!canEdit}
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
              disabled={!canEdit}
            />
          </div>
        </div>

        <FacultyDepartmentSelector
          selectedFaculty={formData.faculty}
          selectedDepartment={formData.department}
          onFacultyChange={(faculty) => setFormData((prev) => ({ ...prev, faculty }))}
          onDepartmentChange={(department) => setFormData((prev) => ({ ...prev, department }))}
          facultyError=""
          departmentError=""
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">ปีการศึกษา</label>
            <input type="text" value={formData.academic_year || '-'} disabled className="w-full border border-gray-300 rounded-xl p-3 text-sm bg-gray-100 text-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">ภาคเรียน</label>
            <input type="text" value={formData.semester || '-'} disabled className="w-full border border-gray-300 rounded-xl p-3 text-sm bg-gray-100 text-gray-600" />
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
            disabled={!canEdit}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">คำอธิบายผลงาน</label>
          <textarea
            rows={4}
            value={formData.portfolio_description}
            onChange={(e) => setFormData((prev) => ({ ...prev, portfolio_description: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl p-3 text-sm"
            disabled={!canEdit}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">ผลงานที่ได้รับ</label>
          <textarea
            rows={4}
            value={formData.achievements}
            onChange={(e) => setFormData((prev) => ({ ...prev, achievements: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl p-3 text-sm"
            disabled={!canEdit}
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
              disabled={!canEdit}
            />
          </div>
        )}

        <div className="pt-4 border-t border-gray-100">
          <h3 className="font-bold text-gray-800 mb-3">เอกสารที่จำเป็น</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requiredFiles.map((fileDef) => (
              <label key={fileDef.key} className="border rounded-xl p-4 flex items-center gap-3 cursor-pointer">
                <UploadCloud size={18} className="text-ku-main" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-700">{fileDef.label}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {selectedFiles[fileDef.key]?.name ||
                      (existingByCategory.get(fileDef.key) || []).join(', ') ||
                      'ยังไม่ได้เลือกไฟล์'}
                  </p>
                </div>
                <input type="file" accept={fileDef.accept} onChange={(event) => handleFileChange(fileDef.key, event)} className="hidden" disabled={!canEdit} />
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-bold text-gray-800 mb-3">เอกสารเพิ่มเติม (ถ้ามี)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {optionalFiles.map((fileDef) => (
              <label key={fileDef.key} className="border rounded-xl p-4 flex items-center gap-3 cursor-pointer">
                <UploadCloud size={18} className="text-gray-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-700">{fileDef.label}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {selectedFiles[fileDef.key]?.name ||
                      (existingByCategory.get(fileDef.key) || []).join(', ') ||
                      'ยังไม่ได้เลือกไฟล์'}
                  </p>
                </div>
                <input type="file" accept={fileDef.accept} onChange={(event) => handleFileChange(fileDef.key, event)} className="hidden" disabled={!canEdit} />
              </label>
            ))}
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end gap-3">
          {canDeleteDraft && (
            <button
              type="button"
              onClick={handleDeleteDraft}
              disabled={saving || submitting || deleting}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition font-bold disabled:opacity-60"
            >
              {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />} ลบฉบับร่าง
            </button>
          )}
          <button
            type="button"
            onClick={() => saveTicket({ submitNow: false })}
            disabled={saving || submitting || deleting}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition font-bold disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} บันทึกฉบับร่าง
          </button>
          <button
            type="button"
            onClick={() => saveTicket({ submitNow: true })}
            disabled={saving || submitting || deleting}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-ku-main text-white hover:bg-green-800 transition font-bold disabled:opacity-60"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} บันทึกและส่งใบสมัคร
          </button>
        </div>
      )}
    </div>
  );
};

export default EditTicket;
