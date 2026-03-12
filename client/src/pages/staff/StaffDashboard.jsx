import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2, Users, Clock3, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import StatusBadge from '../../components/StatusBadge';
import { authenticatedApiRequest } from '../../utils/api';
import { getRoleLabel } from '../../utils/roleLabels';

const AWARD_LABELS = {
  activity_enrichment: '1.1 ด้านกิจกรรมเสริมหลักสูตร',
  creativity_innovation: '1.2 ด้านความคิดสร้างสรรค์และนวัตกรรม',
  good_behavior: '1.3 ด้านความประพฤติดี'
};

const ROLE_TO_STATUS = {
  STAFF: 'submitted_by_student',
  SUB_DEAN: 'reviewed_by_staff',
  DEAN: 'reviewed_by_subdean'
};

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
    <div>
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
    </div>
    <div className={`p-3 rounded-full ${color}`}>
      <Icon size={22} />
    </div>
  </div>
);

const StaffDashboard = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const role = user?.primary_role || user?.role;

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await authenticatedApiRequest('/api/tickets');
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || 'ไม่สามารถโหลดใบสมัครได้');
        }

        const payload = await response.json();
        setTickets(Array.isArray(payload?.tickets) ? payload.tickets : []);
      } catch (fetchError) {
        setError(fetchError.message || 'ไม่สามารถโหลดใบสมัครได้');
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, []);

  const requiredStatus = ROLE_TO_STATUS[role] || '';

  const queueByRole = useMemo(
    () => tickets
      .filter((ticket) => String(ticket.status || '').toLowerCase() === requiredStatus)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [tickets, requiredStatus]
  );

  const currentStudentCount = useMemo(() => {
    const filtered = tickets.filter((ticket) => {
      if (role === 'STAFF') {
        return String(ticket.department || '') === String(user?.department || '');
      }
      if (role === 'SUB_DEAN' || role === 'DEAN') {
        return String(ticket.faculty || '') === String(user?.faculty || '');
      }
      return false;
    });

    const studentIds = new Set(
      filtered
        .map((ticket) => ticket.student_code || ticket.student_id)
        .filter(Boolean)
    );
    return studentIds.size;
  }, [tickets, role, user?.department, user?.faculty]);

  const scopeText =
    role === 'STAFF'
      ? `${user?.department || '-'} (เฉพาะสาขา)`
      : `${user?.faculty || '-'} (ทั้งคณะ)`;

  const studentCountTitle =
    role === 'STAFF'
      ? 'นิสิตทั้งหมดในสาขา'
      : 'นิสิตทั้งหมดในคณะ';

  const previewList = queueByRole.slice(0, 5);

  const formatDate = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">พอร์ทัลสายพิจารณา - {getRoleLabel(role || 'STAFF')}</h1>
          <p className="text-gray-500 mt-1">ขอบเขตที่เห็น: {scopeText}</p>
        </div>
        <Link
          to="/staff/reviews"
          className="inline-flex items-center gap-2 bg-ku-main text-white px-4 py-2 rounded-lg hover:bg-green-800 transition font-bold text-sm"
        >
          ไปหน้าคิวตรวจสอบ <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title={studentCountTitle} value={currentStudentCount} icon={Users} color="bg-blue-50 text-blue-600" />
        <StatCard title="คำขอรอตรวจสอบ" value={queueByRole.length} icon={Clock3} color="bg-orange-50 text-orange-600" />
        <StatCard title="คำขอในขอบเขตทั้งหมด" value={tickets.length} icon={ListChecks} color="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">คิวล่าสุด</h2>
          <Link to="/staff/reviews" className="text-sm text-ku-main font-bold hover:underline">ดูทั้งหมด</Link>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" /> กำลังโหลดใบสมัคร...
          </div>
        ) : error ? (
          <div className="px-6 py-10 text-center text-red-600">{error}</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">นิสิต</th>
                <th className="px-6 py-4">รางวัล</th>
                <th className="px-6 py-4">วันที่ส่ง</th>
                <th className="px-6 py-4">สถานะ</th>
                <th className="px-6 py-4 text-right">ตรวจสอบ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {previewList.length > 0 ? (
                previewList.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-800">{item.full_name || item.full_name_thai || '-'}</p>
                      <p className="text-xs text-gray-400 font-mono">{item.student_code || '-'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{AWARD_LABELS[item.award_type] || item.award_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(item.submitted_at || item.created_at)}</td>
                    <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/staff/review/${item.id}`} className="inline-flex items-center gap-1 text-ku-main font-bold text-sm hover:underline">
                        เปิด <ArrowRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-400 italic">
                    ไม่มีใบสมัครที่รอตรวจสอบในขณะนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;
