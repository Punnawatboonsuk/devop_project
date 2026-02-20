-- Migration 002: Phase Management (State Machine)

-- สร้าง enum สำหรับ phase
DO $$ BEGIN
    CREATE TYPE phase_status AS ENUM (
        'NOMINATION', 'REVIEW_END', 'VOTING', 'VOTING_END', 'CERTIFICATE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- สร้าง phases table
CREATE TABLE IF NOT EXISTS phases (
    id SERIAL PRIMARY KEY,
    phase phase_status UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    started_by INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default phases
INSERT INTO phases (phase, is_active, notes) VALUES
('NOMINATION', true, 'ระยะรับสมัครเริ่มต้น'),
('REVIEW_END', false, 'รอเปิดใช้งาน'),
('VOTING', false, 'รอเปิดใช้งาน'),
('VOTING_END', false, 'รอเปิดใช้งาน'),
('CERTIFICATE', false, 'รอเปิดใช้งาน')
ON CONFLICT (phase) DO NOTHING;

-- สร้าง index
CREATE INDEX IF NOT EXISTS idx_phases_active ON phases(is_active) WHERE is_active = true;

-- ลบ trigger เก่าก่อน
DROP TRIGGER IF EXISTS update_phases_updated_at ON phases;
CREATE TRIGGER update_phases_updated_at
    BEFORE UPDATE ON phases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- สร้าง function เพื่อดึง current phase
CREATE OR REPLACE FUNCTION get_current_phase()
RETURNS phase_status AS $$
DECLARE
    current_phase phase_status;
BEGIN
    SELECT phase INTO current_phase
    FROM phases
    WHERE is_active = true
    LIMIT 1;
    
    RETURN current_phase;
END;
$$ LANGUAGE plpgsql;