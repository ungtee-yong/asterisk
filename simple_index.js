const express = require('express');
const winston = require('winston');
const SimpleAEPClient = require('./simple_aep_client');
const Database = require('./database');

// ตั้งค่า logging
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'simple-asterisk-aep-client' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// สร้าง Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// เริ่มต้น components
const database = new Database();
const aepClient = new SimpleAEPClient(
    process.env.ASTERISK_HOST || '127.0.0.1',
    parseInt(process.env.ASTERISK_AEP_PORT) || 4573
);

// Event handlers สำหรับ AEP Client
aepClient.on('connected', () => {
    logger.info('✅ เชื่อมต่อกับ Asterisk AEP สำเร็จ');
    
    // ยืนยันตัวตนกับ Asterisk
    aepClient.authenticate(process.env.AEP_SECRET || 'aeap_secret_key_123')
        .then(() => {
            logger.info('✅ ยืนยันตัวตนกับ Asterisk สำเร็จ');
        })
        .catch(error => {
            logger.error('❌ ยืนยันตัวตนล้มเหลว:', error);
        });
});

aepClient.on('disconnected', () => {
    logger.warn('❌ การเชื่อมต่อกับ Asterisk AEP ถูกตัด');
});

aepClient.on('error', (error) => {
    logger.error('❌ ข้อผิดพลาด AEP Client:', error);
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            aep: {
                connected: aepClient.connected,
                authenticated: aepClient.authenticated
            },
            currentChannel: aepClient.currentChannel
        });
    } catch (error) {
        logger.error('❌ Health check ล้มเหลว:', error);
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// API endpoints
app.get('/api/status', (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                connected: aepClient.connected,
                authenticated: aepClient.authenticated,
                currentChannel: aepClient.currentChannel
            }
        });
    } catch (error) {
        logger.error('❌ ข้อผิดพลาดในการดึงสถานะ:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/connect', async (req, res) => {
    try {
        if (aepClient.connected) {
            res.json({ success: true, message: 'เชื่อมต่ออยู่แล้ว' });
            return;
        }

        await aepClient.connect();
        res.json({ success: true, message: 'เชื่อมต่อกับ Asterisk สำเร็จ' });
    } catch (error) {
        logger.error('❌ ข้อผิดพลาดในการเชื่อมต่อ AEP:', error);
        res.status(500).json({ error: 'ไม่สามารถเชื่อมต่อกับ Asterisk ได้' });
    }
});

app.post('/api/disconnect', (req, res) => {
    try {
        aepClient.disconnect();
        res.json({ success: true, message: 'ตัดการเชื่อมต่อกับ Asterisk สำเร็จ' });
    } catch (error) {
        logger.error('❌ ข้อผิดพลาดในการตัดการเชื่อมต่อ AEP:', error);
        res.status(500).json({ error: 'ไม่สามารถตัดการเชื่อมต่อกับ Asterisk ได้' });
    }
});

// หน้าแรก
app.get('/', (req, res) => {
    res.json({
        message: 'Simple Asterisk AEP Client',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            status: '/api/status',
            connect: 'POST /api/connect',
            disconnect: 'POST /api/disconnect'
        }
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('❌ ข้อผิดพลาดที่ไม่ได้จัดการ:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// เริ่ม HTTP server
const server = app.listen(port, () => {
    logger.info(`🚀 Simple Asterisk AEP Client ทำงานบนพอร์ต ${port}`);
});

// เชื่อมต่อกับ Asterisk AEP
aepClient.connect().catch(error => {
    logger.error('❌ ไม่สามารถเชื่อมต่อกับ Asterisk AEP ได้:', error);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    logger.info(`📴 รับสัญญาณ ${signal}. เริ่มการปิดระบบอย่างปลอดภัย...`);
    
    server.close(() => {
        logger.info('✅ HTTP server ปิดแล้ว');
    });
    
    aepClient.disconnect();
    
    database.close().then(() => {
        logger.info('✅ การเชื่อมต่อฐานข้อมูลปิดแล้ว');
        process.exit(0);
    });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = app;