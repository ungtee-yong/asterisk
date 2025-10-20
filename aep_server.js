const net = require('net');
const EventEmitter = require('events');
const Database = require('./config/database');
const GoogleSpeechService = require('./config/google_speech');
const CallRoutingAGI = require('./agi_scripts/call_routing');

class AEPServer extends EventEmitter {
    constructor(port = 4573, host = '0.0.0.0') {
        super();
        this.port = port;
        this.host = host;
        this.server = null;
        this.clients = new Map();
        this.database = new Database();
        this.speechService = new GoogleSpeechService();
    }

    start() {
        this.server = net.createServer((socket) => {
            this.handleClient(socket);
        });

        this.server.listen(this.port, this.host, () => {
            console.log(`AEP Server listening on ${this.host}:${this.port}`);
        });

        this.server.on('error', (error) => {
            console.error('AEP Server error:', error);
        });
    }

    handleClient(socket) {
        const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
        console.log(`New AEP client connected: ${clientId}`);

        this.clients.set(clientId, {
            socket: socket,
            authenticated: false,
            channels: new Map()
        });

        socket.on('data', (data) => {
            this.handleData(clientId, data);
        });

        socket.on('close', () => {
            console.log(`AEP client disconnected: ${clientId}`);
            this.clients.delete(clientId);
        });

        socket.on('error', (error) => {
            console.error(`AEP client error ${clientId}:`, error);
            this.clients.delete(clientId);
        });
    }

    handleData(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const message = data.toString().trim();
        console.log(`Received from ${clientId}: ${message}`);

        // Parse AEP message
        const parts = message.split('|');
        if (parts.length < 2) {
            this.sendResponse(clientId, 'ERROR|Invalid message format');
            return;
        }

        const [action, ...params] = parts;

        switch (action) {
            case 'AUTH':
                this.handleAuth(clientId, params);
                break;
            case 'CALL':
                this.handleCall(clientId, params);
                break;
            case 'ANSWER':
                this.handleAnswer(clientId, params);
                break;
            case 'HANGUP':
                this.handleHangup(clientId, params);
                break;
            case 'PLAY':
                this.handlePlay(clientId, params);
                break;
            case 'RECORD':
                this.handleRecord(clientId, params);
                break;
            case 'DIAL':
                this.handleDial(clientId, params);
                break;
            case 'SPEECH':
                this.handleSpeech(clientId, params);
                break;
            default:
                this.sendResponse(clientId, 'ERROR|Unknown action');
        }
    }

    handleAuth(clientId, params) {
        const [secret] = params;
        const client = this.clients.get(clientId);
        
        if (secret === 'aeap_secret_key_123') {
            client.authenticated = true;
            this.sendResponse(clientId, 'AUTH|OK');
            console.log(`Client ${clientId} authenticated successfully`);
        } else {
            this.sendResponse(clientId, 'AUTH|ERROR|Invalid secret');
            console.log(`Client ${clientId} authentication failed`);
        }
    }

    async handleCall(clientId, params) {
        const client = this.clients.get(clientId);
        if (!client.authenticated) {
            this.sendResponse(clientId, 'ERROR|Not authenticated');
            return;
        }

        const [channelId, callerId, calledNumber] = params;
        console.log(`Handling call: ${channelId} from ${callerId} to ${calledNumber}`);

        // Store channel info
        client.channels.set(channelId, {
            callerId,
            calledNumber,
            status: 'ringing'
        });

        // Start call routing process
        this.startCallRouting(clientId, channelId, callerId, calledNumber);
    }

    async startCallRouting(clientId, channelId, callerId, calledNumber) {
        try {
            // Create call routing instance
            const callRouting = new CallRoutingAGI();
            
            // Set up channel context
            process.env.CALLERIDNUM = callerId;
            process.env.DNID = calledNumber;
            process.env.CHANNEL = channelId;

            // Start the call routing process
            await callRouting.main();

        } catch (error) {
            console.error(`Error in call routing for ${channelId}:`, error);
            this.sendResponse(clientId, `ERROR|Call routing failed: ${error.message}`);
        }
    }

