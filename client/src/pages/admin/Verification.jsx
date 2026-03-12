import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2, RefreshCcw, Search, Download, Clock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import StatusBadge from '../../components/StatusBadge';
import ActionModal from '../../components/ActionModal';
import FilePreviewButton from '../../components/FilePreviewButton';
import { authenticatedApiRequest } from '../../utils/api';

const AWARD_LABELS = {
  activity_enrichment: '1.1 ด้านกิจกรรมเสริมหลักสูตร',
  creativity_innovation: '1.2 ด้านความคิดสร้างสรรค์และนวัตกรรม',
  good_behavior: '1.3 ด้านความประพฤติดี'
};

const ALLOW_VERIFY_PHASES = new Set(['NOMINATION', 'REVIEW_END']);

const Verification = () => {
  const [tickets, setTickets] = useState([]);
  const [phase, setPhase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [awardType, setAwardType] = useState('all');
  const [submittingId, setSubmittingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [editedAwardType, setEditedAwardType] = useState('');
  const [savingAwardType, setSavingAwardType] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [pendingVerifyId, setPendingVerifyId] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [ticketsResponse, phaseResponse] = await Promise.all([
        authenticatedApiRequest('/api/tickets'),
        authenticatedApiRequest('/api/admin/phase/current')
      ]);

      const ticketPayload = await ticketsResponse.json().catch(() => ({}));
      const phasePayload = await phaseResponse.json().catch(() => ({}));

      if (!ticketsResponse.ok) {
        throw new Error(ticketPayload?.message || 'ไม่สามารถโหลดใบสมัครได้');
      }

      setPhase(phaseResponse.ok ? phasePayload?.current_phase || null : null);

      const allTickets = Array.isArray(ticketPayload?.tickets) ? ticketPayload.tickets : [];
      const verifyList = allTickets
        .filter((ticket) => String(ticket.status || '').toLowerCase() === 'reviewed_by_dean')
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
      setTickets(verifyList);
    } catch (fetchError) {
      setError(fetchError.message || 'ไม่สามารถโหลดข้อมูลการตรวจสอบได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredTickets = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesAward = awardType === 'all' ? true : ticket.award_type === awardType;
      if (!matchesAward) return false;
      if (!keyword) return true;
      const name = String(ticket.full_name || ticket.full_name_thai || '').toLowerCase();
      const code = String(ticket.student_code || '').toLowerCase();
      const id = String(ticket.id || '').toLowerCase();
      return name.includes(keyword) || code.includes(keyword) || id.includes(keyword);
    });
  }, [tickets, searchTerm, awardType]);

  useEffect(() => {
    if (filteredTickets.length === 0) {
      setSelectedId(null);
      setSelectedTicket(null);
      setSelectedFiles([]);
      setSelectedHistory([]);
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
        setSelectedTicket(payload?.ticket || null);
        setSelectedFiles(Array.isArray(payload?.files) ? payload.files : []);
        setSelectedHistory(Array.isArray(payload?.history) ? payload.history : []);
        setEditedAwardType(payload?.ticket?.award_type || '');
      } catch (detailError) {
        toast.error(detailError.message || 'ไม่สามารถโหลดรายละเอียดใบสมัครได้');
        setSelectedTicket(null);
        setSelectedFiles([]);
        setSelectedHistory([]);
        setEditedAwardType('');
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetail();
  }, [selectedId]);

  const canVerifyNow = ALLOW_VERIFY_PHASES.has(String(phase || '').toUpperCase());

  const handleVerify = async (ticketId) => {
    if (!canVerifyNow) {
      toast.error(`ไม่สามารถตรวจสอบได้ในช่วง ${phase || 'NONE'}`);
      return;
    }

    setSubmittingId(ticketId);
    try {
      const response = await authenticatedApiRequest(`/api/tickets/${ticketId}/approve`, {
        method: 'PATCH'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถตรวจสอบใบสมัครได้');
      }

      toast.success(payload?.message || 'อนุมัติใบสมัครสำหรับการลงคะแนนเรียบร้อย');
      setTickets((prev) => prev.filter((item) => item.id !== ticketId));
      setVerifyModalOpen(false);
      setPendingVerifyId(null);
    } catch (submitError) {
      toast.error(submitError.message || 'ไม่สามารถตรวจสอบใบสมัครได้');
    } finally {
      setSubmittingId(null);
    }
  };

  const openVerifyModal = (ticketId) => {
    if (!canVerifyNow) {
      toast.error(`ไม่สามารถตรวจสอบได้ในช่วง ${phase || 'NONE'}`);
      return;
    }
    setPendingVerifyId(ticketId);
    setVerifyModalOpen(true);
  };

  const handleConfirmVerify = async () => {
    if (!pendingVerifyId) return;
    await handleVerify(pendingVerifyId);
  };

  const handleUpdateAwardType = async () => {
    if (!selectedTicket || !editedAwardType) return;
    if (editedAwardType === selectedTicket.award_type) {
      toast('ประเภทเดิมไม่ได้เปลี่ยนแปลง');
      return;
    }

    setSavingAwardType(true);
    try {
      const response = await authenticatedApiRequest(`/api/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ award_type: editedAwardType })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถแก้ไขประเภทรางวัลได้');
      }

      const updatedTicket = payload?.ticket || null;
      if (updatedTicket) {
        setSelectedTicket(updatedTicket);
        setEditedAwardType(updatedTicket.award_type || editedAwardType);
        setTickets((prev) =>
          prev.map((item) => (item.id === updatedTicket.id ? { ...item, award_type: updatedTicket.award_type } : item))
        );
      }
      toast.success('อัปเดตประเภทรางวัลเรียบร้อย');
    } catch (updateError) {
      toast.error(updateError.message || 'ไม่สามารถแก้ไขประเภทรางวัลได้');
    } finally {
      setSavingAwardType(false);
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
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">หน้าตรวจสอบสิทธิ์</h1>
          <p className="text-gray-500">อนุมัติผู้สมัครที่คณบดีตรวจแล้วเพื่อเข้าสู่การลงคะแนน</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700">
            ช่วง: <strong>{phase || 'NONE'}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-full bg-orange-50 text-orange-700">
            รอตรวจสอบ: <strong>{tickets.length}</strong>
          </span>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
          >
            <RefreshCcw size={16} /> รีเฟรช
          </button>
        </div>
      </div>

      {!canVerifyNow && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
          การตรวจสอบทำได้เฉพาะช่วง NOMINATION หรือ REVIEW_END เท่านั้น
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ค้นหาด้วยชื่อ รหัสนิสิต หรือรหัสใบสมัคร"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-ku-main/30"
              />
            </div>
            <select
              value={awardType}
              onChange={(event) => setAwardType(event.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-ku-main/30"
            >
              <option value="all">ทุกหมวดรางวัล</option>
              {Object.entries(AWARD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-6 text-gray-500 flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" /> กำลังโหลดคิวตรวจสอบ...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">ไม่มีใบสมัครที่รอตรวจสิทธิ์</div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[62vh] overflow-y-auto">
                {filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedId(ticket.id)}
                    className={`w-full text-left p-4 transition ${selectedId === ticket.id ? 'bg-ku-light/70' : 'hover:bg-gray-50'}`}
                  >
                    <p className="font-bold text-gray-800">{ticket.full_name || ticket.full_name_thai || '-'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">#{ticket.id} | {ticket.student_code || '-'}</p>
                    <p className="text-xs text-gray-500 mt-1">{AWARD_LABELS[ticket.award_type] || ticket.award_type}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[420px]">
            {detailLoading ? (
              <div className="text-gray-500 flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" /> กำลังโหลดรายละเอียด...
              </div>
            ) : !selectedTicket ? (
              <p className="text-sm text-gray-500">เลือกใบสมัครทางซ้ายเพื่อดูรายละเอียด</p>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">{AWARD_LABELS[selectedTicket.award_type] || selectedTicket.award_type}</p>
                    <h2 className="text-xl font-bold text-gray-800 mt-1">ใบสมัคร #{selectedTicket.id}</h2>
                    <p className="text-xs text-gray-500 mt-1">ส่งเมื่อ: {formatDate(selectedTicket.submitted_at || selectedTicket.created_at)}</p>
                  </div>
                  <StatusBadge status={selectedTicket.status} />
                </div>

                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <p><span className="font-bold text-gray-600">ชื่อ-นามสกุล:</span> {selectedTicket.full_name || selectedTicket.full_name_thai || '-'}</p>
                  <p><span className="font-bold text-gray-600">รหัสนิสิต:</span> {selectedTicket.student_code || '-'}</p>
                  <p><span className="font-bold text-gray-600">คณะ:</span> {selectedTicket.faculty || '-'}</p>
                  <p><span className="font-bold text-gray-600">ภาควิชา:</span> {selectedTicket.department || '-'}</p>
                  <p><span className="font-bold text-gray-600">ปี/ภาคเรียน:</span> {selectedTicket.academic_year || '-'} / {selectedTicket.semester || '-'}</p>
                  <p><span className="font-bold text-gray-600">เกรดเฉลี่ย:</span> {selectedTicket.gpa || '-'}</p>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-bold text-blue-900">5. กองพัฒนานิสิตตรวจสอบว่าประเภทถูกต้องตามที่เสนอหรือไม่</p>
                  <div className="flex flex-col md:flex-row gap-2 md:items-center">
                    <select
                      value={editedAwardType}
                      onChange={(event) => setEditedAwardType(event.target.value)}
                      className="md:flex-1 px-3 py-2 border border-blue-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-ku-main/30 text-sm"
                    >
                      {Object.entries(AWARD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleUpdateAwardType}
                      disabled={savingAwardType || !editedAwardType || editedAwardType === selectedTicket.award_type}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white border border-blue-200 text-blue-700 text-sm font-bold hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingAwardType ? <Loader2 size={16} className="animate-spin" /> : null}
                      บันทึกประเภท
                    </button>
                  </div>
                  <p className="text-xs text-blue-800">
                    ปัจจุบันในระบบ: <strong>{AWARD_LABELS[selectedTicket.award_type] || selectedTicket.award_type}</strong>
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><User size={16} /> คำอธิบายผลงาน</h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedTicket.portfolio_description || '-'}</p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Clock size={16} /> ผลงานที่ได้รับ</h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedTicket.achievements || '-'}</p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Download size={16} /> เอกสารแนบ</h3>
                  {selectedFiles.length === 0 ? (
                    <p className="text-sm text-gray-500">ยังไม่มีไฟล์แนบ</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedFiles.map((file) => (
                        <FilePreviewButton
                          key={file.id}
                          file={file}
                          className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-left"
                        >
                          <p className="font-bold text-gray-700 truncate">{file.original_name}</p>
                          <p className="text-xs text-gray-500">{file.file_category}</p>
                        </FilePreviewButton>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-gray-800 mb-3">ประวัติการดำเนินการ</h3>
                  {selectedHistory.length === 0 ? (
                    <p className="text-sm text-gray-500">ไม่มีประวัติ</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedHistory.slice(0, 6).map((log) => (
                        <div key={log.id} className="text-xs bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                          <p className="font-bold text-gray-700">{log.action}</p>
                          <p className="text-gray-500">{formatDate(log.timestamp)}</p>
                          <p className="text-gray-600 mt-1">{log.notes || '-'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => openVerifyModal(selectedTicket.id)}
                    disabled={!canVerifyNow || submittingId === selectedTicket.id}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ku-main text-white text-sm rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingId === selectedTicket.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    ยืนยันสิทธิ์เข้าสู่การลงคะแนน
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ActionModal
        isOpen={verifyModalOpen}
        type="approve"
        onClose={() => {
          setVerifyModalOpen(false);
          setPendingVerifyId(null);
        }}
        onConfirm={handleConfirmVerify}
        title="ยืนยันสิทธิ์เข้าสู่การลงคะแนน"
      />
    </div>
  );
};

export default Verification;
