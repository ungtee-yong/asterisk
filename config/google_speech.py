import os
import io
import wave
from google.cloud import speech
from google.cloud import texttospeech
from dotenv import load_dotenv

load_dotenv()

class GoogleSpeechService:
    def __init__(self):
        # ตั้งค่า Google Cloud credentials
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        
        # สร้าง clients
        self.speech_client = speech.SpeechClient()
        self.tts_client = texttospeech.TextToSpeechClient()
    
    def speech_to_text(self, audio_data, sample_rate=8000, language_code='th-TH'):
        """แปลงเสียงเป็นข้อความ"""
        try:
            # ตั้งค่า audio config
            audio = speech.RecognitionAudio(content=audio_data)
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=sample_rate,
                language_code=language_code,
                enable_automatic_punctuation=True,
                model='latest_long'
            )
            
            # เรียกใช้ Speech-to-Text API
            response = self.speech_client.recognize(config=config, audio=audio)
            
            if response.results:
                return response.results[0].alternatives[0].transcript.strip()
            else:
                return None
                
        except Exception as e:
            print(f"Speech-to-Text error: {e}")
            return None
    
    def text_to_speech(self, text, language_code='th-TH', voice_name='th-TH-Standard-A'):
        """แปลงข้อความเป็นเสียง"""
        try:
            # ตั้งค่า synthesis input
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            # ตั้งค่า voice parameters
            voice = texttospeech.VoiceSelectionParams(
                language_code=language_code,
                name=voice_name,
                ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
            )
            
            # ตั้งค่า audio config
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                sample_rate_hertz=8000
            )
            
            # เรียกใช้ Text-to-Speech API
            response = self.tts_client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )
            
            return response.audio_content
            
        except Exception as e:
            print(f"Text-to-Speech error: {e}")
            return None
    
    def create_audio_file(self, audio_data, filename):
        """สร้างไฟล์เสียงจาก audio data"""
        try:
            with open(filename, 'wb') as f:
                f.write(audio_data)
            return True
        except Exception as e:
            print(f"Error creating audio file: {e}")
            return False