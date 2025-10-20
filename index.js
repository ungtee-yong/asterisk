const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const AEPServer = require('./aep_server');
const Database = require('./config/database');

// Configure logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'callcenter-api' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});

// Initialize database
const database = new Database();

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check database connection
        const branchInfo = await database.getBranchExtension('test');
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
            aep: 'running'
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// API endpoints
app.get('/api/branches', async (req, res) => {
    try {
        // This would need to be implemented in Database class
        res.json({ message: 'Branches endpoint - to be implemented' });
    } catch (error) {
        logger.error('Error fetching branches:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/call-logs', async (req, res) => {
    try {
        // This would need to be implemented in Database class
        res.json({ message: 'Call logs endpoint - to be implemented' });
    } catch (error) {
        logger.error('Error fetching call logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/call-logs', async (req, res) => {
    try {
        const callData = req.body;
        const result = await database.logCall(callData);
        res.json({ success: result });
    } catch (error) {
        logger.error('Error logging call:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start AEP Server
const aepServer = new AEPServer(4573, '0.0.0.0');
aepServer.start();

// Start HTTP server
const server = app.listen(port, () => {
    logger.info(`Call Center API server running on port ${port}`);
    logger.info(`AEP Server running on port 4573`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
        logger.info('HTTP server closed');
    });
    
    aepServer.stop();
    
    database.close().then(() => {
        logger.info('Database connection closed');
        process.exit(0);
    });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = app;