-- Migration 006: Academic Round + Phase Timeline

-- Ensure phase enum exists (for older/newer stacks)
DO $$ BEGIN
    CREATE TYPE phase_status AS ENUM (
        'NOMINATION',
        'REVIEW_END',
        'VOTING',
        'VOTING_END',
        'CERTIFICATE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Academic round identifier (year + semester)
CREATE TABLE IF NOT EXISTS selection_round (
    id SERIAL PRIMARY KEY,
    academic_year INTEGER NOT NULL,
    semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
    name TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (academic_year, semester)
);

-- Workflow phase history for each round (append-only)
CREATE TABLE IF NOT EXISTS round_phase_history (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL REFERENCES selection_round(id) ON DELETE CASCADE,
    phase phase_status NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    started_by INTEGER REFERENCES users(id),
    notes TEXT
);

-- One open phase per round
CREATE UNIQUE INDEX IF NOT EXISTS one_open_phase_per_round
ON round_phase_history (round_id)
WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_round_phase_history_round_id
ON round_phase_history (round_id, started_at DESC);

-- Phase advance helper (close current, open next)
CREATE OR REPLACE FUNCTION advance_round_phase(
    p_round_id INTEGER,
    p_next phase_status,
    p_user INTEGER DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE round_phase_history
    SET ended_at = NOW()
    WHERE round_id = p_round_id
      AND ended_at IS NULL;

    INSERT INTO round_phase_history (round_id, phase, started_by, notes)
    VALUES (p_round_id, p_next, p_user, p_notes);
END;
$$ LANGUAGE plpgsql;

-- Add round relation to business data
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS round_id INTEGER REFERENCES selection_round(id);

ALTER TABLE votes
    ADD COLUMN IF NOT EXISTS round_id INTEGER REFERENCES selection_round(id);

CREATE INDEX IF NOT EXISTS idx_tickets_round_id ON tickets(round_id);
CREATE INDEX IF NOT EXISTS idx_votes_round_id ON votes(round_id);

-- Backfill rounds from existing ticket academic context
INSERT INTO selection_round (academic_year, semester, name)
SELECT DISTINCT
    t.academic_year::INTEGER AS academic_year,
    CASE WHEN t.semester = 1 THEN 1 ELSE 2 END AS semester,
    'Nisit Deeden ' || t.academic_year || ' S' || CASE WHEN t.semester = 1 THEN 1 ELSE 2 END
FROM tickets t
WHERE t.academic_year ~ '^[0-9]+$'
ON CONFLICT (academic_year, semester) DO NOTHING;

-- Backfill ticket.round_id using year + semester mapping
UPDATE tickets t
SET round_id = sr.id
FROM selection_round sr
WHERE t.round_id IS NULL
  AND t.academic_year ~ '^[0-9]+$'
  AND sr.academic_year = t.academic_year::INTEGER
  AND sr.semester = CASE WHEN t.semester = 1 THEN 1 ELSE 2 END;

-- Backfill votes.round_id from tickets
UPDATE votes v
SET round_id = t.round_id
FROM tickets t
WHERE v.ticket_id = t.id
  AND v.round_id IS NULL
  AND t.round_id IS NOT NULL;
