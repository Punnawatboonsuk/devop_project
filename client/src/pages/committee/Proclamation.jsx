import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, FileCheck, Loader2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { authenticatedApiRequest } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import FilePreviewModal from '../../components/FilePreviewModal';

const AWARD_LABELS = {
  activity_enrichment: '1.1. ด้านกิจกรรมเสริมหลักสูตร',
  creativity_innovation: '1.2. ด้านความคิดสร้างสรรค์และนวัตกรรม',
  good_behavior: '1.3. ด้านความประพฤติดี'
};

const Proclamation = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [uploadingSigned, setUploadingSigned] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [signedPreviewUrl, setSignedPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState(0);
  const [signedFile, setSignedFile] = useState(null);
  const [data, setData] = useState({
    round: null,
    phase: null,
    permissions: { can_publish: false },
    winners: [],
    history: []
  });

  const isPresident = useMemo(() => {
    const roleList = Array.isArray(user?.roles) ? user.roles : [];
    return (
      user?.primary_role === 'COMMITTEE_PRESIDENT' ||
      user?.role === 'COMMITTEE_PRESIDENT' ||
      roleList.includes('COMMITTEE_PRESIDENT')
    );
  }, [user]);
  const isCertificatePhase = String(data?.phase || '').toUpperCase() === 'CERTIFICATE';
  const canViewCurrentResults = useMemo(() => {
    const currentPhase = String(data?.phase || '').toUpperCase();
    return ['VOTING', 'VOTING_END', 'CERTIFICATE'].includes(currentPhase);
  }, [data?.phase]);

  const fetchProclamation = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await authenticatedApiRequest('/api/votes/proclamation');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถโหลดประกาศผลได้');
      }

      setData({
        round: payload?.round || null,
        phase: payload?.phase || null,
        permissions: payload?.permissions || { can_publish: false },
        winners: Array.isArray(payload?.winners) ? payload.winners : [],
        history: Array.isArray(payload?.history) ? payload.history : []
      });
      setSelectedHistoryIdx(0);
    } catch (fetchError) {
      setError(fetchError.message || 'ไม่สามารถโหลดประกาศผลได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProclamation();
  }, []);

  useEffect(() => {
    const loadSignedPreview = async () => {
      if (!isPresident) return;
      if (!data?.round?.academic_year || !data?.round?.semester) return;
      if (String(data?.phase || '').toUpperCase() !== 'CERTIFICATE') {
        setSignedPreviewUrl('');
        return;
      }

      try {
        const response = await authenticatedApiRequest(
          `/api/certificates/signed-latest?academic_year=${data.round.academic_year}&semester=${data.round.semester}`
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setSignedPreviewUrl('');
          return;
        }
        if (payload?.download_url) {
          const viewUrl = payload.download_url.replace('/download', '/view');
          setSignedPreviewUrl(viewUrl);
        } else {
          setSignedPreviewUrl('');
        }
      } catch {
        setSignedPreviewUrl('');
      }
    };

    loadSignedPreview();
  }, [data?.phase, data?.round?.academic_year, data?.round?.semester, isPresident]);

  const selectedHistory = useMemo(
    () => (data.history?.[selectedHistoryIdx] ? data.history[selectedHistoryIdx] : null),
    [data.history, selectedHistoryIdx]
  );

  const handleExportCertificate = async () => {
    if (!isPresident) {
      toast.error('เฉพาะประธานคณะกรรมการเท่านั้น');
      return;
    }
    if (data?.phase !== 'CERTIFICATE') {
      toast.error(`ส่งออกไฟล์ได้เฉพาะช่วง CERTIFICATE (สถานะปัจจุบัน: ${data?.phase || 'NONE'})`);
      return;
    }

    setExporting(true);
    const year = data?.round?.academic_year;
    const semester = data?.round?.semester;
    const query = year && semester ? `academic_year=${year}&semester=${semester}` : '';
    setPreviewFile({
      url: `/api/certificates/preview${query ? `?${query}` : ''}`,
      name: 'ประกาศผล.pdf',
      mimeType: 'application/pdf'
    });
    setExporting(false);
  };

  const handleUploadSigned = async () => {
    if (!isPresident) {
      toast.error('เฉพาะประธานคณะกรรมการเท่านั้น');
      return;
    }
    if (!isCertificatePhase) {
      toast.error(`อัปโหลดได้เฉพาะช่วง CERTIFICATE (สถานะปัจจุบัน: ${data?.phase || 'NONE'})`);
      return;
    }
    if (!signedFile) {
      toast.error('กรุณาเลือกไฟล์ PDF ที่ลงนามแล้ว');
      return;
    }

    try {
      setUploadingSigned(true);
      const formData = new FormData();
      formData.append('signed_file', signedFile);
      if (data?.round?.id) {
        formData.append('round_id', String(data.round.id));
      }

      const response = await authenticatedApiRequest('/api/certificates/upload-signed', {
        method: 'POST',
        body: formData
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถอัปโหลดไฟล์ที่ลงนามแล้วได้');
      }

      toast.success(payload?.message || 'อัปโหลดไฟล์ที่ลงนามแล้วเรียบร้อย');
      setSignedFile(null);
      if (payload?.download_url) {
        const viewUrl = payload.download_url.replace('/download', '/view');
        setSignedPreviewUrl(viewUrl);
        setPreviewFile({
          url: viewUrl,
          name: 'ประกาศผล (ลงนามแล้ว).pdf',
          mimeType: 'application/pdf'
        });
      }
    } catch (uploadError) {
      toast.error(uploadError.message || 'ไม่สามารถอัปโหลดไฟล์ที่ลงนามแล้วได้');
    } finally {
      setUploadingSigned(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ku-main">ประกาศผลอย่างเป็นทางการ</h1>
          <p className="text-gray-500">
            {data.round
              ? `รอบ ${data.round.name || `${data.round.academic_year}/${data.round.semester}`}`
              : 'รอบปัจจุบัน'}
          </p>
        </div>

        <div className="flex gap-2">
          {isPresident && (
            <button
              onClick={handleExportCertificate}
              disabled={exporting || loading || data.phase !== 'CERTIFICATE'}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 shadow hover:bg-blue-700 transition disabled:opacity-60"
            >
              {exporting ? <Loader2 size={18} className="animate-spin" /> : <FileCheck size={18} />}
              ส่งออกไฟล์ประกาศ
            </button>
          )}
          <button
            onClick={() => setShowHistory(true)}
            className="bg-gray-500 text-white px-6 py-3 rounded-xl font-bold shadow hover:bg-gray-700 transition"
          >
            ดูประวัติประกาศผล
          </button>
        </div>
      </div>

      {!canViewCurrentResults && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-700 text-sm">
          {isPresident
            ? `สามารถส่งออกและอัปโหลดไฟล์ที่ลงนามแล้วได้เมื่ออยู่ในช่วง CERTIFICATE (สถานะปัจจุบัน: ${data.phase || 'NONE'})`
            : 'บัญชีกรรมการทั่วไปสามารถดูได้เฉพาะประวัติประกาศผลเท่านั้น'}
        </div>
      )}

      {isPresident && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-bold text-gray-700 mb-2">อัปโหลดไฟล์ประกาศที่ลงนามแล้ว (PDF)</label>
          <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white cursor-pointer hover:bg-gray-50 ${!isCertificatePhase ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <Upload size={16} />
            <span>{signedFile ? 'เปลี่ยนไฟล์ประกาศ' : 'เลือกไฟล์ PDF'}</span>
            <input
              type="file"
              className="hidden"
              accept="application/pdf,.pdf"
              disabled={!isCertificatePhase}
              onChange={(event) => setSignedFile(event.target.files?.[0] || null)}
            />
          </label>
          <p className="text-xs text-gray-500 mt-2">
            {signedFile ? `ไฟล์ที่เลือก: ${signedFile.name}` : 'ยังไม่ได้เลือกไฟล์'}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleUploadSigned}
              disabled={uploadingSigned || loading || !isCertificatePhase || !signedFile}
              className="bg-ku-main text-white px-5 py-2 rounded-lg font-bold inline-flex items-center gap-2 shadow hover:bg-green-800 transition disabled:opacity-60"
            >
              {uploadingSigned ? <Loader2 size={16} className="animate-spin" /> : <FileCheck size={16} />}
              อัปโหลดไฟล์ที่ลงนามแล้ว
            </button>
            {signedPreviewUrl && (
              <button
                type="button"
                onClick={() =>
                  setPreviewFile({
                    url: signedPreviewUrl,
                    name: 'ประกาศผล (ลงนามแล้ว).pdf',
                    mimeType: 'application/pdf'
                  })
                }
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
              >
                ดูไฟล์ที่ลงนามแล้ว
              </button>
            )}
            {!isCertificatePhase && (
              <span className="text-xs text-gray-500">อัปโหลดได้เฉพาะช่วง CERTIFICATE</span>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-500 flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" /> กำลังโหลดประกาศผล...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && canViewCurrentResults && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-gray-700">รายชื่อผู้ชนะที่เตรียมประกาศ</h3>
          </div>
          <table className="w-full text-left">
            <thead className="bg-white border-b border-gray-100 text-xs uppercase text-gray-400 font-bold">
              <tr>
                <th className="p-6">อันดับ</th>
                <th className="p-6">ชื่อ-นามสกุล</th>
                <th className="p-6">หมวดรางวัล</th>
                <th className="p-6">จำนวนเสียงอนุมัติ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.winners.length === 0 ? (
                <tr>
                  <td className="p-6 text-gray-500 text-sm" colSpan={4}>ยังไม่มีผู้ชนะที่ผ่านเกณฑ์</td>
                </tr>
              ) : (
                data.winners.map((winner, index) => (
                  <tr key={winner.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-6 font-black text-ku-main text-xl">#{index + 1}</td>
                    <td className="p-6 font-bold text-gray-800">{winner.fullname || '-'}</td>
                    <td className="p-6">
                      <span className="px-3 py-1 bg-ku-light text-ku-main rounded-full text-xs font-bold">
                        {AWARD_LABELS[winner.award_type] || winner.award_type}
                      </span>
                    </td>
                    <td className="p-6 font-mono font-bold text-gray-600">{winner.voting?.approved || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showHistory && (
        <>
          <div className="fixed left-64 top-0 right-0 bottom-0 bg-white/30 backdrop-blur-md z-40" />
          <div className="fixed left-64 top-0 right-0 bottom-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-[760px] max-w-full relative">
              <button
                onClick={() => setShowHistory(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-xl font-bold"
              >
                &#10005;
              </button>
              <h2 className="text-2xl font-black mb-4 text-ku-main">ประวัติประกาศผล</h2>
              {data.history.length === 0 ? (
                <p className="text-sm text-gray-500">ไม่พบประวัติประกาศผล</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => setSelectedHistoryIdx((prev) => Math.max(prev - 1, 0))}
                      className={`px-3 py-1 rounded bg-gray-200 text-gray-700 font-bold ${selectedHistoryIdx === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}`}
                      disabled={selectedHistoryIdx === 0}
                    >
                      ก่อนหน้า
                    </button>
                    <select
                      value={selectedHistoryIdx}
                      onChange={(event) => setSelectedHistoryIdx(Number(event.target.value))}
                      className="px-3 py-1 rounded bg-gray-100 text-gray-700 font-bold border border-gray-300"
                    >
                      {data.history.map((item, index) => (
                        <option key={item.round?.id || index} value={index}>
                          {item.round?.name || `${item.round?.academic_year}/${item.round?.semester}`}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setSelectedHistoryIdx((prev) => Math.min(prev + 1, data.history.length - 1))}
                      className={`px-3 py-1 rounded bg-gray-200 text-gray-700 font-bold ${selectedHistoryIdx === data.history.length - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}`}
                      disabled={selectedHistoryIdx === data.history.length - 1}
                    >
                      ถัดไป
                    </button>
                  </div>

                  {selectedHistory && (
                    <div className="mb-2">
                      <h3 className="font-bold text-gray-700 mb-2">
                        {selectedHistory.round?.name || `${selectedHistory.round?.academic_year}/${selectedHistory.round?.semester}`}
                      </h3>
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-400 font-bold">
                          <tr>
                            <th className="p-2">อันดับ</th>
                            <th className="p-2">ชื่อ-นามสกุล</th>
                            <th className="p-2">หมวดรางวัล</th>
                            <th className="p-2">จำนวนเสียงอนุมัติ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedHistory.winners || []).length === 0 ? (
                            <tr>
                              <td className="p-2 text-gray-500 text-sm" colSpan={4}>ไม่มีผู้ชนะในรอบนี้</td>
                            </tr>
                          ) : (
                            (selectedHistory.winners || []).map((winner, idx) => (
                              <tr key={winner.id} className="hover:bg-gray-100">
                                <td className="p-2 font-black text-ku-main">#{idx + 1}</td>
                                <td className="p-2 font-bold text-gray-800">{winner.fullname || '-'}</td>
                                <td className="p-2">
                                  <span className="px-2 py-1 bg-ku-light text-ku-main rounded-full text-xs font-bold">
                                    {AWARD_LABELS[winner.award_type] || winner.award_type}
                                  </span>
                                </td>
                                <td className="p-2 font-mono font-bold text-gray-600">{winner.voting?.approved || 0}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      <FilePreviewModal
        open={Boolean(previewFile)}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
};

export default Proclamation;

