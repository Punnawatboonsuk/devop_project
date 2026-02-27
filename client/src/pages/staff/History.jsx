import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Download,
  CheckCircle,
  XCircle,
  Filter,
  Eye,
  Calendar,
  FileText,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { authenticatedApiRequest } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';

const AWARD_LABELS = {
  academic: 'ด้านวิชาการ',
  sport: 'ด้านกีฬา',
  arts_culture: 'ด้านศิลปวัฒนธรรม',
  moral_ethics: 'ด้านคุณธรรมจริยธรรม',
  social_service: 'ด้านบำเพ็ญประโยชน์',
  innovation: 'ด้านนวัตกรรม',
  entrepreneurship: 'ด้านผู้ประกอบการ'
};

const ROLE_HISTORY_APPROVED_STATUSES = {
  STAFF: new Set(['reviewed_by_staff', 'reviewed_by_subdean', 'reviewed_by_dean', 'approved', 'announced']),
  SUB_DEAN: new Set(['reviewed_by_subdean', 'reviewed_by_dean', 'approved', 'announced']),
  DEAN: new Set(['reviewed_by_dean', 'approved', 'announced'])
};

const ROLE_HISTORY_VISIBLE_STATUSES = {
  STAFF: new Set(['reviewed_by_staff', 'reviewed_by_subdean', 'reviewed_by_dean', 'approved', 'announced', 'rejected', 'returned', 'not_approved', 'dq', 'expired']),
  SUB_DEAN: new Set(['reviewed_by_subdean', 'reviewed_by_dean', 'approved', 'announced', 'rejected', 'returned', 'not_approved', 'dq', 'expired']),
  DEAN: new Set(['reviewed_by_dean', 'approved', 'announced', 'rejected', 'returned', 'not_approved', 'dq', 'expired'])
};

