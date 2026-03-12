const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const { pool, transaction } = require('../config/database');
const { ROLES, PHASES, CERTIFICATE_STATUS, LOG_ACTIONS } = require('../utils/constants');
const { getRoundById, getRoundByAcademic, getActiveRound, getCurrentPhaseForRound } = require('../services/roundPhase');

const router = express.Router();

const certificateDir = path.resolve(process.cwd(), 'uploads', 'certificates');
if (!fs.existsSync(certificateDir)) {
  fs.mkdirSync(certificateDir, { recursive: true });
}

const signedUpload = multer({
  dest: certificateDir,
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return cb(new Error('Signed file must be a PDF.'));
    }
    return cb(null, true);
  }
});

function uploadSignedMiddleware(req, res, next) {
  signedUpload.single('signed_file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Invalid signed file upload.' });
    }
    return next();
  });
}

const AWARD_SECTION_TITLES = {
  activity_enrichment: 'นิสิตที่มีผลงานดีเด่นด้านกิจกรรมเสริมหลักสูตร',
  creativity_innovation: 'นิสิตที่มีผลงานดีเด่นด้านความคิดสร้างสรรค์และนวัตกรรม',
  good_behavior: 'นิสิตที่มีความประพฤติดีเด่น'
};

const AWARD_ORDER = ['activity_enrichment', 'creativity_innovation', 'good_behavior'];

function toThaiNumber(value) {
  const map = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  return String(value || '')
    .split('')
    .map((ch) => (/\d/.test(ch) ? map[Number(ch)] : ch))
    .join('');
}

function semesterLabel(semester) {
  return Number(semester) === 1 ? 'ภาคต้น' : 'ภาคปลาย';
}

function isAdmin(userRoles = []) {
  return userRoles.includes(ROLES.ADMIN);
}

function isPresident(userRoles = []) {
  return userRoles.includes(ROLES.COMMITTEE_PRESIDENT);
}

async function getUserRoles(client, userId) {
  const rolesResult = await client.query(
    `SELECT r.name
     FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = $1`,
    [userId]
  );
  return rolesResult.rows.map((row) => row.name);
}

async function requireAuth(req, res, next) {
  if (!req.session.user_id) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const client = await pool.connect();
  try {
    req.userRoles = await getUserRoles(client, req.session.user_id);
    return next();
  } catch (error) {
    console.error('Certificate auth error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  } finally {
    client.release();
  }
}

async function requireAdminOrPresident(req, res, next) {
  await requireAuth(req, res, async () => {
    if (!isAdmin(req.userRoles) && !isPresident(req.userRoles)) {
      return res.status(403).json({ message: 'Access denied. Admin or committee president only' });
    }
    return next();
  });
}

async function requirePresident(req, res, next) {
  await requireAuth(req, res, async () => {
    if (!isPresident(req.userRoles)) {
      return res.status(403).json({ message: 'Access denied. Committee president only' });
    }
    return next();
  });
}

async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    if (!isAdmin(req.userRoles)) {
      return res.status(403).json({ message: 'Access denied. Admin only' });
    }
    return next();
  });
}

async function createAuditLog(client, userId, action, data = {}) {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, data.resourceType || null, data.resourceId || null, JSON.stringify(data.newValues || {})]
  );
}

async function resolveRound(client, input = {}) {
  const roundId = Number.parseInt(input.round_id, 10);
  if (!Number.isNaN(roundId) && roundId > 0) {
    return getRoundById(client, roundId);
  }

  const year = Number.parseInt(input.academic_year, 10);
  const semester = Number.parseInt(input.semester, 10);
  if (!Number.isNaN(year) && [1, 2].includes(semester)) {
    return getRoundByAcademic(client, year, semester);
  }

  return getActiveRound(client);
}

async function getRoundWinnersForCertificate(client, roundId) {
  const result = await client.query(
    `SELECT
       t.id,
       t.award_type,
       t.form_data,
       t.created_at,
       u.id AS user_id,
       u.fullname AS owner_fullname,
       u.ku_id AS owner_ku_id,
       u.faculty AS owner_faculty,
       u.department AS owner_department
     FROM tickets t
     JOIN users u ON u.id = t.user_id
     WHERE t.round_id = $1
       AND COALESCE(t.form_data->>'proclamation_result', '') = 'winner'
     ORDER BY t.award_type ASC, t.created_at ASC`,
    [roundId]
  );

  return result.rows.map((row) => {
    const formData = row.form_data || {};
    return {
      ticket_id: row.id,
      user_id: row.user_id,
      award_type: row.award_type,
      fullname: formData.full_name || row.owner_fullname || '-',
      gender: formData.gender || null,
      ku_id: formData.student_code || row.owner_ku_id || '-',
      faculty: formData.faculty || row.owner_faculty || '-',
      department: formData.department || row.owner_department || '-',
      proclamation_signature: formData.proclamation_signature || null
    };
  });
}

