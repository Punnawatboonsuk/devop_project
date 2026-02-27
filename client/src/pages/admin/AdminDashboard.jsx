import React, { useEffect, useMemo, useState } from 'react';
import { Users, FileText, UserCheck, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authenticatedApiRequest } from '../../utils/api';

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

const STAGE_DEFS = [
  { key: 'draft', label: 'ฉบับร่าง', color: 'bg-slate-400' },
  { key: 'submitted_by_student', label: 'ส่งโดยนิสิต', color: 'bg-blue-500' },
  { key: 'reviewed_by_staff', label: 'ผ่านหัวหน้าภาควิชา', color: 'bg-indigo-500' },
  { key: 'reviewed_by_subdean', label: 'ผ่านรองคณบดี', color: 'bg-violet-500' },
  { key: 'reviewed_by_dean', label: 'ผ่านคณบดี', color: 'bg-fuchsia-500' },
  { key: 'approved', label: 'ผ่านตรวจสิทธิ์', color: 'bg-emerald-500' },
  { key: 'announced', label: 'ประกาศผลแล้ว', color: 'bg-green-700' },
  { key: 'returned', label: 'ส่งกลับแก้ไข', color: 'bg-amber-500' },
  { key: 'rejected', label: 'ไม่อนุมัติ', color: 'bg-red-500' },
  { key: 'expired', label: 'หมดอายุ', color: 'bg-gray-500' },
  { key: 'dq', label: 'ตัดสิทธิ์', color: 'bg-rose-700' }
];

const hasCommitteeRole = (roles) => {
  const list = Array.isArray(roles) ? roles : [];
  return list.includes('COMMITTEE') || list.includes('COMMITTEE_PRESIDENT');
};

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [phaseInfo, setPhaseInfo] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [usersResponse, ticketsResponse, phaseResponse] = await Promise.all([
        authenticatedApiRequest('/api/admin/users'),
        authenticatedApiRequest('/api/tickets'),
        authenticatedApiRequest('/api/admin/phase/current')
      ]);

      const usersPayload = await usersResponse.json().catch(() => ({}));
      const ticketsPayload = await ticketsResponse.json().catch(() => ({}));
      const phasePayload = await phaseResponse.json().catch(() => ({}));

      if (!usersResponse.ok) {
        throw new Error(usersPayload?.message || 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
      }
      if (!ticketsResponse.ok) {
        throw new Error(ticketsPayload?.message || 'ไม่สามารถโหลดข้อมูลใบสมัครได้');
      }

      setUsers(Array.isArray(usersPayload?.users) ? usersPayload.users : []);
      setTickets(Array.isArray(ticketsPayload?.tickets) ? ticketsPayload.tickets : []);
      setPhaseInfo(phaseResponse.ok ? phasePayload : null);
    } catch (fetchError) {
      setError(fetchError.message || 'ไม่สามารถโหลดข้อมูลแดชบอร์ดได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentYear = phaseInfo?.round?.academic_year || null;
  const currentSemester = phaseInfo?.round?.semester || null;

  const currentRoundTickets = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          Number.parseInt(ticket.academic_year, 10) === Number.parseInt(currentYear, 10) &&
          Number.parseInt(ticket.semester, 10) === Number.parseInt(currentSemester, 10)
      ),
    [tickets, currentYear, currentSemester]
  );

  const stageStats = useMemo(() => {
    const total = currentRoundTickets.length;
    return STAGE_DEFS.map((stage) => {
      const count = currentRoundTickets.filter((ticket) => String(ticket.status || '').toLowerCase() === stage.key).length;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return { ...stage, count, pct };
    });
  }, [currentRoundTickets]);

  const stackedStages = useMemo(
    () => stageStats.filter((stage) => stage.count > 0),
    [stageStats]
  );

  const totalUsers = users.length;
  const totalTickets = tickets.length;
  const currentCommitteeMembers = users.filter((user) => hasCommitteeRole(user.roles)).length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">แดชบอร์ดผู้ดูแลระบบ</h1>
          <p className="text-gray-500 mt-1">
            ปีการศึกษา {currentYear || '-'} / ภาคเรียน {currentSemester || '-'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-bold">
            <RefreshCw size={16} /> รีเฟรช
          </button>
          <Link to="/admin/verification" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ku-main text-white text-sm font-bold hover:bg-green-800">
            <FileText size={16} /> ไปหน้าตรวจสิทธิ์
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="ผู้ใช้ทั้งหมด" value={totalUsers} icon={Users} color="bg-blue-50 text-blue-600" />
        <StatCard title="ใบสมัครทั้งหมด" value={totalTickets} icon={FileText} color="bg-orange-50 text-orange-600" />
        <StatCard title="กรรมการปัจจุบัน" value={currentCommitteeMembers} icon={UserCheck} color="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-800 mb-1">สัดส่วนสถานะใบสมัคร (ปี/ภาคเรียนปัจจุบัน)</h2>
        <p className="text-sm text-gray-500 mb-6">จำนวนใบสมัครในรอบนี้: {currentRoundTickets.length}</p>

        {loading ? (
          <div className="py-6 text-gray-500 flex items-center gap-2">
            <Loader2 size={18} className="animate-spin" /> กำลังโหลดสถิติ...
          </div>
        ) : error ? (
          <div className="py-2 text-red-600 text-sm">{error}</div>
        ) : (
          <div className="space-y-4">
            <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
              {stackedStages.length > 0 ? (
                stackedStages.map((stage) => (
                  <div
                    key={stage.key}
                    className={`${stage.color} h-full transition-all duration-500`}
                    style={{ width: `${stage.pct}%` }}
                    title={`${stage.label}: ${stage.count} (${stage.pct}%)`}
                  />
                ))
              ) : (
                <div className="h-full w-full bg-gray-200" />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {stageStats.map((stage) => (
                <div key={stage.key} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2">
                  <span className="text-gray-700 font-medium inline-flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                    {stage.label}
                  </span>
                  <span className="text-gray-500">{stage.count} ({stage.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
