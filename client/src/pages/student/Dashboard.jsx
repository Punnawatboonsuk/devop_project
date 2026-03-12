import React, { useEffect, useMemo, useState } from 'react';
import { Plus, FileText, Clock, CheckCircle, Lock, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authenticatedApiRequest } from '../../utils/api';
import StatusBadge from '../../components/StatusBadge';

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

const CLOSED_PHASES = new Set(['CLOSED_NOMINATION', 'REVIEW_END', 'VOTING', 'VOTING_END', 'CERTIFICATE']);
const PENDING_STATUSES = new Set(['submitted_by_student', 'reviewed_by_staff', 'reviewed_by_subdean', 'reviewed_by_dean']);
const ACTIVE_STATUSES = new Set(['draft', 'submitted_by_student', 'reviewed_by_staff', 'reviewed_by_subdean', 'reviewed_by_dean', 'approved', 'returned']);
const EDITABLE_STATUSES = new Set(['draft', 'returned']);

const StudentDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [systemPhase, setSystemPhase] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [userResponse, phaseResponse, ticketsResponse] = await Promise.all([
          authenticatedApiRequest('/api/auth/me'),
          authenticatedApiRequest('/api/auth/phase'),
          authenticatedApiRequest('/api/tickets/me')
        ]);

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData.user);
        }

        if (phaseResponse.ok) {
          const phaseData = await phaseResponse.json();
          setSystemPhase(phaseData.phase);
        }

        if (ticketsResponse.ok) {
          const ticketsData = await ticketsResponse.json();
          setTickets(Array.isArray(ticketsData.tickets) ? ticketsData.tickets : []);
        }
      } catch (error) {
        console.error('Dashboard fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)),
    [tickets]
  );

  const activeTicket = useMemo(
    () => sortedTickets.find((ticket) => ACTIVE_STATUSES.has(String(ticket.status || '').toLowerCase())) || null,
    [sortedTickets]
  );

  const totalTickets = tickets.length;
  const pendingTickets = tickets.filter((t) => PENDING_STATUSES.has(String(t.status || '').toLowerCase())).length;
  const approvedTickets = tickets.filter((t) => String(t.status || '').toLowerCase() === 'approved').length;

  const canCreateNewTicket =
    !loading &&
    !CLOSED_PHASES.has(String(systemPhase || '').toUpperCase()) &&
    (!activeTicket || ['rejected', 'returned', 'not_approved', 'expired', 'dq'].includes(String(activeTicket.status || '').toLowerCase()));

  const formatDate = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ยินดีต้อนรับ, {user?.fullname || 'นิสิต'}</h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded text-gray-600">{user?.ku_id || '-'}</span>
            {user?.faculty || '-'} | {user?.department || '-'}
          </p>
        </div>
        <div>
          {loading ? (
            <button disabled className="flex items-center gap-2 bg-gray-200 text-gray-500 px-5 py-2.5 rounded-lg cursor-not-allowed font-medium shadow-sm">
              <RefreshCw size={18} className="animate-spin" /> กำลังโหลด...
            </button>
          ) : CLOSED_PHASES.has(String(systemPhase || '').toUpperCase()) ? (
            <button disabled className="flex items-center gap-2 bg-gray-200 text-gray-500 px-5 py-2.5 rounded-lg cursor-not-allowed font-medium shadow-sm">
              <Lock size={18} /> ปิดรับสมัครแล้ว
            </button>
          ) : canCreateNewTicket ? (
            <Link to="/student/create" className="flex items-center gap-2 bg-ku-main text-white px-5 py-2.5 rounded-lg hover:bg-green-800 transition shadow-md font-medium">
              <Plus size={20} />
              <span>สร้างใบสมัครใหม่</span>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="ใบสมัครทั้งหมด" value={totalTickets} icon={FileText} color="bg-blue-50 text-blue-600" />
        <StatCard title="รอตรวจสอบ" value={pendingTickets} icon={Clock} color="bg-orange-50 text-orange-600" />
        <StatCard title="ผ่านอนุมัติ" value={approvedTickets} icon={CheckCircle} color="bg-green-50 text-green-600" />
      </div>

      {activeTicket && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <FileText size={18} className="text-ku-main" /> ใบสมัครล่าสุด
            </h3>
            <Link to="/student/tracking" className="text-sm font-bold text-ku-main hover:underline bg-ku-light px-4 py-1.5 rounded-lg">
              ติดตามสถานะ
            </Link>
          </div>
          <div className="p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{activeTicket.award_type || '-'}</span>
              <h4 className="font-bold text-gray-800 text-lg leading-tight mt-1">ใบสมัคร #{activeTicket.id}</h4>
              <p className="text-sm text-gray-400 mt-1">
                อัปเดตล่าสุด: {formatDate(activeTicket.updated_at || activeTicket.created_at)}
              </p>
              {EDITABLE_STATUSES.has(String(activeTicket.status || '').toLowerCase()) && (
                <Link
                  to={`/student/edit/${activeTicket.id}`}
                  className="inline-flex items-center mt-3 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition text-sm font-bold"
                >
                  ดำเนินการแก้ไขต่อ
                </Link>
              )}
            </div>
            <StatusBadge status={activeTicket.status} />
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
