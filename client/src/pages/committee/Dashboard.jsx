import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Users, Award, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authenticatedApiRequest } from '../../utils/api';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
    <div>
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
    </div>
    <div className={`p-3 rounded-full ${color}`}>
      <Icon size={24} />
    </div>
  </div>
);

const AWARD_LABELS = {
  activity_enrichment: '1.1. ด้านกิจกรรมเสริมหลักสูตร',
  creativity_innovation: '1.2. ด้านความคิดสร้างสรรค์และนวัตกรรม',
  good_behavior: '1.3. ด้านความประพฤติดี'
};

function CommitteeDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ total_tickets: 0, total_committee: 0, pending_vote: 0 });

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await authenticatedApiRequest('/api/votes/tickets');
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.message || 'ไม่สามารถโหลดแดชบอร์ดคณะกรรมการได้');
        }

        setTickets(Array.isArray(payload?.tickets) ? payload.tickets : []);
        setCategories(Array.isArray(payload?.categories) ? payload.categories : []);
        setSummary(payload?.summary || { total_tickets: 0, total_committee: 0, pending_vote: 0 });
      } catch (fetchError) {
        setError(fetchError.message || 'ไม่สามารถโหลดแดชบอร์ดคณะกรรมการได้');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const pendingApprovals = useMemo(() => tickets.filter((item) => !item.my_vote), [tickets]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ku-main">
            ยินดีต้อนรับ, {user?.fullname || 'คณะกรรมการ'}
          </h1>
          <p className="text-gray-500">แดชบอร์ดคณะกรรมการ - จัดการรางวัล</p>
        </div>
      </div>

      {loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-500 flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" /> กำลังโหลดแดชบอร์ด...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="ใบสมัครทั้งหมด" value={summary.total_tickets || 0} icon={FileText} color="bg-blue-50 text-blue-600" />
            <StatCard title="หมวดรางวัล" value={categories.length} icon={Award} color="bg-yellow-50 text-yellow-600" />
            <StatCard title="จำนวนกรรมการ" value={summary.total_committee || 0} icon={Users} color="bg-green-50 text-green-600" />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">รายการรอลงคะแนน</h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-white border-b border-gray-100 text-xs uppercase text-gray-400 font-bold">
                <tr>
                  <th className="p-4">ข้อมูลนิสิต</th>
                  <th className="p-4">หมวดรางวัล</th>
                  <th className="p-4">วันที่ส่ง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingApprovals.length === 0 ? (
                  <tr>
                    <td className="p-4 text-gray-500 text-sm" colSpan={3}>ไม่มีรายการรอลงคะแนน</td>
                  </tr>
                ) : (
                  pendingApprovals.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-ku-light cursor-pointer transition-colors"
                      onClick={() => navigate(`/committee/vote/${item.id}`)}
                    >
                      <td className="p-4">
                        <div className="font-bold text-gray-800">{item.fullname || '-'}</div>
                        <div className="text-xs text-gray-500">รหัสนิสิต: {item.ku_id || '-'}</div>
                      </td>
                      <td className="p-4">{AWARD_LABELS[item.award_type] || item.award_type}</td>
                      <td className="p-4">{new Date(item.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">หมวดรางวัลในรอบปัจจุบัน</h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-white border-b border-gray-100 text-xs uppercase text-gray-400 font-bold">
                <tr>
                  <th className="p-6">หมวดรางวัล</th>
                  <th className="p-6">จำนวนผู้เข้าชิง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {categories.length === 0 ? (
                  <tr>
                    <td className="p-6 text-gray-500 text-sm" colSpan={2}>ไม่มีผู้เข้าชิงในรอบนี้</td>
                  </tr>
                ) : (
                  categories.map((category) => (
                    <tr key={category.award_type} className="hover:bg-gray-50 transition-colors">
                      <td className="p-6 font-bold text-gray-800">{AWARD_LABELS[category.award_type] || category.award_type}</td>
                      <td className="p-6 font-mono font-bold text-ku-main">{category.candidates}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default CommitteeDashboard;
