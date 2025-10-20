#!/usr/bin/env python3
"""
Script สำหรับสร้างและเริ่มต้นฐานข้อมูล
"""

import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

def init_database():
    """สร้างและเริ่มต้นฐานข้อมูล"""
    try:
        # เชื่อมต่อฐานข้อมูลโดยไม่ระบุ database
        connection = pymysql.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', 3306)),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            charset='utf8mb4'
        )
        
        with connection.cursor() as cursor:
            # อ่านไฟล์ schema
            with open('database/schema.sql', 'r', encoding='utf-8') as f:
                schema_sql = f.read()
            
            # แยกคำสั่ง SQL และรันทีละคำสั่ง
            statements = schema_sql.split(';')
            for statement in statements:
                statement = statement.strip()
                if statement and not statement.startswith('--'):
                    try:
                        cursor.execute(statement)
                        print(f"Executed: {statement[:50]}...")
                    except Exception as e:
                        print(f"Error executing statement: {e}")
                        print(f"Statement: {statement}")
            
            connection.commit()
            print("Database initialized successfully!")
            
    except Exception as e:
        print(f"Error initializing database: {e}")
    finally:
        if 'connection' in locals():
            connection.close()

if __name__ == "__main__":
    init_database()