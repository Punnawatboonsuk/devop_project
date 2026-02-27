const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { pool, transaction } = require('../config/database');
const { ROLES, PHASES, CERTIFICATE_STATUS, LOG_ACTIONS } = require('../utils/constants');
const { getRoundById, getRoundByAcademic, getActiveRound, getCurrentPhaseForRound } = require('../services/roundPhase');

const router = express.Router();

const certificateDir = path.resolve(process.cwd(), 'uploads', 'certificates');
if (!fs.existsSync(certificateDir)) {
  fs.mkdirSync(certificateDir, { recursive: true });
}

const AWARD_SECTION_TITLES = {
  good_behavior: 'เธเธดเธชเธดเธ•เธ—เธตเนเธกเธตเธเธงเธฒเธกเธเธฃเธฐเธเธคเธ•เธดเธ”เธตเน€เธ”เนเธ',
  activity_enrichment: 'เธเธดเธชเธดเธ•เธ—เธตเนเธกเธตเธเธฅเธเธฒเธเธ”เธตเน€เธ”เนเธเธ”เนเธฒเธเธเธดเธเธเธฃเธฃเธกเน€เธชเธฃเธดเธกเธซเธฅเธฑเธเธชเธนเธ•เธฃ',
  creativity_innovation: 'เธเธดเธชเธดเธ•เธ—เธตเนเธกเธตเธเธฅเธเธฒเธเธ”เธตเน€เธ”เนเธเธ”เนเธฒเธเธเธงเธฒเธกเธเธดเธ”เธชเธฃเนเธฒเธเธชเธฃเธฃเธเนเนเธฅเธฐเธเธงเธฑเธ•เธเธฃเธฃเธก',
  moral_ethics: 'เธเธดเธชเธดเธ•เธ—เธตเนเธกเธตเธเธงเธฒเธกเธเธฃเธฐเธเธคเธ•เธดเธ”เธตเน€เธ”เนเธ',
  social_service: 'เธเธดเธชเธดเธ•เธ—เธตเนเธกเธตเธเธฅเธเธฒเธเธ”เธตเน€เธ”เนเธเธ”เนเธฒเธเธเธณเน€เธเนเธเธเธฃเธฐเนเธขเธเธเน',
  innovation: 'เธเธดเธชเธดเธ•เธ—เธตเนเธกเธตเธเธฅเธเธฒเธเธ”เธตเน€เธ”เนเธเธ”เนเธฒเธเธเธงเธฑเธ•เธเธฃเธฃเธก'
};

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

function createCertificatePdf({ filePath, round, winners, presidentSignaturePath = null, thaiFontPath }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 72 });
    const stream = fs.createWriteStream(filePath);

    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.on('error', reject);

    doc.pipe(stream);
    doc.font(thaiFontPath);

    const pageBottom = () => doc.page.height - doc.page.margins.bottom;
    const ensureSpace = (needed = 24) => {
      if (doc.y + needed > pageBottom()) {
        doc.addPage();
        doc.font(thaiFontPath);
      }
    };

    const sortedWinners = [...winners].sort((a, b) => {
      const aa = String(a.award_type || '');
      const bb = String(b.award_type || '');
      if (aa !== bb) return aa.localeCompare(bb);
      return String(a.fullname || '').localeCompare(String(b.fullname || ''));
    });

    const groups = new Map();
    for (const winner of sortedWinners) {
      const key = String(winner.award_type || 'other');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(winner);
    }

    doc.fontSize(18).text(`ประกาศรายชื่อนิสิตดีเด่นภายในคณะฯ ประจำปีการศึกษา ${round.academic_year}`, {
      align: 'center'
    });
    doc.fontSize(17).text(`ภาคเรียนที่ ${round.semester}`, { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(14).text('มหาวิทยาลัยเกษตรศาสตร์', { align: 'center' });
    doc.moveDown(1.1);

    const nameX = doc.page.margins.left;
    const facultyX = doc.page.width * 0.56;
    const rowHeight = 22;

    for (const [awardType, rows] of groups.entries()) {
      ensureSpace(46);
      const sectionTitle = AWARD_SECTION_TITLES[awardType] || `นิสิตดีเด่นประเภท ${awardType}`;
      doc.moveDown(0.6);
      doc.fontSize(15).text(sectionTitle, { align: 'center' });
      doc.moveDown(0.45);

      for (const row of rows) {
        ensureSpace(rowHeight + 4);
        const fullName = withHonorific(row.fullname, row.gender);
        const facultyName = String(row.faculty || '-');
        const nameWidth = Math.max(120, facultyX - nameX - 18);
        const facultyWidth = doc.page.width - doc.page.margins.right - facultyX;

        doc.fontSize(14).text(fullName, nameX, doc.y, {
          width: nameWidth,
          lineBreak: false
        });
        doc.fontSize(14).text(facultyName, facultyX, doc.y, {
          width: facultyWidth,
          lineBreak: false
        });
        doc.moveDown(1);
      }
      doc.moveDown(0.7);
    }

    ensureSpace(115);
    doc.moveDown(1.6);
    doc.fontSize(14).text('ประธานคณะกรรมการคัดเลือกนิสิตดีเด่น', { align: 'right' });
    doc.moveDown(0.3);
    if (presidentSignaturePath && fs.existsSync(presidentSignaturePath)) {
      try {
        const signX = doc.page.width - doc.page.margins.right - 170;
        doc.image(presidentSignaturePath, signX, doc.y, { fit: [160, 70], align: 'right' });
        doc.moveDown(3.2);
      } catch {
        doc.moveDown(2.5);
      }
    } else {
      doc.moveDown(2.5);
    }
    doc.fontSize(14).text('(....................................................)', { align: 'right' });
    doc.fontSize(13).text('ลงนามเพื่อเสนออธิการบดีพิจารณาประกาศผล', { align: 'right' });

    doc.end();
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
          `SELECT id
           FROM certificates
           WHERE ticket_id = $1
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

        if (existing.rows.length > 0) {
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

module.exports = router;




