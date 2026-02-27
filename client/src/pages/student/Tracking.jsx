import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Calendar, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import StatusTimeline from '../../components/StatusTimeline';
import StatusBadge from '../../components/StatusBadge';
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

const Tracking = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => String(ticket.id) === String(selectedTicketId)) || null,
    [tickets, selectedTicketId]
  );

  const fetchTickets = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
        setError('');
      } else {
        setRefreshing(true);
      }

      const response = await authenticatedApiRequest('/api/tickets/me');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || 'ไม่สามารถโหลดรายการใบสมัครได้');
      }

      const payload = await response.json();
      const list = Array.isArray(payload?.tickets) ? payload.tickets : [];
      setTickets(list);
      setSelectedTicketId((current) => {
        if (list.length === 0) return '';
        if (current && list.some((ticket) => String(ticket.id) === String(current))) {
          return current;
        }
        const sorted = [...list].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
        return String(sorted[0].id);
      });
    } catch (fetchError) {
      if (!silent) {
        setError(fetchError.message || 'ไม่สามารถโหลดข้อมูลติดตามสถานะได้');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchTickets({ silent: true });
    }, 15000);
    return () => clearInterval(intervalId);
  }, [fetchTickets]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedTicketId) {
        setHistory([]);
        return;
      }

      try {
        setLoadingHistory(true);
        const response = await authenticatedApiRequest(`/api/tickets/${selectedTicketId}/history`);
        if (!response.ok) {
          setHistory([]);
          return;
        }
        const payload = await response.json();
        setHistory(Array.isArray(payload?.history) ? payload.history : []);
      } catch {
        setHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [selectedTicketId]);

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

  const proclamationResult = selectedTicket?.proclamation_result || null;
  const isWinner = proclamationResult === 'winner';
  const isNotSelected = proclamationResult === 'not_selected';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ku-main">ติดตามใบสมัคร</h1>
        <p className="text-gray-500">ติดตามความคืบหน้าและไทม์ไลน์ของใบสมัครที่ส่งแล้ว</p>
      </div>

      {!loading && !error && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => fetchTickets({ silent: true })}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            รีเฟรช
          </button>
        </div>
      )}

      {loading && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center text-gray-500">
          <Loader2 size={18} className="animate-spin mr-2" /> กำลังโหลดใบสมัคร...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 p-4 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && tickets.length === 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-gray-500">
          คุณยังไม่มีใบสมัคร
        </div>
      )}

      {!loading && !error && tickets.length > 0 && (
        <>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <label className="text-sm font-semibold text-gray-700 block mb-2">เลือกใบสมัคร</label>
            <select
              value={selectedTicketId}
              onChange={(event) => setSelectedTicketId(event.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {tickets
                .slice()
                .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
                .map((ticket) => (
                  <option key={ticket.id} value={ticket.id}>
                    #{ticket.id} - {(AWARD_LABELS[ticket.award_type] || ticket.award_type)} ({ticket.academic_year} ภาคเรียน {ticket.semester})
                  </option>
                ))}
            </select>
          </div>

          {selectedTicket && (
            <>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-6">
                  <div>
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                      {AWARD_LABELS[selectedTicket.award_type] || selectedTicket.award_type}
                    </span>
                    <h2 className="text-xl font-bold text-gray-800 mt-2">
                      ใบสมัคร{(AWARD_LABELS[selectedTicket.award_type] || selectedTicket.award_type)}
                    </h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><FileText size={16} /> อ้างอิง: #{selectedTicket.id}</span>
                      <span className="flex items-center gap-1"><Calendar size={16} /> ส่งเมื่อ: {formatDate(selectedTicket.submitted_at || selectedTicket.created_at)}</span>
                    </div>
                  </div>
                  <StatusBadge status={selectedTicket.status} />
                </div>

                <div className="py-2">
                  <StatusTimeline currentStatus={selectedTicket.status} />
                </div>

                {(isWinner || isNotSelected) && (
                  <div className={`mt-6 border rounded-xl p-4 ${isWinner ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <p className="font-bold">
                      ผลการประกาศ: {isWinner ? 'ผ่านการคัดเลือก (ได้รับรางวัล)' : 'ไม่ผ่านการคัดเลือก'}
                    </p>
                    <p className="text-sm mt-1">
                      ประกาศเมื่อ: {formatDate(selectedTicket.result_announced_at)}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <h3 className="font-bold text-gray-700 mb-4">บันทึกกิจกรรม</h3>
                {loadingHistory ? (
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> กำลังโหลดบันทึกกิจกรรม...
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-sm text-gray-500">ไม่มีบันทึกกิจกรรม</p>
                ) : (
                  <div className="space-y-4">
                    {history.map((log) => (
                      <div key={log.id} className="flex justify-between text-sm">
                        <span className="font-medium text-gray-600">{log.action}</span>
                        <div className="text-right">
                          <span className="text-gray-500 block">{formatDate(log.timestamp)}</span>
                          <span className="text-xs text-gray-400">โดย {log.actor_name || `ผู้ใช้ ${log.actor_id || '-'}`}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Tracking;
