const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const AEPClient = require('./aep_client');
const CallHandlers = require('./call_handlers');
const Database = require('./config/database');

// Configure logging
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'callcenter-aep-client' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
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

// Initialize components
const database = new Database();
const callHandlers = new CallHandlers();
const aepClient = new AEPClient(
    process.env.ASTERISK_HOST || '127.0.0.1',
    parseInt(process.env.ASTERISK_AEP_PORT) || 4573
);

// AEP Client event handlers
aepClient.on('connected', () => {
    logger.info('Connected to Asterisk AEP');
    
    // Authenticate with Asterisk
    aepClient.authenticate(process.env.AEP_SECRET || 'aeap_secret_key_123')
        .then(() => {
            logger.info('Authenticated with Asterisk');
        })
        .catch(error => {
            logger.error('Authentication failed:', error);
        });
});

aepClient.on('disconnected', () => {
    logger.warn('Disconnected from Asterisk AEP');
});

aepClient.on('error', (error) => {
    logger.error('AEP Client error:', error);
});

aepClient.on('maxReconnectAttemptsReached', () => {
    logger.error('Max reconnection attempts reached. Shutting down.');
    process.exit(1);
});

// Call handlers event handlers
callHandlers.on('transferCall', (data) => {
    logger.info(`Transferring call ${data.channelId} to extension ${data.extension}`);
    aepClient.sendMessage(`DIAL|${data.channelId}|${data.extension}`);
});

callHandlers.on('playAudio', (data) => {
    logger.info(`Playing audio ${data.filename} on channel ${data.channelId}`);
    aepClient.sendMessage(`PLAY|${data.channelId}|${data.filename}`);
});

callHandlers.on('recordAudio', (data) => {
    logger.info(`Recording audio ${data.filename} on channel ${data.channelId}`);
    aepClient.sendMessage(`RECORD|${data.channelId}|${data.filename}|${data.duration}|${data.silence}`);
});

// Override AEP client's handleIncomingCall to use our call handlers
aepClient.handleIncomingCall = async function(params) {
    const [channelId, callerId, calledNumber, context] = params;
    await callHandlers.handleIncomingCall(channelId, callerId, calledNumber, context);
};

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const stats = callHandlers.getCallStats();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            aep: {
                connected: aepClient.connected,
                authenticated: aepClient.authenticated
            },
            calls: stats,
            database: 'connected'
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
app.get('/api/calls', (req, res) => {
    try {
        const activeCalls = callHandlers.getActiveCalls();
        res.json({
            success: true,
            data: activeCalls
        });
    } catch (error) {
        logger.error('Error fetching calls:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        const stats = callHandlers.getCallStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/branches', async (req, res) => {
    try {
        // This would need to be implemented in Database class
        res.json({ 
            success: true,
            message: 'Branches endpoint - to be implemented',
            data: []
        });
    } catch (error) {
        logger.error('Error fetching branches:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/call-logs', async (req, res) => {
    try {
        // This would need to be implemented in Database class
        res.json({ 
            success: true,
            message: 'Call logs endpoint - to be implemented',
            data: []
        });
    } catch (error) {
        logger.error('Error fetching call logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/call-logs', async (req, res) => {
    try {
        const callData = req.body;
        const result = await database.logCall(callData);
        res.json({ 
            success: result,
            message: result ? 'Call logged successfully' : 'Failed to log call'
        });
    } catch (error) {
        logger.error('Error logging call:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// AEP control endpoints
app.post('/api/aep/connect', async (req, res) => {
    try {
        if (aepClient.connected) {
            res.json({ success: true, message: 'Already connected' });
            return;
        }

        await aepClient.connect();
        res.json({ success: true, message: 'Connected to Asterisk' });
    } catch (error) {
        logger.error('Error connecting to AEP:', error);
        res.status(500).json({ error: 'Failed to connect to Asterisk' });
    }
});

app.post('/api/aep/disconnect', (req, res) => {
    try {
        aepClient.disconnect();
        res.json({ success: true, message: 'Disconnected from Asterisk' });
    } catch (error) {
        logger.error('Error disconnecting from AEP:', error);
        res.status(500).json({ error: 'Failed to disconnect from Asterisk' });
    }
});

app.get('/api/aep/status', (req, res) => {
    res.json({
        success: true,
        data: {
            connected: aepClient.connected,
            authenticated: aepClient.authenticated,
            channels: aepClient.channels.size
        }
    });
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

// Start HTTP server
const server = app.listen(port, () => {
    logger.info(`Call Center AEP Client API server running on port ${port}`);
});

// Connect to Asterisk AEP
aepClient.connect().catch(error => {
    logger.error('Failed to connect to Asterisk AEP:', error);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
        logger.info('HTTP server closed');
    });
    
    aepClient.disconnect();
    
    database.close().then(() => {
        logger.info('Database connection closed');
        process.exit(0);
    });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = app;