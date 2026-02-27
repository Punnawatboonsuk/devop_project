import React from 'react';
import { Check, Clock, Circle, MapPin } from 'lucide-react';

const steps = [
  { id: 'draft', label: 'สร้างฉบับร่าง' },
  { id: 'submitted_by_student', label: 'นิสิตส่งใบสมัคร' },
  { id: 'reviewed_by_staff', label: 'หัวหน้าภาควิชาตรวจสอบ' },
  { id: 'reviewed_by_subdean', label: 'รองคณบดีตรวจสอบ' },
  { id: 'reviewed_by_dean', label: 'คณบดีตรวจสอบ' },
  { id: 'verification', label: 'ผู้ดูแลระบบยืนยันสิทธิ์' },
  { id: 'voting', label: 'คณะกรรมการลงคะแนน' },
  { id: 'announced', label: 'ประกาศผล' }
];

const legacyAlias = {
  submit_by_staff: 'reviewed_by_staff',
  submit_by_subdean: 'reviewed_by_subdean',
  submit_by_dean: 'reviewed_by_dean',
  approved: 'verification',
  not_approved: 'voting',
  reject: 'rejected'
};

const rejectedStatuses = new Set(['rejected', 'returned', 'not_approved', 'dq', 'expired']);
const statusToCompletedStep = {
  draft: 'draft',
  submitted_by_student: 'submitted_by_student',
  reviewed_by_staff: 'reviewed_by_staff',
  reviewed_by_subdean: 'reviewed_by_subdean',
  reviewed_by_dean: 'reviewed_by_dean',
  verification: 'verification',
  voting: 'voting',
  announced: 'announced'
};

const StatusTimeline = ({ currentStatus }) => {
  const normalized = String(currentStatus || '').toLowerCase();
  const resolvedStatus = legacyAlias[normalized] || normalized;
  const completedStepId = statusToCompletedStep[resolvedStatus] || null;
  const completedIndex = steps.findIndex((step) => step.id === completedStepId);
  const awaitingIndex =
    completedIndex >= 0 && completedIndex < steps.length - 1 ? completedIndex + 1 : -1;
  const isRejected = rejectedStatuses.has(resolvedStatus);
  const rejectedIndex = awaitingIndex >= 0 ? awaitingIndex : Math.max(0, completedIndex);

  return (
    <div className="relative my-6">
      <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gray-200" aria-hidden="true" />

      <div className="space-y-8">
      {steps.map((step, index) => {
        let statusColor = 'border-gray-300 text-gray-300';
        let icon = <Circle size={10} />;
        let labelColor = 'text-gray-400';
        let helperText = '';

        if (completedIndex >= 0 && index <= completedIndex) {
          statusColor = 'border-ku-main bg-ku-main text-white';
          icon = <Check size={14} strokeWidth={3} />;
          labelColor = 'text-gray-900';
        }

        if (!isRejected && index === awaitingIndex) {
          statusColor = 'border-ku-accent bg-white text-ku-accent ring-4 ring-ku-light';
          icon = <Clock size={16} />;
          labelColor = 'text-ku-main font-bold';
          helperText = 'กำลังรอขั้นตอนนี้...';
        }

        if (isRejected && index === rejectedIndex) {
          statusColor = 'border-red-500 bg-red-500 text-white animate-pulse';
          icon = <MapPin size={14} />;
          labelColor = 'text-red-600 font-bold';
          helperText = 'ใบสมัครต้องแก้ไขหรือไม่ผ่านการอนุมัติ';
        }

        return (
          <div key={step.id} className="relative flex items-start gap-4">
            <div className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-500 shrink-0 ${statusColor}`}>
              {icon}
            </div>
            <div className="flex flex-col">
              <h3 className={`text-sm transition-colors duration-300 ${labelColor}`}>{step.label}</h3>
              {helperText && <p className="text-xs text-gray-500 mt-1 animate-fadeIn">{helperText}</p>}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default StatusTimeline;
