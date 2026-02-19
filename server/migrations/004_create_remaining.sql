-- Migration 004: Files, Votes, Logs, Certificates

CREATE TABLE IF NOT EXISTS ticket_files (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_category VARCHAR(50),
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    deleted_by INTEGER REFERENCES users(id)
);

CREATE INDEX idx_ticket_files_ticket_id ON ticket_files(ticket_id);
CREATE INDEX idx_ticket_files_active ON ticket_files(ticket_id) WHERE deleted_at IS NULL;

CREATE TYPE vote_choice AS ENUM ('approved', 'not_approved');

CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    vote vote_choice NOT NULL,
    notes TEXT,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ticket_id, user_id)
);

CREATE INDEX idx_votes_ticket_id ON votes(ticket_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);

CREATE OR REPLACE FUNCTION update_ticket_vote_count()
RETURNS TRIGGER AS \$\$
BEGIN
    UPDATE tickets
    SET 
        total_votes = (SELECT COUNT(*) FROM votes WHERE ticket_id = COALESCE(NEW.ticket_id, OLD.ticket_id)),
        approved_votes = (SELECT COUNT(*) FROM votes WHERE ticket_id = COALESCE(NEW.ticket_id, OLD.ticket_id) AND vote = 'approved'),
        vote_percentage = (
            SELECT CASE WHEN COUNT(*) = 0 THEN 0
                   ELSE ROUND((COUNT(*) FILTER (WHERE vote = 'approved') * 100.0 / COUNT(*)), 2)
                   END
            FROM votes WHERE ticket_id = COALESCE(NEW.ticket_id, OLD.ticket_id)
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.ticket_id, OLD.ticket_id);
    RETURN COALESCE(NEW, OLD);
END;
\$\$ LANGUAGE plpgsql;

CREATE TRIGGER update_votes_count_insert AFTER INSERT ON votes
    FOR EACH ROW EXECUTE FUNCTION update_ticket_vote_count();
CREATE TRIGGER update_votes_count_update AFTER UPDATE ON votes
    FOR EACH ROW EXECUTE FUNCTION update_ticket_vote_count();
CREATE TRIGGER update_votes_count_delete AFTER DELETE ON votes
    FOR EACH ROW EXECUTE FUNCTION update_ticket_vote_count();

CREATE TYPE log_action AS ENUM (
    'user_login', 'user_logout', 'user_register', 'ticket_create', 'ticket_update',
    'ticket_accept', 'ticket_reject', 'ticket_expire', 'vote_submit', 'vote_update',
    'phase_change', 'file_upload', 'file_delete', 'certificate_generate',
    'certificate_sign', 'certificate_publish', 'admin_action'
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

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE TYPE certificate_status AS ENUM ('draft', 'signed', 'published');

CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    certificate_number VARCHAR(50) UNIQUE NOT NULL,
    status certificate_status DEFAULT 'draft',
    pdf_path TEXT,
    generated_by INTEGER NOT NULL REFERENCES users(id),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    signed_by INTEGER REFERENCES users(id),
    signed_at TIMESTAMP,
    published_by INTEGER REFERENCES users(id),
    published_at TIMESTAMP,
    template_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_certificates_ticket_id ON certificates(ticket_id);
CREATE INDEX idx_certificates_status ON certificates(status);
CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
