import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Clock,
  Download,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import ActionModal from '../../components/ActionModal';
import StatusBadge from '../../components/StatusBadge';
import FilePreviewButton from '../../components/FilePreviewButton';
import { authenticatedApiRequest } from '../../utils/api';
import { getRoleLabel } from '../../utils/roleLabels';
import toast from 'react-hot-toast';

const AWARD_LABELS = {
  academic: 'ด้านวิชาการ',
  sport: 'ด้านกีฬา',
  arts_culture: 'ด้านศิลปวัฒนธรรม',
  moral_ethics: 'ด้านคุณธรรมจริยธรรม',
  social_service: 'ด้านบำเพ็ญประโยชน์',
  innovation: 'ด้านนวัตกรรม',
  entrepreneurship: 'ด้านผู้ประกอบการ'
};

const ROLE_RULES = {
  STAFF: { expectedStatus: 'submitted_by_student', approveAction: 'accept', approveLabel: 'ตรวจสอบและส่งต่อ' },
  SUB_DEAN: { expectedStatus: 'reviewed_by_staff', approveAction: 'accept', approveLabel: 'เสนอคณบดีพิจารณา' },
  DEAN: { expectedStatus: 'reviewed_by_subdean', approveAction: 'accept', approveLabel: 'อนุมัติระดับคณบดี' }
};

