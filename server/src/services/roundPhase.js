const PHASE_SEQUENCE = [
  'NOMINATION',
  'REVIEW_END',
  'VOTING',
  'VOTING_END',
  'CERTIFICATE'
];

function isValidPhase(phase) {
  return PHASE_SEQUENCE.includes(phase);
}

function canAdvance(currentPhase, nextPhase) {
  if (!isValidPhase(nextPhase)) return false;
  if (!currentPhase) return nextPhase === 'NOMINATION';
  const currentIndex = PHASE_SEQUENCE.indexOf(currentPhase);
  return PHASE_SEQUENCE[currentIndex + 1] === nextPhase;
}

async function getRoundById(client, roundId) {
  const result = await client.query(
    `SELECT id, academic_year, semester, name, created_at
     FROM selection_round
     WHERE id = $1`,
    [roundId]
  );
  return result.rows[0] || null;
}

async function getRoundByAcademic(client, academicYear, semester) {
  const result = await client.query(
    `SELECT id, academic_year, semester, name, created_at
     FROM selection_round
     WHERE academic_year = $1 AND semester = $2`,
    [academicYear, semester]
  );
  return result.rows[0] || null;
}

async function getOrCreateRound(client, academicYear, semester) {
  const result = await client.query(
    `INSERT INTO selection_round (academic_year, semester, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (academic_year, semester)
     DO UPDATE SET name = EXCLUDED.name
     RETURNING id, academic_year, semester, name, created_at`,
    [academicYear, semester, `Nisit Deeden ${academicYear} S${semester}`]
  );
  return result.rows[0];
}

async function getCurrentPhaseForRound(client, roundId) {
  const result = await client.query(
    `SELECT phase, started_at, started_by, notes
     FROM round_phase_history
     WHERE round_id = $1
       AND ended_at IS NULL
     LIMIT 1`,
    [roundId]
  );
  return result.rows[0] || null;
}

async function getActiveRound(client) {
  const openResult = await client.query(
    `SELECT sr.id, sr.academic_year, sr.semester, sr.name, sr.created_at
     FROM selection_round sr
     JOIN round_phase_history rph ON rph.round_id = sr.id
     WHERE rph.ended_at IS NULL
     ORDER BY sr.academic_year DESC, sr.semester DESC, rph.started_at DESC
     LIMIT 1`
  );
  const openRound = openResult.rows[0] || null;

  const latestResult = await client.query(
    `SELECT sr.id, sr.academic_year, sr.semester, sr.name, sr.created_at
     FROM selection_round sr
     ORDER BY sr.academic_year DESC, sr.semester DESC, sr.created_at DESC
     LIMIT 1`
  );
  const latestRound = latestResult.rows[0] || null;

  if (!openRound) return latestRound;
  if (!latestRound) return openRound;

  const openKey = [openRound.academic_year, openRound.semester];
  const latestKey = [latestRound.academic_year, latestRound.semester];

  if (latestKey[0] > openKey[0]) return latestRound;
  if (latestKey[0] === openKey[0] && latestKey[1] > openKey[1]) return latestRound;
  return openRound;
}

async function ensureInitialNominationPhase(client, roundId, startedBy = null, notes = null) {
  const current = await getCurrentPhaseForRound(client, roundId);
  if (current) return current;

  await client.query(
    `INSERT INTO round_phase_history (round_id, phase, started_by, notes)
     VALUES ($1, 'NOMINATION', $2, $3)`,
    [roundId, startedBy, notes]
  );

  return getCurrentPhaseForRound(client, roundId);
}

async function advancePhase(client, roundId, nextPhase, userId = null, notes = null) {
  if (!isValidPhase(nextPhase)) {
    throw new Error(`Invalid phase: ${nextPhase}`);
  }

  const current = await getCurrentPhaseForRound(client, roundId);
  const currentPhase = current?.phase || null;

  if (!canAdvance(currentPhase, nextPhase)) {
    throw new Error(`Invalid phase transition from ${currentPhase || 'NONE'} to ${nextPhase}`);
  }

  await client.query(
    'SELECT advance_round_phase($1, $2::phase_status, $3, $4)',
    [roundId, nextPhase, userId, notes]
  );

  return getCurrentPhaseForRound(client, roundId);
}

module.exports = {
  PHASE_SEQUENCE,
  isValidPhase,
  canAdvance,
  getRoundById,
  getRoundByAcademic,
  getOrCreateRound,
  getCurrentPhaseForRound,
  getActiveRound,
  ensureInitialNominationPhase,
  advancePhase
};
