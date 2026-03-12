import React, { useEffect, useMemo, useState } from 'react';
import { Search, Eye, Calendar, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge';
import { authenticatedApiRequest } from '../../utils/api';

const AWARD_LABELS = {
  activity_enrichment: '1.1. ด้านกิจกรรมเสริมหลักสูตร',
  creativity_innovation: '1.2. ด้านความคิดสร้างสรรค์และนวัตกรรม',
  good_behavior: '1.3. ด้านความประพฤติดี'
};

const StudentHistory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await authenticatedApiRequest('/api/tickets/me');
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || 'ไม่สามารถโหลดประวัติใบสมัครได้');
        }

        const payload = await response.json();
        setTickets(Array.isArray(payload?.tickets) ? payload.tickets : []);
      } catch (fetchError) {
        setError(fetchError.message || 'ไม่สามารถโหลดประวัติใบสมัครได้');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return tickets;

    return tickets.filter((ticket) => {
      const id = String(ticket.id || '').toLowerCase();
      const awardType = String(ticket.award_type || '').toLowerCase();
      const academicYear = String(ticket.academic_year || '').toLowerCase();
      return id.includes(keyword) || awardType.includes(keyword) || academicYear.includes(keyword);
    });
  }, [tickets, searchTerm]);

  const formatDate = (rawDate) => {
    if (!rawDate) return '-';
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const renderResult = (ticket) => {
    const result = ticket?.proclamation_result || null;
    if (result === 'winner') {
      return <span className="text-xs font-bold text-green-700">ได้รับรางวัล</span>;
    }
    if (result === 'not_selected') {
      return <span className="text-xs font-bold text-red-600">ไม่ได้รับรางวัล</span>;
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="text-ku-main" /> ประวัติ
          </h1>
          <p className="text-gray-500 text-sm mt-1">รายการใบสมัครทั้งหมดและสถานะล่าสุดของคุณ</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="ค้นหาด้วยรหัสใบสมัคร หมวดรางวัล หรือปีการศึกษา..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ku-main/50 focus:border-ku-main transition"
          />
        </div>
      </div>

      {loading && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-gray-500">
          <Loader2 size={18} className="animate-spin mr-2" /> กำลังโหลดประวัติ...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">ปีการศึกษา</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">ใบสมัคร</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">วันที่ส่ง</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">สถานะ</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!loading && filteredHistory.length > 0 ? (
              filteredHistory.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-6 py-4 font-bold text-gray-700">{ticket.academic_year || '-'}</td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{AWARD_LABELS[ticket.award_type] || ticket.award_type}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400 font-mono">#{ticket.id}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">
                          ภาคเรียน {ticket.semester || '-'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(ticket.submitted_at || ticket.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={ticket.status} />
                      {renderResult(ticket)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/student/ticket/${ticket.id}`}
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition text-sm font-bold gap-1"
                    >
                      <Eye size={16} /> รายละเอียด
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              !loading && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                    ไม่พบประวัติใบสมัคร
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentHistory;