const REJECTED_STATUSES = new Set(['rejected', 'returned', 'not_approved', 'dq', 'expired']);

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const parseTs = (value) => {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const normalizeId = (value) => String(value ?? '').trim();

const StaffHistory = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const role = user?.primary_role || user?.role || 'STAFF';
  const userId = normalizeId(user?.id);
  const approvedStatuses = ROLE_HISTORY_APPROVED_STATUSES[role] || ROLE_HISTORY_APPROVED_STATUSES.STAFF;
  const visibleStatuses = ROLE_HISTORY_VISIBLE_STATUSES[role] || ROLE_HISTORY_VISIBLE_STATUSES.STAFF;

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await authenticatedApiRequest('/api/tickets');
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || 'ไม่สามารถโหลดประวัติได้');
        }

        const payload = await response.json();
        const list = Array.isArray(payload?.tickets) ? payload.tickets : [];
        setTickets(list);
      } catch (fetchError) {
        setError(fetchError.message || 'ไม่สามารถโหลดประวัติได้');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const historyData = useMemo(() => {
    const roleKey = normalizeRole(role);

    const findMyLatestAction = (ticket) => {
      const logs = Array.isArray(ticket.status_log) ? ticket.status_log : [];
      const myLogs = logs
        .filter((log) => normalizeId(log?.actor_id) === userId && normalizeRole(log?.actor_role) === roleKey)
        .sort((a, b) => parseTs(b?.timestamp) - parseTs(a?.timestamp));

      if (myLogs.length > 0) {
        const latest = myLogs[0];
        return {
          status: String(latest?.status || ticket.status || '').toLowerCase(),
          timestamp: latest?.timestamp || ticket.reviewed_at || ticket.updated_at || ticket.created_at,
          remark: latest?.remark || null
        };
      }

      if (normalizeId(ticket.reviewed_by) === userId) {
        return {
          status: String(ticket.status || '').toLowerCase(),
          timestamp: ticket.reviewed_at || ticket.updated_at || ticket.created_at,
          remark: ticket.reason_for_return || ticket.review_notes || ticket.reject_reason || null
        };
      }

      return null;
    };

    return tickets
      .map((ticket) => {
        const myAction = findMyLatestAction(ticket);
        return {
          ...ticket,
          my_action_status: myAction?.status || null,
          my_action_at: myAction?.timestamp || null,
          my_action_remark: myAction?.remark || null
        };
      })
      .filter((ticket) => Boolean(ticket.my_action_status) && visibleStatuses.has(String(ticket.my_action_status).toLowerCase()))
      .sort((a, b) => new Date(b.my_action_at || b.updated_at || b.created_at) - new Date(a.my_action_at || a.updated_at || a.created_at));
  }, [tickets, visibleStatuses, role, userId]);

  const displayedList = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return historyData.filter((item) => {
      const status = String(item.my_action_status || '').toLowerCase();
      const statusMatch =
        filter === 'ALL'
          ? true
          : filter === 'APPROVED'
            ? approvedStatuses.has(status)
            : REJECTED_STATUSES.has(status);

      const searchMatch =
        !keyword ||
        String(item.full_name || '').toLowerCase().includes(keyword) ||
        String(item.student_code || '').toLowerCase().includes(keyword) ||
        String(item.id || '').toLowerCase().includes(keyword) ||
        String(item.award_type || '').toLowerCase().includes(keyword);

      return statusMatch && searchMatch;
    });
  }, [historyData, filter, searchTerm, approvedStatuses]);

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

  const isApprovedStatus = (status) => {
    const normalized = String(status || '').toLowerCase();
    return approvedStatuses.has(normalized);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="text-ku-main" /> ประวัติการดำเนินการ
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            ประวัติการพิจารณาใบสมัครในสายงานของภาควิชาคุณ
          </p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition shadow-sm">
          <Download size={18} /> ส่งออก CSV
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex p-1 bg-gray-100 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setFilter('ALL')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'ALL' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ทั้งหมด
          </button>
          <button
            onClick={() => setFilter('APPROVED')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${filter === 'APPROVED' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-green-600'}`}
          >
            <CheckCircle size={16} /> อนุมัติ
          </button>
          <button
            onClick={() => setFilter('REJECTED')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${filter === 'REJECTED' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-red-600'}`}
          >
            <XCircle size={16} /> ไม่อนุมัติ/ส่งกลับ
          </button>
        </div>

        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="ค้นหาด้วยชื่อนิสิต รหัสนิสิต หรือรหัสใบสมัคร..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ku-main/50 focus:border-ku-main transition"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" /> กำลังโหลดประวัติ...
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-red-600">{error}</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">นิสิต</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">รางวัล</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">วันที่ดำเนินการ</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ผลลัพธ์</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">หมายเหตุ</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">ดู</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayedList.length > 0 ? (
                displayedList.map((item) => {
                  const approved = isApprovedStatus(item.my_action_status);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{item.full_name || '-'}</p>
                          <p className="text-xs text-gray-400 font-mono">{item.student_code || '-'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
                          <FileText size={12} />
                          {AWARD_LABELS[item.award_type] || item.award_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                        {formatDate(item.my_action_at || item.updated_at || item.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${approved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {approved ? <CheckCircle size={14} /> : <XCircle size={14} />}
                          {approved ? 'อนุมัติ' : 'ไม่อนุมัติ/ส่งกลับ'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {item.my_action_remark || item.reason_for_return || item.review_notes || item.reject_reason || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/staff/review/${item.id}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-ku-main hover:text-white transition"
                          title="ดูรายละเอียด"
                        >
                          <Eye size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-300">
                      <Filter size={48} className="mb-3 opacity-50" />
                      <p className="text-lg font-bold text-gray-400">ไม่พบข้อมูล</p>
                      <p className="text-sm">ลองเปลี่ยนตัวกรองหรือคำค้นหา</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-between items-center text-xs text-gray-400 px-2">
        <p>แสดง {displayedList.length} จาก {historyData.length} รายการ</p>
        <p>ประวัติการทำงานตามสายงานภาควิชา</p>
      </div>
    </div>
  );
};

export default StaffHistory;