    handleAnswer(clientId, params) {
        const [channelId] = params;
        const client = this.clients.get(clientId);
        
        if (client && client.channels.has(channelId)) {
            client.channels.get(channelId).status = 'answered';
            this.sendResponse(clientId, `ANSWER|${channelId}|OK`);
        } else {
            this.sendResponse(clientId, `ANSWER|${channelId}|ERROR|Channel not found`);
        }
    }

    handleHangup(clientId, params) {
        const [channelId] = params;
        const client = this.clients.get(clientId);
        
        if (client && client.channels.has(channelId)) {
            client.channels.delete(channelId);
            this.sendResponse(clientId, `HANGUP|${channelId}|OK`);
        } else {
            this.sendResponse(clientId, `HANGUP|${channelId}|ERROR|Channel not found`);
        }
    }

    async handlePlay(clientId, params) {
        const [channelId, filename] = params;
        const client = this.clients.get(clientId);
        
        if (client && client.channels.has(channelId)) {
            // Simulate playing audio file
            console.log(`Playing ${filename} on channel ${channelId}`);
            this.sendResponse(clientId, `PLAY|${channelId}|OK`);
        } else {
            this.sendResponse(clientId, `PLAY|${channelId}|ERROR|Channel not found`);
        }
    }

    async handleRecord(clientId, params) {
        const [channelId, filename, duration, silence] = params;
        const client = this.clients.get(clientId);
        
        if (client && client.channels.has(channelId)) {
            // Simulate recording audio
            console.log(`Recording ${filename} on channel ${channelId} for ${duration}s`);
            this.sendResponse(clientId, `RECORD|${channelId}|OK`);
        } else {
            this.sendResponse(clientId, `RECORD|${channelId}|ERROR|Channel not found`);
        }
    }

    async handleDial(clientId, params) {
        const [channelId, extension] = params;
        const client = this.clients.get(clientId);
        
        if (client && client.channels.has(channelId)) {
            console.log(`Dialing ${extension} from channel ${channelId}`);
            this.sendResponse(clientId, `DIAL|${channelId}|${extension}|OK`);
        } else {
            this.sendResponse(clientId, `DIAL|${channelId}|ERROR|Channel not found`);
        }
    }

    async handleSpeech(clientId, params) {
        const [channelId, action, ...speechParams] = params;
        const client = this.clients.get(clientId);
        
        if (!client || !client.channels.has(channelId)) {
            this.sendResponse(clientId, `SPEECH|${channelId}|ERROR|Channel not found`);
            return;
        }

        try {
            switch (action) {
                case 'TTS':
                    const [text] = speechParams;
                    const audioData = await this.speechService.textToSpeech(text);
                    if (audioData) {
                        this.sendResponse(clientId, `SPEECH|${channelId}|TTS|OK`);
                    } else {
                        this.sendResponse(clientId, `SPEECH|${channelId}|TTS|ERROR|TTS failed`);
                    }
                    break;
                
                case 'STT':
                    const [audioFile] = speechParams;
                    const audioBuffer = await this.speechService.readAudioFile(audioFile);
                    const text = await this.speechService.speechToText(audioBuffer);
                    if (text) {
                        this.sendResponse(clientId, `SPEECH|${channelId}|STT|${text}`);
                    } else {
                        this.sendResponse(clientId, `SPEECH|${channelId}|STT|ERROR|STT failed`);
                    }
                    break;
                
                default:
                    this.sendResponse(clientId, `SPEECH|${channelId}|ERROR|Unknown speech action`);
            }
        } catch (error) {
            console.error(`Speech error for channel ${channelId}:`, error);
            this.sendResponse(clientId, `SPEECH|${channelId}|ERROR|${error.message}`);
        }
    }

    sendResponse(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.socket) {
            client.socket.write(`${message}\n`);
            console.log(`Sent to ${clientId}: ${message}`);
        }
    }

    stop() {
        if (this.server) {
            this.server.close();
            console.log('AEP Server stopped');
        }
    }
}

// Start AEP Server
if (require.main === module) {
    const server = new AEPServer();
    server.start();

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('Shutting down AEP Server...');
        server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('Shutting down AEP Server...');
        server.stop();
        process.exit(0);
    });
}

module.exports = AEPServer;