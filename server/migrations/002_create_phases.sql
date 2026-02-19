-- Migration 002: Create Phases Table
-- ระบบจัดการ phase ของการคัดเลือก (State Machine)

CREATE TYPE phase_status AS ENUM (
    'NOMINATION',      -- เปิดรับสมัคร
    'REVIEW_END',      -- ปิดรับสมัคร/รอตรวจสอบ
    'VOTING',          -- เปิดโหวต
    'VOTING_END',      -- ปิดโหวต
    'CERTIFICATE'      -- ออกใบประกาศ
);

CREATE TABLE IF NOT EXISTS phases (
    id SERIAL PRIMARY KEY,
    phase phase_status UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    started_by INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- ต้องมี phase active เพียง 1 phase เท่านั้น
    CONSTRAINT only_one_active_phase UNIQUE NULLS NOT DISTINCT (is_active)
);

-- Insert default phases
INSERT INTO phases (phase, is_active, notes) VALUES
('NOMINATION', true, 'ระยะรับสมัครเริ่มต้น'),
('REVIEW_END', false, 'รอเปิดใช้งาน'),
('VOTING', false, 'รอเปิดใช้งาน'),
('VOTING_END', false, 'รอเปิดใช้งาน'),
('CERTIFICATE', false, 'รอเปิดใช้งาน')
ON CONFLICT (phase) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_phases_active ON phases(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_phases_phase ON phases(phase);

-- Create trigger for auto-update updated_at
CREATE TRIGGER update_phases_updated_at
    BEFORE UPDATE ON phases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to get current phase
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

-- Create function to set active phase
CREATE OR REPLACE FUNCTION set_active_phase(new_phase phase_status, admin_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    -- Deactivate all phases
    UPDATE phases SET is_active = false WHERE is_active = true;
    
    -- Activate new phase
    UPDATE phases 
    SET 
        is_active = true,
        started_at = CURRENT_TIMESTAMP,
        started_by = admin_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE phase = new_phase;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE phases IS 'ตารางจัดการ phase/ระยะของการคัดเลือก (State Machine)';
COMMENT ON FUNCTION get_current_phase() IS 'ฟังก์ชันดึง phase ปัจจุบัน';
COMMENT ON FUNCTION set_active_phase(phase_status, INTEGER) IS 'ฟังก์ชันเปลี่ยน phase';
