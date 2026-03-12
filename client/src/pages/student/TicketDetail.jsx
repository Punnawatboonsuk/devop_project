import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Download, Clock, CheckCircle2, AlertCircle, Loader2, Edit3 } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import FilePreviewButton from '../../components/FilePreviewButton';
import { authenticatedApiRequest } from '../../utils/api';

const AWARD_LABELS = {
  activity_enrichment: '1.1. ด้านกิจกรรมเสริมหลักสูตร',
  creativity_innovation: '1.2. ด้านความคิดสร้างสรรค์และนวัตกรรม',
  good_behavior: '1.3. ด้านความประพฤติดี'
};

const EDITABLE_STATUSES = new Set(['draft', 'returned']);

const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [files, setFiles] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await authenticatedApiRequest(`/api/tickets/${id}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || 'ไม่สามารถโหลดรายละเอียดใบสมัครได้');
        }
        const payload = await response.json();
        setTicket(payload?.ticket || null);
        setFiles(Array.isArray(payload?.files) ? payload.files : []);
        setHistory(Array.isArray(payload?.history) ? payload.history : []);
      } catch (fetchError) {
        setError(fetchError.message || 'ไม่สามารถโหลดรายละเอียดใบสมัครได้');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const formatDate = (rawDate) => {
    if (!rawDate) return '-';
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fileTypeLabel = (mimeType = '') => {
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('image')) return 'IMG';
    if (mimeType.includes('word')) return 'DOC';
    if (mimeType.includes('zip')) return 'ZIP';
    return 'FILE';
  };

  const genderLabel = (gender) => {
    const value = String(gender || '').toLowerCase();
    if (value === 'male') return 'ชาย';
    if (value === 'female') return 'หญิง';
    return '-';
  };

  const proclamationResult = ticket?.proclamation_result || null;
  const isWinner = proclamationResult === 'winner';
  const isNotSelected = proclamationResult === 'not_selected';

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-ku-main transition font-medium">
          <ArrowLeft size={20} /> กลับ
        </button>
        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-sm font-mono font-bold">Ref: #{id}</span>
      </div>

      {loading && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-gray-500 flex items-center">
          <Loader2 size={18} className="animate-spin mr-2" /> กำลังโหลดรายละเอียดใบสมัคร...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && ticket && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 mb-6">
            <div className="min-w-0">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase mb-3 border border-blue-100">
                ปีการศึกษา {ticket.academic_year} | ภาคเรียน {ticket.semester} | {AWARD_LABELS[ticket.award_type] || ticket.award_type}
              </span>
              <h1 className="text-2xl font-bold text-gray-800 leading-tight">ใบสมัคร{AWARD_LABELS[ticket.award_type] || ticket.award_type}</h1>
            </div>
            <div className="md:text-right">
              <StatusBadge status={ticket.status} />
              {EDITABLE_STATUSES.has(String(ticket.status || '').toLowerCase()) && (
                <div className="mt-3">
                  <Link
                    to={`/student/edit/${ticket.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition text-sm font-bold"
                  >
                    <Edit3 size={14} /> แก้ไขต่อ
                  </Link>
                </div>
              )}
            </div>
          </div>

          {(isWinner || isNotSelected) && (
            <div className={`mb-6 border rounded-xl p-4 ${isWinner ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <p className="font-bold">
                ผลการประกาศ: {isWinner ? 'ผ่านการคัดเลือก (ได้รับรางวัล)' : 'ไม่ผ่านการคัดเลือก'}
              </p>
              <p className="text-sm mt-1">
                ประกาศเมื่อ: {formatDate(ticket.result_announced_at)}
              </p>
            </div>
          )}

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-8 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2 border-b border-gray-200">
              <p className="text-sm text-gray-700">
                <span className="font-bold text-gray-600">ชื่อ-นามสกุล:</span> {ticket.full_name_thai || ticket.full_name || '-'}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-bold text-gray-600">เพศ:</span> {genderLabel(ticket.gender)}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-bold text-gray-600">คณะ:</span> {ticket.faculty || '-'}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-bold text-gray-600">ภาควิชา:</span> {ticket.department || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 mb-1 uppercase">คำอธิบายผลงาน</p>
              <p className="text-gray-700 leading-relaxed break-words">{ticket.portfolio_description || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 mb-1 uppercase">ผลงานที่ได้รับ</p>
              <p className="text-gray-700 leading-relaxed break-words">{ticket.achievements || '-'}</p>
            </div>
            <p className="text-xs text-gray-400">ส่งเมื่อ: {formatDate(ticket.submitted_at || ticket.created_at)}</p>
          </div>

          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Download size={20} className="text-ku-main" /> เอกสารที่ส่ง
          </h3>
          {files.length === 0 ? (
            <p className="text-sm text-gray-500 mb-8">ยังไม่มีไฟล์ที่อัปโหลด</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {files.map((file) => (
                <FilePreviewButton
                  key={file.id}
                  file={file}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-white hover:border-blue-300 transition cursor-pointer group w-full text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-500">
                      {fileTypeLabel(file.mime_type)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-700 group-hover:text-blue-600 truncate">{file.original_name}</p>
                      <p className="text-xs text-gray-400">{file.file_category}</p>
                    </div>
                  </div>
                  <Download size={18} className="text-gray-400 group-hover:text-blue-600" />
                </FilePreviewButton>
              ))}
            </div>
          )}

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
      )}
    </div>
  );
};

export default TicketDetail;
