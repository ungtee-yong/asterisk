const net = require('net');
const EventEmitter = require('events');
const Database = require('./config/database');
const GoogleSpeechService = require('./config/google_speech');

class AEPClient extends EventEmitter {
    constructor(asteriskHost = '127.0.0.1', asteriskPort = 4573) {
        super();
        this.asteriskHost = asteriskHost;
        this.asteriskPort = asteriskPort;
        this.socket = null;
        this.connected = false;
        this.authenticated = false;
        this.channels = new Map();
        this.database = new Database();
        this.speechService = new GoogleSpeechService();
        this.reconnectInterval = 5000; // 5 seconds
        this.maxReconnectAttempts = 10;
        this.reconnectAttempts = 0;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();
            
            this.socket.connect(this.asteriskPort, this.asteriskHost, () => {
                console.log(`Connected to Asterisk AEP at ${this.asteriskHost}:${this.asteriskPort}`);
                this.connected = true;
                this.reconnectAttempts = 0;
                this.emit('connected');
                resolve();
            });

            this.socket.on('data', (data) => {
                this.handleMessage(data);
            });

            this.socket.on('close', () => {
                console.log('Connection to Asterisk closed');
                this.connected = false;
                this.authenticated = false;
                this.emit('disconnected');
                this.handleReconnect();
            });

            this.socket.on('error', (error) => {
                console.error('AEP Client error:', error);
                this.connected = false;
                this.emit('error', error);
                reject(error);
            });
        });
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect().catch(error => {
                    console.error('Reconnection failed:', error);
                });
            }, this.reconnectInterval);
        } else {
            console.error('Max reconnection attempts reached. Giving up.');
            this.emit('maxReconnectAttemptsReached');
        }
    }

    handleMessage(data) {
        const message = data.toString().trim();
        console.log(`Received from Asterisk: ${message}`);

        const parts = message.split('|');
        if (parts.length < 2) {
            console.error('Invalid message format:', message);
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
            case 'CHANNEL':
                this.handleChannelEvent(params);
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
                console.log(`Unknown action: ${action}`);
        }
    }

    async authenticate(secret = 'aeap_secret_key_123') {
        if (!this.connected) {
            throw new Error('Not connected to Asterisk');
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Authentication timeout'));
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

    handleAuthResponse(params) {
        const [status, ...errorParts] = params;
        
        if (status === 'OK') {
            this.authenticated = true;
            console.log('Successfully authenticated with Asterisk');
            this.emit('authenticated');
        } else {
            const error = errorParts.join('|');
            console.error('Authentication failed:', error);
            this.emit('authError', new Error(error));
        }
    }

    async handleIncomingCall(params) {
        const [channelId, callerId, calledNumber, context] = params;
        console.log(`Incoming call: ${channelId} from ${callerId} to ${calledNumber}`);

        // Store channel info
        this.channels.set(channelId, {
            callerId,
            calledNumber,
            context,
            status: 'ringing',
            startTime: new Date()
        });

        // Start call routing process
        try {
            await this.processCallRouting(channelId, callerId, calledNumber);
        } catch (error) {
            console.error(`Error processing call ${channelId}:`, error);
            await this.hangupCall(channelId);
        }
    }

    async processCallRouting(channelId, callerId, calledNumber) {
        const callData = {
            callerId,
            calledNumber,
            requestedBranch: null,
            recognizedText: null,
            routedToExtension: null,
            callDuration: 0,
            callStatus: 'answered'
        };

        try {
            // 1. Answer the call
            await this.answerCall(channelId);

            // 2. Play welcome message
            await this.playText(channelId, 'กรุณาพูดสาขาที่ต้องการติดต่อ');

            // 3. Get branch input from customer
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

            // 4. Search for branch in database
            const branchInfo = await this.database.getBranchExtension(branchInput);

            if (!branchInfo) {
                await this.playText(channelId, `ขออภัย ไม่พบสาขา ${branchInput} กรุณาติดต่อเจ้าหน้าที่`);
                callData.callStatus = 'failed';
                await this.logCallData(callData);
                return;
            }

            // 5. Confirm branch
            const confirmed = await this.confirmBranch(channelId, branchInfo.branch_name);
            if (!confirmed) {
                await this.playText(channelId, 'กรุณาพูดสาขาที่ต้องการติดต่ออีกครั้ง');
                callData.callStatus = 'failed';
                await this.logCallData(callData);
                return;
            }

            // 6. Transfer call
            await this.playText(channelId, `กำลังโอนสายไปยังสาขา ${branchInfo.branch_name}`);
            callData.routedToExtension = branchInfo.extension;
            
            const transferResult = await this.transferCall(channelId, branchInfo.extension);

            if (transferResult) {
                console.log(`Call ${channelId} transferred successfully to ${branchInfo.extension}`);
                callData.callStatus = 'answered';
            } else {
                await this.playText(channelId, 'ขออภัย ไม่สามารถโอนสายได้ในขณะนี้ กรุณาติดต่อเจ้าหน้าที่');
                callData.callStatus = 'failed';
            }

            await this.logCallData(callData);

        } catch (error) {
            console.error(`Error in call routing for ${channelId}:`, error);
            await this.playText(channelId, 'ขออภัย เกิดข้อผิดพลาดในระบบ กรุณาติดต่อเจ้าหน้าที่');
            callData.callStatus = 'failed';
            await this.logCallData(callData);
        }
    }

    async answerCall(channelId) {
        return this.sendMessage(`ANSWER|${channelId}`);
    }

    async hangupCall(channelId) {
        return this.sendMessage(`HANGUP|${channelId}`);
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

            // Play audio file
            return this.sendMessage(`PLAY|${channelId}|${tempFile}`);
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
            const recordResult = await this.recordAudio(channelId, tempFile, 10, 3);

            if (recordResult && recordResult.includes('OK')) {
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
            } else {
                console.log('Recording failed');
            }

            if (attempt < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return null;
    }

    async recordAudio(channelId, filename, duration = 10, silence = 3) {
        return this.sendMessage(`RECORD|${channelId}|${filename}|${duration}|${silence}`);
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

    async transferCall(channelId, extension) {
        return this.sendMessage(`DIAL|${channelId}|${extension}`);
    }

    async logCallData(callData) {
        try {
            await this.database.logCall(callData);
        } catch (error) {
            console.error('Error logging call data:', error);
        }
    }

    handleChannelEvent(params) {
        const [channelId, event, ...data] = params;
        console.log(`Channel event: ${channelId} - ${event}`);
        
        if (this.channels.has(channelId)) {
            const channel = this.channels.get(channelId);
            channel.status = event;
            
            if (event === 'hangup') {
                this.channels.delete(channelId);
            }
        }
    }

    handleSpeechResponse(params) {
        const [channelId, action, ...data] = params;
        console.log(`Speech response: ${channelId} - ${action}`);
    }

    handleDialResponse(params) {
        const [channelId, extension, status] = params;
        console.log(`Dial response: ${channelId} to ${extension} - ${status}`);
    }

    handleHangupResponse(params) {
        const [channelId, status] = params;
        console.log(`Hangup response: ${channelId} - ${status}`);
    }

    handleError(params) {
        const error = params.join('|');
        console.error('Asterisk error:', error);
        this.emit('error', new Error(error));
    }

    sendMessage(message) {
        if (!this.connected || !this.socket) {
            throw new Error('Not connected to Asterisk');
        }

        console.log(`Sending to Asterisk: ${message}`);
        this.socket.write(`${message}\n`);
    }

    disconnect() {
        if (this.socket) {
            this.socket.end();
            this.socket = null;
        }
        this.connected = false;
        this.authenticated = false;
    }
}

module.exports = AEPClient;