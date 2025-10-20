import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

class Database:
    def __init__(self):
        self.connection = None
        self.connect()
    
    def connect(self):
        try:
            self.connection = pymysql.connect(
                host=os.getenv('DB_HOST', 'localhost'),
                port=int(os.getenv('DB_PORT', 3306)),
                user=os.getenv('DB_USER'),
                password=os.getenv('DB_PASSWORD'),
                database=os.getenv('DB_NAME'),
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
        except Exception as e:
            print(f"Database connection error: {e}")
            self.connection = None
    
    def get_branch_extension(self, branch_name):
        """ค้นหาหมายเลขภายในของสาขาจากชื่อสาขา"""
        if not self.connection:
            self.connect()
        
        if not self.connection:
            return None
        
        try:
            with self.connection.cursor() as cursor:
                # ค้นหาสาขาที่มีชื่อคล้ายกับที่ลูกค้าพูด
                sql = """
                SELECT extension, branch_name 
                FROM branches 
                WHERE branch_name LIKE %s 
                OR branch_name_th LIKE %s
                ORDER BY 
                    CASE 
                        WHEN branch_name = %s THEN 1
                        WHEN branch_name_th = %s THEN 2
                        ELSE 3
                    END
                LIMIT 1
                """
                search_term = f"%{branch_name}%"
                cursor.execute(sql, (search_term, search_term, branch_name, branch_name))
                result = cursor.fetchone()
                return result
        except Exception as e:
            print(f"Database query error: {e}")
            return None
    
    def close(self):
        if self.connection:
            self.connection.close()