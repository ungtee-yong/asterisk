const EventEmitter = require('events');
const Database = require('./config/database');
const GoogleSpeechService = require('./config/google_speech');

class CallHandlers extends EventEmitter {
    constructor() {
        super();
        this.database = new Database();
        this.speechService = new GoogleSpeechService();
        this.activeCalls = new Map();
    }

    async handleIncomingCall(channelId, callerId, calledNumber, context) {
        console.log(`Handling incoming call: ${channelId} from ${callerId} to ${calledNumber}`);
        
        const callData = {
            channelId,
            callerId,
            calledNumber,
            context,
            startTime: new Date(),
            status: 'ringing',
            requestedBranch: null,
            recognizedText: null,
            routedToExtension: null,
            callDuration: 0,
            callStatus: 'answered'
        };

        this.activeCalls.set(channelId, callData);

        try {
            // Start call routing process
            await this.processCallRouting(callData);
        } catch (error) {
            console.error(`Error processing call ${channelId}:`, error);
            callData.callStatus = 'failed';
            await this.logCallData(callData);
        }
    }

    async processCallRouting(callData) {
        const { channelId, callerId, calledNumber } = callData;

        try {
            // 1. Play welcome message
            await this.playText(channelId, 'กรุณาพูดสาขาที่ต้องการติดต่อ');

            // 2. Get branch input from customer
            const branchInput = await this.getSpeechInput(channelId, 'กรุณาพูดสาขาที่ต้องการติดต่อ');

            if (!branchInput) {
                await this.playText(channelId, 'ขออภัย ไม่สามารถรับข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
                callData.callStatus = 'failed';
                await this.logCallData(callData);
                return;
            }

            callData.requestedBranch = branchInput;
            callData.recognizedText = branchInput;
            console.log(`Customer requested branch: ${branchInput}`);

            // 3. Search for branch in database
            const branchInfo = await this.database.getBranchExtension(branchInput);

            if (!branchInfo) {
                await this.playText(channelId, `ขออภัย ไม่พบสาขา ${branchInput} กรุณาติดต่อเจ้าหน้าที่`);
                callData.callStatus = 'failed';
                await this.logCallData(callData);
                return;
            }

            // 4. Confirm branch
            const confirmed = await this.confirmBranch(channelId, branchInfo.branch_name);
            if (!confirmed) {
                await this.playText(channelId, 'กรุณาพูดสาขาที่ต้องการติดต่ออีกครั้ง');
                callData.callStatus = 'failed';
                await this.logCallData(callData);
                return;
            }

            // 5. Transfer call
            await this.playText(channelId, `กำลังโอนสายไปยังสาขา ${branchInfo.branch_name}`);
            callData.routedToExtension = branchInfo.extension;
            
            // Emit transfer event
            this.emit('transferCall', {
                channelId,
                extension: branchInfo.extension,
                branchName: branchInfo.branch_name
            });

            callData.callStatus = 'transferred';
            await this.logCallData(callData);

        } catch (error) {
            console.error(`Error in call routing for ${channelId}:`, error);
            await this.playText(channelId, 'ขออภัย เกิดข้อผิดพลาดในระบบ กรุณาติดต่อเจ้าหน้าที่');
            callData.callStatus = 'failed';
            await this.logCallData(callData);
        }
    }

    async playText(channelId, text) {
        try {
            // Convert text to speech
            const audioData = await this.speechService.textToSpeech(text);
            if (!audioData) {
                throw new Error('TTS failed');
            }

            // Save audio to temporary file
            const tempFile = `/tmp/tts_${channelId}_${Date.now()}.wav`;
            await this.speechService.createAudioFile(audioData, tempFile);

            // Emit play event
            this.emit('playAudio', {
                channelId,
                filename: tempFile
            });

            return tempFile;
        } catch (error) {
            console.error(`Error playing text for ${channelId}:`, error);
            throw error;
        }
    }

    async getSpeechInput(channelId, promptText, maxAttempts = 3) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Play prompt
            await this.playText(channelId, promptText);

            // Record audio
            const tempFile = `/tmp/stt_${channelId}_${Date.now()}.wav`;
            
            // Emit record event
            this.emit('recordAudio', {
                channelId,
                filename: tempFile,
                duration: 10,
                silence: 3
            });

            // Wait for recording to complete (this would be handled by the AEP client)
            // For now, we'll simulate the process
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                // Read audio file
                const audioData = await this.speechService.readAudioFile(tempFile);

                // Convert speech to text
                const text = await this.speechService.speechToText(audioData);

                // Clean up temp file
                try {
                    require('fs').unlinkSync(tempFile);
                } catch (err) {
                    // Ignore cleanup errors
                }

                if (text) {
                    console.log(`Recognized text: ${text}`);
                    return text;
                } else {
                    console.log('No speech recognized');
                    if (attempt < maxAttempts - 1) {
                        await this.playText(channelId, 'ขออภัย ไม่ได้ยินเสียง กรุณาพูดอีกครั้ง');
                    }
                }
            } catch (error) {
                console.error(`Error processing audio: ${error.message}`);
                try {
                    require('fs').unlinkSync(tempFile);
                } catch (err) {
                    // Ignore cleanup errors
                }
            }

            if (attempt < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return null;
    }

    async confirmBranch(channelId, branchName) {
        const confirmationText = `คุณต้องการติดต่อสาขา ${branchName} ใช่หรือไม่`;
        await this.playText(channelId, confirmationText);

        const response = await this.getSpeechInput(channelId, 'กรุณาพูด ใช่ หรือ ไม่ใช่');

        if (response) {
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

    async logCallData(callData) {
        try {
            const logData = {
                callerId: callData.callerId,
                calledNumber: callData.calledNumber,
                requestedBranch: callData.requestedBranch,
                recognizedText: callData.recognizedText,
                routedToExtension: callData.routedToExtension,
                callDuration: callData.callDuration || 0,
                callStatus: callData.callStatus || 'answered'
            };

            await this.database.logCall(logData);
        } catch (error) {
            console.error('Error logging call data:', error);
        }
    }

    handleCallEnded(channelId) {
        if (this.activeCalls.has(channelId)) {
            const callData = this.activeCalls.get(channelId);
            callData.endTime = new Date();
            callData.callDuration = Math.floor((callData.endTime - callData.startTime) / 1000);
            callData.status = 'ended';
            
            this.activeCalls.delete(channelId);
            console.log(`Call ${channelId} ended. Duration: ${callData.callDuration}s`);
        }
    }

    getActiveCalls() {
        return Array.from(this.activeCalls.values());
    }

    getCallStats() {
        const calls = this.getActiveCalls();
        return {
            totalCalls: calls.length,
            activeCalls: calls.filter(call => call.status === 'ringing' || call.status === 'answered').length,
            transferredCalls: calls.filter(call => call.status === 'transferred').length,
            failedCalls: calls.filter(call => call.status === 'failed').length
        };
    }
}

module.exports = CallHandlers;