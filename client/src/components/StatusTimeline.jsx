import React from 'react';
import { Check, Clock, Circle, MapPin } from 'lucide-react';

const steps = [
  { id: 'draft', label: 'Draft Created' },
  { id: 'submit_by_staff', label: 'Dept. Head Review' },
  { id: 'submit_by_subdean', label: 'Sub-Dean Review' },
  { id: 'submit_by_dean', label: 'Dean Approval' },
  { id: 'dev_review', label: 'Admin Verification' },
  { id: 'nominated', label: 'Committee Voting' },
  { id: 'approved', label: 'Finalizing' }, // รอประธานเซ็น
  { id: 'announced', label: 'Announced' },
];

const StatusTimeline = ({ currentStatus }) => {
  const currentIndex = steps.findIndex(step => step.id === currentStatus);
  const isRejected = currentStatus === 'reject';

  return (
    <div className="relative pl-8 border-l-2 border-gray-200 space-y-8 my-6 ml-4">
      {steps.map((step, index) => {
        // Logic การแสดงผล
        let statusColor = 'border-gray-300 text-gray-300'; // ยังไม่ถึง
        let icon = <Circle size={10} />;
        let labelColor = 'text-gray-400';

        if (index < currentIndex) {
          // ผ่านมาแล้ว
          statusColor = 'border-ku-main bg-ku-main text-white';
          icon = <Check size={14} strokeWidth={3} />;
          labelColor = 'text-gray-900';
        } else if (index === currentIndex) {
          // อยู่ขั้นตอนปัจจุบัน
          if (isRejected) {
             statusColor = 'border-red-500 bg-red-500 text-white animate-pulse';
             icon = <MapPin size={14} />;
             labelColor = 'text-red-600 font-bold';
          } else {
             statusColor = 'border-ku-accent bg-white text-ku-accent ring-4 ring-ku-light';
             icon = <Clock size={16} />;
             labelColor = 'text-ku-main font-bold';
          }
        }

        return (
          <div key={step.id} className="relative group">
            {/* Dot Indicator */}
            <div 
              className={`absolute -left-[43px] top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${statusColor}`}
            >
              {icon}
            </div>

            {/* Text Content */}
            <div className="flex flex-col">
              <h3 className={`text-sm transition-colors duration-300 ${labelColor}`}>
                {step.label}
              </h3>
              {index === currentIndex && (
                <p className="text-xs text-gray-500 mt-1 animate-fadeIn">
                  {isRejected ? 'Application has been returned.' : 'Currently in progress...'}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatusTimeline;