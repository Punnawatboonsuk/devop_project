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
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session
app.use(session(sessionConfig));

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
    const { query } = require('./src/config/database');
    const result = await query(
      'SELECT phase, is_active, started_at FROM phases WHERE is_active = true LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active phase found',
      });
    }

    return res.json({
      success: true,
      phase: result.rows[0],
    });
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