-- Migration 001: Create Roles and Users Tables (Multi-Role Support)
-- สร้าง tables สำหรับจัดการ users และ roles แบบ many-to-many

-- สร้าง roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert 7 default roles
INSERT INTO roles (name, description) VALUES
('STUDENT', 'นิสิตที่สามารถสมัครเข้าร่วมการคัดเลือก'),
('STAFF', 'เจ้าหน้าที่ที่ตรวจสอบและรับรองเอกสาร'),
('SUB_DEAN', 'รองคณบดีที่อนุมัติการสมัคร'),
('DEAN', 'คณบดีที่อนุมัติขั้นสุดท้าย'),
('COMMITTEE', 'กรรมการที่มีสิทธิ์ลงคะแนนโหวต'),
('COMMITTEE_PRESIDENT', 'ประธานกรรมการที่เซ็นเอกสาร'),
('ADMIN', 'ผู้ดูแลระบบที่ควบคุมทุกอย่าง')
ON CONFLICT (name) DO NOTHING;

-- สร้าง users table
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

-- สร้าง user_roles table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),
    
    UNIQUE(user_id, role_id)
);

-- สร้าง indexes สำหรับ performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_ku_id ON users(ku_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- สร้าง function สำหรับ auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง trigger สำหรับ users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- สร้าง view สำหรับดูข้อมูล user พร้อม roles
CREATE OR REPLACE VIEW user_roles_view AS
SELECT 
    u.id,
    u.ku_id,
    u.email,
    u.fullname,
    u.faculty,
    u.department,
    u.sso_enabled,
    u.last_login,
    u.created_at,
    array_agg(r.name) as roles,
    array_agg(r.id) as role_ids
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
GROUP BY u.id, u.ku_id, u.email, u.fullname, u.faculty, u.department, u.sso_enabled, u.last_login, u.created_at;

COMMENT ON TABLE roles IS 'ตารางเก็บบทบาทของผู้ใช้ในระบบ';
COMMENT ON TABLE users IS 'ตารางเก็บข้อมูลผู้ใช้ รองรับ KU SSO และ password-based login';
COMMENT ON TABLE user_roles IS 'ตารางเชื่อมโยง users และ roles (many-to-many)';
