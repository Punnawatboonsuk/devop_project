import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Play, RefreshCcw, Square, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { authenticatedApiRequest } from '../../utils/api';

const PHASE_LABELS = {
  NOMINATION: 'เปิดรับเสนอชื่อ',
  REVIEW_END: 'สิ้นสุดการตรวจสอบ',
  VOTING: 'เปิดลงคะแนน',
  VOTING_END: 'ปิดลงคะแนน',
  CERTIFICATE: 'ช่วงออกประกาศนียบัตร'
};

const INITIAL_PHASE_OPTIONS = ['NOMINATION', 'REVIEW_END', 'VOTING', 'VOTING_END', 'CERTIFICATE'];
const CURRENT_BUDDHIST_YEAR = new Date().getFullYear() + 543;
const DEFAULT_YEAR = Math.min(3000, Math.max(2000, CURRENT_BUDDHIST_YEAR));

const VotingControl = () => {
  const [phase, setPhase] = useState(null);
  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    reviewed_by_dean: 0,
    approved_for_voting: 0,
    announced: 0
  });
  const [filters, setFilters] = useState({
    academic_year: DEFAULT_YEAR,
    semester: 1
  });
  const [draftFilters, setDraftFilters] = useState({
    academic_year: DEFAULT_YEAR,
    semester: 1
  });
  const [initialPhase, setInitialPhase] = useState('NOMINATION');
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    action: null,
    title: '',
    message: '',
    confirmText: 'ยืนยัน'
  });

  const isValidYearSemester = (year, semester) => {
    if (Number.isNaN(year) || year < 2000 || year > 3000) {
      return { ok: false, message: 'ปีการศึกษาต้องอยู่ระหว่าง 2000 - 3000' };
    }
    if (![1, 2].includes(semester)) {
      return { ok: false, message: 'ภาคเรียนต้องเป็น 1 หรือ 2 เท่านั้น' };
    }
    return { ok: true };
  };

  const fetchControlData = async (targetFilters = filters) => {
    const year = Number.parseInt(targetFilters.academic_year, 10);
    const semester = Number.parseInt(targetFilters.semester, 10);
    const validation = isValidYearSemester(year, semester);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const query = `academic_year=${year}&semester=${semester}`;
      const [phaseResponse, ticketsResponse] = await Promise.all([
        authenticatedApiRequest(`/api/admin/phase/current?${query}`),
        authenticatedApiRequest('/api/tickets')
      ]);

      const phasePayload = await phaseResponse.json().catch(() => ({}));
      const ticketsPayload = await ticketsResponse.json().catch(() => ({}));

      if (phaseResponse.status === 404) {
        setPhase(null);
        setRound({
          id: null,
          academic_year: year,
          semester,
          name: `Round ${year}/${semester}`
        });
        setStats({
          reviewed_by_dean: 0,
          approved_for_voting: 0,
          announced: 0
        });
        return;
      }

      if (!phaseResponse.ok) {
        throw new Error(phasePayload?.message || 'ไม่สามารถโหลดช่วงการลงคะแนนได้');
      }

      setPhase(phasePayload?.current_phase || null);
      setRound(phasePayload?.round || null);

      if (ticketsResponse.ok) {
        const tickets = Array.isArray(ticketsPayload?.tickets) ? ticketsPayload.tickets : [];
        const scopedTickets = tickets.filter((ticket) => {
          const ticketRoundId = Number.parseInt(ticket?.round_id, 10);
          const roundId = Number.parseInt(phasePayload?.round?.id, 10);
          if (!Number.isNaN(ticketRoundId) && !Number.isNaN(roundId)) {
            return ticketRoundId === roundId;
          }
          const ticketYear = Number.parseInt(ticket?.academic_year, 10);
          const ticketSemester = Number.parseInt(ticket?.semester, 10);
          return ticketYear === year && ticketSemester === semester;
        });

        setStats({
          reviewed_by_dean: scopedTickets.filter((t) => String(t.status || '').toLowerCase() === 'reviewed_by_dean').length,
          approved_for_voting: scopedTickets.filter((t) => String(t.status || '').toLowerCase() === 'approved').length,
          announced: scopedTickets.filter((t) => String(t.status || '').toLowerCase() === 'announced').length
        });
      }
    } catch (fetchError) {
      setError(fetchError.message || 'ไม่สามารถโหลดหน้าควบคุมการลงคะแนนได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initFromActiveRound = async () => {
      try {
        const activeRes = await authenticatedApiRequest('/api/auth/phase');
        const activePayload = await activeRes.json().catch(() => ({}));

        if (!mounted) return;

        if (activeRes.ok && activePayload?.round) {
          const activeYear = Number.parseInt(activePayload.round.academic_year, 10);
          const activeSemester = Number.parseInt(activePayload.round.semester, 10);
          const nextFilters = {
            academic_year: activeYear,
            semester: activeSemester
          };
          setFilters(nextFilters);
          setDraftFilters(nextFilters);
          await fetchControlData(nextFilters);
          return;
        }
      } catch {
        // fallback below
      }

      if (!mounted) return;
      await fetchControlData(filters);
    };

    initFromActiveRound();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextAction = useMemo(() => {
    if (phase === 'NOMINATION') {
      return {
        endpoint: '/api/admin/phase/end-nomination',
        confirm: 'ยุติช่วงเสนอชื่อและไปช่วง REVIEW_END ใช่หรือไม่?',
        label: 'ปิดช่วงเสนอชื่อ',
        icon: Square
      };
    }
    if (phase === 'REVIEW_END') {
      return {
        endpoint: '/api/admin/phase/start-vote',
        confirm: 'เริ่มช่วงลงคะแนนตอนนี้หรือไม่?',
        label: 'เริ่มลงคะแนน',
        icon: Play
      };
    }
    if (phase === 'VOTING') {
      return {
        endpoint: '/api/admin/phase/end-vote',
        confirm: 'ปิดการลงคะแนนและไปช่วง VOTING_END ใช่หรือไม่?',
        label: 'ปิดการลงคะแนน',
        icon: Square
      };
    }
    if (phase === 'VOTING_END') {
      return {
        endpoint: '/api/admin/phase/start-certificate',
        confirm: 'ยืนยันเข้าสู่ช่วง CERTIFICATE ใช่หรือไม่?',
        label: 'เริ่มช่วงออกใบประกาศ',
        icon: Play
      };
    }
    return null;
  }, [phase]);

  const applyFilters = () => {
    const nextYear = Number.parseInt(draftFilters.academic_year, 10);
    const nextSemester = Number.parseInt(draftFilters.semester, 10);
    const validation = isValidYearSemester(nextYear, nextSemester);

    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    const nextFilters = {
      academic_year: nextYear,
      semester: nextSemester
    };
    setFilters(nextFilters);
    fetchControlData(nextFilters);
  };

  const runPhaseAction = async () => {
    if (!nextAction) return;

    const year = Number.parseInt(filters.academic_year, 10);
    const semester = Number.parseInt(filters.semester, 10);

    setActionLoading(true);
    try {
      const response = await authenticatedApiRequest(nextAction.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: year,
          semester
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถอัปเดตช่วงได้');
      }
      toast.success(payload?.message || 'อัปเดตช่วงเรียบร้อย');
      await fetchControlData(filters);
    } catch (actionError) {
      toast.error(actionError.message || 'ไม่สามารถอัปเดตช่วงได้');
    } finally {
      setActionLoading(false);
    }
  };

  const exportCertificatePackage = async () => {
    const year = Number.parseInt(filters.academic_year, 10);
    const semester = Number.parseInt(filters.semester, 10);

    setActionLoading(true);
    try {
      const response = await authenticatedApiRequest('/api/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: year,
          semester
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถสร้างเอกสารประกาศผลได้');
      }

      toast.success(payload?.message || 'สร้างเอกสารประกาศผลเรียบร้อย');
      if (payload?.download_url) {
        window.open(payload.download_url, '_blank', 'noopener,noreferrer');
      }
    } catch (actionError) {
      toast.error(actionError.message || 'ไม่สามารถสร้างเอกสารประกาศผลได้');
    } finally {
      setActionLoading(false);
    }
  };

  const openApplyModal = () => {
    const nextYear = Number.parseInt(draftFilters.academic_year, 10);
    const nextSemester = Number.parseInt(draftFilters.semester, 10);
    const validation = isValidYearSemester(nextYear, nextSemester);

    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    setConfirmModal({
      open: true,
      action: 'apply',
      title: 'ยืนยันการเปลี่ยนรอบ',
      message: `ต้องการใช้ ปีการศึกษา ${nextYear} / ภาคเรียน ${nextSemester} ใช่หรือไม่?`,
      confirmText: 'ยืนยันรอบ'
    });
  };

  const openPhaseModal = () => {
    if (!nextAction) return;
    setConfirmModal({
      open: true,
      action: 'phase',
      title: nextAction.label,
      message: nextAction.confirm,
      confirmText: 'ยืนยันดำเนินการ'
    });
  };

  const runInitializeRound = async () => {
    const year = Number.parseInt(filters.academic_year, 10);
    const semester = Number.parseInt(filters.semester, 10);
    const validation = isValidYearSemester(year, semester);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    setActionLoading(true);
    try {
      const response = await authenticatedApiRequest('/api/admin/phase/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: year,
          semester,
          phase: initialPhase
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to initialize round phase');
      }
      toast.success(payload?.message || 'Round phase initialized');
      await fetchControlData({ academic_year: year, semester });
    } catch (actionError) {
      toast.error(actionError.message || 'Unable to initialize round phase');
    } finally {
      setActionLoading(false);
    }
  };

  const openInitializeModal = () => {
    const year = Number.parseInt(filters.academic_year, 10);
    const semester = Number.parseInt(filters.semester, 10);
    const validation = isValidYearSemester(year, semester);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    setConfirmModal({
      open: true,
      action: 'initialize',
      title: 'Initialize Round',
      message: `Initialize year ${year} / semester ${semester} at phase ${initialPhase}?`,
      confirmText: 'Initialize'
    });
  };

  const openExportModal = () => {
    setConfirmModal({
      open: true,
      action: 'certificate_export',
      title: 'สร้างและส่งออกไฟล์ประกาศ',
      message: `ยืนยันสร้างไฟล์ประกาศรอบ ปีการศึกษา ${filters.academic_year} / ภาคเรียน ${filters.semester} ใช่หรือไม่?`,
      confirmText: 'ยืนยันส่งออกไฟล์'
    });
  };

  const closeConfirmModal = () => {
    if (actionLoading) return;
    setConfirmModal({
      open: false,
      action: null,
      title: '',
      message: '',
      confirmText: 'ยืนยัน'
    });
  };

  const handleConfirmModal = async () => {
    if (confirmModal.action === 'apply') {
      closeConfirmModal();
      applyFilters();
      return;
    }

    if (confirmModal.action === 'phase') {
      await runPhaseAction();
      closeConfirmModal();
      return;
    }

    if (confirmModal.action === 'certificate_export') {
      await exportCertificatePackage();
      closeConfirmModal();
      return;
    }

    if (confirmModal.action === 'initialize') {
      await runInitializeRound();
      closeConfirmModal();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ควบคุมช่วงการลงคะแนน</h1>
            <p className="text-gray-500">
              ช่วงปัจจุบัน:{' '}
              <span className="font-semibold text-ku-main">
                {phase ? `${phase} (${PHASE_LABELS[phase] || phase})` : 'NONE'}
              </span>
            </p>
            {round && (
              <p className="text-sm text-gray-500 mt-1">
                รอบ: {round.name || `ปีการศึกษา ${round.academic_year} / ภาคเรียน ${round.semester}`}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fetchControlData(filters)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
            >
              <RefreshCcw size={16} /> รีเฟรช
            </button>
            {nextAction && (
              <button
                onClick={openPhaseModal}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-white bg-ku-main hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <nextAction.icon size={16} />
                )}
                {nextAction.label}
              </button>
            )}
            {!nextAction && !phase && (
              <button
                onClick={openInitializeModal}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-white bg-ku-main hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {actionLoading && confirmModal.action === 'initialize' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : null}
                Initialize first phase
              </button>
            )}
            {phase === 'CERTIFICATE' && (
              <button
                onClick={openExportModal}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {actionLoading && confirmModal.action === 'certificate_export' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : null}
                ส่งออกไฟล์ประกาศ
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">ปีการศึกษา (พ.ศ.)</span>
            <input
              type="number"
              min={2000}
              max={3000}
              value={draftFilters.academic_year}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, academic_year: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">ภาคเรียน</span>
            <select
              value={draftFilters.semester}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, semester: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
          <div className="md:col-span-2 flex items-end">
            <button
              type="button"
              onClick={openApplyModal}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-ku-main text-white hover:bg-green-800"
            >
              ใช้รอบนี้
            </button>
          </div>
          {!phase && (
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-sm text-gray-600">Starting phase (new round)</span>
              <select
                value={initialPhase}
                onChange={(e) => setInitialPhase(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                {INITIAL_PHASE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item} ({PHASE_LABELS[item] || item})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-500 flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" /> กำลังโหลดหน้าควบคุมการลงคะแนน...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500">รอตรวจสอบสิทธิ์</p>
            <p className="text-2xl font-bold text-gray-800">{stats.reviewed_by_dean}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500">อนุมัติเข้ารอบลงคะแนน</p>
            <p className="text-2xl font-bold text-gray-800">{stats.approved_for_voting}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500">ประกาศผู้ชนะแล้ว</p>
            <p className="text-2xl font-bold text-gray-800">{stats.announced}</p>
          </div>
        </div>
      )}

      {confirmModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeConfirmModal} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{confirmModal.title}</h3>
                <p className="text-sm text-gray-500 mt-1">กรุณาตรวจสอบก่อนยืนยัน</p>
              </div>
              <button
                type="button"
                onClick={closeConfirmModal}
                disabled={actionLoading}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 text-sm text-gray-700">{confirmModal.message}</div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeConfirmModal}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmModal}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ku-main text-white hover:bg-green-800 disabled:opacity-60"
              >
                {actionLoading && (confirmModal.action === 'phase' || confirmModal.action === 'certificate_export') ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : null}
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VotingControl;
