export const ROLE_LABELS = {
  STUDENT: 'นิสิต',
  STAFF: 'หัวหน้าภาควิชา',
  SUB_DEAN: 'รองคณบดี',
  DEAN: 'คณบดี',
  ADMIN: 'กองพัฒนานิสิต / ผู้ดูแลระบบ',
  COMMITTEE: 'คณะกรรมการพิจารณานิสิตดีเด่น',
  COMMITTEE_PRESIDENT: 'ประธานคณะกรรมการ'
};

export const getRoleLabel = (role) => {
  const normalized = String(role || '').trim().toUpperCase();
  return ROLE_LABELS[normalized] || role || '-';
};

