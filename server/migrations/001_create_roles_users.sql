-- Migration 001: Roles & Users with Multi-Role Support

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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- สร้าง user_roles table (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),
    UNIQUE(user_id, role_id)
);

-- สร้าง indexes
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

-- ลบ trigger เก่าก่อน แล้วสร้างใหม่
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();