import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';

const ActionModal = ({ isOpen, onClose, onConfirm, type = 'approve', title }) => {
  const [reason, setReason] = useState('');
  
  if (!isOpen) return null;

  const isReject = type === 'reject';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal Content */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden transform transition-all scale-100">
        <div className={`p-6 flex items-center gap-4 ${isReject ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className={`p-3 rounded-full ${isReject ? 'bg-red-100 text-red-600' : 'bg-green-100 text-ku-main'}`}>
            {isReject ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isReject ? 'text-red-800' : 'text-green-900'}`}>
              {title || (isReject ? 'ไม่อนุมัติใบสมัคร' : 'อนุมัติใบสมัคร')}
            </h3>
            <p className="text-sm text-gray-500">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {isReject ? (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">เหตุผลที่ไม่อนุมัติ <span className="text-red-500">*</span></label>
              <textarea
                className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                rows="3"
                placeholder="เช่น เอกสารชั่วโมงกิจกรรมไม่ครบ..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          ) : (
            <p className="text-gray-600 leading-relaxed">
              ยืนยันการดำเนินการหรือไม่ ใบสมัครนี้จะถูกส่งต่อไปยังขั้นตอนถัดไปทันที
            </p>
          )}
        </div>

        <div className="p-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-gray-600 hover:bg-gray-200 text-sm font-medium transition-colors">
            ยกเลิก
          </button>
          <button 
            onClick={() => {
                if (isReject && !reason) return;
                onConfirm(reason);
            }}
            disabled={isReject && !reason}
            className={`px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-lg transform active:scale-95 transition-all
              ${isReject 
                ? 'bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed' 
                : 'bg-ku-main hover:bg-green-800'}`}
          >
            ยืนยัน{isReject ? 'ไม่อนุมัติ' : 'อนุมัติ'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionModal;
