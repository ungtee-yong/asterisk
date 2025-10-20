# Simple Asterisk AEP Client

โค้ด Node.js แบบง่ายสำหรับเชื่อมต่อกับ Asterisk ผ่าน AEP (Asterisk External Protocol) พร้อมระบบ routing สายโทรตามสาขา

## 🎯 ฟีเจอร์หลัก

- **เชื่อมต่อกับ Asterisk ผ่าน AEP** - ใช้ protocol ที่เร็วและเสถียร
- **Speech-to-Text** - แปลงเสียงพูดเป็นข้อความด้วย Google Cloud Speech API
- **Text-to-Speech** - แปลงข้อความเป็นเสียงด้วย Google Cloud TTS API
- **ยืนยันสาขา** - ถามยืนยันสาขาก่อนโอนสาย
- **ค้นหาหมายเลขภายใน** - ค้นหาสาขาในฐานข้อมูล MySQL
- **โอนสายอัตโนมัติ** - โอนสายไปยังหมายเลขภายในที่ถูกต้อง

## 📁 ไฟล์หลัก

- **`simple_aep_client.js`** - AEP Client หลัก (เข้าใจง่าย)
- **`simple_index.js`** - Main application
- **`simple_test.js`** - ทดสอบระบบ
- **`simple_asterisk_config.conf`** - การตั้งค่า Asterisk
- **`simple_install.sh`** - สคริปต์ติดตั้ง
- **`database.js`** - เชื่อมต่อฐานข้อมูล
- **`google_speech.js`** - Google Speech API

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

เพิ่มการตั้งค่าใน `simple_asterisk_config.conf` ลงในไฟล์ config ของ Asterisk

### 6. ติดตั้งระบบ

```bash
chmod +x simple_install.sh
./simple_install.sh
```

## 🧪 การทดสอบ

```bash
# ทดสอบระบบทั้งหมด
node simple_test.js

# เริ่ม application
node simple_index.js

# ทดสอบ API
curl http://localhost:3000/health
```

## 📊 API Endpoints

- **`GET /health`** - ตรวจสอบสถานะระบบ
- **`GET /api/status`** - ดูสถานะ AEP
- **`POST /api/connect`** - เชื่อมต่อ AEP
- **`POST /api/disconnect`** - ตัดการเชื่อมต่อ AEP

## 🔄 กระบวนการทำงาน

1. **รับสายโทรเข้า** - ระบบรับสายจาก Asterisk
2. **ถามสาขา** - พูด "กรุณาพูดสาขาที่ต้องการติดต่อ"
3. **รับข้อมูลเสียง** - บันทึกเสียงและแปลงเป็นข้อความ
4. **ค้นหาสาขา** - ค้นหาในฐานข้อมูล MySQL
5. **ยืนยันสาขา** - ถาม "คุณต้องการติดต่อสาขา... ใช่หรือไม่"
6. **โอนสาย** - โอนสายไปยังหมายเลขภายในที่ถูกต้อง

## 🛠️ การจัดการระบบ

```bash
# เริ่มระบบ
systemctl start simple-asterisk-aep-client

# หยุดระบบ
systemctl stop simple-asterisk-aep-client

# ตรวจสอบสถานะ
systemctl status simple-asterisk-aep-client

# ดู logs
journalctl -u simple-asterisk-aep-client -f

# รีสตาร์ทระบบ
systemctl restart simple-asterisk-aep-client
```

## 🔧 การแก้ไขปัญหา

### ตรวจสอบการเชื่อมต่อ AEP

```bash
telnet localhost 4573
```

### ตรวจสอบฐานข้อมูล

```bash
mysql -u callcenter_user -p callcenter
```

### ตรวจสอบ Google Cloud

```bash
export GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
gcloud auth application-default print-access-token
```

### ตรวจสอบ Asterisk

```bash
asterisk -rx "aeap show status"
asterisk -rx "module show like aeap"
```

## 📝 ตัวอย่างการใช้งาน

### เริ่มระบบ

```bash
node simple_index.js
```

### ทดสอบการเชื่อมต่อ

```bash
curl http://localhost:3000/health
```

### ดูสถานะ

```bash
curl http://localhost:3000/api/status
```

## 🎉 ข้อดีของโค้ดนี้

- **เข้าใจง่าย** - โค้ดมี comment ภาษาไทย
- **แยกส่วนชัดเจน** - แต่ละฟังก์ชันมีหน้าที่เฉพาะ
- **Error handling** - จัดการข้อผิดพลาดได้ดี
- **Logging** - มี log ที่ชัดเจน
- **API** - มี REST API สำหรับจัดการ
- **Testing** - มีสคริปต์ทดสอบ

## 🆘 การสนับสนุน

หากมีปัญหา กรุณาตรวจสอบ:

1. **Logs** - ดู logs ใน console หรือ journalctl
2. **การเชื่อมต่อ** - ตรวจสอบการเชื่อมต่อ AEP, ฐานข้อมูล, Google Cloud
3. **การตั้งค่า** - ตรวจสอบไฟล์ .env และการตั้งค่า Asterisk
4. **Dependencies** - ตรวจสอบการติดตั้ง npm packages