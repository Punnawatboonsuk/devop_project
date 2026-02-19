/**
 * Constants & Enums
 * ค่าคงที่และ enum ทั้งหมดของระบบ
 */

// Roles
const ROLES = {
  STUDENT: 'STUDENT',
  STAFF: 'STAFF',
  SUB_DEAN: 'SUB_DEAN',
  DEAN: 'DEAN',
  COMMITTEE: 'COMMITTEE',
  COMMITTEE_PRESIDENT: 'COMMITTEE_PRESIDENT',
  ADMIN: 'ADMIN'
};

// Phases
const PHASES = {
  NOMINATION: 'NOMINATION',       // เปิดรับสมัคร
  REVIEW_END: 'REVIEW_END',       // ปิดรับสมัคร/รอตรวจสอบ
  VOTING: 'VOTING',               // เปิดโหวต
  VOTING_END: 'VOTING_END',       // ปิดโหวต/นับคะแนน
  CERTIFICATE: 'CERTIFICATE'      // ออกใบประกาศ
};

// Phase transitions (กำหนดลำดับที่ถูกต้อง)
const PHASE_TRANSITIONS = {
  NOMINATION: ['REVIEW_END'],
  REVIEW_END: ['VOTING'],
  VOTING: ['VOTING_END'],
  VOTING_END: ['CERTIFICATE'],
  CERTIFICATE: null // Final phase
};

// Ticket Status
const TICKET_STATUS = {
  PENDING: 'pending',           // รอการตรวจสอบ
  ACCEPTED: 'accepted',         // ผ่านการตรวจสอบ
  REJECTED: 'rejected',         // ไม่ผ่านการตรวจสอบ
  EXPIRED: 'expired',           // หมดเวลา
  VOTING: 'voting',             // อยู่ในระหว่างโหวต
  APPROVED: 'approved',         // ชนะการโหวต (>50%)
  NOT_APPROVED: 'not_approved'  // แพ้การโหวต (≤50%)
};

// Award Types (7 ประเภท)
const AWARD_TYPES = {
  ACADEMIC: 'academic',
  SPORT: 'sport',
  ARTS_CULTURE: 'arts_culture',
  MORAL_ETHICS: 'moral_ethics',
  SOCIAL_SERVICE: 'social_service',
  INNOVATION: 'innovation',
  ENTREPRENEURSHIP: 'entrepreneurship'
};

// Award Type Labels (ภาษาไทย)
const AWARD_TYPE_LABELS = {
  academic: 'นิสิตดีเด่นด้านวิชาการ',
  sport: 'นิสิตดีเด่นด้านกีฬา',
  arts_culture: 'นิสิตดีเด่นด้านศิลปวัฒนธรรม',
  moral_ethics: 'นิสิตดีเด่นด้านคุณธรรมจริยธรรม',
  social_service: 'นิสิตดีเด่นด้านบริการสังคม',
  innovation: 'นิสิตดีเด่นด้านนวัตกรรม',
  entrepreneurship: 'นิสิตดีเด่นด้านผู้ประกอบการ'
};

// Achievement Levels
const ACHIEVEMENT_LEVELS = {
  UNIVERSITY: 'ภายในมหาวิทยาลัย',
  PROVINCIAL: 'ระดับจังหวัด',
  NATIONAL: 'ระดับประเทศ',
  INTERNATIONAL: 'ระดับนานาชาติ'
};

// Vote Choices
const VOTE_CHOICES = {
  APPROVED: 'approved',
  NOT_APPROVED: 'not_approved'
};

// Vote Threshold (>50% to pass)
const VOTE_THRESHOLD = 50;

// File Upload Configurations
const FILE_CONFIGS = {
  // Max file size (20MB)
  MAX_FILE_SIZE: 20 * 1024 * 1024,
  
  // Allowed MIME types
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'video/mp4',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/zip'
  ],
  
  // Required files per award type
  REQUIRED_FILES: {
    academic: ['transcript.pdf', 'certificate.pdf'],
    sport: ['certificate.pdf', 'photo.jpg|photo.png'],
    arts_culture: ['certificate.pdf', 'photo.jpg|photo.png'],
    moral_ethics: ['certificate.pdf', 'activity_report.pdf'],
    social_service: ['activity_report.pdf', 'certificate.pdf'],
    innovation: ['prototype_doc.pdf', 'demo.mp4'],
    entrepreneurship: ['business_plan.pdf', 'financial.xlsx']
  },
  
  // Optional files per award type
  OPTIONAL_FILES: {
    academic: ['paper.pdf', 'portfolio.zip'],
    sport: ['highlight.mp4'],
    arts_culture: ['performance.mp4'],
    moral_ethics: ['photo.jpg|photo.png'],
    social_service: ['photo.jpg|photo.png'],
    innovation: ['patent.pdf'],
    entrepreneurship: ['pitch_deck.pptx']
  }
};

