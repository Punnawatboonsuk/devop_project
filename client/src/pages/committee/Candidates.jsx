import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { authenticatedApiRequest } from '../../utils/api';

const AWARD_COLORS = {
  academic: 'bg-green-100 text-green-700',
  sport: 'bg-blue-100 text-blue-700',
  arts_culture: 'bg-orange-100 text-orange-700',
  moral_ethics: 'bg-indigo-100 text-indigo-700',
  social_service: 'bg-purple-100 text-purple-700',
  innovation: 'bg-yellow-100 text-yellow-700',
  entrepreneurship: 'bg-pink-100 text-pink-700'
};

const AWARD_LABELS = {
  academic: 'ด้านวิชาการ',
  sport: 'ด้านกีฬา',
  arts_culture: 'ด้านศิลปวัฒนธรรม',
  moral_ethics: 'ด้านคุณธรรมจริยธรรม',
  social_service: 'ด้านบำเพ็ญประโยชน์',
  innovation: 'ด้านนวัตกรรม',
  entrepreneurship: 'ด้านผู้ประกอบการ'
};

const getCategoryColor = (category) => AWARD_COLORS[category] || 'bg-gray-100 text-gray-700';

const CandidateCard = ({ candidate, onViewDetail }) => {
  const approved = candidate?.voting?.approved || 0;
  const rejected = candidate?.voting?.not_approved || 0;
  const total = approved + rejected;
  const approvePercent = total ? Math.round((approved / total) * 100) : 0;
  const rejectPercent = total ? 100 - approvePercent : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 min-w-[320px]">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center font-bold text-lg text-gray-600">
          {(candidate.fullname || 'N').split(' ').map((name) => name[0]).join('').slice(0, 2)}
        </div>
        <div>
          <div className="font-bold text-lg text-gray-800">{candidate.fullname || '-'}</div>
          <div className="text-xs text-gray-500">รหัสนิสิต: {candidate.ku_id || '-'}</div>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${getCategoryColor(candidate.award_type)}`}>
          {AWARD_LABELS[candidate.award_type] || candidate.award_type}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs font-bold">
          <span className="text-green-700">{approvePercent}%</span>
          <span className="text-red-600">{rejectPercent}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden flex">
          <div className="bg-green-500 h-full" style={{ width: `${approvePercent}%` }} />
          <div className="bg-red-500 h-full" style={{ width: `${rejectPercent}%` }} />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-green-700">{approved} อนุมัติ</span>
          <span className="text-red-600">{rejected} ไม่อนุมัติ</span>
        </div>
      </div>

      <button
        className="mt-2 text-ku-main font-semibold flex items-center gap-1 hover:underline"
        onClick={onViewDetail}
      >
        ดูรายละเอียด <span aria-hidden>&#8594;</span>
      </button>
    </div>
  );
};

const CommitteeCandidates = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await authenticatedApiRequest('/api/votes/tickets');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'ไม่สามารถโหลดผู้เข้าชิงได้');
        }
        setCandidates(Array.isArray(payload?.tickets) ? payload.tickets : []);
      } catch (fetchError) {
        setError(fetchError.message || 'ไม่สามารถโหลดผู้เข้าชิงได้');
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ku-main">ความคืบหน้าการลงคะแนนแบบเรียลไทม์</h1>
          <p className="text-gray-500">ติดตามผลการพิจารณาผู้เข้าชิงแบบทันที</p>
        </div>
      </div>

      {loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-500 flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" /> กำลังโหลดผู้เข้าชิง...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {candidates.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-gray-500 text-sm">
              ไม่มีผู้เข้าชิงในรอบนี้
            </div>
          ) : (
            candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                onViewDetail={() => navigate(`/committee/vote/${candidate.id}`)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CommitteeCandidates;