async function getCommitteeCount(client) {
  const result = await client.query(
    `SELECT COUNT(DISTINCT ur.user_id)::int AS total
     FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE r.name IN ($1, $2)`,
    [ROLES.COMMITTEE, ROLES.COMMITTEE_PRESIDENT]
  );
  return result.rows[0]?.total || 0;
}

async function getRoundWinnersFromVotes(client, roundId) {
  const totalCommittee = await getCommitteeCount(client);
  const threshold = Math.floor(totalCommittee / 2) + 1;
  if (threshold <= 0) return [];

  const result = await client.query(
    `SELECT
       t.id,
       t.award_type,
       t.form_data,
       t.created_at,
       u.id AS user_id,
       u.fullname AS owner_fullname,
       u.ku_id AS owner_ku_id,
       u.faculty AS owner_faculty,
       u.department AS owner_department,
       COUNT(v.id)::int AS total_votes,
       COUNT(CASE WHEN v.vote = 'approved' THEN 1 END)::int AS approved_votes
     FROM tickets t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN votes v ON v.ticket_id = t.id
     WHERE t.round_id = $1
       AND t.status = 'approved'
     GROUP BY t.id, u.id
     ORDER BY t.award_type ASC, t.created_at ASC`,
    [roundId]
  );

  const byAward = new Map();
  for (const row of result.rows) {
    const formData = row.form_data || {};
    const candidate = {
      ticket_id: row.id,
      user_id: row.user_id,
      award_type: row.award_type,
      fullname: formData.full_name || row.owner_fullname || '-',
      gender: formData.gender || null,
      ku_id: formData.student_code || row.owner_ku_id || '-',
      faculty: formData.faculty || row.owner_faculty || '-',
      department: formData.department || row.owner_department || '-',
      proclamation_signature: formData.proclamation_signature || null,
      approved_votes: row.approved_votes || 0,
      total_votes: row.total_votes || 0,
      created_at: row.created_at
    };
    if (!byAward.has(candidate.award_type)) {
      byAward.set(candidate.award_type, []);
    }
    byAward.get(candidate.award_type).push(candidate);
  }

  const winners = [];
  for (const [, candidates] of byAward.entries()) {
    const qualified = candidates
      .filter((item) => item.approved_votes >= threshold)
      .sort((a, b) => {
        if (b.approved_votes !== a.approved_votes) {
          return b.approved_votes - a.approved_votes;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    if (qualified.length > 0) {
      winners.push(qualified[0]);
    }
  }

  return winners;
}

function toThaiHonorific(gender) {
  const value = String(gender || '').trim().toLowerCase();
  const maleThai = '\u0E0A\u0E32\u0E22';
  const femaleThai = '\u0E2B\u0E0D\u0E34\u0E07';
  const mrThai = '\u0E19\u0E32\u0E22';
  const msThai = '\u0E19\u0E32\u0E07\u0E2A\u0E32\u0E27';
  if (['male', 'm', 'man', maleThai].includes(value)) return mrThai;
  if (['female', 'f', 'woman', femaleThai].includes(value)) return msThai;
  return '';
}

function withHonorific(fullname, gender) {
  const name = String(fullname || '').trim();
  if (!name) return '-';
  if (/^(\u0E19\u0E32\u0E22|\u0E19\u0E32\u0E07\u0E2A\u0E32\u0E27)\s/.test(name)) return name;
  const prefix = toThaiHonorific(gender);
  return prefix ? `${prefix} ${name}` : name;
}

function resolveThaiFontPath() {
  const candidates = [
    process.env.CERT_THAI_FONT_PATH,
    'C:\\Windows\\Fonts\\THSarabunNew.ttf',
    'C:\\Windows\\Fonts\\THSarabun.ttf',
    'C:\\Windows\\Fonts\\Tahoma.ttf',
    'C:\\Windows\\Fonts\\LeelawUI.ttf'
  ].filter(Boolean);

  for (const fontPath of candidates) {
    if (fs.existsSync(fontPath)) {
      return fontPath;
    }
  }
  return null;
}

function renderCertificatePdf(doc, { round, winners, presidentSignaturePath = null, thaiFontPath }) {
  doc.font(thaiFontPath);

  const pageBottom = () => doc.page.height - doc.page.margins.bottom;
  const ensureSpace = (needed = 24) => {
    if (doc.y + needed > pageBottom()) {
      doc.addPage();
      doc.font(thaiFontPath);
    }
  };

  const sortedWinners = [...winners].sort((a, b) => {
    const aa = AWARD_ORDER.indexOf(String(a.award_type || ''));
    const bb = AWARD_ORDER.indexOf(String(b.award_type || ''));
    if (aa !== bb) return aa - bb;
    return String(a.fullname || '').localeCompare(String(b.fullname || ''));
  });

  const groups = new Map();
  for (const winner of sortedWinners) {
    const key = String(winner.award_type || 'other');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(winner);
  }

  doc.fontSize(16).text(
    `ประกาศรายชื่อผู้ที่มีผลงานดีเด่น ${semesterLabel(round.semester)} ประจำปีการศึกษา ${toThaiNumber(round.academic_year)}`,
    { align: 'center' }
  );
  doc.moveDown(0.4);
  doc.moveDown(1.1);

  const nameX = doc.page.margins.left + 20;
  const facultyX = doc.page.width * 0.48 + 20;
  const rowHeight = 22;

  const orderedGroups = new Map();
  for (const key of AWARD_ORDER) {
    if (groups.has(key)) orderedGroups.set(key, groups.get(key));
  }

  if (orderedGroups.size === 0) {
    doc.moveDown(0.6);
    doc.fontSize(12).text('ไม่พบผู้ชนะในรอบนี้', { align: 'center' });
    doc.moveDown(1.2);
  } else {
    for (const [awardType, rows] of orderedGroups.entries()) {
      ensureSpace(46);
      const sectionTitle = AWARD_SECTION_TITLES[awardType] || `นิสิตดีเด่นประเภท ${awardType}`;
      doc.moveDown(0.6);
      doc.x = doc.page.margins.left;
      doc.fontSize(14).text(sectionTitle, {
        align: 'center',
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right
      });
      doc.moveDown(0.45);

      for (const row of rows) {
        ensureSpace(rowHeight + 4);
        const fullName = withHonorific(row.fullname, row.gender);
        const facultyName = String(row.faculty || '-');
        const nameWidth = Math.max(120, facultyX - nameX - 18);
        const facultyWidth = doc.page.width - doc.page.margins.right - facultyX;
        const rowY = doc.y;

        doc.fontSize(12).text(fullName, nameX, rowY, {
          width: nameWidth,
          lineBreak: false
        });
        doc.fontSize(12).text(facultyName, facultyX, rowY, {
          width: facultyWidth,
          lineBreak: false
        });
        doc.y = rowY + rowHeight;
      }
      doc.moveDown(0.7);
    }
  }

  ensureSpace(160);
  doc.moveDown(1.2);
  const rightX = doc.page.width - doc.page.margins.right;
  const blockWidth = 240;
  const gap = 24;
  const signY = doc.y;

  const blockX = rightX - blockWidth;
  const signatureHeight = 70;

  if (presidentSignaturePath && fs.existsSync(presidentSignaturePath)) {
    try {
      doc.image(presidentSignaturePath, blockX + 40, signY, { fit: [160, signatureHeight], align: 'left' });
    } catch {}
  }

  const lineY = signY + signatureHeight + gap;
  doc.fontSize(12).text('(..................................)', blockX, lineY, {
    width: blockWidth,
    align: 'center'
  });
  doc.fontSize(12).text('ลงนามรับรอง ประธานคณะกรรมการคัดเลือกนิสิตดีเด่น', blockX, lineY + 18, {
    width: blockWidth,
    align: 'center'
  });

  const rectorLineY = lineY + 90;
  doc.fontSize(12).text('(..................................)', blockX, rectorLineY, {
    width: blockWidth,
    align: 'center'
  });
  doc.fontSize(12).text('ลงนามรับรอง อธิการบดีที่ปรึกษาคัดเลือกนิสิตดีเด่น', blockX, rectorLineY + 18, {
    width: blockWidth,
    align: 'center'
  });

  doc.end();
}

function createCertificatePdf({ filePath, round, winners, presidentSignaturePath = null, thaiFontPath }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 72 });
    const stream = fs.createWriteStream(filePath);

    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.on('error', reject);

    doc.pipe(stream);
    renderCertificatePdf(doc, { round, winners, presidentSignaturePath, thaiFontPath });
  });
}
// POST /api/certificates/generate - Generate round certificate/proclamation PDF
router.post('/generate', requireAdminOrPresident, async (req, res) => {
  try {
    const result = await transaction(async (client) => {
      const round = await resolveRound(client, req.body || {});
      if (!round) {
        throw new Error('Round not found');
      }

      const phaseInfo = await getCurrentPhaseForRound(client, round.id);
      if (!phaseInfo || phaseInfo.phase !== PHASES.CERTIFICATE) {
        throw new Error(
          `Certificate export is allowed only in CERTIFICATE phase (current phase: ${phaseInfo?.phase || 'NONE'})`
        );
      }

      let winners = await getRoundWinnersForCertificate(client, round.id);
      if (winners.length === 0) {
        winners = await getRoundWinnersFromVotes(client, round.id);
      }
      if (winners.length === 0) {
        throw new Error('No winners found for this round from proclamation or voting results.');
      }

      const thaiFontPath = resolveThaiFontPath();
      if (!thaiFontPath) {
        throw new Error('Thai font not found on server. Please set CERT_THAI_FONT_PATH to a valid .ttf (e.g. THSarabunNew.ttf).');
      }

      const signaturePath =
        winners.find((winner) => winner.proclamation_signature?.file_path)?.proclamation_signature?.file_path || null;
      const filename = `certificate-round-${round.id}-${Date.now()}.pdf`;
      const filePath = path.join(certificateDir, filename);
      await createCertificatePdf({
        filePath,
        round,
        winners,
        presidentSignaturePath: signaturePath,
        thaiFontPath
      });

      const generatedCertificates = [];
      for (const winner of winners) {
        const certificateNumber = `ND-${round.academic_year}-${round.semester}-${winner.ticket_id}`;
        const existing = await client.query(
          `SELECT id, status
           FROM certificates
           WHERE ticket_id = $1
           ORDER BY updated_at DESC NULLS LAST, id DESC
           LIMIT 1`,
          [winner.ticket_id]
        );

        const templateData = {
          round_id: round.id,
          round_name: round.name,
          academic_year: round.academic_year,
          semester: round.semester,
          winner: {
            ticket_id: winner.ticket_id,
            user_id: winner.user_id,
            fullname: winner.fullname,
            ku_id: winner.ku_id,
            faculty: winner.faculty,
            department: winner.department,
            award_type: winner.award_type
          },
          proclamation_signature: winner.proclamation_signature || null
        };

        if (existing.rows.length > 0 && ![CERTIFICATE_STATUS.SIGNED, CERTIFICATE_STATUS.PUBLISHED].includes(existing.rows[0].status)) {
          await client.query(
            `UPDATE certificates
             SET certificate_number = $1,
                 status = $2::certificate_status,
                 pdf_path = $3,
                 generated_by = $4,
                 generated_at = NOW(),
                 template_data = $5::jsonb
             WHERE id = $6`,
            [
              certificateNumber,
              CERTIFICATE_STATUS.DRAFT,
              filePath,
              req.session.user_id,
              JSON.stringify(templateData),
              existing.rows[0].id
            ]
          );
          generatedCertificates.push({ id: existing.rows[0].id, ticket_id: winner.ticket_id });
        } else {
          const inserted = await client.query(
            `INSERT INTO certificates (ticket_id, certificate_number, status, pdf_path, generated_by, template_data)
             VALUES ($1, $2, $3::certificate_status, $4, $5, $6::jsonb)
             RETURNING id`,
            [
              winner.ticket_id,
              certificateNumber,
              CERTIFICATE_STATUS.DRAFT,
              filePath,
              req.session.user_id,
              JSON.stringify(templateData)
            ]
          );
          generatedCertificates.push({ id: inserted.rows[0].id, ticket_id: winner.ticket_id });
        }
      }

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.CERTIFICATE_GENERATE, {
        resourceType: 'certificate',
        resourceId: generatedCertificates[0]?.id || null,
        newValues: {
          round_id: round.id,
          generated_count: generatedCertificates.length,
          file_path: filePath
        }
      });

      return {
        round,
        filePath,
        generatedCertificates
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Certificate package generated successfully',
      round: {
        id: result.round.id,
        academic_year: result.round.academic_year,
        semester: result.round.semester,
        name: result.round.name
      },
      generated_count: result.generatedCertificates.length,
      certificates: result.generatedCertificates,
      download_url: result.generatedCertificates[0]
        ? `/api/certificates/${result.generatedCertificates[0].id}/download`
        : null
    });
  } catch (error) {
    console.error('Generate certificates error:', error);
    return res.status(400).json({ message: error.message || 'Error generating certificates' });
  }
});

