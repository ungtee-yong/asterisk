const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class GoogleSpeechService {
    constructor() {
        // ตั้งค่า Google Cloud credentials
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        }

        // สร้าง clients
        this.speechClient = new speech.SpeechClient();
        this.ttsClient = new textToSpeech.TextToSpeechClient();
    }

    async speechToText(audioData, sampleRate = 8000, languageCode = 'th-TH') {
        try {
            const audio = {
                content: audioData.toString('base64')
            };

            const config = {
                encoding: 'LINEAR16',
                sampleRateHertz: sampleRate,
                languageCode: languageCode,
                enableAutomaticPunctuation: true,
                model: 'latest_long'
            };

            const request = {
                audio: audio,
                config: config
            };

            const [response] = await this.speechClient.recognize(request);
            
            if (response.results && response.results.length > 0) {
                return response.results[0].alternatives[0].transcript.trim();
            } else {
                return null;
            }
        } catch (error) {
            console.error('Speech-to-Text error:', error);
            return null;
        }
    }

    async textToSpeech(text, languageCode = 'th-TH', voiceName = 'th-TH-Standard-A') {
        try {
            const request = {
                input: { text: text },
                voice: {
                    languageCode: languageCode,
                    name: voiceName,
                    ssmlGender: 'FEMALE'
                },
                audioConfig: {
                    audioEncoding: 'LINEAR16',
                    sampleRateHertz: 8000
                }
            };

            const [response] = await this.ttsClient.synthesizeSpeech(request);
            return response.audioContent;
        } catch (error) {
            console.error('Text-to-Speech error:', error);
            return null;
        }
    }

    async createAudioFile(audioData, filename) {
        try {
            await fs.promises.writeFile(filename, audioData);
            return true;
        } catch (error) {
            console.error('Error creating audio file:', error);
            return false;
        }
    }

    async readAudioFile(filename) {
        try {
            const audioData = await fs.promises.readFile(filename);
            return audioData;
        } catch (error) {
            console.error('Error reading audio file:', error);
            return null;
        }
    }
}

module.exports = GoogleSpeechService;