# Node.js AEP Client for Existing Asterisk

Node.js application ที่เชื่อมต่อกับ Asterisk ที่มีอยู่แล้วผ่าน AEP (Asterisk External Protocol) เพื่อทำการ routing สายโทรศัพท์ตามสาขาที่ลูกค้าต้องการติดต่อ

## 🎯 ภาพรวมระบบ

ระบบนี้จะทำงานตามขั้นตอนต่อไปนี้:
1. ลูกค้าโทรเข้ามา → ระบบพูด "กรุณาพูดสาขาที่ต้องการติดต่อ"
2. ลูกค้าพูดชื่อสาขา → ระบบแปลงเสียงเป็นข้อความ
3. ระบบยืนยัน → "คุณต้องการติดต่อสาขา...ใช่หรือไม่"
4. ลูกค้าตอบ "ใช่" → ระบบค้นหาหมายเลขภายในและโอนสาย
5. ลูกค้าตอบ "ไม่ใช่" → ระบบถามใหม่

## 🚀 เทคโนโลยีที่ใช้

- **Node.js** - Runtime สำหรับ JavaScript
- **AEP (Asterisk External Protocol)** - การเชื่อมต่อระหว่าง Asterisk กับแอปพลิเคชันภายนอก
- **Google Cloud Speech API** - Speech-to-Text และ Text-to-Speech
- **MySQL** - ฐานข้อมูลสำหรับเก็บข้อมูลสาขา
- **Asterisk PBX** - ระบบโทรศัพท์ที่มีอยู่แล้ว

## 📋 ข้อกำหนดระบบ

- Asterisk PBX ที่ติดตั้งแล้ว (เวอร์ชัน 16+)
- Node.js 16.0+
- MySQL/MariaDB
- Google Cloud Platform account
- Ubuntu/Debian Linux

## 🔧 การติดตั้ง

### 1. ดาวน์โหลดและติดตั้ง

```bash
# Clone repository
git clone <repository-url>
cd asterisk-callcenter-aep-client

# ติดตั้ง Node.js และ dependencies
sudo ./install_nodejs_only.sh
```

### 2. ตั้งค่า Google Cloud

1. สร้าง Google Cloud Project
2. เปิดใช้งาน Speech-to-Text และ Text-to-Speech APIs
3. สร้าง Service Account และดาวน์โหลด JSON key
4. วางไฟล์ key ใน `/workspace/service-account-key.json`

### 3. ตั้งค่าฐานข้อมูล

```bash
# แก้ไขไฟล์ .env
cp .env.example .env
nano .env

# สร้างฐานข้อมูล
mysql -u root -p < database/schema.sql
```

### 4. เริ่มระบบ

```bash
# เริ่ม service
sudo systemctl start callcenter-aep-client

# ตรวจสอบสถานะ
sudo systemctl status callcenter-aep-client

# ดู logs
sudo journalctl -u callcenter-aep-client -f
```

## 🔧 การตั้งค่า Asterisk

ระบบจะติดตั้ง AEP configuration ใน Asterisk โดยอัตโนมัติ:

- **aeap.conf** - ตั้งค่า AEP server
- **extensions_aep.conf** - เพิ่ม context สำหรับ AEP
- **modules_aep.conf** - โหลด modules ที่จำเป็น
- **manager_aep.conf** - ตั้งค่า manager access

### การทดสอบ AEP

```bash
# ทดสอบการเชื่อมต่อ AEP
telnet localhost 4573

# ทดสอบ call routing
# โทรไปยัง extension 9999
```

## 📁 โครงสร้างโปรเจค

```
asterisk-callcenter-aep-client/
├── aep_client.js                 # AEP Client สำหรับเชื่อมต่อ Asterisk
├── call_handlers.js              # Call handlers สำหรับจัดการการโทร
├── index.js                      # Main HTTP API server
├── config/
│   ├── database.js               # Database connection
│   └── google_speech.js          # Google Speech API
├── asterisk_config/
│   ├── aeap.conf                 # AEP configuration
│   ├── extensions_aep.conf       # AEP extensions
│   ├── modules_aep.conf          # AEP modules
│   ├── manager_aep.conf          # AEP manager
│   └── install_asterisk_config.sh # Installation script
├── database/
│   └── schema.sql                # Database schema
├── test/
│   └── test_system.js            # Test script
├── package.json                  # Node.js dependencies
├── .env.example                  # Environment variables template
├── install_nodejs_only.sh        # Installation script
└── README_AEP_CLIENT.md          # Documentation
```