// GET /api/certificates/pending - Pending list
router.get('/pending', requireAdminOrPresident, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const round = await resolveRound(client, req.query || {});
      if (!round) {
        return res.status(200).json({ round: null, certificates: [] });
      }

      const result = await client.query(
        `SELECT
           c.id,
           c.ticket_id,
           c.certificate_number,
           c.status,
           c.generated_at,
           c.signed_at,
           c.published_at,
           c.template_data
         FROM certificates c
         JOIN tickets t ON t.id = c.ticket_id
         WHERE t.round_id = $1
         ORDER BY c.generated_at DESC`,
        [round.id]
      );

      const certificates = result.rows.map((row) => ({
        id: row.id,
        ticket_id: row.ticket_id,
        certificate_number: row.certificate_number,
        status: row.status,
        generated_at: row.generated_at,
        signed_at: row.signed_at,
        published_at: row.published_at,
        winner: row.template_data?.winner || null,
        download_url: `/api/certificates/${row.id}/download`
      }));

      return res.status(200).json({
        round: {
          id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          name: round.name
        },
        certificates
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('List pending certificates error:', error);
    return res.status(500).json({ message: 'Error fetching certificates' });
  }
});

// POST /api/certificates/prepare - Create draft certificate records (no PDF)
router.post('/prepare', requireAdminOrPresident, async (req, res) => {
  try {
    const result = await transaction(async (client) => {
      const round = await resolveRound(client, req.body || {});
      if (!round) {
        throw new Error('Round not found');
      }

      const phaseInfo = await getCurrentPhaseForRound(client, round.id);
      if (!phaseInfo || phaseInfo.phase !== PHASES.CERTIFICATE) {
        throw new Error(
          `Prepare certificates is allowed only in CERTIFICATE phase (current phase: ${phaseInfo?.phase || 'NONE'})`
        );
      }

      let winners = await getRoundWinnersForCertificate(client, round.id);
      if (winners.length === 0) {
        winners = await getRoundWinnersFromVotes(client, round.id);
      }
      if (winners.length === 0) {
        throw new Error('No winners found for this round from proclamation or voting results.');
      }

      const created = [];
      for (const winner of winners) {
        const certificateNumber = `ND-${round.academic_year}-${round.semester}-${winner.ticket_id}`;
        const existing = await client.query(
          `SELECT id, status
           FROM certificates
           WHERE ticket_id = $1
           ORDER BY updated_at DESC NULLS LAST, id DESC
           LIMIT 1`,
          [winner.ticket_id]
        );

        const templateData = {
          round_id: round.id,
          round_name: round.name,
          academic_year: round.academic_year,
          semester: round.semester,
          winner: {
            ticket_id: winner.ticket_id,
            user_id: winner.user_id,
            fullname: winner.fullname,
            ku_id: winner.ku_id,
            faculty: winner.faculty,
            department: winner.department,
            award_type: winner.award_type
          },
          proclamation_signature: winner.proclamation_signature || null
        };

        if (
          existing.rows.length > 0 &&
          ![CERTIFICATE_STATUS.SIGNED, CERTIFICATE_STATUS.PUBLISHED].includes(existing.rows[0].status)
        ) {
          await client.query(
            `UPDATE certificates
             SET certificate_number = $1,
                 status = $2::certificate_status,
                 template_data = $3::jsonb,
                 generated_by = $4,
                 generated_at = NOW()
             WHERE id = $5`,
            [
              certificateNumber,
              CERTIFICATE_STATUS.DRAFT,
              JSON.stringify(templateData),
              req.session.user_id,
              existing.rows[0].id
            ]
          );
          created.push({ id: existing.rows[0].id, ticket_id: winner.ticket_id });
        } else {
          const inserted = await client.query(
            `INSERT INTO certificates (ticket_id, certificate_number, status, generated_by, template_data)
             VALUES ($1, $2, $3::certificate_status, $4, $5::jsonb)
             RETURNING id`,
            [
              winner.ticket_id,
              certificateNumber,
              CERTIFICATE_STATUS.DRAFT,
              req.session.user_id,
              JSON.stringify(templateData)
            ]
          );
          created.push({ id: inserted.rows[0].id, ticket_id: winner.ticket_id });
        }
      }

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.CERTIFICATE_GENERATE, {
        resourceType: 'certificate',
        resourceId: created[0]?.id || null,
        newValues: {
          round_id: round.id,
          generated_count: created.length,
          file_path: null
        }
      });

      return { round, created };
    });

    return res.status(200).json({
      success: true,
      message: 'Certificate records prepared successfully',
      round: {
        id: result.round.id,
        academic_year: result.round.academic_year,
        semester: result.round.semester,
        name: result.round.name
      },
      generated_count: result.created.length,
      certificates: result.created
    });
  } catch (error) {
    console.error('Prepare certificates error:', error);
    return res.status(400).json({ message: error.message || 'Error preparing certificates' });
  }
});

