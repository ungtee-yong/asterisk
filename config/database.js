const mysql = require('mysql2/promise');
require('dotenv').config();

class Database {
    constructor() {
        this.connection = null;
        this.connect();
    }

    async connect() {
        try {
            this.connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT) || 3306,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                charset: 'utf8mb4'
            });
            console.log('Database connected successfully');
        } catch (error) {
            console.error('Database connection error:', error);
            this.connection = null;
        }
    }

    async getBranchExtension(branchName) {
        if (!this.connection) {
            await this.connect();
        }

        if (!this.connection) {
            return null;
        }

        try {
            const [rows] = await this.connection.execute(
                `SELECT extension, branch_name, branch_name_th 
                 FROM branches 
                 WHERE branch_name LIKE ? 
                 OR branch_name_th LIKE ?
                 ORDER BY 
                     CASE 
                         WHEN branch_name = ? THEN 1
                         WHEN branch_name_th = ? THEN 2
                         ELSE 3
                     END
                 LIMIT 1`,
                [`%${branchName}%`, `%${branchName}%`, branchName, branchName]
            );
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Database query error:', error);
            return null;
        }
    }

    async logCall(callData) {
        if (!this.connection) {
            await this.connect();
        }

        if (!this.connection) {
            return false;
        }

        try {
            await this.connection.execute(
                `INSERT INTO call_logs 
                 (caller_id, called_number, requested_branch, recognized_text, 
                  routed_to_extension, call_duration, call_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    callData.callerId,
                    callData.calledNumber,
                    callData.requestedBranch,
                    callData.recognizedText,
                    callData.routedToExtension,
                    callData.callDuration || 0,
                    callData.callStatus || 'answered'
                ]
            );
            return true;
        } catch (error) {
            console.error('Error logging call:', error);
            return false;
        }
    }

    async getSystemConfig(key) {
        if (!this.connection) {
            await this.connect();
        }

        if (!this.connection) {
            return null;
        }

        try {
            const [rows] = await this.connection.execute(
                'SELECT config_value FROM system_config WHERE config_key = ?',
                [key]
            );
            
            return rows.length > 0 ? rows[0].config_value : null;
        } catch (error) {
            console.error('Error getting system config:', error);
            return null;
        }
    }

    async close() {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }
}

module.exports = Database;