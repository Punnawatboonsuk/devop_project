-- Migration 003: Create Tickets Table
-- ตารางเก็บข้อมูลการสมัครคัดเลือกนิสิตดีเด่น

CREATE TYPE ticket_status AS ENUM (
    'pending',        -- รอการตรวจสอบ
    'accepted',       -- ผ่านการตรวจสอบ
    'rejected',       -- ไม่ผ่านการตรวจสอบ
    'expired',        -- หมดเวลา (ไม่ได้ส่งภายในเวลา)
    'voting',         -- อยู่ในระหว่างโหวต
    'approved',       -- ชนะการโหวต (>50%)
    'not_approved'    -- แพ้การโหวต (≤50%)
);

CREATE TYPE award_type AS ENUM (
    'academic',           -- นิสิตดีเด่นด้านวิชาการ
    'sport',              -- นิสิตดีเด่นด้านกีฬา
    'arts_culture',       -- นิสิตดีเด่นด้านศิลปวัฒนธรรม
    'moral_ethics',       -- นิสิตดีเด่นด้านคุณธรรมจริยธรรม
    'social_service',     -- นิสิตดีเด่นด้านบริการสังคม
    'innovation',         -- นิสิตดีเด่นด้านนวัตกรรม
    'entrepreneurship'    -- นิสิตดีเด่นด้านผู้ประกอบการ
);

CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    award_type award_type NOT NULL,
    academic_year VARCHAR(10) NOT NULL,
    semester INTEGER NOT NULL CHECK (semester IN (1, 2, 3)),
    status ticket_status DEFAULT 'pending',
    
    -- Form data (JSON)
    form_data JSONB DEFAULT '{}',
    
    -- Workflow tracking
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    reject_reason TEXT,
    
    -- Voting data
    vote_start_at TIMESTAMP,
    vote_end_at TIMESTAMP,
    total_votes INTEGER DEFAULT 0,
    approved_votes INTEGER DEFAULT 0,
    vote_percentage DECIMAL(5,2),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_semester CHECK (semester BETWEEN 1 AND 3),
    CONSTRAINT valid_academic_year CHECK (academic_year ~* '^\d{4}$')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_award_type ON tickets(award_type);
CREATE INDEX IF NOT EXISTS idx_tickets_academic_year ON tickets(academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_tickets_voting ON tickets(status) WHERE status = 'voting';
CREATE INDEX IF NOT EXISTS idx_tickets_form_data ON tickets USING GIN (form_data);

-- Create trigger for auto-update updated_at
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to expire pending tickets
CREATE OR REPLACE FUNCTION expire_pending_tickets()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE tickets
        SET 
            status = 'expired',
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'pending'
        AND get_current_phase() != 'NOMINATION'
        RETURNING id
    )
    SELECT COUNT(*) INTO expired_count FROM expired;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to move accepted tickets to voting
CREATE OR REPLACE FUNCTION move_tickets_to_voting()
RETURNS INTEGER AS $$
DECLARE
    moved_count INTEGER;
BEGIN
    WITH moved AS (
        UPDATE tickets
        SET 
            status = 'voting',
            vote_start_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'accepted'
        AND get_current_phase() = 'VOTING'
        RETURNING id
    )
    SELECT COUNT(*) INTO moved_count FROM moved;
    
    RETURN moved_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate vote results
CREATE OR REPLACE FUNCTION calculate_vote_results()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    WITH results AS (
        UPDATE tickets t
        SET 
            status = CASE 
                WHEN t.vote_percentage > 50 THEN 'approved'::ticket_status
                ELSE 'not_approved'::ticket_status
            END,
            vote_end_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE t.status = 'voting'
        AND get_current_phase() = 'VOTING_END'
        RETURNING id
    )
    SELECT COUNT(*) INTO updated_count FROM results;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for ticket summary
CREATE OR REPLACE VIEW ticket_summary AS
SELECT 
    t.id,
    t.user_id,
    u.fullname,
    u.ku_id,
    u.faculty,
    u.department,
    t.award_type,
    t.academic_year,
    t.semester,
    t.status,
    t.submitted_at,
    t.vote_percentage,
    COUNT(DISTINCT tf.id) as file_count,
    COUNT(DISTINCT v.id) as vote_count
FROM tickets t
JOIN users u ON t.user_id = u.id
LEFT JOIN ticket_files tf ON t.id = tf.ticket_id AND tf.deleted_at IS NULL
LEFT JOIN votes v ON t.id = v.ticket_id
GROUP BY t.id, u.id;

COMMENT ON TABLE tickets IS 'ตารางเก็บข้อมูลการสมัครคัดเลือกนิสิตดีเด่น';
COMMENT ON COLUMN tickets.form_data IS 'ข้อมูลฟอร์มเป็น JSON (flexible structure)';
COMMENT ON COLUMN tickets.vote_percentage IS 'เปอร์เซ็นต์คะแนนโหวตที่เห็นด้วย';