const ReviewTicket = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [files, setFiles] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalType, setModalType] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const role = user?.primary_role || user?.role;
  const roleRule = ROLE_RULES[role];

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await authenticatedApiRequest(`/api/tickets/${id}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || 'ไม่สามารถโหลดใบสมัครได้');
        }

        const payload = await response.json();
        setTicket(payload?.ticket || null);
        setFiles(Array.isArray(payload?.files) ? payload.files : []);
        setHistory(Array.isArray(payload?.history) ? payload.history : []);
      } catch (fetchError) {
        setError(fetchError.message || 'ไม่สามารถโหลดใบสมัครได้');
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [id]);

  const canAct = useMemo(() => {
    if (!ticket || !roleRule) return false;
    const status = String(ticket.status || '').toLowerCase();
    return status === roleRule.expectedStatus;
  }, [ticket, roleRule]);

  const formatDate = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleConfirm = async (reason) => {
    if (!ticket) return;
    setSubmitting(true);
    try {
      const action = modalType === 'approve' ? roleRule.approveAction : 'return';
      const response = await authenticatedApiRequest(`/api/tickets/${ticket.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          action,
          reason: reason || (action === 'return' ? 'ส่งกลับเพื่อแก้ไข' : undefined)
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || 'ไม่สามารถพิจารณาใบสมัครได้');
      }

      const payload = await response.json();
      toast.success(payload?.message || 'พิจารณาใบสมัครเรียบร้อย');
      setModalType(null);
      navigate('/staff/dashboard');
    } catch (submitError) {
      toast.error(submitError.message || 'ไม่สามารถพิจารณาใบสมัครได้');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <div className="flex items-center justify-between sticky top-0 bg-gray-50/90 backdrop-blur-sm z-30 py-4 border-b border-gray-200">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-ku-main transition font-medium">
          <ArrowLeft size={20} /> กลับไปหน้ารายการ
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">รหัสใบสมัคร</span>
          <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-mono font-bold">#{id}</span>
        </div>
      </div>

      {loading && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-gray-500 flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" /> กำลังโหลดใบสมัคร...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {!loading && !error && ticket && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="mb-6">
                <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3 border border-blue-100">
                  {AWARD_LABELS[ticket.award_type] || ticket.award_type}
                </span>
                <h1 className="text-2xl font-bold text-gray-800 leading-tight">
                  ใบสมัคร{(AWARD_LABELS[ticket.award_type] || ticket.award_type)}
                </h1>
              </div>

              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-8">
                <div className="w-14 h-14 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                  <User className="text-gray-500" size={24} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-lg">{ticket.full_name || '-'}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><User size={14} /> {ticket.student_code || '-'}</span>
                    <span>|</span><span>{ticket.faculty || '-'}</span><span>|</span><span>{ticket.department || '-'}</span>
                  </div>
                </div>
                <div className="text-right pl-4 border-l border-gray-300">
                  <p className="text-xs text-gray-400 font-bold uppercase">เกรดเฉลี่ย</p>
                  <p className="font-black text-ku-main text-2xl">{ticket.gpa || '-'}</p>
                </div>
              </div>

              <div className="prose max-w-none text-gray-600 space-y-4">
                <h3 className="text-gray-800 font-bold text-lg mb-3 flex items-center gap-2">
                  <FileText size={20} className="text-ku-main" /> คำอธิบายผลงาน
                </h3>
                <p className="leading-relaxed bg-white p-4 rounded-lg border border-gray-100 shadow-inner">{ticket.portfolio_description || '-'}</p>

                <h3 className="text-gray-800 font-bold text-lg mb-3 flex items-center gap-2">
                  <FileText size={20} className="text-ku-main" /> ผลงานที่ได้รับ
                </h3>
                <p className="leading-relaxed bg-white p-4 rounded-lg border border-gray-100 shadow-inner">{ticket.achievements || '-'}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Download size={20} className="text-ku-main" /> เอกสารแนบ
              </h3>
              {files.length === 0 ? (
                <p className="text-sm text-gray-500">ยังไม่มีไฟล์ที่อัปโหลด</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {files.map((file) => (
                    <FilePreviewButton
                      key={file.id}
                      file={file}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition cursor-pointer group w-full text-left"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs bg-blue-100 text-blue-600">ไฟล์</div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-700 truncate group-hover:text-blue-700">{file.original_name}</p>
                          <p className="text-xs text-gray-400">{file.file_category}</p>
                        </div>
                      </div>
                      <Download size={18} className="text-gray-300 group-hover:text-blue-600" />
                    </FilePreviewButton>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Clock size={20} className="text-ku-main" /> บันทึกการอนุมัติ
              </h3>
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">ไม่มีบันทึกการอนุมัติ</p>
              ) : (
                <div className="relative py-1">
                  <div className="absolute left-[15px] top-3 bottom-3 w-px bg-gray-200" aria-hidden="true" />
                  <div className="space-y-6">
                    {history.map((log) => (
                      <div key={log.id} className="relative flex items-start gap-4">
                        <div className="relative z-10 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center border-2 border-white shadow-sm shrink-0">
                          <CheckCircle2 size={14} />
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-sm font-bold text-gray-800 break-words">{log.action}</p>
                          <p className="text-xs text-gray-500">{formatDate(log.timestamp)}</p>
                          <div className="mt-1 bg-green-50/50 p-2 rounded-lg text-xs text-green-700 border border-green-100 inline-block break-words max-w-full">
                            {log.notes || `โดย ${log.actor_name || `ผู้ใช้ ${log.actor_id || '-'}`}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="sticky top-24 space-y-6">
              <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                <div className="h-2 w-full bg-gradient-to-r from-ku-main to-ku-accent"></div>
                <div className="p-6">
                  <div className="mb-6 text-center">
                    <h3 className="font-bold text-gray-800 text-lg">พิจารณาใบสมัคร</h3>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold mt-2">
                      <User size={12} /> บทบาท: {getRoleLabel(role)}
                    </div>
                    <div className="mt-3">
                      <StatusBadge status={ticket.status} />
                    </div>
                  </div>

                  {canAct ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => setModalType('approve')}
                        disabled={submitting}
                        className="w-full py-4 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg bg-ku-main hover:bg-green-800 disabled:opacity-60"
                      >
                        <CheckCircle2 size={20} /> {roleRule.approveLabel}
                      </button>
                      <button
                        onClick={() => setModalType('reject')}
                        disabled={submitting}
                        className="w-full py-4 bg-white text-red-600 border-2 border-red-100 hover:bg-red-50 hover:border-red-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                      >
                        <XCircle size={20} /> ส่งกลับเพื่อแก้ไข
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border text-center font-bold text-sm bg-gray-50 text-gray-600 border-gray-200">
                      ใบสมัครนี้ไม่ได้อยู่ในคิวตรวจสอบของคุณในขณะนี้
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex gap-3 items-start">
                <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-orange-800">
                  <strong>หมายเหตุ:</strong> กรุณาตรวจสอบเอกสารหลักฐานก่อนอนุมัติ
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ActionModal
        isOpen={!!modalType}
        type={modalType}
        onClose={() => setModalType(null)}
        onConfirm={handleConfirm}
        title={modalType === 'approve' ? `ยืนยัน: ${roleRule?.approveLabel || 'อนุมัติ'}` : 'ส่งกลับใบสมัครเพื่อแก้ไข'}
      />
    </div>
  );
};

export default ReviewTicket;

