const AEPClient = require('./aep_client');
const Database = require('./database');
const GoogleSpeechService = require('./google_speech');

async function testSystem() {
    console.log('Testing Asterisk AEP Client System');
    console.log('=' * 50);

    // Test Database
    console.log('Testing database connection...');
    const database = new Database();
    try {
        const result = await database.getBranchExtension('กรุงเทพ');
        if (result) {
            console.log('✓ Database connection successful');
            console.log(`  Found branch: ${result.branch_name} (${result.extension})`);
        } else {
            console.log('⚠ Database connected but no test data found');
        }
    } catch (error) {
        console.log(`✗ Database error: ${error.message}`);
    }

    // Test Google Speech
    console.log('\nTesting Google Speech API...');
    const speechService = new GoogleSpeechService();
    try {
        const audioData = await speechService.textToSpeech('สวัสดีครับ');
        if (audioData) {
            console.log('✓ Google Speech API working');
        } else {
            console.log('✗ Google Speech API failed');
        }
    } catch (error) {
        console.log(`✗ Google Speech error: ${error.message}`);
    }

    // Test AEP Client
    console.log('\nTesting AEP Client...');
    const aepClient = new AEPClient();
    try {
        await aepClient.connect();
        console.log('✓ AEP Client connected');
        
        await aepClient.authenticate('aeap_secret_key_123');
        console.log('✓ AEP Client authenticated');
        
        aepClient.disconnect();
    } catch (error) {
        console.log(`✗ AEP Client error: ${error.message}`);
    }

    // Cleanup
    await database.close();
    
    console.log('\n' + '=' * 50);
    console.log('Test completed!');
}

// Run test if this file is executed directly
if (require.main === module) {
    testSystem().catch(error => {
        console.error('Test error:', error);
        process.exit(1);
    });
}

module.exports = testSystem;