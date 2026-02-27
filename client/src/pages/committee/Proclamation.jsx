import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, FileCheck, Loader2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
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

const Proclamation = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState(0);
  const [signatureFile, setSignatureFile] = useState(null);
  const [data, setData] = useState({
    round: null,
    phase: null,
    permissions: { can_publish: false },
    winners: [],
    history: []
  });

  const isPresident = user?.primary_role === 'COMMITTEE_PRESIDENT';
  const canPublish = Boolean(data?.permissions?.can_publish) && isPresident;

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

  const selectedHistory = useMemo(
    () => (data.history?.[selectedHistoryIdx] ? data.history[selectedHistoryIdx] : null),
    [data.history, selectedHistoryIdx]
  );

  const handleSignAndAnnounce = () => {
    if (!canPublish) {
      toast.error('เฉพาะประธานกรรมการเท่านั้นที่ลงนามประกาศผลได้');
      return;
    }
    if (!signatureFile) {
      toast.error('กรุณาอัปโหลดไฟล์ลายเซ็นก่อนประกาศผล');
      return;
    }
    setShowConfirm(true);
  };

  const confirmSignAndAnnounce = async () => {
    try {
      setPublishing(true);
      const formData = new FormData();
      formData.append('signature', signatureFile);
      if (data?.round?.id) {
        formData.append('round_id', String(data.round.id));
      }

      const response = await authenticatedApiRequest('/api/votes/proclamation/publish', {
        method: 'POST',
        body: formData
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'ไม่สามารถเผยแพร่ประกาศผลได้');
      }

      toast.success('ลงนามและประกาศผลเรียบร้อย');
      setSignatureFile(null);
      setShowConfirm(false);
      await fetchProclamation();
    } catch (publishError) {
      toast.error(publishError.message || 'ไม่สามารถเผยแพร่ประกาศผลได้');
    } finally {
      setPublishing(false);
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
          {canPublish && (
            <button
              onClick={handleSignAndAnnounce}
              disabled={publishing || loading || data.winners.length === 0 || !signatureFile}
              className="bg-ku-main text-white px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 shadow-xl hover:bg-green-800 transition disabled:opacity-60"
            >
              {publishing ? <Loader2 size={18} className="animate-spin" /> : <FileCheck size={18} />}
              ลงนามและประกาศผล
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

      {!canPublish && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-700 text-sm">
          {isPresident
            ? `รอผู้ดูแลระบบปิดโหวตเป็น VOTING_END ก่อนจึงจะลงนามและประกาศผลได้ (สถานะปัจจุบัน: ${data.phase || 'NONE'})`
            : 'บัญชีกรรมการทั่วไปสามารถดูได้เฉพาะประวัติประกาศผลเท่านั้น การลงนามและประกาศผลทำได้เฉพาะประธานกรรมการ'}
        </div>
      )}

      {canPublish && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-bold text-gray-700 mb-2">อัปโหลดลายเซ็นประธาน (ไฟล์ภาพ)</label>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white cursor-pointer hover:bg-gray-50">
            <Upload size={16} />
            <span>{signatureFile ? 'เปลี่ยนไฟล์ลายเซ็น' : 'เลือกไฟล์ลายเซ็น'}</span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(event) => setSignatureFile(event.target.files?.[0] || null)}
            />
          </label>
          <p className="text-xs text-gray-500 mt-2">
            {signatureFile ? `ไฟล์ที่เลือก: ${signatureFile.name}` : 'ยังไม่ได้เลือกไฟล์'}
          </p>
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

      {!loading && !error && canPublish && (
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

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !publishing && setShowConfirm(false)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">ยืนยันลงนามและประกาศผล</h3>
                <p className="text-sm text-gray-500 mt-1">การดำเนินการนี้ย้อนกลับไม่ได้</p>
              </div>
              <button
                type="button"
                onClick={() => !publishing && setShowConfirm(false)}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                disabled={publishing}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 text-sm text-gray-700">
              ยืนยันประกาศผลรอบ {data.round?.name || `${data.round?.academic_year || '-'} / ${data.round?.semester || '-'}`} โดยใช้ไฟล์ลายเซ็น <span className="font-semibold">{signatureFile?.name || '-'}</span> ใช่หรือไม่?
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={publishing}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmSignAndAnnounce}
                disabled={publishing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ku-main text-white hover:bg-green-800 disabled:opacity-60"
              >
                {publishing ? <Loader2 size={16} className="animate-spin" /> : null}
                ยืนยันประกาศผล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Proclamation;
