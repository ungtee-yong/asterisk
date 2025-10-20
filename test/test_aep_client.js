const AEPClient = require('../aep_client');
const Database = require('../config/database');
const GoogleSpeechService = require('../config/google_speech');

class AEPClientTester {
    constructor() {
        this.aepClient = new AEPClient('127.0.0.1', 4573);
        this.database = new Database();
        this.speechService = new GoogleSpeechService();
    }

    async testAEPConnection() {
        console.log('Testing AEP connection...');
        try {
            await this.aepClient.connect();
            console.log('✓ AEP connection successful');
            
            // Test authentication
            await this.aepClient.authenticate('aeap_secret_key_123');
            console.log('✓ AEP authentication successful');
            
            return true;
        } catch (error) {
            console.log(`✗ AEP connection failed: ${error.message}`);
            return false;
        }
    }

    async testDatabaseConnection() {
        console.log('Testing database connection...');
        try {
            if (this.database.connection) {
                console.log('✓ Database connection successful');
                
                // Test branch search
                const result = await this.database.getBranchExtension('กรุงเทพ');
                if (result) {
                    console.log(`✓ Branch search successful: ${JSON.stringify(result)}`);
                } else {
                    console.log('✗ Branch search failed');
                }
            } else {
                console.log('✗ Database connection failed');
            }
        } catch (error) {
            console.log(`✗ Database error: ${error.message}`);
        }
    }

    async testGoogleSpeech() {
        console.log('\nTesting Google Speech API...');
        try {
            // Test Text-to-Speech
            console.log('Testing Text-to-Speech...');
            const audioData = await this.speechService.textToSpeech('สวัสดีครับ ยินดีต้อนรับสู่ระบบ Call Center');
            if (audioData) {
                console.log('✓ Text-to-Speech successful');
                
                // Save audio file for testing
                const testFile = '/tmp/test_audio.wav';
                await this.speechService.createAudioFile(audioData, testFile);
                console.log(`✓ Audio file saved: ${testFile}`);
            } else {
                console.log('✗ Text-to-Speech failed');
            }
            
            // Test Speech-to-Text (requires audio file)
            console.log('\nTesting Speech-to-Text...');
            console.log('Note: Speech-to-Text requires audio file input');
            
        } catch (error) {
            console.log(`✗ Google Speech error: ${error.message}`);
        }
    }

    async testAsteriskConfiguration() {
        console.log('\nTesting Asterisk configuration...');
        try {
            const { exec } = require('child_process');
            
            // Check if Asterisk is running
            exec('asterisk -rx "core show version"', (error, stdout, stderr) => {
                if (error) {
                    console.log('✗ Asterisk is not running or not accessible');
                    return;
                }
                console.log('✓ Asterisk is running');
                console.log(`  Version: ${stdout.trim()}`);
            });

            // Check AEP module
            exec('asterisk -rx "module show like aeap"', (error, stdout, stderr) => {
                if (error || !stdout.includes('res_aeap.so')) {
                    console.log('✗ AEP module not loaded');
                    return;
                }
                console.log('✓ AEP module is loaded');
            });

            // Check AEP configuration
            exec('asterisk -rx "aeap show settings"', (error, stdout, stderr) => {
                if (error) {
                    console.log('✗ AEP configuration not found');
                    return;
                }
                if (stdout.includes('enabled.*yes')) {
                    console.log('✓ AEP is enabled');
                } else {
                    console.log('✗ AEP is not enabled');
                }
            });

        } catch (error) {
            console.log(`✗ Asterisk configuration error: ${error.message}`);
        }
    }

    async testPortAvailability() {
        console.log('\nTesting port availability...');
        try {
            const net = require('net');
            
            // Test AEP port (4573)
            const aepServer = net.createServer();
            aepServer.listen(4573, '127.0.0.1', () => {
                console.log('✓ Port 4573 is available');
                aepServer.close();
            });
            
            aepServer.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.log('✓ Port 4573 is in use (Asterisk AEP is running)');
                } else {
                    console.log(`✗ Port 4573 error: ${error.message}`);
                }
            });

            // Test HTTP API port (3000)
            const httpServer = net.createServer();
            httpServer.listen(3000, '127.0.0.1', () => {
                console.log('✓ Port 3000 is available');
                httpServer.close();
            });
            
            httpServer.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.log('✓ Port 3000 is in use (HTTP API is running)');
                } else {
                    console.log(`✗ Port 3000 error: ${error.message}`);
                }
            });

        } catch (error) {
            console.log(`✗ Port availability error: ${error.message}`);
        }
    }

    async runAllTests() {
        console.log('AEP Client System Test');
        console.log('=' * 50);
        
        await this.testDatabaseConnection();
        await this.testGoogleSpeech();
        await this.testAsteriskConfiguration();
        await this.testPortAvailability();
        
        // Test AEP connection last (as it might disconnect)
        const aepConnected = await this.testAEPConnection();
        
        console.log('\n' + '=' * 50);
        if (aepConnected) {
            console.log('✓ All tests completed successfully!');
        } else {
            console.log('⚠ Some tests failed. Please check the configuration.');
        }
        
        // Close connections
        this.aepClient.disconnect();
        await this.database.close();
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new AEPClientTester();
    tester.runAllTests().catch(error => {
        console.error('Test error:', error);
        process.exit(1);
    });
}

module.exports = AEPClientTester;