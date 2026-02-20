/**
 * Session Configuration
 * Express session with PostgreSQL store
 */

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./database');

const sessionConfig = {
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'nisit-deeden-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  },
  name: 'nisit.sid'
};

module.exports = sessionConfig;