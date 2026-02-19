-- Migration 004: Create Ticket Files Table
-- ตารางเก็บไฟล์แนบของ tickets

CREATE TABLE IF NOT EXISTS ticket_files (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    deleted_by INTEGER REFERENCES users(id),
    version INTEGER DEFAULT 1,
    
    CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 10485760) -- 10MB max
);

CREATE INDEX IF NOT EXISTS idx_ticket_files_ticket_id ON ticket_files(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_files_active ON ticket_files(ticket_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE ticket_files IS 'ตารางเก็บไฟล์แนบของ tickets (รองรับ soft delete และ versioning)';

---

-- Migration 005: Create Votes Table
-- ตารางเก็บคะแนนโหวต

CREATE TYPE vote_choice AS ENUM ('approved', 'not_approved');

CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    vote vote_choice NOT NULL,
    notes TEXT,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(ticket_id, user_id) -- หนึ่งคนโหวตหนึ่ง ticket ได้แค่ครั้งเดียว
);

CREATE INDEX IF NOT EXISTS idx_votes_ticket_id ON votes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_choice ON votes(vote);

-- Trigger to update ticket vote counts
CREATE OR REPLACE FUNCTION update_ticket_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tickets
    SET 
        total_votes = (
            SELECT COUNT(*) FROM votes WHERE ticket_id = COALESCE(NEW.ticket_id, OLD.ticket_id)
        ),
        approved_votes = (
            SELECT COUNT(*) FROM votes 
            WHERE ticket_id = COALESCE(NEW.ticket_id, OLD.ticket_id) 
            AND vote = 'approved'
        ),
        vote_percentage = (
            SELECT 
                CASE 
                    WHEN COUNT(*) = 0 THEN 0
                    ELSE ROUND((COUNT(*) FILTER (WHERE vote = 'approved') * 100.0 / COUNT(*)), 2)
                END
            FROM votes 
            WHERE ticket_id = COALESCE(NEW.ticket_id, OLD.ticket_id)
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.ticket_id, OLD.ticket_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_votes_count_on_insert
    AFTER INSERT ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_vote_count();

CREATE TRIGGER update_votes_count_on_update
    AFTER UPDATE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_vote_count();

CREATE TRIGGER update_votes_count_on_delete
    AFTER DELETE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_vote_count();

COMMENT ON TABLE votes IS 'ตารางเก็บคะแนนโหวตของกรรมการ';

---

-- Migration 006: Create Audit Logs Table
-- ตารางเก็บ audit trail

CREATE TYPE log_action AS ENUM (
    'user_login',
    'user_logout',
    'user_register',
    'ticket_create',
    'ticket_update',
    'ticket_accept',
    'ticket_reject',
    'ticket_expire',
    'vote_submit',
    'vote_update',
    'phase_change',
    'file_upload',
    'file_delete',
    'certificate_generate',
    'certificate_sign',
    'certificate_publish',
    'admin_action'
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action log_action NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_jsonb ON audit_logs USING GIN (old_values, new_values);

COMMENT ON TABLE audit_logs IS 'ตารางเก็บ audit trail ของทุก actions ในระบบ';

---

-- Migration 007: Create Certificates Table
-- ตารางจัดการใบประกาศนียบัตร

CREATE TYPE certificate_status AS ENUM (
    'draft',         -- สร้างแล้วแต่ยังไม่ได้เซ็น
    'signed',        -- ประธานเซ็นแล้ว
    'published'      -- เผยแพร่แล้ว (ผู้ชนะดาวน์โหลดได้)
);

CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    certificate_number VARCHAR(50) UNIQUE NOT NULL,
    status certificate_status DEFAULT 'draft',
    
    -- File paths
    pdf_path TEXT,
    html_path TEXT,
    signed_pdf_path TEXT,
    
    -- Metadata
    generated_by INTEGER NOT NULL REFERENCES users(id),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    signed_by INTEGER REFERENCES users(id),
    signed_at TIMESTAMP,
    published_by INTEGER REFERENCES users(id),
    published_at TIMESTAMP,
    
    -- Template data
    template_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_certificates_ticket_id ON certificates(ticket_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON certificates(certificate_number);

CREATE TRIGGER update_certificates_updated_at
    BEFORE UPDATE ON certificates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE certificates IS 'ตารางจัดการใบประกาศนียบัตรนิสิตดีเด่น';
COMMENT ON COLUMN certificates.certificate_number IS 'เลขที่ใบประกาศ (unique)';
