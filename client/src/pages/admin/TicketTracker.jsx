import React, { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, ArrowLeftCircle, ArrowRightCircle, RefreshCcw, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import StatusBadge from '../../components/StatusBadge';
import { authenticatedApiRequest } from '../../utils/api';

const AWARD_LABELS = {
  activity_enrichment: '1.1 ด้านกิจกรรมเสริมหลักสูตร',
  creativity_innovation: '1.2 ด้านความคิดสร้างสรรค์และนวัตกรรม',
  good_behavior: '1.3 ด้านความประพฤติดี'
};

const WORKFLOW_ORDER = [
  'draft',
  'submitted_by_student',
  'reviewed_by_staff',
  'reviewed_by_subdean',
  'reviewed_by_dean',
  'approved',
  'announced'
];

const OVERRIDE_STATUSES = [
  ...WORKFLOW_ORDER,
  'returned',
  'rejected',
  'expired',
  'dq'
];

const TicketTracker = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState('');
  const [overrideRemark, setOverrideRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await authenticatedApiRequest('/api/tickets');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถโหลดรายการใบสมัครได้');
      }
      const list = Array.isArray(payload?.tickets) ? payload.tickets : [];
      list.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
      setTickets(list);
    } catch (fetchError) {
      setError(fetchError.message || 'ไม่สามารถโหลดรายการใบสมัครได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const filteredTickets = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return tickets;
    return tickets.filter((ticket) => {
      const name = String(ticket.full_name || ticket.full_name_thai || '').toLowerCase();
      const code = String(ticket.student_code || '').toLowerCase();
      const id = String(ticket.id || '').toLowerCase();
      const status = String(ticket.status || '').toLowerCase();
      return name.includes(keyword) || code.includes(keyword) || id.includes(keyword) || status.includes(keyword);
    });
  }, [tickets, searchTerm]);

  useEffect(() => {
    if (filteredTickets.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredTickets.some((item) => item.id === selectedId)) {
      setSelectedId(filteredTickets[0].id);
    }
  }, [filteredTickets, selectedId]);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!selectedId) return;
      try {
        setDetailLoading(true);
        const response = await authenticatedApiRequest(`/api/tickets/${selectedId}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'ไม่สามารถโหลดรายละเอียดใบสมัครได้');
        }
        const ticket = payload?.ticket || null;
        setSelectedTicket(ticket);
        setSelectedFiles(Array.isArray(payload?.files) ? payload.files : []);
        setSelectedHistory(Array.isArray(payload?.history) ? payload.history : []);
        setOverrideStatus(ticket?.status || '');
        setOverrideRemark('');
      } catch (detailError) {
        toast.error(detailError.message || 'ไม่สามารถโหลดรายละเอียดใบสมัครได้');
        setSelectedTicket(null);
        setSelectedFiles([]);
        setSelectedHistory([]);
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetail();
  }, [selectedId]);

  const currentIndex = WORKFLOW_ORDER.indexOf(String(selectedTicket?.status || '').toLowerCase());
  const prevStatus = currentIndex > 0 ? WORKFLOW_ORDER[currentIndex - 1] : null;
  const nextStatus = currentIndex >= 0 && currentIndex < WORKFLOW_ORDER.length - 1 ? WORKFLOW_ORDER[currentIndex + 1] : null;

  const applyOverride = async (targetStatus) => {
    if (!selectedTicket || !targetStatus) return;
    setSubmitting(true);
    try {
      const response = await authenticatedApiRequest(`/api/tickets/${selectedTicket.id}/admin/override`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: targetStatus,
          remark: overrideRemark || null
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถ override สถานะได้');
      }

      const updated = payload?.ticket;
      toast.success(payload?.message || 'อัปเดตสถานะเรียบร้อย');
      if (updated) {
        setSelectedTicket(updated);
        setOverrideStatus(updated.status || targetStatus);
        setTickets((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      } else {
        await fetchTickets();
      }
    } catch (overrideError) {
      toast.error(overrideError.message || 'ไม่สามารถ override สถานะได้');
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ติดตามและควบคุม Ticket ทั้งระบบ</h1>
          <p className="text-gray-500 text-sm">เลือก ticket แล้ว override ย้อนกลับหรือเลื่อนไปขั้นถัดไปได้</p>
        </div>
        <button
          onClick={fetchTickets}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-bold"
        >
          <RefreshCcw size={16} /> รีเฟรช
        </button>
      </div>

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ค้นหาด้วยชื่อ รหัสนิสิต สถานะ หรือเลข ticket"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-ku-main/30"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-6 text-gray-500 flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" /> กำลังโหลด ticket...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">ไม่พบ ticket</div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                {filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedId(ticket.id)}
                    className={`w-full text-left p-4 transition ${selectedId === ticket.id ? 'bg-ku-light/70' : 'hover:bg-gray-50'}`}
                  >
                    <p className="font-bold text-gray-800">{ticket.full_name || ticket.full_name_thai || '-'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">#{ticket.id} | {ticket.student_code || '-'}</p>
                    <p className="text-xs text-gray-500 mt-1">{AWARD_LABELS[ticket.award_type] || ticket.award_type}</p>
                    <div className="mt-2"><StatusBadge status={ticket.status} /></div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[420px] space-y-6">
            {detailLoading ? (
              <div className="text-gray-500 flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" /> กำลังโหลดรายละเอียด...
              </div>
            ) : !selectedTicket ? (
              <p className="text-sm text-gray-500">เลือก ticket ทางซ้ายเพื่อจัดการ</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Ticket #{selectedTicket.id}</h2>
                    <p className="text-sm text-gray-500">{selectedTicket.full_name || selectedTicket.full_name_thai || '-'} ({selectedTicket.student_code || '-'})</p>
                    <p className="text-xs text-gray-500 mt-1">{AWARD_LABELS[selectedTicket.award_type] || selectedTicket.award_type}</p>
                  </div>
                  <StatusBadge status={selectedTicket.status} />
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-bold text-gray-800">Override สถานะ</p>
                  <div className="flex flex-col md:flex-row gap-2">
                    <button
                      onClick={() => applyOverride(prevStatus)}
                      disabled={!prevStatus || submitting}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-bold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowLeftCircle size={16} /> ย้อนกลับ 1 ขั้น
                    </button>
                    <button
                      onClick={() => applyOverride(nextStatus)}
                      disabled={!nextStatus || submitting}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-bold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      เลื่อนไป 1 ขั้น <ArrowRightCircle size={16} />
                    </button>
                  </div>
                  <div className="flex flex-col md:flex-row gap-2">
                    <select
                      value={overrideStatus}
                      onChange={(event) => setOverrideStatus(event.target.value)}
                      className="md:flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-ku-main/30 text-sm"
                    >
                      {OVERRIDE_STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => applyOverride(overrideStatus)}
                      disabled={submitting || !overrideStatus || overrideStatus === selectedTicket.status}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-ku-main text-white text-sm font-bold hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                      Override เป็นสถานะนี้
                    </button>
                  </div>
                  <textarea
                    value={overrideRemark}
                    onChange={(event) => setOverrideRemark(event.target.value)}
                    placeholder="หมายเหตุ (ถ้ามี)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-ku-main/30"
                    rows={2}
                  />
                </div>

                <div>
                  <p className="text-sm font-bold text-gray-800 mb-2">ข้อมูลใบสมัคร</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                    <p><span className="font-bold text-gray-600">คณะ:</span> {selectedTicket.faculty || '-'}</p>
                    <p><span className="font-bold text-gray-600">ภาควิชา:</span> {selectedTicket.department || '-'}</p>
                    <p><span className="font-bold text-gray-600">ปี/ภาคเรียน:</span> {selectedTicket.academic_year || '-'} / {selectedTicket.semester || '-'}</p>
                    <p><span className="font-bold text-gray-600">อัปเดตล่าสุด:</span> {formatDate(selectedTicket.updated_at || selectedTicket.created_at)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-gray-800 mb-2">ไฟล์แนบ ({selectedFiles.length})</p>
                  {selectedFiles.length === 0 ? (
                    <p className="text-sm text-gray-500">ไม่มีไฟล์แนบ</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedFiles.map((file) => (
                        <a key={file.id} href={`/api/uploads/file/${file.id}/download`} className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                          <p className="font-bold text-gray-700 truncate">{file.original_name}</p>
                          <p className="text-xs text-gray-500">{file.file_category}</p>
                          <span className="text-xs text-ku-main inline-flex items-center gap-1 mt-1"><Download size={12} /> ดาวน์โหลด</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-bold text-gray-800 mb-2">ประวัติการทำรายการ</p>
                  {selectedHistory.length === 0 ? (
                    <p className="text-sm text-gray-500">ไม่มีประวัติ</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {selectedHistory.map((log) => (
                        <div key={log.id} className="text-xs bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                          <p className="font-bold text-gray-700">{log.action}</p>
                          <p className="text-gray-500">{formatDate(log.timestamp)}</p>
                          <p className="text-gray-600 mt-1">{log.notes || '-'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketTracker;
