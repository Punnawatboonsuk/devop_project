import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Play, RefreshCcw, Square, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { authenticatedApiRequest } from '../../utils/api';
import FilePreviewModal from '../../components/FilePreviewModal';

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
  const [votingTickets, setVotingTickets] = useState([]);
  const [totalCommittee, setTotalCommittee] = useState(0);
  const [voteDetailOpen, setVoteDetailOpen] = useState(false);
  const [voteDetailLoading, setVoteDetailLoading] = useState(false);
  const [voteDetailError, setVoteDetailError] = useState('');
  const [voteDetailTickets, setVoteDetailTickets] = useState([]);
  const [voteDetailTicketId, setVoteDetailTicketId] = useState(null);
  const [winnerSummary, setWinnerSummary] = useState([]);
  const [winnerSummaryLoading, setWinnerSummaryLoading] = useState(false);
  const [winnerSummaryError, setWinnerSummaryError] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [deanSignedFile, setDeanSignedFile] = useState(null);
  const [uploadingDeanSigned, setUploadingDeanSigned] = useState(false);
  const [publishedPreviewUrl, setPublishedPreviewUrl] = useState('');
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
      const [phaseResponse, ticketsResponse, usersResponse] = await Promise.all([
        authenticatedApiRequest(`/api/admin/phase/current?${query}`),
        authenticatedApiRequest('/api/tickets'),
        authenticatedApiRequest('/api/admin/users')
      ]);

      const phasePayload = await phaseResponse.json().catch(() => ({}));
      const ticketsPayload = await ticketsResponse.json().catch(() => ({}));
      const usersPayload = await usersResponse.json().catch(() => ({}));

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
        setVotingTickets([]);
        setTotalCommittee(0);
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

        const votingList = scopedTickets
          .filter((t) => String(t.status || '').toLowerCase() === 'approved')
          .map((ticket) => ({
            id: ticket.id,
            full_name: ticket.full_name_thai || ticket.full_name || '-',
            ku_id: ticket.student_code || ticket.student_id || '-',
            faculty: ticket.faculty || '-',
            department: ticket.department || '-',
            approved_votes: Number.parseInt(ticket.approved_votes || 0, 10),
            total_votes: Number.parseInt(ticket.total_votes || 0, 10),
            vote_percentage: Number.parseFloat(ticket.vote_percentage || 0)
          }));

        setVotingTickets(votingList);
      }

      if (usersResponse.ok) {
        const users = Array.isArray(usersPayload?.users) ? usersPayload.users : [];
        const total = users.reduce((sum, user) => {
          const roles = Array.isArray(user.roles) ? user.roles : [];
          return roles.some((role) => role === 'COMMITTEE' || role === 'COMMITTEE_PRESIDENT') ? sum + 1 : sum;
        }, 0);
        setTotalCommittee(total);
      }
    } catch (fetchError) {
      setError(fetchError.message || 'ไม่สามารถโหลดหน้าควบคุมการลงคะแนนได้');
    } finally {
      setLoading(false);
    }
  };

  const loadVoteDetail = async (ticketId = null) => {
    const year = Number.parseInt(filters.academic_year, 10);
    const semester = Number.parseInt(filters.semester, 10);
    setVoteDetailLoading(true);
    setVoteDetailError('');
    try {
      const ticketQuery = ticketId ? `&ticket_id=${ticketId}` : '';
      const response = await authenticatedApiRequest(`/api/admin/vote-detail?academic_year=${year}&semester=${semester}${ticketQuery}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถโหลดรายละเอียดการโหวตได้');
      }
      setVoteDetailTickets(Array.isArray(payload?.tickets) ? payload.tickets : []);
    } catch (err) {
      setVoteDetailError(err.message || 'ไม่สามารถโหลดรายละเอียดการโหวตได้');
    } finally {
      setVoteDetailLoading(false);
    }
  };

  const loadWinnerSummary = async () => {
    const year = Number.parseInt(filters.academic_year, 10);
    const semester = Number.parseInt(filters.semester, 10);
    setWinnerSummaryLoading(true);
    setWinnerSummaryError('');
    try {
      const response = await authenticatedApiRequest(`/api/admin/vote-summary?academic_year=${year}&semester=${semester}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถโหลดสรุปผลโหวตได้');
      }
      setWinnerSummary(Array.isArray(payload?.winners) ? payload.winners : []);
    } catch (err) {
      setWinnerSummaryError(err.message || 'ไม่สามารถโหลดสรุปผลโหวตได้');
    } finally {
      setWinnerSummaryLoading(false);
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

  useEffect(() => {
    if (phase === 'VOTING_END' || phase === 'CERTIFICATE') {
      loadWinnerSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, filters.academic_year, filters.semester]);

  useEffect(() => {
    const loadPublishedPreview = async () => {
      if (phase !== 'CERTIFICATE') {
        setPublishedPreviewUrl('');
        return;
      }

      const year = Number.parseInt(filters.academic_year, 10);
      const semester = Number.parseInt(filters.semester, 10);
      try {
        const response = await authenticatedApiRequest(
          `/api/certificates/published-latest?academic_year=${year}&semester=${semester}`
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.download_url) {
          setPublishedPreviewUrl('');
          return;
        }
        setPublishedPreviewUrl(payload.download_url.replace('/download', '/view'));
      } catch {
        setPublishedPreviewUrl('');
      }
    };

    loadPublishedPreview();
  }, [phase, filters.academic_year, filters.semester]);

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
      window.dispatchEvent(new Event('phase:refresh'));
    } catch (actionError) {
      toast.error(actionError.message || 'ไม่สามารถอัปเดตช่วงได้');
    } finally {
      setActionLoading(false);
    }
  };

  const exportCertificatePackage = async () => {
    const year = Number.parseInt(filters.academic_year, 10);
    const semester = Number.parseInt(filters.semester, 10);

    try {
      setActionLoading(true);
      const response = await authenticatedApiRequest('/api/admin/announce-winners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academic_year: year, semester })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถประกาศผลได้');
      }
      toast.success(payload?.message || 'ประกาศผลเรียบร้อย');
      await fetchControlData(filters);
    } catch (err) {
      toast.error(err.message || 'ไม่สามารถประกาศผลได้');
      setActionLoading(false);
      return;
    }
    setActionLoading(false);
  };

  const previewWinnersExport = async () => {
    if (phase !== 'CERTIFICATE') {
      toast.error('ดูตัวอย่างได้เฉพาะช่วง CERTIFICATE');
      return;
    }
    setPreviewFile({
      url: `/api/certificates/preview?academic_year=${filters.academic_year}&semester=${filters.semester}`,
      name: 'ประกาศผล (ตัวอย่าง).pdf',
      mimeType: 'application/pdf'
    });
  };

  const viewSignedCertificate = async () => {
    const year = Number.parseInt(filters.academic_year, 10);
    const semester = Number.parseInt(filters.semester, 10);

    setActionLoading(true);
    try {
      const response = await authenticatedApiRequest(
        `/api/certificates/signed-latest?academic_year=${year}&semester=${semester}`
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่พบไฟล์ที่ลงนามแล้ว');
      }

      if (payload?.download_url) {
        const viewUrl = payload.download_url.replace('/download', '/view');
        setPreviewFile({
          url: viewUrl,
          name: 'ประกาศผล (ลงนามแล้ว).pdf',
          mimeType: 'application/pdf'
        });
      } else {
        throw new Error('ไม่พบลิงก์ไฟล์ที่ลงนามแล้ว');
      }
    } catch (actionError) {
      toast.error(actionError.message || 'ไม่พบไฟล์ที่ลงนามแล้ว');
    } finally {
      setActionLoading(false);
    }
  };

  const uploadDeanSigned = async () => {
    if (!deanSignedFile) {
      toast.error('กรุณาเลือกไฟล์ PDF ที่ลงนามโดยคณบดี');
      return;
    }
    if (phase !== 'CERTIFICATE') {
      toast.error('อัปโหลดได้เฉพาะช่วง CERTIFICATE');
      return;
    }

    try {
      setUploadingDeanSigned(true);
      await authenticatedApiRequest('/api/certificates/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: filters.academic_year,
          semester: filters.semester
        })
      }).catch(() => {});
      const formData = new FormData();
      formData.append('signed_file', deanSignedFile);
      formData.append('academic_year', String(filters.academic_year));
      formData.append('semester', String(filters.semester));

      const response = await authenticatedApiRequest('/api/certificates/upload-published', {
        method: 'POST',
        body: formData
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถอัปโหลดไฟล์ที่ลงนามโดยคณบดีได้');
      }

      toast.success(payload?.message || 'อัปโหลดไฟล์ที่ลงนามโดยคณบดีเรียบร้อย');
      setDeanSignedFile(null);
      if (payload?.download_url) {
        setPublishedPreviewUrl(payload.download_url.replace('/download', '/view'));
      }
    } catch (err) {
      toast.error(err.message || 'ไม่สามารถอัปโหลดไฟล์ที่ลงนามโดยคณบดีได้');
    } finally {
      setUploadingDeanSigned(false);
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
      message: publishedPreviewUrl
        ? `ยืนยันสร้างไฟล์ประกาศรอบ ปีการศึกษา ${filters.academic_year} / ภาคเรียน ${filters.semester} ใช่หรือไม่?`
        : `ยังไม่มีไฟล์ลงนามโดยคณบดี ต้องการส่งออกไฟล์ประกาศโดยไม่มีลายเซ็นหรือไม่?`,
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

          <div className="flex flex-col gap-3 items-end">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  await fetchControlData(filters);
                  window.dispatchEvent(new Event('phase:refresh'));
                }}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
              >
                <RefreshCcw size={16} /> รีเฟรช
              </button>
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
            </div>

            {phase === 'CERTIFICATE' && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2">
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white cursor-pointer hover:bg-gray-50">
                  <Upload size={16} />
                  เลือกไฟล์ลงนามโดยคณบดี
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf,.pdf"
                    onChange={(event) => setDeanSignedFile(event.target.files?.[0] || null)}
                  />
                </label>
                <button
                  type="button"
                  onClick={uploadDeanSigned}
                  disabled={uploadingDeanSigned || actionLoading || !deanSignedFile}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {uploadingDeanSigned ? <Loader2 size={16} className="animate-spin" /> : null}
                  อัปโหลดไฟล์ลงนามโดยคณบดี
                </button>
                <button
                  type="button"
                  onClick={() =>
                    publishedPreviewUrl &&
                    setPreviewFile({
                      url: publishedPreviewUrl,
                      name: 'ประกาศผล (ลงนามโดยคณบดี).pdf',
                      mimeType: 'application/pdf'
                    })
                  }
                  disabled={!publishedPreviewUrl}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ดูไฟล์ที่ลงนามแล้ว
                </button>
              </div>
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

      {!loading && !error && (phase === 'NOMINATION' || phase === 'REVIEW_END' || phase === 'VOTING') && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-800">ผลโหวตปัจจุบัน (เฉพาะรอบนี้)</h2>
              <p className="text-sm text-gray-500">
                จำนวนคณะกรรมการที่มีสิทธิ์โหวต: {totalCommittee || 0}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setVoteDetailTicketId(null);
                setVoteDetailOpen(true);
                loadVoteDetail(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              ดูรายละเอียดกรรมการ
            </button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-4">ผู้สมัคร</th>
                <th className="p-4">รหัสนิสิต</th>
                <th className="p-4">คณะ</th>
                <th className="p-4">ภาควิชา</th>
                <th className="p-4">ผลโหวต</th>
                <th className="p-4">เห็นด้วย</th>
                <th className="p-4">ไม่เห็นด้วย</th>
                <th className="p-4">โหวตแล้ว</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {votingTickets.length > 0 ? (
                votingTickets.map((ticket) => {
                  const approved = ticket.approved_votes || 0;
                  const total = ticket.total_votes || 0;
                  const disagreed = Math.max(0, total - approved);
                  const approvePercent = total ? Math.round((approved / total) * 100) : 0;
                  const rejectPercent = total ? 100 - approvePercent : 0;
                  return (
                    <tr
                      key={ticket.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setVoteDetailTicketId(ticket.id);
                        setVoteDetailOpen(true);
                        loadVoteDetail(ticket.id);
                      }}
                    >
                      <td className="p-4">
                        <p className="font-semibold text-gray-800">{ticket.full_name}</p>
                        <p className="text-xs text-gray-500">#{ticket.id}</p>
                      </td>
                      <td className="p-4 text-gray-600">{ticket.ku_id || '-'}</td>
                      <td className="p-4 text-gray-600">{ticket.faculty}</td>
                      <td className="p-4 text-gray-600">{ticket.department}</td>
                      <td className="p-4">
                        <div className="min-w-[140px]">
                          <div className="flex justify-between text-[10px] font-bold mb-1">
                            <span className="text-green-700">{approvePercent}%</span>
                            <span className="text-red-600">{rejectPercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden flex">
                            <div className="bg-green-500 h-full" style={{ width: `${approvePercent}%` }} />
                            <div className="bg-red-500 h-full" style={{ width: `${rejectPercent}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-700 font-semibold">{approved}</td>
                      <td className="p-4 text-gray-700 font-semibold">{disagreed}</td>
                      <td className="p-4 text-gray-700 font-semibold">
                        {total}/{totalCommittee || 0}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-sm text-gray-500">
                    ไม่พบผู้สมัครในสถานะโหวต
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && (phase === 'VOTING_END' || phase === 'CERTIFICATE') && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-800">สรุปผลโหวตก่อนส่งให้ประธานกรรมการ</h2>
              <p className="text-sm text-gray-500">ตรวจสอบรายชื่อผู้ชนะก่อนสร้างเอกสาร</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (phase === 'CERTIFICATE') {
                    previewWinnersExport();
                  }
                }}
                disabled={actionLoading || phase !== 'CERTIFICATE'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ku-main text-white hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                ดูตัวอย่างไฟล์ผู้ชนะ
              </button>
              <button
                type="button"
                onClick={viewSignedCertificate}
                disabled={actionLoading || phase !== 'CERTIFICATE'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                ตรวจสอบการลงชื่อของประธานคณะกรรมการ
              </button>
            </div>
          </div>

          {winnerSummaryLoading && (
            <div className="p-5 text-gray-500 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> กำลังโหลดสรุปผลโหวต...
            </div>
          )}

          {winnerSummaryError && !winnerSummaryLoading && (
            <div className="p-5 text-sm text-red-700 bg-red-50 border-t border-red-100">{winnerSummaryError}</div>
          )}

          {!winnerSummaryLoading && !winnerSummaryError && (
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-4">ผู้ชนะ</th>
                  <th className="p-4">รหัสนิสิต</th>
                  <th className="p-4">ประเภท</th>
                  <th className="p-4">เห็นด้วย</th>
                  <th className="p-4">โหวตทั้งหมด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {winnerSummary.length > 0 ? (
                  winnerSummary.map((winner) => (
                    <tr key={winner.ticket_id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <p className="font-semibold text-gray-800">{winner.fullname || '-'}</p>
                        <p className="text-xs text-gray-500">#{winner.ticket_id}</p>
                      </td>
                      <td className="p-4 text-gray-600">{winner.ku_id || '-'}</td>
                      <td className="p-4 text-gray-600">{winner.award_type}</td>
                      <td className="p-4 text-gray-700 font-semibold">{winner.approved_votes || 0}</td>
                      <td className="p-4 text-gray-700 font-semibold">{winner.total_votes || 0}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-sm text-gray-500">
                      ไม่พบรายชื่อผู้ชนะ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
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
      {voteDetailOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!voteDetailLoading) {
                setVoteDetailOpen(false);
              }
            }}
          />
          <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">รายละเอียดการโหวตของกรรมการ</h3>
                <p className="text-sm text-gray-500 mt-1">
                  แสดงสถานะการโหวตของกรรมการและประธานกรรมการแต่ละคน
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVoteDetailOpen(false)}
                disabled={voteDetailLoading}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {voteDetailLoading && (
              <div className="p-6 text-gray-500 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> กำลังโหลดรายละเอียดการโหวต...
              </div>
            )}

            {voteDetailError && !voteDetailLoading && (
              <div className="p-6 text-sm text-red-700 bg-red-50 border-t border-red-100">
                {voteDetailError}
              </div>
            )}

            {!voteDetailLoading && !voteDetailError && (
              <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-100">
                {voteDetailTickets.length > 0 ? (
                  voteDetailTickets.map((ticket) => (
                    <div key={ticket.ticket_id} className="p-5">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
                        <div>
                          <p className="font-semibold text-gray-800">{ticket.fullname || '-'}</p>
                          <p className="text-xs text-gray-500">#{ticket.ticket_id} | {ticket.ku_id || '-'}</p>
                        </div>
                        <div className="text-xs text-gray-500">
                          {ticket.faculty || '-'} / {ticket.department || '-'}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Array.isArray(ticket.votes) && ticket.votes.map((vote) => {
                          const status = vote.vote === 'approved'
                            ? { label: 'อนุมัติ', color: 'bg-green-50 text-green-700 border-green-200' }
                            : vote.vote === 'not_approved'
                              ? { label: 'ไม่อนุมัติ', color: 'bg-red-50 text-red-700 border-red-200' }
                              : { label: 'ยังไม่โหวต', color: 'bg-gray-50 text-gray-600 border-gray-200' };
                          return (
                            <div key={`${ticket.ticket_id}-${vote.user_id}`} className="border rounded-xl p-3 flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-gray-800">{vote.fullname || vote.email}</p>
                                <p className="text-xs text-gray-500">{vote.role}</p>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${status.color}`}>
                                {status.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-sm text-gray-500">ไม่พบข้อมูลการโหวต</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <FilePreviewModal
        open={Boolean(previewFile)}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
};

export default VotingControl;
