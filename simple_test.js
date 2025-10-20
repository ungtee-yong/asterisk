const SimpleAEPClient = require('./simple_aep_client');
const Database = require('./database');
const GoogleSpeechService = require('./google_speech');

async function testSimpleSystem() {
    console.log('🧪 ทดสอบ Simple Asterisk AEP Client System');
    console.log('=' * 50);

    // ทดสอบฐานข้อมูล
    console.log('📊 ทดสอบการเชื่อมต่อฐานข้อมูล...');
    const database = new Database();
    try {
        const result = await database.getBranchExtension('กรุงเทพ');
        if (result) {
            console.log('✅ การเชื่อมต่อฐานข้อมูลสำเร็จ');
            console.log(`   พบสาขา: ${result.branch_name} (${result.extension})`);
        } else {
            console.log('⚠️  ฐานข้อมูลเชื่อมต่อได้แต่ไม่มีข้อมูลทดสอบ');
        }
    } catch (error) {
        console.log(`❌ ข้อผิดพลาดฐานข้อมูล: ${error.message}`);
    }

    // ทดสอบ Google Speech
    console.log('\n🎤 ทดสอบ Google Speech API...');
    const speechService = new GoogleSpeechService();
    try {
        const audioData = await speechService.textToSpeech('สวัสดีครับ');
        if (audioData) {
            console.log('✅ Google Speech API ทำงานได้');
        } else {
            console.log('❌ Google Speech API ล้มเหลว');
        }
    } catch (error) {
        console.log(`❌ ข้อผิดพลาด Google Speech: ${error.message}`);
    }

    // ทดสอบ AEP Client
    console.log('\n📞 ทดสอบ AEP Client...');
    const aepClient = new SimpleAEPClient();
    try {
        await aepClient.connect();
        console.log('✅ AEP Client เชื่อมต่อได้');
        
        await aepClient.authenticate('aeap_secret_key_123');
        console.log('✅ AEP Client ยืนยันตัวตนได้');
        
        aepClient.disconnect();
    } catch (error) {
        console.log(`❌ ข้อผิดพลาด AEP Client: ${error.message}`);
    }

    // ทดสอบการยืนยันสาขา
    console.log('\n🔍 ทดสอบการยืนยันสาขา...');
    try {
        const testBranches = ['กรุงเทพ', 'เชียงใหม่', 'ภูเก็ต'];
        
        for (const branchName of testBranches) {
            const branchInfo = await database.getBranchExtension(branchName);
            if (branchInfo) {
                console.log(`✅ พบสาขา: ${branchInfo.branch_name} (${branchInfo.extension})`);
            } else {
                console.log(`❌ ไม่พบสาขา: ${branchName}`);
            }
        }
    } catch (error) {
        console.log(`❌ ข้อผิดพลาดในการทดสอบสาขา: ${error.message}`);
    }

    // ทดสอบการแปลงข้อความเป็นเสียง
    console.log('\n🔊 ทดสอบการแปลงข้อความเป็นเสียง...');
    try {
        const testTexts = [
            'กรุณาพูดสาขาที่ต้องการติดต่อ',
            'คุณต้องการติดต่อสาขากรุงเทพ ใช่หรือไม่',
            'กำลังโอนสายไปยังสาขากรุงเทพ'
        ];
        
        for (const text of testTexts) {
            const audioData = await speechService.textToSpeech(text);
            if (audioData) {
                console.log(`✅ แปลงข้อความ: "${text}"`);
            } else {
                console.log(`❌ ไม่สามารถแปลงข้อความ: "${text}"`);
            }
        }
    } catch (error) {
        console.log(`❌ ข้อผิดพลาดในการแปลงข้อความเป็นเสียง: ${error.message}`);
    }

    // ล้างข้อมูล
    await database.close();
    
    console.log('\n' + '=' * 50);
    console.log('🎉 การทดสอบเสร็จสิ้น!');
}

// รันการทดสอบถ้าไฟล์นี้ถูกเรียกใช้โดยตรง
if (require.main === module) {
    testSimpleSystem().catch(error => {
        console.error('❌ ข้อผิดพลาดในการทดสอบ:', error);
        process.exit(1);
    });
}

module.exports = testSimpleSystem;