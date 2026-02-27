/**
 * Set Round Phase Script
 *
 * Usage:
 *   node scripts/setPhase.js [ACADEMIC_YEAR] [SEMESTER] [PHASE_NAME] [USER_ID(optional)]
 *
 * Example:
 *   node scripts/setPhase.js 2025 1 VOTING 13
 */

const { query } = require('../src/config/database');
const { PHASES, PHASE_TRANSITIONS } = require('../src/utils/constants');

async function setPhase(academicYear, semester, newPhase, userId = null) {
  try {
    console.log(`Setting phase for ${academicYear} S${semester} to: ${newPhase}`);

    if (!Object.values(PHASES).includes(newPhase)) {
      console.error(`Invalid phase: ${newPhase}`);
      console.error(`Available phases: ${Object.values(PHASES).join(', ')}`);
      process.exit(1);
    }

    const roundResult = await query(
      `INSERT INTO selection_round (academic_year, semester, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (academic_year, semester)
       DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [academicYear, semester, `Nisit Deeden ${academicYear} S${semester}`]
    );
    const roundId = roundResult.rows[0].id;

    const currentPhaseResult = await query(
      `SELECT phase
       FROM round_phase_history
       WHERE round_id = $1
         AND ended_at IS NULL
       LIMIT 1`,
      [roundId]
    );
    const currentPhase = currentPhaseResult.rows[0]?.phase || null;
    console.log(`Current phase: ${currentPhase || 'NONE'}`);

    if (currentPhase && PHASE_TRANSITIONS[currentPhase]) {
      const allowedTransitions = PHASE_TRANSITIONS[currentPhase];
      if (allowedTransitions && !allowedTransitions.includes(newPhase)) {
        console.error(`Cannot transition from ${currentPhase} to ${newPhase}`);
        console.error(`Allowed transitions from ${currentPhase}: ${allowedTransitions.join(', ')}`);
        process.exit(1);
      }
    } else if (!currentPhase && newPhase !== PHASES.NOMINATION) {
      console.error('First phase must be NOMINATION');
      process.exit(1);
    }

    await query(
      'SELECT advance_round_phase($1, $2::phase_status, $3, $4)',
      [roundId, newPhase, userId, 'Set from CLI script']
    );

    console.log(`Phase successfully updated to: ${newPhase}`);
  } catch (error) {
    console.error('Error setting phase:', error.message);
    process.exit(1);
  }
}

if (process.argv.length < 5 || process.argv.length > 6) {
  console.log('Usage: node scripts/setPhase.js [ACADEMIC_YEAR] [SEMESTER] [PHASE_NAME] [USER_ID(optional)]');
  console.log('Available phases:');
  Object.values(PHASES).forEach((phase) => {
    console.log(`  - ${phase}`);
  });
  process.exit(1);
}

const academicYear = Number.parseInt(process.argv[2], 10);
const semester = Number.parseInt(process.argv[3], 10);
const newPhase = process.argv[4];
const userId = process.argv[5] ? Number.parseInt(process.argv[5], 10) : null;

if (Number.isNaN(academicYear) || academicYear < 2000) {
  console.error('Invalid academic year');
  process.exit(1);
}
if (![1, 2].includes(semester)) {
  console.error('Semester must be 1 or 2');
  process.exit(1);
}
if (process.argv[5] && Number.isNaN(userId)) {
  console.error('Invalid USER_ID');
  process.exit(1);
}

setPhase(academicYear, semester, newPhase, userId);
