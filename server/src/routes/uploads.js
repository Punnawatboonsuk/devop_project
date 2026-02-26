const express = require('express');
const { pool, transaction } = require('../config/database');
const { upload, getTicketFiles, upsertTicketFiles, deleteFileById, findFileById, createAuditLog } = require('../utils/fileUtils');
const { ROLES, ERROR_MESSAGES } = require('../utils/constants');

const router = express.Router();

async function requireAuth(req, res, next) {
  if (!req.session.user_id) {
    return res.status(401).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
  }
  return next();
}

async function getUserRoles(req, res, next) {
  const client = await pool.connect();
  try {
    const rolesResult = await client.query(
      `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [req.session.user_id]
    );
    req.userRoles = rolesResult.rows.map((row) => row.name);
    return next();
  } catch (error) {
    console.error('Get user roles error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  } finally {
    client.release();
  }
}

function hasRole(userRoles, role) {
  return userRoles.includes(role);
}

function isAdmin(userRoles) {
  return hasRole(userRoles, ROLES.ADMIN);
}

function isStaffOrHigher(userRoles) {
  return userRoles.some((role) => [ROLES.STAFF, ROLES.SUB_DEAN, ROLES.DEAN, ROLES.ADMIN].includes(role));
}

function isTicketOwner(userRoles, ticketOwnerId) {
  return hasRole(userRoles, ROLES.STUDENT) && ticketOwnerId === req.session.user_id;
}

// POST /api/uploads/ticket/:ticketId - Upload files for a ticket
router.post('/ticket/:ticketId', [requireAuth, getUserRoles], upload.fields([
  { name: 'transcript', maxCount: 1 },
  { name: 'portfolio', maxCount: 1 },
  { name: 'profile_photo', maxCount: 1 },
  { name: 'certificates', maxCount: 20 },
  { name: 'recommendation_letter', maxCount: 1 }
]), async (req, res) => {
  const ticketId = Number.parseInt(req.params.ticketId, 10);
  if (Number.isNaN(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket id.' });
  }

  try {
    const client = await pool.connect();
    try {
      // Check if ticket exists and get owner info
      const ticketResult = await client.query(
        'SELECT user_id FROM tickets WHERE id = $1',
        [ticketId]
      );
      
      if (ticketResult.rows.length === 0) {
        return res.status(404).json({ message: 'Ticket not found.' });
      }

      const ticketOwnerId = ticketResult.rows[0].user_id;
      const isOwner = ticketOwnerId === req.session.user_id;
      const canUpload = isOwner || isAdmin(req.userRoles) || isStaffOrHigher(req.userRoles);

      if (!canUpload) {
        return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
      }

      // Get files from request
      const filesByCategory = {};
      if (req.files.transcript) filesByCategory.transcript = req.files.transcript;
      if (req.files.portfolio) filesByCategory.portfolio = req.files.portfolio;
      if (req.files.profile_photo) filesByCategory.profile_photo = req.files.profile_photo;
      if (req.files.recommendation_letter) filesByCategory.recommendation_letter = req.files.recommendation_letter;
      if (req.files.certificates) filesByCategory.certificates = req.files.certificates;

      if (Object.keys(filesByCategory).length === 0) {
        return res.status(400).json({ message: 'No files provided.' });
      }

      // Upload files
      await upsertTicketFiles(client, ticketId, filesByCategory, req.session.user_id);

      // Get updated file list
      const files = await getTicketFiles(client, ticketId);

      // Create audit log
      await createAuditLog(client, req.session.user_id, 'file_upload', {
        resourceType: 'ticket',
        resourceId: ticketId,
        newValues: {
          file_categories: Object.keys(filesByCategory),
          file_count: Object.values(filesByCategory).reduce((sum, files) => sum + files.length, 0),
          actor_role: isAdmin(req.userRoles) ? ROLES.ADMIN : 
                       isStaffOrHigher(req.userRoles) ? req.userRoles.find(role => [ROLES.STAFF, ROLES.SUB_DEAN, ROLES.DEAN].includes(role)) :
                       ROLES.STUDENT
        },
        remark: 'Files uploaded for ticket.'
      });

      return res.status(200).json({
        message: 'Files uploaded successfully.',
        files: files
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Upload files error:', error);
    return res.status(500).json({ message: 'Error uploading files.' });
  }
});

// GET /api/uploads/ticket/:ticketId - List files for a ticket
router.get('/ticket/:ticketId', [requireAuth, getUserRoles], async (req, res) => {
  const ticketId = Number.parseInt(req.params.ticketId, 10);
  if (Number.isNaN(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket id.' });
  }

  try {
    const client = await pool.connect();
    try {
      // Check if ticket exists and get owner info
      const ticketResult = await client.query(
        'SELECT user_id FROM tickets WHERE id = $1',
        [ticketId]
      );
      
      if (ticketResult.rows.length === 0) {
        return res.status(404).json({ message: 'Ticket not found.' });
      }

      const ticketOwnerId = ticketResult.rows[0].user_id;
      const isOwner = ticketOwnerId === req.session.user_id;
      const canView = isOwner || isAdmin(req.userRoles) || isStaffOrHigher(req.userRoles);

      if (!canView) {
        return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
      }

      const files = await getTicketFiles(client, ticketId);

      return res.status(200).json({
        ticket_id: ticketId,
        files: files
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('List files error:', error);
    return res.status(500).json({ message: 'Error fetching files.' });
  }
});

// GET /api/uploads/file/:fileId - View file details
router.get('/file/:fileId', [requireAuth, getUserRoles], async (req, res) => {
  const fileId = Number.parseInt(req.params.fileId, 10);
  if (Number.isNaN(fileId)) {
    return res.status(400).json({ message: 'Invalid file id.' });
  }

  try {
    const client = await pool.connect();
    try {
      const file = await findFileById(client, fileId);
      
      if (!file) {
        return res.status(404).json({ message: 'File not found.' });
      }

      const isOwner = file.ticket_owner_id === req.session.user_id;
      const canView = isOwner || isAdmin(req.userRoles) || isStaffOrHigher(req.userRoles);

      if (!canView) {
        return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
      }

      return res.status(200).json({
        file: {
          id: file.id,
          original_name: file.original_name,
          filename: file.filename,
          file_path: file.file_path,
          file_size: file.file_size,
          mime_type: file.mime_type,
          file_category: file.file_category,
          uploaded_at: file.uploaded_at,
          ticket_id: file.ticket_id
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('View file error:', error);
    return res.status(500).json({ message: 'Error fetching file details.' });
  }
});

// GET /api/uploads/file/:fileId/download - Download file
router.get('/file/:fileId/download', [requireAuth, getUserRoles], async (req, res) => {
  const fileId = Number.parseInt(req.params.fileId, 10);
  if (Number.isNaN(fileId)) {
    return res.status(400).json({ message: 'Invalid file id.' });
  }

  try {
    const client = await pool.connect();
    try {
      const file = await findFileById(client, fileId);
      
      if (!file) {
        return res.status(404).json({ message: 'File not found.' });
      }

      const isOwner = file.ticket_owner_id === req.session.user_id;
      const canDownload = isOwner || isAdmin(req.userRoles) || isStaffOrHigher(req.userRoles);

      if (!canDownload) {
        return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
      }

      // Serve file for download
      const fs = require('fs');
      const path = require('path');
      
      const filePath = path.join(__dirname, '../../', file.file_path);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found on server.' });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
      res.setHeader('Content-Type', file.mime_type);
      res.sendFile(filePath);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Download file error:', error);
    return res.status(500).json({ message: 'Error downloading file.' });
  }
});

// DELETE /api/uploads/file/:fileId - Delete file (admin only)
router.delete('/file/:fileId', [requireAuth, getUserRoles], async (req, res) => {
  const fileId = Number.parseInt(req.params.fileId, 10);
  if (Number.isNaN(fileId)) {
    return res.status(400).json({ message: 'Invalid file id.' });
  }

  if (!isAdmin(req.userRoles)) {
    return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
  }

  try {
    const client = await pool.connect();
    try {
      const deletedFile = await deleteFileById(client, fileId, req.session.user_id);
      
      if (!deletedFile) {
        return res.status(404).json({ message: 'File not found or already deleted.' });
      }

      // Create audit log
      await createAuditLog(client, req.session.user_id, 'file_delete', {
        resourceType: 'ticket_file',
        resourceId: fileId,
        oldValues: {
          original_name: deletedFile.original_name,
          file_category: deletedFile.file_category,
          ticket_id: deletedFile.ticket_id
        },
        remark: 'File deleted by admin.'
      });

      return res.status(200).json({
        message: 'File deleted successfully.',
        file_id: fileId
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete file error:', error);
    return res.status(500).json({ message: 'Error deleting file.' });
  }
});

module.exports = router;