// GET /api/certificates/preview - Preview unsigned certificate package (no save)
router.get('/preview', requireAdminOrPresident, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const round = await resolveRound(client, req.query || {});
      if (!round) {
        return res.status(404).json({ message: 'Round not found' });
      }

      const phaseInfo = await getCurrentPhaseForRound(client, round.id);
      if (!phaseInfo || phaseInfo.phase !== PHASES.CERTIFICATE) {
        return res.status(400).json({
          message: `Certificate preview is allowed only in CERTIFICATE phase (current phase: ${phaseInfo?.phase || 'NONE'})`
        });
      }

      let winners = await getRoundWinnersForCertificate(client, round.id);
      if (winners.length === 0) {
        winners = await getRoundWinnersFromVotes(client, round.id);
      }
      if (winners.length === 0) {
        // Allow preview with "no winners" notice.
      }

      const thaiFontPath = resolveThaiFontPath();
      if (!thaiFontPath) {
        return res.status(400).json({
          message: 'Thai font not found on server. Please set CERT_THAI_FONT_PATH to a valid .ttf (e.g. THSarabunNew.ttf).'
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="proclamation-preview.pdf"');

      const doc = new PDFDocument({ size: 'A4', margin: 72 });
      doc.on('error', (err) => {
        console.error('Preview PDF error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error generating preview' });
        }
      });
      doc.pipe(res);
      renderCertificatePdf(doc, { round, winners, presidentSignaturePath: null, thaiFontPath });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Preview certificates error:', error);
    return res.status(500).json({ message: 'Error generating preview' });
  }
});

