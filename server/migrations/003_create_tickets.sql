-- Migration 003: Tickets

-- สร้าง enums
DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM (
        'pending', 'accepted', 'rejected', 'expired', 
        'voting', 'approved', 'not_approved'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE award_type AS ENUM (
        'academic', 'sport', 'arts_culture', 'moral_ethics',
        'social_service', 'innovation', 'entrepreneurship'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- สร้าง tickets table
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- สร้าง indexes
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_award_type ON tickets(award_type);
CREATE INDEX IF NOT EXISTS idx_tickets_academic_year ON tickets(academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_tickets_form_data ON tickets USING GIN (form_data);

-- ลบ trigger เก่าก่อน
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();