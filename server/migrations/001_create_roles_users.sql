-- Migration 001: Roles & Users with Multi-Role Support
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (name, description) VALUES
('STUDENT', 'นิสิตที่สามารถสมัครเข้าร่วมการคัดเลือก'),
('STAFF', 'เจ้าหน้าที่ที่ตรวจสอบและรับรองเอกสาร'),
('SUB_DEAN', 'รองคณบดีที่อนุมัติการสมัคร'),
('DEAN', 'คณบดีที่อนุมัติขั้นสุดท้าย'),
('COMMITTEE', 'กรรมการที่มีสิทธิ์ลงคะแนนโหวต'),
('COMMITTEE_PRESIDENT', 'ประธานกรรมการที่เซ็นเอกสาร'),
('ADMIN', 'ผู้ดูแลระบบที่ควบคุมทุกอย่าง')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    ku_id VARCHAR(20),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    fullname VARCHAR(255) NOT NULL,
    faculty VARCHAR(255),
    department VARCHAR(255),
    sso_enabled BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@(ku\.th|live\.ku\.th)$')
);

CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),
    UNIQUE(user_id, role_id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
