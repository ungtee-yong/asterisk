const net = require('net');
const EventEmitter = require('events');
const Database = require('./database');
const GoogleSpeechService = require('./google_speech');

class SimpleAEPClient extends EventEmitter {
    constructor(asteriskHost = '127.0.0.1', asteriskPort = 4573) {
        super();
        this.asteriskHost = asteriskHost;
        this.asteriskPort = asteriskPort;
        this.socket = null;
        this.connected = false;
        this.authenticated = false;
        this.currentChannel = null;
        this.database = new Database();
        this.speechService = new GoogleSpeechService();
    }

    // เชื่อมต่อกับ Asterisk
    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();
            
            this.socket.connect(this.asteriskPort, this.asteriskHost, () => {
                console.log(`✅ เชื่อมต่อกับ Asterisk ที่ ${this.asteriskHost}:${this.asteriskPort}`);
                this.connected = true;
                this.emit('connected');
                resolve();
            });

            this.socket.on('data', (data) => {
                this.handleMessage(data);
            });

            this.socket.on('close', () => {
                console.log('❌ การเชื่อมต่อกับ Asterisk ถูกปิด');
                this.connected = false;
                this.authenticated = false;
                this.emit('disconnected');
            });

            this.socket.on('error', (error) => {
                console.error('❌ ข้อผิดพลาด AEP Client:', error);
                this.connected = false;
                this.emit('error', error);
                reject(error);
            });
        });
    }

    // รับข้อความจาก Asterisk
    handleMessage(data) {
        const message = data.toString().trim();
        console.log(`📨 รับจาก Asterisk: ${message}`);

        const parts = message.split('|');
        if (parts.length < 2) {
            console.error('❌ รูปแบบข้อความไม่ถูกต้อง:', message);
            return;
        }

        const [action, ...params] = parts;

        switch (action) {
            case 'AUTH':
                this.handleAuthResponse(params);
                break;
            case 'CALL':
                this.handleIncomingCall(params);
                break;
            case 'SPEECH':
                this.handleSpeechResponse(params);
                break;
            case 'DIAL':
                this.handleDialResponse(params);
                break;
            case 'HANGUP':
                this.handleHangupResponse(params);
                break;
            case 'ERROR':
                this.handleError(params);
                break;
            default:
                console.log(`❓ Action ไม่รู้จัก: ${action}`);
        }
    }

    // ยืนยันตัวตนกับ Asterisk
    async authenticate(secret = 'aeap_secret_key_123') {
        if (!this.connected) {
            throw new Error('ยังไม่ได้เชื่อมต่อกับ Asterisk');
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('หมดเวลายืนยันตัวตน'));
            }, 10000);

            this.once('authenticated', () => {
                clearTimeout(timeout);
                resolve();
            });

            this.once('authError', (error) => {
                clearTimeout(timeout);
                reject(error);
            });

            this.sendMessage(`AUTH|${secret}`);
        });
    }

    // จัดการการตอบกลับการยืนยันตัวตน
    handleAuthResponse(params) {
        const [status, ...errorParts] = params;
        
        if (status === 'OK') {
            this.authenticated = true;
            console.log('✅ ยืนยันตัวตนกับ Asterisk สำเร็จ');
            this.emit('authenticated');
        } else {
            const error = errorParts.join('|');
            console.error('❌ ยืนยันตัวตนล้มเหลว:', error);
            this.emit('authError', new Error(error));
        }
    }

    // จัดการสายโทรเข้า
    async handleIncomingCall(params) {
        const [channelId, callerId, calledNumber, context] = params;
        console.log(`📞 สายโทรเข้า: ${channelId} จาก ${callerId} ไปยัง ${calledNumber}`);

        this.currentChannel = channelId;
        
        // เริ่มกระบวนการ routing
        try {
            await this.processCallRouting(channelId, callerId, calledNumber);
        } catch (error) {
            console.error(`❌ ข้อผิดพลาดในการประมวลผลสายโทร ${channelId}:`, error);
            await this.hangupCall(channelId);
        }
    }

    // กระบวนการหลักในการ routing สายโทร
    async processCallRouting(channelId, callerId, calledNumber) {
        console.log(`🔄 เริ่มประมวลผลสายโทร ${channelId}`);

        try {
            // 1. รับสาย
            await this.answerCall(channelId);
            console.log(`✅ รับสาย ${channelId}`);

            // 2. พูดข้อความต้อนรับ
            await this.playText(channelId, 'กรุณาพูดสาขาที่ต้องการติดต่อ');
            console.log(`🔊 พูดข้อความต้อนรับ`);

            // 3. รับข้อมูลสาขาจากลูกค้า
            const branchInput = await this.getSpeechInput(channelId);
            
            if (!branchInput) {
                await this.playText(channelId, 'ขออภัย ไม่สามารถรับข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
                console.log(`❌ ไม่สามารถรับข้อมูลสาขาได้`);
                return;
            }

            console.log(`🎤 ลูกค้าต้องการสาขา: ${branchInput}`);

            // 4. ค้นหาสาขาในฐานข้อมูล
            const branchInfo = await this.database.getBranchExtension(branchInput);
            
            if (!branchInfo) {
                await this.playText(channelId, `ขออภัย ไม่พบสาขา ${branchInput} กรุณาติดต่อเจ้าหน้าที่`);
                console.log(`❌ ไม่พบสาขา: ${branchInput}`);
                return;
            }

            console.log(`✅ พบสาขา: ${branchInfo.branch_name} (${branchInfo.extension})`);

            // 5. ยืนยันสาขากับลูกค้า
            const confirmed = await this.confirmBranch(channelId, branchInfo.branch_name);
            
            if (!confirmed) {
                await this.playText(channelId, 'กรุณาพูดสาขาที่ต้องการติดต่ออีกครั้ง');
                console.log(`❌ ลูกค้าไม่ยืนยันสาขา`);
                return;
            }

            console.log(`✅ ลูกค้ายืนยันสาขา: ${branchInfo.branch_name}`);

            // 6. โอนสายไปยังสาขา
            await this.playText(channelId, `กำลังโอนสายไปยังสาขา ${branchInfo.branch_name}`);
            console.log(`🔄 กำลังโอนสายไปยัง ${branchInfo.extension}`);
            
            const transferResult = await this.transferCall(channelId, branchInfo.extension);

            if (transferResult) {
                console.log(`✅ โอนสาย ${channelId} ไปยัง ${branchInfo.extension} สำเร็จ`);
                
                // บันทึกข้อมูลการโทร
                await this.database.logCall({
                    callerId,
                    calledNumber,
                    requestedBranch: branchInfo.branch_name,
                    recognizedText: branchInput,
                    routedToExtension: branchInfo.extension,
                    callDuration: 0,
                    callStatus: 'transferred'
                });
            } else {
                await this.playText(channelId, 'ขออภัย ไม่สามารถโอนสายได้ในขณะนี้ กรุณาติดต่อเจ้าหน้าที่');
                console.log(`❌ ไม่สามารถโอนสายได้`);
            }

        } catch (error) {
            console.error(`❌ ข้อผิดพลาดในกระบวนการ routing:`, error);
            await this.playText(channelId, 'ขออภัย เกิดข้อผิดพลาดในระบบ กรุณาติดต่อเจ้าหน้าที่');
        }
    }

    // รับสาย
    async answerCall(channelId) {
        return this.sendMessage(`ANSWER|${channelId}`);
    }

    // วางสาย
    async hangupCall(channelId) {
        return this.sendMessage(`HANGUP|${channelId}`);
    }

    // พูดข้อความ
    async playText(channelId, text) {
        try {
            console.log(`🔊 แปลงข้อความเป็นเสียง: "${text}"`);
            
            // แปลงข้อความเป็นเสียง
            const audioData = await this.speechService.textToSpeech(text);
            if (!audioData) {
                throw new Error('การแปลงข้อความเป็นเสียงล้มเหลว');
            }

            // บันทึกไฟล์เสียงชั่วคราว
            const tempFile = `/tmp/tts_${channelId}_${Date.now()}.wav`;
            await this.speechService.createAudioFile(audioData, tempFile);

            // เล่นไฟล์เสียง
            return this.sendMessage(`PLAY|${channelId}|${tempFile}`);
        } catch (error) {
            console.error(`❌ ข้อผิดพลาดในการเล่นข้อความ:`, error);
            throw error;
        }
    }

    // รับข้อมูลเสียงจากลูกค้า
    async getSpeechInput(channelId, maxAttempts = 3) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            console.log(`🎤 รับข้อมูลเสียง (ครั้งที่ ${attempt + 1}/${maxAttempts})`);

            // บันทึกเสียง
            const tempFile = `/tmp/stt_${channelId}_${Date.now()}.wav`;
            const recordResult = await this.recordAudio(channelId, tempFile, 10, 3);

            if (recordResult && recordResult.includes('OK')) {
                try {
                    // อ่านไฟล์เสียง
                    const audioData = await this.speechService.readAudioFile(tempFile);

                    // แปลงเสียงเป็นข้อความ
                    const text = await this.speechService.speechToText(audioData);

                    // ลบไฟล์ชั่วคราว
                    try {
                        require('fs').unlinkSync(tempFile);
                    } catch (err) {
                        // ไม่สนใจข้อผิดพลาดในการลบไฟล์
                    }

                    if (text) {
                        console.log(`✅ รับรู้ข้อความ: "${text}"`);
                        return text;
                    } else {
                        console.log(`❌ ไม่สามารถรับรู้ข้อความได้`);
                        if (attempt < maxAttempts - 1) {
                            await this.playText(channelId, 'ขออภัย ไม่ได้ยินเสียง กรุณาพูดอีกครั้ง');
                        }
                    }
                } catch (error) {
                    console.error(`❌ ข้อผิดพลาดในการประมวลผลเสียง:`, error);
                    try {
                        require('fs').unlinkSync(tempFile);
                    } catch (err) {
                        // ไม่สนใจข้อผิดพลาดในการลบไฟล์
                    }
                }
            } else {
                console.log(`❌ การบันทึกเสียงล้มเหลว`);
            }

            if (attempt < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return null;
    }

    // บันทึกเสียง
    async recordAudio(channelId, filename, duration = 10, silence = 3) {
        return this.sendMessage(`RECORD|${channelId}|${filename}|${duration}|${silence}`);
    }

    // ยืนยันสาขากับลูกค้า
    async confirmBranch(channelId, branchName) {
        const confirmationText = `คุณต้องการติดต่อสาขา ${branchName} ใช่หรือไม่`;
        await this.playText(channelId, confirmationText);
        console.log(`❓ ยืนยันสาขา: ${branchName}`);

        const response = await this.getSpeechInput(channelId, 2);

        if (response) {
            const responseLower = response.toLowerCase();
            const positiveWords = ['ใช่', 'yes', 'ถูกต้อง', 'ถูก'];
            const negativeWords = ['ไม่ใช่', 'no', 'ไม่ถูก', 'ผิด'];

            if (positiveWords.some(word => responseLower.includes(word))) {
                console.log(`✅ ลูกค้ายืนยันสาขา: ${branchName}`);
                return true;
            } else if (negativeWords.some(word => responseLower.includes(word))) {
                console.log(`❌ ลูกค้าไม่ยืนยันสาขา: ${branchName}`);
                return false;
            }
        }

        console.log(`❓ ไม่สามารถตีความการตอบกลับได้`);
        return false;
    }

    // โอนสาย
    async transferCall(channelId, extension) {
        console.log(`🔄 โอนสาย ${channelId} ไปยัง ${extension}`);
        return this.sendMessage(`DIAL|${channelId}|${extension}`);
    }

    // จัดการการตอบกลับการพูด
    handleSpeechResponse(params) {
        const [channelId, action, ...data] = params;
        console.log(`🔊 การตอบกลับการพูด: ${channelId} - ${action}`);
    }

    // จัดการการตอบกลับการโอนสาย
    handleDialResponse(params) {
        const [channelId, extension, status] = params;
        console.log(`🔄 การตอบกลับการโอนสาย: ${channelId} ไปยัง ${extension} - ${status}`);
    }

    // จัดการการตอบกลับการวางสาย
    handleHangupResponse(params) {
        const [channelId, status] = params;
        console.log(`📞 การตอบกลับการวางสาย: ${channelId} - ${status}`);
    }

    // จัดการข้อผิดพลาด
    handleError(params) {
        const error = params.join('|');
        console.error('❌ ข้อผิดพลาดจาก Asterisk:', error);
        this.emit('error', new Error(error));
    }

    // ส่งข้อความไปยัง Asterisk
    sendMessage(message) {
        if (!this.connected || !this.socket) {
            throw new Error('ยังไม่ได้เชื่อมต่อกับ Asterisk');
        }

        console.log(`📤 ส่งไปยัง Asterisk: ${message}`);
        this.socket.write(`${message}\n`);
    }

    // ตัดการเชื่อมต่อ
    disconnect() {
        if (this.socket) {
            this.socket.end();
            this.socket = null;
        }
        this.connected = false;
        this.authenticated = false;
    }
}

module.exports = SimpleAEPClient;