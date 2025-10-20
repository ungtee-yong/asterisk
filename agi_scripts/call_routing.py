#!/usr/bin/env python3
"""
AGI Script สำหรับจัดการ call routing ผ่าน Google Speech API
"""

import sys
import os
import tempfile
import time
from config.google_speech import GoogleSpeechService
from config.database import Database

class CallRoutingAGI:
    def __init__(self):
        self.speech_service = GoogleSpeechService()
        self.database = Database()
        
    def log(self, message):
        """เขียน log ไปยัง Asterisk"""
        print(f"VERBOSE \"{message}\" 1", flush=True)
        sys.stdout.flush()
    
    def agi_command(self, command):
        """ส่งคำสั่งไปยัง Asterisk"""
        print(command, flush=True)
        sys.stdout.flush()
        return sys.stdin.readline().strip()
    
    def play_audio_file(self, filename):
        """เล่นไฟล์เสียง"""
        return self.agi_command(f"STREAM FILE {filename} \"\"")
    
    def record_audio(self, filename, duration=5, silence=2):
        """บันทึกเสียงจากผู้โทร"""
        return self.agi_command(f"RECORD FILE {filename} wav {duration} {silence}")
    
    def say_text(self, text):
        """พูดข้อความผ่าน TTS"""
        try:
            # แปลงข้อความเป็นเสียง
            audio_data = self.speech_service.text_to_speech(text)
            if not audio_data:
                return False
            
            # สร้างไฟล์เสียงชั่วคราว
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_filename = temp_file.name
            
            # เล่นไฟล์เสียง
            result = self.play_audio_file(temp_filename)
            
            # ลบไฟล์ชั่วคราว
            os.unlink(temp_filename)
            
            return result
        except Exception as e:
            self.log(f"Error in say_text: {e}")
            return False
    
    def get_speech_input(self, prompt_text, max_attempts=3):
        """รับข้อมูลเสียงจากผู้โทร"""
        for attempt in range(max_attempts):
            # พูดข้อความถาม
            self.say_text(prompt_text)
            
            # บันทึกเสียง
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_filename = temp_file.name
            
            self.log(f"Recording attempt {attempt + 1}")
            record_result = self.record_audio(temp_filename, duration=10, silence=3)
            
            if record_result and "200" in record_result:
                # อ่านไฟล์เสียง
                try:
                    with open(temp_filename, 'rb') as f:
                        audio_data = f.read()
                    
                    # แปลงเสียงเป็นข้อความ
                    text = self.speech_service.speech_to_text(audio_data)
                    
                    # ลบไฟล์ชั่วคราว
                    os.unlink(temp_filename)
                    
                    if text:
                        self.log(f"Recognized text: {text}")
                        return text
                    else:
                        self.log("No speech recognized")
                        if attempt < max_attempts - 1:
                            self.say_text("ขออภัย ไม่ได้ยินเสียง กรุณาพูดอีกครั้ง")
                except Exception as e:
                    self.log(f"Error processing audio: {e}")
                    if os.path.exists(temp_filename):
                        os.unlink(temp_filename)
            else:
                self.log("Recording failed")
            
            if attempt < max_attempts - 1:
                time.sleep(1)
        
        return None
    
    def confirm_branch(self, branch_name):
        """ยืนยันสาขาที่ลูกค้าต้องการติดต่อ"""
        confirmation_text = f"คุณต้องการติดต่อสาขา {branch_name} ใช่หรือไม่"
        self.say_text(confirmation_text)
        
        # รับคำตอบ
        response = self.get_speech_input("กรุณาพูด ใช่ หรือ ไม่ใช่")
        
        if response:
            # ตรวจสอบคำตอบ
            response_lower = response.lower()
            if any(word in response_lower for word in ['ใช่', 'yes', 'ถูกต้อง', 'ถูก']):
                return True
            elif any(word in response_lower for word in ['ไม่ใช่', 'no', 'ไม่ถูก', 'ผิด']):
                return False
        
        return False
    
    def route_call(self, extension):
        """โอนสายไปยังหมายเลขภายใน"""
        self.log(f"Transferring call to extension {extension}")
        return self.agi_command(f"DIAL SIP/{extension},30")
    
    def main(self):
        """ฟังก์ชันหลักของ AGI script"""
        try:
            self.log("Call routing AGI started")
            
            # 1. รับข้อมูลสาขาที่ต้องการติดต่อ
            branch_input = self.get_speech_input("กรุณาพูดสาขาที่ต้องการติดต่อ")
            
            if not branch_input:
                self.say_text("ขออภัย ไม่สามารถรับข้อมูลได้ กรุณาลองใหม่อีกครั้ง")
                return
            
            self.log(f"Customer requested branch: {branch_input}")
            
            # 2. ค้นหาสาขาในฐานข้อมูล
            branch_info = self.database.get_branch_extension(branch_input)
            
            if not branch_info:
                self.say_text(f"ขออภัย ไม่พบสาขา {branch_input} กรุณาติดต่อเจ้าหน้าที่")
                return
            
            # 3. ยืนยันสาขา
            if not self.confirm_branch(branch_info['branch_name']):
                self.say_text("กรุณาพูดสาขาที่ต้องการติดต่ออีกครั้ง")
                return
            
            # 4. โอนสาย
            self.say_text(f"กำลังโอนสายไปยังสาขา {branch_info['branch_name']}")
            transfer_result = self.route_call(branch_info['extension'])
            
            if transfer_result and "200" in transfer_result:
                self.log("Call transferred successfully")
            else:
                self.say_text("ขออภัย ไม่สามารถโอนสายได้ในขณะนี้ กรุณาติดต่อเจ้าหน้าที่")
            
        except Exception as e:
            self.log(f"Error in main: {e}")
            self.say_text("ขออภัย เกิดข้อผิดพลาดในระบบ กรุณาติดต่อเจ้าหน้าที่")
        
        finally:
            # ปิดการเชื่อมต่อฐานข้อมูล
            self.database.close()

if __name__ == "__main__":
    agi = CallRoutingAGI()
    agi.main()