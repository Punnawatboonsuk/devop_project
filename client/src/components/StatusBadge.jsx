import React from 'react';

const StatusBadge = ({ status }) => {
  const key = String(status || '').toLowerCase();

  const config = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'ฉบับร่าง' },
    submitted_by_student: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'ส่งแล้ว' },
    reviewed_by_staff: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'หัวหน้าภาควิชาตรวจแล้ว' },
    reviewed_by_subdean: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'รองคณบดีตรวจแล้ว' },
    reviewed_by_dean: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'คณบดีตรวจแล้ว' },
    pending: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'รอดำเนินการ' },
    voting: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'อยู่ระหว่างลงคะแนน' },
    approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'อนุมัติ' },
    announced: { bg: 'bg-ku-main', text: 'text-white', label: 'ประกาศผลแล้ว' },
    returned: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'ส่งกลับแก้ไข' },
    rejected: { bg: 'bg-red-50', text: 'text-red-600', label: 'ไม่อนุมัติ' },
    expired: { bg: 'bg-gray-200', text: 'text-gray-700', label: 'หมดอายุ' },
    dq: { bg: 'bg-red-100', text: 'text-red-700', label: 'ตัดสิทธิ์' },
    not_approved: { bg: 'bg-red-100', text: 'text-red-700', label: 'ไม่ผ่านอนุมัติ' },
    accept: { bg: 'bg-green-100', text: 'text-green-700', label: 'รับรองแล้ว' },
    submit_by_staff: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'รอหัวหน้าภาควิชา' },
    submit_by_subdean: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'รอรองคณบดี' },
    submit_by_dean: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'รอคณบดี' },
    dev_review: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'รอผู้ดูแลตรวจสอบ' },
    nominated: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'ช่วงลงคะแนน' },
    reject: { bg: 'bg-red-50', text: 'text-red-600', label: 'ไม่อนุมัติ' }
  };

  const current = config[key] || config.draft;

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border border-transparent ${current.bg} ${current.text}`}>
      {current.label}
    </span>
  );
};

export default StatusBadge;
