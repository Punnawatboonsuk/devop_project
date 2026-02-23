-- Add google_id field to users table for Google OAuth support
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_profile_picture TEXT;

-- Create index on google_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Add comment to document the field
COMMENT ON COLUMN users.google_id IS 'Google OAuth user identifier for SSO authentication';
COMMENT ON COLUMN users.google_profile_picture IS 'Google profile picture URL for display';