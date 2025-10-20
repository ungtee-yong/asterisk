const Database = require('../config/database');
const GoogleSpeechService = require('../config/google_speech');
const fs = require('fs');
const path = require('path');

class SystemTester {
    constructor() {
        this.database = new Database();
        this.speechService = new GoogleSpeechService();
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
                const testFile = path.join(__dirname, 'test_audio.wav');
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

    async testAEPConfiguration() {
        console.log('\nTesting AEP configuration...');
        try {
            const configFiles = [
                '../asterisk/aeap.conf',
                '../asterisk/extensions.conf',
                '../asterisk/sip.conf',
                '../asterisk/manager.conf',
                '../asterisk/modules.conf'
            ];
            
            for (const configFile of configFiles) {
                const fullPath = path.join(__dirname, configFile);
                if (fs.existsSync(fullPath)) {
                    console.log(`✓ ${configFile} exists`);
                } else {
                    console.log(`✗ ${configFile} missing`);
                }
            }
        } catch (error) {
            console.log(`✗ AEP config error: ${error.message}`);
        }
    }

    async testNodeJSAGI() {
        console.log('\nTesting Node.js AGI script...');
        try {
            const agiPath = path.join(__dirname, '../agi_scripts/call_routing.js');
            if (fs.existsSync(agiPath)) {
                console.log('✓ AGI script exists');
                
                // Check if executable
                const stats = fs.statSync(agiPath);
                if (stats.mode & parseInt('111', 8)) {
                    console.log('✓ AGI script is executable');
                } else {
                    console.log('✗ AGI script is not executable');
                }
            } else {
                console.log('✗ AGI script not found');
            }
        } catch (error) {
            console.log(`✗ AGI script error: ${error.message}`);
        }
    }

    async testPackageDependencies() {
        console.log('\nTesting package dependencies...');
        try {
            const packagePath = path.join(__dirname, '../package.json');
            if (fs.existsSync(packagePath)) {
                const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                console.log('✓ package.json exists');
                console.log(`  - Node.js version: ${process.version}`);
                console.log(`  - Dependencies: ${Object.keys(packageJson.dependencies || {}).length}`);
            } else {
                console.log('✗ package.json not found');
            }
        } catch (error) {
            console.log(`✗ Package dependencies error: ${error.message}`);
        }
    }

    async runAllTests() {
        console.log('Call Center System Test (Node.js + AEP)');
        console.log('=' * 50);
        
        await this.testDatabaseConnection();
        await this.testGoogleSpeech();
        await this.testAEPConfiguration();
        await this.testNodeJSAGI();
        await this.testPackageDependencies();
        
        console.log('\n' + '=' * 50);
        console.log('Test completed!');
        
        // Close database connection
        await this.database.close();
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new SystemTester();
    tester.runAllTests().catch(error => {
        console.error('Test error:', error);
        process.exit(1);
    });
}

module.exports = SystemTester;