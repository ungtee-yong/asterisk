#!/usr/bin/env node

/**
 * AGI Script สำหรับจัดการ call routing ผ่าน Google Speech API
 * ใช้ Node.js และ AEP (Asterisk External Protocol)
 */

const fs = require('fs');
const path = require('path');
const temp = require('temp');
const Database = require('../config/database');
const GoogleSpeechService = require('../config/google_speech');

class CallRoutingAGI {
    constructor() {
        this.speechService = new GoogleSpeechService();
        this.database = new Database();
        this.tempDir = temp.track();
    }

    log(message) {
        /**เขียน log ไปยัง Asterisk*/
        console.log(`VERBOSE "${message}" 1`);
        process.stdout.write(`VERBOSE "${message}" 1\n`);
    }

    async agiCommand(command) {
        /**ส่งคำสั่งไปยัง Asterisk*/
        console.log(command);
        process.stdout.write(`${command}\n`);
        
        return new Promise((resolve) => {
            process.stdin.once('data', (data) => {
                resolve(data.toString().trim());
            });
        });
    }

    async playAudioFile(filename) {
        /**เล่นไฟล์เสียง*/
        return await this.agiCommand(`STREAM FILE ${filename} ""`);
    }

    async recordAudio(filename, duration = 5, silence = 2) {
        /**บันทึกเสียงจากผู้โทร*/
        return await this.agiCommand(`RECORD FILE ${filename} wav ${duration} ${silence}`);
    }

    async sayText(text) {
        /**พูดข้อความผ่าน TTS*/
        try {
            // แปลงข้อความเป็นเสียง
            const audioData = await this.speechService.textToSpeech(text);
            if (!audioData) {
                return false;
            }

            // สร้างไฟล์เสียงชั่วคราว
            const tempFile = temp.path({ suffix: '.wav' });
            await this.speechService.createAudioFile(audioData, tempFile);

            // เล่นไฟล์เสียง
            const result = await this.playAudioFile(tempFile);

            // ลบไฟล์ชั่วคราว
            try {
                fs.unlinkSync(tempFile);
            } catch (err) {
                this.log(`Warning: Could not delete temp file ${tempFile}: ${err.message}`);
            }

            return result;
        } catch (error) {
            this.log(`Error in sayText: ${error.message}`);
            return false;
        }
    }