// Certificate Status
const CERTIFICATE_STATUS = {
  DRAFT: 'draft',         // สร้างแล้วแต่ยังไม่ได้เซ็น
  SIGNED: 'signed',       // ประธานเซ็นแล้ว
  PUBLISHED: 'published'  // เผยแพร่แล้ว
};

// Audit Log Actions
const LOG_ACTIONS = {
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_REGISTER: 'user_register',
  TICKET_CREATE: 'ticket_create',
  TICKET_UPDATE: 'ticket_update',
  TICKET_ACCEPT: 'ticket_accept',
  TICKET_REJECT: 'ticket_reject',
  TICKET_EXPIRE: 'ticket_expire',
  VOTE_SUBMIT: 'vote_submit',
  VOTE_UPDATE: 'vote_update',
  PHASE_CHANGE: 'phase_change',
  FILE_UPLOAD: 'file_upload',
  FILE_DELETE: 'file_delete',
  CERTIFICATE_GENERATE: 'certificate_generate',
  CERTIFICATE_SIGN: 'certificate_sign',
  CERTIFICATE_PUBLISH: 'certificate_publish',
  ADMIN_ACTION: 'admin_action'
};

// Permissions (ตาม requirement จาก auth_middleware.js เดิม)
const PERMISSIONS = {
  // Student permissions
  create_ticket: [ROLES.STUDENT],
  view_own_tickets: [ROLES.STUDENT],
  edit_own_ticket: [ROLES.STUDENT],
  upload_files: [ROLES.STUDENT, ROLES.ADMIN],
  
  // Staff permissions
  view_department_tickets: [ROLES.STAFF, ROLES.SUB_DEAN, ROLES.DEAN, ROLES.ADMIN],
  approve_ticket_level1: [ROLES.STAFF],
  
  // Sub-Dean permissions
  approve_ticket_level2: [ROLES.SUB_DEAN],
  
  // Dean permissions
  approve_ticket_level3: [ROLES.DEAN],
  
  // Committee permissions
  view_all_tickets: [ROLES.ADMIN, ROLES.COMMITTEE, ROLES.COMMITTEE_PRESIDENT],
  vote_ticket: [ROLES.COMMITTEE, ROLES.COMMITTEE_PRESIDENT],
  view_votes: [ROLES.COMMITTEE, ROLES.COMMITTEE_PRESIDENT, ROLES.ADMIN],
  
  // Committee President specific
  sign_certificate: [ROLES.COMMITTEE_PRESIDENT],
  finalize_voting: [ROLES.COMMITTEE_PRESIDENT],
  
  // Admin permissions
  edit_ticket_type: [ROLES.ADMIN],
  override_status: [ROLES.ADMIN],
  manage_users: [ROLES.ADMIN],
  assign_roles: [ROLES.ADMIN],
  open_close_voting: [ROLES.ADMIN],
  manage_phases: [ROLES.ADMIN],
  export_winners: [ROLES.ADMIN],
  view_system_logs: [ROLES.ADMIN],
  delete_files: [ROLES.ADMIN],
  view_ticket_logs: [ROLES.STAFF, ROLES.SUB_DEAN, ROLES.DEAN, ROLES.ADMIN],
  view_ticket_files: [ROLES.STUDENT, ROLES.STAFF, ROLES.SUB_DEAN, ROLES.DEAN, ROLES.COMMITTEE, ROLES.COMMITTEE_PRESIDENT, ROLES.ADMIN]
};

// Error Messages
const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Access denied. Insufficient permissions',
  INVALID_PHASE: 'This action is not allowed in current phase',
  TICKET_NOT_FOUND: 'Ticket not found',
  VOTE_NOT_FOUND: 'Vote not found',
  ALREADY_VOTED: 'You have already voted for this ticket',
  INVALID_VOTE: 'Invalid vote choice',
  FILE_TOO_LARGE: 'File size exceeds maximum allowed',
  INVALID_FILE_TYPE: 'Invalid file type',
  MISSING_REQUIRED_FILES: 'Missing required files'
};

module.exports = {
  ROLES,
  PHASES,
  PHASE_TRANSITIONS,
  TICKET_STATUS,
  AWARD_TYPES,
  AWARD_TYPE_LABELS,
  ACHIEVEMENT_LEVELS,
  VOTE_CHOICES,
  VOTE_THRESHOLD,
  FILE_CONFIGS,
  CERTIFICATE_STATUS,
  LOG_ACTIONS,
  PERMISSIONS,
  ERROR_MESSAGES
};