// GET /api/certificates/signed-latest - Get latest signed certificate package for round
router.get('/signed-latest', requireAdminOrPresident, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const round = await resolveRound(client, req.query || {});
      if (!round) {
        return res.status(404).json({ message: 'Round not found' });
      }

      let result = await client.query(
        `SELECT c.id, c.pdf_path, c.signed_at, c.updated_at
         FROM certificates c
         JOIN tickets t ON t.id = c.ticket_id
         WHERE t.round_id = $1
           AND c.status = $2::certificate_status
         ORDER BY c.signed_at DESC NULLS LAST, c.updated_at DESC
         LIMIT 1`,
        [round.id, CERTIFICATE_STATUS.SIGNED]
      );

      if (result.rows.length === 0) {
        result = await client.query(
          `SELECT c.id, c.pdf_path, c.signed_at, c.updated_at, c.status
           FROM certificates c
           JOIN tickets t ON t.id = c.ticket_id
           WHERE t.round_id = $1
           ORDER BY c.updated_at DESC
           LIMIT 1`,
          [round.id]
        );
      }

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Signed certificate package not found for this round.' });
      }

      const signed = result.rows[0];
      if (!signed.pdf_path || !fs.existsSync(signed.pdf_path)) {
        return res.status(404).json({ message: 'Signed certificate file not found.' });
      }

      return res.status(200).json({
        round: {
          id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          name: round.name
        },
        certificate_id: signed.id,
        download_url: `/api/certificates/${signed.id}/download`
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get signed certificate error:', error);
    return res.status(500).json({ message: 'Error fetching signed certificate' });
  }
});

