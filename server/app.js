/**
 * Express Application Setup
 * Nisit Deeden System - Outstanding Student Selection
 */

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Configuration
const sessionConfig = require('./src/config/session');
const passport = require('./src/config/passport');

// Routes
const authRoutes = require('./src/routes/auth');
const ticketRoutes = require('./src/routes/tickets');
const adminRoutes = require('./src/routes/admin');
const voteRoutes = require('./src/routes/votes');
const uploadRoutes = require('./src/routes/uploads');
const certificateRoutes = require('./src/routes/certificates');

const app = express();

// ==================== Middleware ====================

// Security
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

// CORS
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174', 
      'http://localhost:5175',
      'http://localhost:5176',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5175',
      'http://127.0.0.1:5176'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session
app.use(session(sessionConfig));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ==================== Routes ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/certificates', certificateRoutes);

// Get current phase (public endpoint)
app.get('/api/phase/current', async (req, res) => {
  try {
    const { pool } = require('./src/config/database');
    const {
      getRoundByAcademic,
      getActiveRound,
      getCurrentPhaseForRound
    } = require('./src/services/roundPhase');

    const client = await pool.connect();
    try {
      const year = Number.parseInt(req.query.year, 10);
      const semester = Number.parseInt(req.query.semester, 10);

      let round = null;
      if (!Number.isNaN(year) && [1, 2].includes(semester)) {
        round = await getRoundByAcademic(client, year, semester);
      } else {
        round = await getActiveRound(client);
      }

      if (!round) {
        return res.status(404).json({
          success: false,
          message: 'No active round found',
        });
      }

      const phase = await getCurrentPhaseForRound(client, round.id);
      if (!phase) {
        return res.status(404).json({
          success: false,
          message: 'No active phase found for round',
          round: {
            id: round.id,
            academic_year: round.academic_year,
            semester: round.semester,
            name: round.name
          }
        });
      }

      return res.json({
        success: true,
        round: {
          id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          name: round.name
        },
        phase: {
          phase: phase.phase,
          started_at: phase.started_at,
          started_by: phase.started_by,
          notes: phase.notes || null
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get current phase error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// ==================== Error Handling ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.path 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
