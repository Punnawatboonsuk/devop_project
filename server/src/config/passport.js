const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { pool, transaction } = require('./database');

// Helper function to validate KU email
function validateKuEmail(email) {
  const kuPattern = /^[a-zA-Z0-9._%+-]+@(ku\.th|live\.ku\.th)$/;
  return kuPattern.test(email);
}

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Extract email and other profile information
    const email = profile.emails?.[0]?.value?.toLowerCase();
    const fullname = profile.displayName;
    const googleId = profile.id;
    const profilePicture = profile.photos?.[0]?.value;

    // Validate that the email is a KU email
    if (!email || !validateKuEmail(email)) {
      return done(null, false, { 
        message: 'Only KU email addresses (@ku.th or @live.ku.th) are allowed for Google SSO' 
      });
    }

    // Check if user already exists by google_id or email
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [googleId, email]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      
      // Update profile picture if provided
      if (profilePicture && user.google_profile_picture !== profilePicture) {
        await pool.query(
          'UPDATE users SET google_profile_picture = $1, last_login = NOW() WHERE id = $2',
          [profilePicture, user.id]
        );
      } else {
        // Update last login
        await pool.query(
          'UPDATE users SET last_login = NOW() WHERE id = $1',
          [user.id]
        );
      }

      // Get user roles
      const rolesResult = await pool.query(
        `SELECT r.name 
         FROM user_roles ur 
         JOIN roles r ON ur.role_id = r.id 
         WHERE ur.user_id = $1`,
        [user.id]
      );
      
      const roles = rolesResult.rows.map(row => row.name);
      const primaryRole = getPrimaryRole(roles);

      return done(null, { ...user, roles, primary_role: primaryRole });
    }

    // Create new user if doesn't exist
    const newUser = await transaction(async (client) => {
      // Get STUDENT role id
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        ['STUDENT']
      );

      if (roleResult.rows.length === 0) {
        throw new Error('STUDENT role not found in database');
      }

      const studentRoleId = roleResult.rows[0].id;

      // Insert new user with Google OAuth info
      const insertResult = await client.query(
        `INSERT INTO users
        (email, fullname, google_id, google_profile_picture, sso_enabled, last_login)
        VALUES ($1, $2, $3, $4, true, NOW())
        RETURNING *`,
        [email, fullname, googleId, profilePicture]
      );

      const user = insertResult.rows[0];

      // Assign STUDENT role
      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [user.id, studentRoleId]
      );

      return user;
    });

    // Get user roles for new user
    const rolesResult = await pool.query(
      `SELECT r.name 
       FROM user_roles ur 
       JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = $1`,
      [newUser.id]
    );
    
    const roles = rolesResult.rows.map(row => row.name);
    const primaryRole = getPrimaryRole(roles);

    return done(null, { ...newUser, roles, primary_role: primaryRole });

  } catch (error) {
    console.error('Google OAuth error:', error);
    return done(error, null);
  }
}));

// Helper function to get primary role (highest priority)
function getPrimaryRole(roles) {
  const roleHierarchy = [
    'ADMIN',
    'COMMITTEE_PRESIDENT',
    'DEAN',
    'SUB_DEAN',
    'COMMITTEE',
    'STAFF',
    'STUDENT'
  ];
  
  for (const role of roleHierarchy) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return 'STUDENT';
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const user = result.rows[0];
    
    if (user) {
      // Get user roles
      const rolesResult = await pool.query(
        `SELECT r.name 
         FROM user_roles ur 
         JOIN roles r ON ur.role_id = r.id 
         WHERE ur.user_id = $1`,
        [user.id]
      );
      
      const roles = rolesResult.rows.map(row => row.name);
      const primaryRole = getPrimaryRole(roles);

      done(null, { ...user, roles, primary_role: primaryRole });
    } else {
      done(null, false);
    }
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;