// GET /api/certificates/published-latest - Get latest published certificate package for round
router.get('/published-latest', requireAdmin, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const round = await resolveRound(client, req.query || {});
      if (!round) {
        return res.status(404).json({ message: 'Round not found' });
      }

      const result = await client.query(
        `SELECT c.id, c.pdf_path, c.published_at, c.updated_at
         FROM certificates c
         JOIN tickets t ON t.id = c.ticket_id
         WHERE t.round_id = $1
           AND c.status = $2::certificate_status
         ORDER BY c.published_at DESC NULLS LAST, c.updated_at DESC
         LIMIT 1`,
        [round.id, CERTIFICATE_STATUS.PUBLISHED]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Published certificate package not found for this round.' });
      }

      const published = result.rows[0];
      if (!published.pdf_path || !fs.existsSync(published.pdf_path)) {
        return res.status(404).json({ message: 'Published certificate file not found.' });
      }

      return res.status(200).json({
        round: {
          id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          name: round.name
        },
        certificate_id: published.id,
        download_url: `/api/certificates/${published.id}/download`
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get published certificate error:', error);
    return res.status(500).json({ message: 'Error fetching published certificate' });
  }
});

// POST /api/certificates/:id/sign - Sign (president)
router.post('/:id/sign', requirePresident, async (req, res) => {
  const certificateId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(certificateId)) {
    return res.status(400).json({ message: 'Invalid certificate id' });
  }

  try {
    const result = await transaction(async (client) => {
      const current = await client.query(
        `SELECT id, status
         FROM certificates
         WHERE id = $1`,
        [certificateId]
      );
      if (current.rows.length === 0) {
        throw new Error('Certificate not found');
      }

      await client.query(
        `UPDATE certificates
         SET status = $1::certificate_status,
             signed_by = $2,
             signed_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [CERTIFICATE_STATUS.SIGNED, req.session.user_id, certificateId]
      );

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.CERTIFICATE_SIGN, {
        resourceType: 'certificate',
        resourceId: certificateId,
        newValues: {
          status: CERTIFICATE_STATUS.SIGNED
        }
      });

      return { id: certificateId };
    });

    return res.status(200).json({
      success: true,
      message: 'Certificate signed successfully',
      certificate_id: result.id
    });
  } catch (error) {
    console.error('Sign certificate error:', error);
    return res.status(400).json({ message: error.message || 'Error signing certificate' });
  }
});

// POST /api/certificates/upload-signed - Upload signed proclamation PDF (president)
router.post('/upload-signed', [requirePresident, uploadSignedMiddleware], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Signed PDF file is required.' });
    }

    const result = await transaction(async (client) => {
      const round = await resolveRound(client, req.body || {});
      if (!round) {
        throw new Error('Round not found');
      }

      const phaseInfo = await getCurrentPhaseForRound(client, round.id);
      if (!phaseInfo || phaseInfo.phase !== PHASES.CERTIFICATE) {
        throw new Error(`Signed upload is allowed only in CERTIFICATE phase (current phase: ${phaseInfo?.phase || 'NONE'})`);
      }

      const certResult = await client.query(
        `SELECT c.id
         FROM certificates c
         JOIN tickets t ON t.id = c.ticket_id
         WHERE t.round_id = $1`,
        [round.id]
      );
      if (certResult.rows.length === 0) {
        throw new Error('No certificates found for this round.');
      }

      const signedFilename = `certificate-signed-round-${round.id}-${Date.now()}.pdf`;
      const signedPath = path.join(certificateDir, signedFilename);
      fs.renameSync(req.file.path, signedPath);

      const certificateIds = certResult.rows.map((row) => row.id);
      await client.query(
        `UPDATE certificates
         SET pdf_path = $1,
             status = $2::certificate_status,
             signed_by = $3,
             signed_at = NOW(),
             updated_at = NOW()
         WHERE id = ANY($4::int[])`,
        [signedPath, CERTIFICATE_STATUS.SIGNED, req.session.user_id, certificateIds]
      );

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.CERTIFICATE_SIGN, {
        resourceType: 'certificate',
        resourceId: certificateIds[0],
        newValues: {
          round_id: round.id,
          signed_count: certificateIds.length,
          file_path: signedPath
        }
      });

      return {
        round,
        certificateId: certificateIds[0]
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Signed certificate package uploaded successfully',
      round: {
        id: result.round.id,
        academic_year: result.round.academic_year,
        semester: result.round.semester,
        name: result.round.name
      },
      download_url: result.certificateId ? `/api/certificates/${result.certificateId}/download` : null
    });
  } catch (error) {
    console.error('Upload signed certificates error:', error);
    return res.status(400).json({ message: error.message || 'Error uploading signed certificate package' });
  }
});

// POST /api/certificates/upload-published - Upload signed proclamation PDF (admin with dean signature)
router.post('/upload-published', [requireAdmin, uploadSignedMiddleware], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Signed PDF file is required.' });
    }

    const result = await transaction(async (client) => {
      const round = await resolveRound(client, req.body || {});
      if (!round) {
        throw new Error('Round not found');
      }

      const phaseInfo = await getCurrentPhaseForRound(client, round.id);
      if (!phaseInfo || phaseInfo.phase !== PHASES.CERTIFICATE) {
        throw new Error(`Signed upload is allowed only in CERTIFICATE phase (current phase: ${phaseInfo?.phase || 'NONE'})`);
      }

      const certResult = await client.query(
        `SELECT c.ticket_id, c.certificate_number, c.template_data
         FROM certificates c
         JOIN tickets t ON t.id = c.ticket_id
         WHERE t.round_id = $1
         ORDER BY c.updated_at DESC NULLS LAST, c.id DESC`,
        [round.id]
      );
      if (certResult.rows.length === 0) {
        throw new Error('No certificates found for this round.');
      }

      const publishedFilename = `certificate-published-round-${round.id}-${Date.now()}.pdf`;
      const publishedPath = path.join(certificateDir, publishedFilename);
      fs.renameSync(req.file.path, publishedPath);

      const latestByTicket = new Map();
      for (const row of certResult.rows) {
        if (!latestByTicket.has(row.ticket_id)) {
          latestByTicket.set(row.ticket_id, row);
        }
      }

      const inserted = [];
      for (const [ticketId, row] of latestByTicket.entries()) {
        const insertResult = await client.query(
          `INSERT INTO certificates (ticket_id, certificate_number, status, pdf_path, published_by, published_at, template_data)
           VALUES ($1, $2, $3::certificate_status, $4, $5, NOW(), $6::jsonb)
           RETURNING id`,
          [
            ticketId,
            row.certificate_number || null,
            CERTIFICATE_STATUS.PUBLISHED,
            publishedPath,
            req.session.user_id,
            JSON.stringify(row.template_data || {})
          ]
        );
        inserted.push({ id: insertResult.rows[0].id, ticket_id: ticketId });
      }

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.CERTIFICATE_PUBLISH, {
        resourceType: 'certificate',
        resourceId: inserted[0]?.id || null,
        newValues: {
          round_id: round.id,
          published_count: inserted.length,
          file_path: publishedPath
        }
      });

      return {
        round,
        certificateId: inserted[0]?.id || null
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Published certificate package uploaded successfully',
      round: {
        id: result.round.id,
        academic_year: result.round.academic_year,
        semester: result.round.semester,
        name: result.round.name
      },
      download_url: result.certificateId ? `/api/certificates/${result.certificateId}/download` : null
    });
  } catch (error) {
    console.error('Upload published certificates error:', error);
    return res.status(400).json({ message: error.message || 'Error uploading published certificate package' });
  }
});

// POST /api/certificates/:id/publish - Publish (admin)
router.post('/:id/publish', requireAdmin, async (req, res) => {
  const certificateId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(certificateId)) {
    return res.status(400).json({ message: 'Invalid certificate id' });
  }

  try {
    const result = await transaction(async (client) => {
      const current = await client.query(
        `SELECT id
         FROM certificates
         WHERE id = $1`,
        [certificateId]
      );
      if (current.rows.length === 0) {
        throw new Error('Certificate not found');
      }

      await client.query(
        `UPDATE certificates
         SET status = $1::certificate_status,
             published_by = $2,
             published_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [CERTIFICATE_STATUS.PUBLISHED, req.session.user_id, certificateId]
      );

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.CERTIFICATE_PUBLISH, {
        resourceType: 'certificate',
        resourceId: certificateId,
        newValues: {
          status: CERTIFICATE_STATUS.PUBLISHED
        }
      });

      return { id: certificateId };
    });

    return res.status(200).json({
      success: true,
      message: 'Certificate published successfully',
      certificate_id: result.id
    });
  } catch (error) {
    console.error('Publish certificate error:', error);
    return res.status(400).json({ message: error.message || 'Error publishing certificate' });
  }
});

