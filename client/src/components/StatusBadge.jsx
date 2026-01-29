import React from 'react';

const StatusBadge = ({ status }) => {
  const config = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
    submit_by_staff: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Wait: Staff' },
    submit_by_subdean: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Wait: Sub-Dean' },
    submit_by_dean: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Wait: Dean' },
    dev_review: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Admin Verify' },
    nominated: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Voting Phase' },
    approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
    announced: { bg: 'bg-ku-main', text: 'text-white', label: 'Announced' },
    reject: { bg: 'bg-red-50', text: 'text-red-600', label: 'Rejected' },
  };

  const current = config[status] || config.draft;

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border border-transparent ${current.bg} ${current.text}`}>
      {current.label}
    </span>
  );
};

export default StatusBadge;