import React, { useEffect, useMemo, useState } from 'react';
import { Search, ArrowRight, Loader2 } from 'lucide-react';
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

const StaffReviews = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
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

  const pendingList = useMemo(() => {
    const requiredStatus = ROLE_TO_STATUS[role];
    if (!requiredStatus) return [];

    let filtered = tickets.filter((ticket) => String(ticket.status || '').toLowerCase() === requiredStatus);
    if (searchTerm.trim()) {
      const keyword = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((ticket) => {
        const name = String(ticket.full_name || ticket.full_name_thai || '').toLowerCase();
        const studentCode = String(ticket.student_code || '').toLowerCase();
        const id = String(ticket.id || '').toLowerCase();
        const award = String(ticket.award_type || '').toLowerCase();
        return name.includes(keyword) || studentCode.includes(keyword) || id.includes(keyword) || award.includes(keyword);
      });
    }

    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [tickets, role, searchTerm]);

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
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">คิวรอตรวจสอบ - {getRoleLabel(role || 'STAFF')}</h1>
          <p className="text-gray-500 text-sm">ค้นหาและเปิดตรวจสอบใบสมัครในคิวงานของคุณ</p>
        </div>
        <div className="bg-ku-light px-4 py-2 rounded-lg border border-ku-main/20">
          <span className="text-ku-main font-bold">ทั้งหมด: {pendingList.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50 bg-gray-50/40">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="ค้นหาด้วยชื่อนิสิต รหัสนิสิต รหัสใบสมัคร หรือหมวดรางวัล..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-ku-main outline-none transition"
            />
          </div>
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
                <th className="px-6 py-4 text-right">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pendingList.length > 0 ? (
                pendingList.map((item) => (
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
                        ตรวจสอบ <ArrowRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-400 italic">
                    ไม่มีใบสมัครที่รอตรวจสอบสำหรับบทบาทของคุณในขณะนี้
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

export default StaffReviews;