## 🧪 การทดสอบ

### ทดสอบระบบทั้งหมด

```bash
npm test
```

### ทดสอบการเชื่อมต่อ AEP

```bash
# เริ่ม AEP Client
node aep_client.js

# ทดสอบการเชื่อมต่อ
telnet localhost 4573
```

### ทดสอบ HTTP API

```bash
# เริ่ม HTTP API Server
node index.js

# ทดสอบ Health Check
curl http://localhost:3000/health

# ทดสอบ AEP Status
curl http://localhost:3000/api/aep/status
```

### ทดสอบการโทร

1. ตั้งค่า SIP client (เช่น Zoiper, X-Lite)
2. โทรไปยังหมายเลขที่ตั้งค่าไว้
3. ระบบจะถามสาขาที่ต้องการติดต่อ
4. พูดชื่อสาขา (เช่น "กรุงเทพ", "เชียงใหม่")
5. ยืนยันการโอนสาย

## 🔧 การตั้งค่า

### ไฟล์ .env

```env
# Node.js Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Asterisk AEP Configuration
ASTERISK_HOST=127.0.0.1
ASTERISK_AEP_PORT=4573
AEP_SECRET=aeap_secret_key_123

# Google Cloud Configuration
GOOGLE_APPLICATION_CREDENTIALS=/workspace/service-account-key.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=callcenter
DB_USER=callcenter_user
DB_PASSWORD=your_password
```

### การเพิ่มสาขาใหม่

```sql
INSERT INTO branches (branch_name, branch_name_th, extension, phone_number, address, manager_name) 
VALUES ('New Branch', 'สาขาใหม่', '110', '02-999-9999', 'ที่อยู่สาขา', 'ชื่อผู้จัดการ');
```

## 📊 API Endpoints

### Health Check
- `GET /health` - ตรวจสอบสถานะระบบ

### Call Management
- `GET /api/calls` - ดูการโทรที่กำลังดำเนินอยู่
- `GET /api/stats` - ดูสถิติการโทร
- `GET /api/call-logs` - ดู log การโทร
- `POST /api/call-logs` - บันทึก log การโทร

### AEP Control
- `GET /api/aep/status` - ดูสถานะ AEP
- `POST /api/aep/connect` - เชื่อมต่อ AEP
- `POST /api/aep/disconnect` - ตัดการเชื่อมต่อ AEP

## 🔍 การแก้ไขปัญหา

### ตรวจสอบ Log

```bash
# Application logs
tail -f logs/combined.log
tail -f logs/error.log

# System logs
sudo journalctl -u callcenter-aep-client -f

# Asterisk logs
tail -f /var/log/asterisk/full
```

### ปัญหาที่พบบ่อย

1. **AEP Client ไม่เชื่อมต่อ**
   - ตรวจสอบ Asterisk AEP: `asterisk -rx "aeap show settings"`
   - ตรวจสอบ port 4573: `netstat -tlnp | grep 4573`
   - ตรวจสอบ firewall: `ufw status`

2. **Google Speech API ไม่ทำงาน**
   - ตรวจสอบ GOOGLE_APPLICATION_CREDENTIALS
   - ตรวจสอบ API quotas และ billing

3. **ฐานข้อมูลเชื่อมต่อไม่ได้**
   - ตรวจสอบการตั้งค่าใน .env
   - ตรวจสอบ MySQL service: `systemctl status mysql`

4. **Asterisk ไม่โหลด AEP module**
   - ตรวจสอบ modules.conf: `asterisk -rx "module show like aeap"`
   - รีโหลด modules: `asterisk -rx "module reload"`

## 🚀 การพัฒนาต่อ

### เพิ่มฟีเจอร์ใหม่

1. **Multi-language Support** - รองรับหลายภาษา
2. **Call Recording** - บันทึกการสนทนา
3. **Analytics Dashboard** - แดชบอร์ดวิเคราะห์ข้อมูล
4. **WebRTC Integration** - รองรับการโทรผ่านเว็บเบราว์เซอร์

### การปรับแต่ง

- แก้ไขข้อความใน `system_config` table
- ปรับแต่งเสียง TTS ใน `config/google_speech.js`
- เพิ่ม validation rules ใน call handlers

## 📞 การสนับสนุน

สำหรับการสนับสนุน กรุณาติดต่อทีมพัฒนา

## 📄 License

MIT License