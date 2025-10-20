# Node.js AEP Client for Asterisk

โค้ด Node.js สำหรับเชื่อมต่อกับ Asterisk ที่มีอยู่แล้วผ่าน AEP (Asterisk External Protocol)

## 📁 ไฟล์ที่จำเป็น

- `package.json` - Dependencies
- `.env` - Environment variables
- `database.js` - Database connection
- `google_speech.js` - Google Speech API
- `aep_client.js` - AEP Client
- `index.js` - Main application
- `test.js` - Test script
- `asterisk_config.sql` - Database schema

## 🚀 การติดตั้ง

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. ตั้งค่า environment variables

แก้ไขไฟล์ `.env`:

```env
# Node.js Application
NODE_ENV=production
PORT=3000

# Asterisk AEP Configuration
ASTERISK_HOST=127.0.0.1
ASTERISK_AEP_PORT=4573
AEP_SECRET=aeap_secret_key_123

# Google Cloud Configuration
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=callcenter
DB_USER=callcenter_user
DB_PASSWORD=your_password
```

### 3. ตั้งค่าฐานข้อมูล

```bash
mysql -u root -p < asterisk_config.sql
```

### 4. ตั้งค่า Google Cloud

วางไฟล์ `service-account-key.json` ในโฟลเดอร์โปรเจค

### 5. ตั้งค่า Asterisk

เพิ่มใน `extensions.conf`:

```ini
[incoming-aep]
exten => s,1,NoOp(Incoming call via AEP)
 same => n,Answer()
 same => n,AEAP(127.0.0.1:4573,aeap_secret_key_123,call_routing)
 same => n,Hangup()
```

เพิ่มใน `aeap.conf`:

```ini
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=4573
secret=aeap_secret_key_123
```

## 🧪 การทดสอบ

```bash
# ทดสอบระบบทั้งหมด
node test.js

# เริ่ม application
node index.js

# ทดสอบ API
curl http://localhost:3000/health
```

## 📊 API Endpoints

- `GET /health` - ตรวจสอบสถานะ
- `GET /api/calls` - ดูการโทรที่กำลังดำเนินอยู่
- `GET /api/stats` - ดูสถิติ
- `GET /api/aep/status` - ดูสถานะ AEP
- `POST /api/aep/connect` - เชื่อมต่อ AEP
- `POST /api/aep/disconnect` - ตัดการเชื่อมต่อ AEP

## 🔧 การใช้งาน

1. เริ่ม application: `node index.js`
2. ระบบจะเชื่อมต่อกับ Asterisk AEP อัตโนมัติ
3. เมื่อมีสายโทรเข้ามา ระบบจะ:
   - ถามสาขาที่ต้องการติดต่อ
   - แปลงเสียงเป็นข้อความ
   - ค้นหาสาขาในฐานข้อมูล
   - ยืนยันสาขา
   - โอนสายไปยังหมายเลขภายใน

## 🆘 การแก้ไขปัญหา

- ตรวจสอบ logs ใน console
- ตรวจสอบการเชื่อมต่อ AEP: `telnet localhost 4573`
- ตรวจสอบฐานข้อมูล: `mysql -u callcenter_user -p callcenter`
- ตรวจสอบ Google Cloud credentials