    async getSpeechInput(promptText, maxAttempts = 3) {
        /**รับข้อมูลเสียงจากผู้โทร*/
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // พูดข้อความถาม
            await this.sayText(promptText);

            // บันทึกเสียง
            const tempFile = temp.path({ suffix: '.wav' });
            this.log(`Recording attempt ${attempt + 1}`);

            const recordResult = await this.recordAudio(tempFile, 10, 3);

            if (recordResult && recordResult.includes('200')) {
                // อ่านไฟล์เสียง
                try {
                    const audioData = await this.speechService.readAudioFile(tempFile);

                    // แปลงเสียงเป็นข้อความ
                    const text = await this.speechService.speechToText(audioData);

                    // ลบไฟล์ชั่วคราว
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (err) {
                        this.log(`Warning: Could not delete temp file ${tempFile}: ${err.message}`);
                    }

                    if (text) {
                        this.log(`Recognized text: ${text}`);
                        return text;
                    } else {
                        this.log('No speech recognized');
                        if (attempt < maxAttempts - 1) {
                            await this.sayText('ขออภัย ไม่ได้ยินเสียง กรุณาพูดอีกครั้ง');
                        }
                    }
                } catch (error) {
                    this.log(`Error processing audio: ${error.message}`);
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (err) {
                        // Ignore cleanup errors
                    }
                }
            } else {
                this.log('Recording failed');
            }

            if (attempt < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return null;
    }

    async confirmBranch(branchName) {
        /**ยืนยันสาขาที่ลูกค้าต้องการติดต่อ*/
        const confirmationText = `คุณต้องการติดต่อสาขา ${branchName} ใช่หรือไม่`;
        await this.sayText(confirmationText);

        // รับคำตอบ
        const response = await this.getSpeechInput('กรุณาพูด ใช่ หรือ ไม่ใช่');

        if (response) {
            // ตรวจสอบคำตอบ
            const responseLower = response.toLowerCase();
            const positiveWords = ['ใช่', 'yes', 'ถูกต้อง', 'ถูก'];
            const negativeWords = ['ไม่ใช่', 'no', 'ไม่ถูก', 'ผิด'];

            if (positiveWords.some(word => responseLower.includes(word))) {
                return true;
            } else if (negativeWords.some(word => responseLower.includes(word))) {
                return false;
            }
        }

        return false;
    }

    async routeCall(extension) {
        /**โอนสายไปยังหมายเลขภายใน*/
        this.log(`Transferring call to extension ${extension}`);
        return await this.agiCommand(`DIAL SIP/${extension},30`);
    }

    async logCallData(callData) {
        /**บันทึกข้อมูลการโทร*/
        try {
            await this.database.logCall(callData);
        } catch (error) {
            this.log(`Error logging call data: ${error.message}`);
        }
    }

    async main() {
        /**ฟังก์ชันหลักของ AGI script*/
        const callData = {
            callerId: process.env.CALLERIDNUM || 'unknown',
            calledNumber: process.env.DNID || 'unknown',
            requestedBranch: null,
            recognizedText: null,
            routedToExtension: null,
            callDuration: 0,
            callStatus: 'answered'
        };

        try {
            this.log('Call routing AGI started');

            // 1. รับข้อมูลสาขาที่ต้องการติดต่อ
            const branchInput = await this.getSpeechInput('กรุณาพูดสาขาที่ต้องการติดต่อ');

            if (!branchInput) {
                await this.sayText('ขออภัย ไม่สามารถรับข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
                callData.callStatus = 'failed';
                await this.logCallData(callData);
                return;
            }

            callData.requestedBranch = branchInput;
            callData.recognizedText = branchInput;
            this.log(`Customer requested branch: ${branchInput}`);

            // 2. ค้นหาสาขาในฐานข้อมูล
            const branchInfo = await this.database.getBranchExtension(branchInput);

            if (!branchInfo) {
                await this.sayText(`ขออภัย ไม่พบสาขา ${branchInput} กรุณาติดต่อเจ้าหน้าที่`);
                callData.callStatus = 'failed';
                await this.logCallData(callData);
                return;
            }

            // 3. ยืนยันสาขา
            if (!(await this.confirmBranch(branchInfo.branch_name))) {
                await this.sayText('กรุณาพูดสาขาที่ต้องการติดต่ออีกครั้ง');
                callData.callStatus = 'failed';
                await this.logCallData(callData);
                return;
            }

            // 4. โอนสาย
            await this.sayText(`กำลังโอนสายไปยังสาขา ${branchInfo.branch_name}`);
            callData.routedToExtension = branchInfo.extension;
            
            const transferResult = await this.routeCall(branchInfo.extension);

            if (transferResult && transferResult.includes('200')) {
                this.log('Call transferred successfully');
                callData.callStatus = 'answered';
            } else {
                await this.sayText('ขออภัย ไม่สามารถโอนสายได้ในขณะนี้ กรุณาติดต่อเจ้าหน้าที่');
                callData.callStatus = 'failed';
            }

            await this.logCallData(callData);

        } catch (error) {
            this.log(`Error in main: ${error.message}`);
            await this.sayText('ขออภัย เกิดข้อผิดพลาดในระบบ กรุณาติดต่อเจ้าหน้าที่');
            callData.callStatus = 'failed';
            await this.logCallData(callData);
        } finally {
            // ปิดการเชื่อมต่อฐานข้อมูล
            await this.database.close();
        }
    }
}

// รัน AGI script
if (require.main === module) {
    const agi = new CallRoutingAGI();
    agi.main().catch(error => {
        console.error('AGI Script Error:', error);
        process.exit(1);
    });
}

module.exports = CallRoutingAGI;