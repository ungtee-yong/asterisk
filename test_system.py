#!/usr/bin/env python3
"""
Test script for the Call Center system
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config.database import Database
from config.google_speech import GoogleSpeechService
import tempfile

def test_database_connection():
    """ทดสอบการเชื่อมต่อฐานข้อมูล"""
    print("Testing database connection...")
    try:
        db = Database()
        if db.connection:
            print("✓ Database connection successful")
            
            # ทดสอบการค้นหาสาขา
            result = db.get_branch_extension("กรุงเทพ")
            if result:
                print(f"✓ Branch search successful: {result}")
            else:
                print("✗ Branch search failed")
            
            db.close()
        else:
            print("✗ Database connection failed")
    except Exception as e:
        print(f"✗ Database error: {e}")

def test_google_speech():
    """ทดสอบ Google Speech API"""
    print("\nTesting Google Speech API...")
    try:
        gs = GoogleSpeechService()
        
        # ทดสอบ Text-to-Speech
        print("Testing Text-to-Speech...")
        audio_data = gs.text_to_speech("สวัสดีครับ ยินดีต้อนรับสู่ระบบ Call Center")
        if audio_data:
            print("✓ Text-to-Speech successful")
            
            # บันทึกไฟล์เสียงเพื่อทดสอบ
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
                f.write(audio_data)
                print(f"✓ Audio file saved: {f.name}")
        else:
            print("✗ Text-to-Speech failed")
        
        # ทดสอบ Speech-to-Text (ต้องมีไฟล์เสียง)
        print("\nTesting Speech-to-Text...")
        print("Note: Speech-to-Text requires audio file input")
        
    except Exception as e:
        print(f"✗ Google Speech error: {e}")

def test_agi_script():
    """ทดสอบ AGI script"""
    print("\nTesting AGI script...")
    try:
        # ตรวจสอบว่าไฟล์ AGI script มีอยู่
        agi_path = "/var/lib/asterisk/agi-bin/call_routing.py"
        if os.path.exists(agi_path):
            print("✓ AGI script exists")
            
            # ตรวจสอบ permissions
            if os.access(agi_path, os.X_OK):
                print("✓ AGI script is executable")
            else:
                print("✗ AGI script is not executable")
        else:
            print("✗ AGI script not found")
            
    except Exception as e:
        print(f"✗ AGI script error: {e}")

def test_asterisk_config():
    """ทดสอบการตั้งค่า Asterisk"""
    print("\nTesting Asterisk configuration...")
    try:
        config_files = [
            "/etc/asterisk/extensions.conf",
            "/etc/asterisk/sip.conf",
            "/etc/asterisk/manager.conf",
            "/etc/asterisk/modules.conf"
        ]
        
        for config_file in config_files:
            if os.path.exists(config_file):
                print(f"✓ {config_file} exists")
            else:
                print(f"✗ {config_file} missing")
                
    except Exception as e:
        print(f"✗ Asterisk config error: {e}")

def main():
    """ฟังก์ชันหลักสำหรับทดสอบระบบ"""
    print("Call Center System Test")
    print("=" * 50)
    
    # ทดสอบการเชื่อมต่อฐานข้อมูล
    test_database_connection()
    
    # ทดสอบ Google Speech API
    test_google_speech()
    
    # ทดสอบ AGI script
    test_agi_script()
    
    # ทดสอบการตั้งค่า Asterisk
    test_asterisk_config()
    
    print("\n" + "=" * 50)
    print("Test completed!")

if __name__ == "__main__":
    main()