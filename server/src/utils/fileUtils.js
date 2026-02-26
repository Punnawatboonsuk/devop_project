const multer = require('multer');
const { pool } = require('../config/database');
const { ERROR_MESSAGES } = require('./constants');

const REQUIRED_FILE_CATEGORIES = ['transcript', 'portfolio', 'profile_photo'];
const OPTIONAL_FILE_CATEGORIES = ['certificates', 'recommendation_letter'];
const ALLOWED_FILE_CATEGORIES = [...REQUIRED_FILE_CATEGORIES, ...OPTIONAL_FILE_CATEGORIES];

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    return cb(null, true);
  }
});

async function getTicketFiles(client, ticketId) {
  const result = await client.query(
    `SELECT id, original_name, filename, file_path, file_size, mime_type, file_category, uploaded_at
     FROM ticket_files
     WHERE ticket_id = $1 AND deleted_at IS NULL
     ORDER BY uploaded_at ASC`,
    [ticketId]
  );
  return result.rows;
}

async function upsertTicketFiles(client, ticketId, filesByCategory, uploadedBy) {
  for (const [fileCategory, files] of Object.entries(filesByCategory || {})) {
    if (!ALLOWED_FILE_CATEGORIES.includes(fileCategory) || !Array.isArray(files) || files.length === 0) {
      continue;
    }

    if (fileCategory !== 'certificates') {
      await client.query(
        `UPDATE ticket_files
         SET deleted_at = NOW(), deleted_by = $2
         WHERE ticket_id = $1
           AND file_category = $3
           AND deleted_at IS NULL`,
        [ticketId, uploadedBy, fileCategory]
      );
    }

    for (const file of files) {
      await client.query(
        `INSERT INTO ticket_files (
          ticket_id,
          filename,
          original_name,
          file_path,
          file_size,
          mime_type,
          file_category,
          uploaded_by,
          uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          ticketId,
          file.filename,
          file.originalname,
          file.path,
          file.size,
          file.mimetype,
          fileCategory,
          uploadedBy
        ]
      );
    }
  }
}

async function deleteTicketFiles(client, ticketId) {
  await client.query(
    `UPDATE ticket_files
     SET deleted_at = NOW(), deleted_by = $2
     WHERE ticket_id = $1 AND deleted_at IS NULL`,
    [ticketId, null] // deleted_by will be null for system deletion
  );
}

async function deleteFileById(client, fileId, deletedBy) {
  const result = await client.query(
    `UPDATE ticket_files
     SET deleted_at = NOW(), deleted_by = $2
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [fileId, deletedBy]
  );
  return result.rows[0] || null;
}

async function findFileById(client, fileId) {
  const result = await client.query(
    `SELECT tf.*, t.user_id AS ticket_owner_id
     FROM ticket_files tf
     JOIN tickets t ON tf.ticket_id = t.id
     WHERE tf.id = $1 AND tf.deleted_at IS NULL`,
    [fileId]
  );
  return result.rows[0] || null;
}

async function createAuditLog(client, userId, action, data = {}) {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, notes)
     VALUES ($1, $2::log_action, $3, $4, $5, $6, $7)`,
    [
      userId,
      action,
      data.resourceType || 'ticket_file',
      data.resourceId || null,
      data.oldValues ? JSON.stringify(data.oldValues) : null,
      data.newValues ? JSON.stringify(data.newValues) : null,
      data.remark || null
    ]
  );
}

function validateFileCategory(category) {
  return ALLOWED_FILE_CATEGORIES.includes(category);
}

function getFileCategoriesFromRequest(req) {
  const filesByCategory = {};
  
  // Handle single files
  if (req.files.transcript) filesByCategory.transcript = req.files.transcript;
  if (req.files.portfolio) filesByCategory.portfolio = req.files.portfolio;
  if (req.files.profile_photo) filesByCategory.profile_photo = req.files.profile_photo;
  if (req.files.recommendation_letter) filesByCategory.recommendation_letter = req.files.recommendation_letter;
  
  // Handle multiple certificates
  if (req.files.certificates) filesByCategory.certificates = req.files.certificates;
  
  return filesByCategory;
}

module.exports = {
  upload,
  getTicketFiles,
  upsertTicketFiles,
  deleteTicketFiles,
  deleteFileById,
  findFileById,
  createAuditLog,
  validateFileCategory,
  getFileCategoriesFromRequest,
  REQUIRED_FILE_CATEGORIES,
  OPTIONAL_FILE_CATEGORIES,
  ALLOWED_FILE_CATEGORIES
};