// GET /api/certificates/:id/download - Download
router.get('/:id/download', requireAuth, async (req, res) => {
  const certificateId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(certificateId)) {
    return res.status(400).json({ message: 'Invalid certificate id' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT
           c.id,
           c.pdf_path,
           c.certificate_number,
           c.ticket_id,
           t.user_id
         FROM certificates c
         JOIN tickets t ON t.id = c.ticket_id
         WHERE c.id = $1`,
        [certificateId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Certificate not found' });
      }

      const certificate = result.rows[0];
      const canDownload =
        isAdmin(req.userRoles) || isPresident(req.userRoles) || Number(certificate.user_id) === Number(req.session.user_id);
      if (!canDownload) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (!certificate.pdf_path || !fs.existsSync(certificate.pdf_path)) {
        return res.status(404).json({ message: 'Certificate file not found' });
      }

      const filename = `${certificate.certificate_number || `certificate-${certificate.id}`}.pdf`;
      return res.download(certificate.pdf_path, filename);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Download certificate error:', error);
    return res.status(500).json({ message: 'Error downloading certificate' });
  }
});

// GET /api/certificates/:id/view - Inline preview (PDF)
router.get('/:id/view', requireAuth, async (req, res) => {
  const certificateId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(certificateId)) {
    return res.status(400).json({ message: 'Invalid certificate id' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT
           c.id,
           c.pdf_path,
           c.certificate_number,
           c.ticket_id,
           t.user_id
         FROM certificates c
         JOIN tickets t ON t.id = c.ticket_id
         WHERE c.id = $1`,
        [certificateId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Certificate not found' });
      }

      const certificate = result.rows[0];
      const canView =
        isAdmin(req.userRoles) || isPresident(req.userRoles) || Number(certificate.user_id) === Number(req.session.user_id);
      if (!canView) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (!certificate.pdf_path || !fs.existsSync(certificate.pdf_path)) {
        return res.status(404).json({ message: 'Certificate file not found' });
      }

      const filename = `${certificate.certificate_number || `certificate-${certificate.id}`}.pdf`;
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/pdf');
      return res.sendFile(certificate.pdf_path);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('View certificate error:', error);
    return res.status(500).json({ message: 'Error viewing certificate' });
  }
});

module.exports = router;




