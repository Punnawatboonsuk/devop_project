/**
 * Set Phase Script
 * ใช้สำหรับเปลี่ยน phase ของระบบ
 * 
 * Usage: node scripts/setPhase.js [PHASE_NAME]
 * Example: node scripts/setPhase.js VOTING
 */

const { query } = require('../src/config/database');
const { PHASES, PHASE_TRANSITIONS } = require('../src/utils/constants');

async function setPhase(newPhase) {
  try {
    console.log(`🔄 Setting phase to: ${newPhase}`);
    
    // Validate phase
    if (!Object.values(PHASES).includes(newPhase)) {
      console.error(`❌ Invalid phase: ${newPhase}`);
      console.error(`Available phases: ${Object.values(PHASES).join(', ')}`);
      process.exit(1);
    }
    
    // Get current phase
    const currentPhaseResult = await query(
      'SELECT phase FROM phases WHERE id = 1'
    );
    
    const currentPhase = currentPhaseResult.rows[0]?.phase;
    console.log(`📋 Current phase: ${currentPhase}`);
    
    // Validate transition
    if (currentPhase && PHASE_TRANSITIONS[currentPhase]) {
      const allowedTransitions = PHASE_TRANSITIONS[currentPhase];
      if (allowedTransitions && !allowedTransitions.includes(newPhase)) {
        console.error(`❌ Cannot transition from ${currentPhase} to ${newPhase}`);
        console.error(`Allowed transitions from ${currentPhase}: ${allowedTransitions.join(', ')}`);
        process.exit(1);
      }
    }
    
    // Update phase
    const result = await query(
      'UPDATE phases SET phase = $1, updated_at = NOW() WHERE id = 1 RETURNING *',
      [newPhase]
    );
    
    if (result.rows.length > 0) {
      console.log(`✅ Phase successfully updated to: ${newPhase}`);
      console.log(`📅 Updated at: ${result.rows[0].updated_at}`);
    } else {
      console.error('❌ Failed to update phase');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error setting phase:', error.message);
    process.exit(1);
  }
}

// Check command line arguments
if (process.argv.length !== 3) {
  console.log('Usage: node scripts/setPhase.js [PHASE_NAME]');
  console.log('Available phases:');
  Object.values(PHASES).forEach(phase => {
    console.log(`  - ${phase}`);
  });
  process.exit(1);
}

const newPhase = process.argv[2];
setPhase(newPhase);