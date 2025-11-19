require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authMiddleware = require('./middleware/auth');
const auditMiddleware = require('./middleware/audit');
const apiRoutes = require('./routes/api');
const heartbeatService = require('./services/heartbeat');

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy headers from nginx/reverse proxy
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_PER_MIN) || 60,
    message: { ok: false, error: 'Too many requests, please try again later' }
});

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json());
app.use(morgan('combined'));

// Apply rate limiting to API routes
app.use('/api', limiter);

// Apply audit logging to all routes
app.use('/api', auditMiddleware);

// Health check endpoint (must be before catch-all routes)
app.get('/health', (req, res) => {
    res.json({ 
        ok: true, 
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// API routes
// Mount all routes at /api, authentication is applied per-route in the router
app.use('/api', apiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        ok: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        ok: false,
        error: 'Endpoint not found'
    });
});

// Start heartbeat monitoring service
heartbeatService.start();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    heartbeatService.stop();
    process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 MT5 Monitor Server running on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Authentication: ${process.env.ENABLE_AUTH === 'true' ? 'Enabled' : 'Disabled'}`);
    console.log(`   Heartbeat timeout: ${process.env.HEARTBEAT_TIMEOUT_SECONDS || 300}s`);
    console.log(`   Telegram notifications: ${process.env.TELEGRAM_BOT_TOKEN ? 'Enabled' : 'Disabled'}\n`);
});
