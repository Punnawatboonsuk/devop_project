import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, X, FileText, Star, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { authenticatedApiRequest } from '../../utils/api';

const AWARD_LABELS = {
  academic: 'ด้านวิชาการ',
  sport: 'ด้านกีฬา',
  arts_culture: 'ด้านศิลปวัฒนธรรม',
  moral_ethics: 'ด้านคุณธรรมจริยธรรม',
  social_service: 'ด้านบำเพ็ญประโยชน์',
  innovation: 'ด้านนวัตกรรม',
  entrepreneurship: 'ด้านผู้ประกอบการ'
};

const fileTypeLabel = (mimeType = '') => {
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('image')) return 'IMG';
  if (mimeType.includes('word')) return 'DOC';
  if (mimeType.includes('zip')) return 'ZIP';
  return 'FILE';
};

const VotingBallot = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedVote, setSelectedVote] = useState(null);

  useEffect(() => {
    const fetchCandidate = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await authenticatedApiRequest(`/api/votes/tickets/${id}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'ไม่สามารถโหลดรายละเอียดผู้เข้าชิงได้');
        }

        setCandidate(payload?.candidate || null);
        setFiles(Array.isArray(payload?.files) ? payload.files : []);
        setSelectedVote(payload?.candidate?.my_vote || null);
      } catch (fetchError) {
        setError(fetchError.message || 'ไม่สามารถโหลดรายละเอียดผู้เข้าชิงได้');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchCandidate();
    }
  }, [id]);

  const canSubmit = useMemo(() => !candidate?.my_vote && selectedVote, [candidate?.my_vote, selectedVote]);

  const handleVote = async () => {
    if (!selectedVote || !candidate?.id) return;
    try {
      setSubmitting(true);
      const response = await authenticatedApiRequest(`/api/votes/${candidate.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ vote_result: selectedVote })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถส่งผลโหวตได้');
      }

      toast.success('ส่งผลโหวตเรียบร้อย');
      setCandidate((prev) => ({ ...prev, my_vote: selectedVote, my_voted_at: new Date().toISOString() }));
    } catch (submitError) {
      toast.error(submitError.message || 'ไม่สามารถส่งผลโหวตได้');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ku-main">บัตรลงคะแนน</h1>
          <p className="text-gray-500">ตรวจสอบข้อมูลผู้เข้าชิงและลงคะแนนของคุณ</p>
        </div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-ku-main">
          <span className="font-bold">&#8592;</span> กลับไปหน้าผู้เข้าชิง
        </button>
      </div>

      {loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-500 flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" /> กำลังโหลดบัตรลงคะแนน...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && candidate && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-8">
              <div className="w-32 h-32 bg-gray-200 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                <span className="text-4xl font-bold text-gray-500">
                  {(candidate.fullname || 'N').split(' ').map((name) => name[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">{candidate.fullname || '-'}</h1>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="bg-gray-100 px-3 py-1 rounded-full text-sm font-medium text-gray-700">
                    คณะ {candidate.faculty || '-'}
                  </span>
                  <span className="bg-gray-100 px-3 py-1 rounded-full text-sm font-medium text-gray-700">
                    {candidate.department || '-'}
                  </span>
                  <span className="bg-gray-100 px-3 py-1 rounded-full text-sm font-medium text-gray-700">
                    {AWARD_LABELS[candidate.award_type] || candidate.award_type}
                  </span>
                </div>
                <p className="text-gray-500 mb-2">{candidate.portfolio_description || '-'}</p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Star size={20} className="text-ku-accent fill-ku-accent" /> ผลงานสำคัญ
              </h3>
              <ul className="space-y-4">
                {candidate.achievements?.length ? (
                  candidate.achievements.map((item, index) => (
                    <li key={`${item}-${index}`} className="flex items-start gap-4 p-2 rounded-xl">
                      <div className="mt-2 w-2 h-2 bg-ku-main rounded-full" />
                      <div className="text-gray-700 font-medium leading-relaxed">{item}</div>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-500">ไม่มีข้อมูลผลงาน</li>
                )}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-6 flex flex-col items-center justify-center border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">เกรดเฉลี่ยปัจจุบัน</div>
                <div className="text-2xl font-bold text-green-700">{candidate.gpa ?? '-'}</div>
              </div>
              <div className="bg-white rounded-xl p-6 flex flex-col items-center justify-center border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">จำนวนเสียงอนุมัติ</div>
                <div className="text-2xl font-bold text-orange-600">
                  {candidate.voting?.approved || 0}
                  <span className="text-sm"> / {candidate.voting?.total_committee || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText size={18} /> หลักฐานประกอบ</h3>
              </div>
              <div className="space-y-2">
                {files.length === 0 ? (
                  <p className="text-sm text-gray-500">ไม่มีไฟล์หลักฐาน</p>
                ) : (
                  files.map((file) => (
                    <a
                      key={file.id}
                      href={file.download_url}
                      className="flex items-center justify-between gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 hover:border-blue-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                          {fileTypeLabel(file.mime_type)}
                        </div>
                        <div className="font-semibold text-gray-800 text-sm truncate">{file.original_name}</div>
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100 flex flex-col gap-4">
              {candidate.my_vote ? (
                <div className="py-3 px-4 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm font-semibold">
                  คุณลงคะแนนแล้ว: {candidate.my_vote === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ'}
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <button
                      className={`flex-1 py-3 rounded-lg font-bold border ${selectedVote === 'not_approved' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}
                      onClick={() => setSelectedVote('not_approved')}
                    >
                      <X size={20} className="inline mr-1" /> ไม่อนุมัติ
                    </button>
                    <button
                      className={`flex-1 py-3 rounded-lg font-bold border ${selectedVote === 'approved' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-green-600 border-green-200 hover:bg-green-50'}`}
                      onClick={() => setSelectedVote('approved')}
                    >
                      <Check size={20} className="inline mr-1" /> อนุมัติ
                    </button>
                  </div>
                  <button
                    className="mt-2 py-3 rounded-lg font-bold bg-ku-main text-white hover:bg-green-800 transition disabled:opacity-60"
                    onClick={handleVote}
                    disabled={!canSubmit || submitting}
                  >
                    {submitting ? 'กำลังส่งผลโหวต...' : `ยืนยัน${selectedVote === 'approved' ? 'อนุมัติ' : selectedVote === 'not_approved' ? 'ไม่อนุมัติ' : 'การโหวต'}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VotingBallot;
