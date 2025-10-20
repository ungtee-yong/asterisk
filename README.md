# Asterisk Call Center with Google Speech Integration

ระบบ Call Center ที่ใช้ Asterisk เชื่อมต่อกับ Google Speech-to-Text และ Text-to-Speech เพื่อทำการ routing สายโทรศัพท์ตามสาขาที่ลูกค้าต้องการติดต่อ

## 🎯 ภาพรวมระบบ

ระบบนี้จะทำงานตามขั้นตอนต่อไปนี้:
1. ลูกค้าโทรเข้ามา → ระบบพูด "กรุณาพูดสาขาที่ต้องการติดต่อ"
2. ลูกค้าพูดชื่อสาขา → ระบบแปลงเสียงเป็นข้อความ
3. ระบบยืนยัน → "คุณต้องการติดต่อสาขา...ใช่หรือไม่"
4. ลูกค้าตอบ "ใช่" → ระบบค้นหาหมายเลขภายในและโอนสาย
5. ลูกค้าตอบ "ไม่ใช่" → ระบบถามใหม่

## คุณสมบัติ

- **Speech-to-Text**: รับข้อมูลเสียงจากลูกค้าและแปลงเป็นข้อความ
- **Text-to-Speech**: แปลงข้อความเป็นเสียงเพื่อพูดกับลูกค้า
- **Branch Routing**: ค้นหาและโอนสายไปยังสาขาที่ลูกค้าต้องการ
- **Confirmation System**: ยืนยันสาขาก่อนโอนสาย
- **Database Integration**: เก็บข้อมูลสาขาและ log การโทร
- **Thai Language Support**: รองรับภาษาไทย

## Call Flow

1. ลูกค้าโทรเข้ามา
2. ระบบพูด: "กรุณาพูดสาขาที่ต้องการติดต่อ"
3. ลูกค้าพูดชื่อสาขา
4. ระบบยืนยัน: "คุณต้องการติดต่อสาขา...ใช่หรือไม่"
5. ถ้าลูกค้าพูด "ใช่" ระบบจะค้นหาหมายเลขภายในและโอนสาย
6. ถ้าลูกค้าพูด "ไม่ใช่" ระบบจะถามใหม่

## การติดตั้ง

### ข้อกำหนดระบบ

- Ubuntu/Debian Linux
- Python 3.7+
- MySQL/MariaDB
- Asterisk PBX
- Google Cloud Platform account

### ขั้นตอนการติดตั้ง

1. **Clone repository**
```bash
git clone <repository-url>
cd asterisk-callcenter
```

2. **รันสคริปต์ติดตั้ง**
```bash
sudo ./install.sh
```

3. **ตั้งค่า Google Cloud**
   - สร้าง Google Cloud Project
   - เปิดใช้งาน Speech-to-Text และ Text-to-Speech APIs
   - สร้าง Service Account และดาวน์โหลด JSON key
   - วางไฟล์ key ใน `/workspace/`

4. **ตั้งค่าฐานข้อมูล**
```bash
# แก้ไขไฟล์ .env
cp .env.example .env
nano .env

# รันสคริปต์สร้างฐานข้อมูล
python3 database/init_db.py
```

5. **รีสตาร์ทเซอร์วิส**
```bash
sudo systemctl restart asterisk
sudo systemctl restart callcenter-agi
```

## การตั้งค่า

### ไฟล์ .env

```env
# Google Cloud Configuration
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=callcenter
DB_USER=callcenter_user
DB_PASSWORD=your_password

# Asterisk Configuration
ASTERISK_AGI_PATH=/var/lib/asterisk/agi-bin
```

### การเพิ่มสาขาใหม่

```sql
INSERT INTO branches (branch_name, branch_name_th, extension, phone_number, address, manager_name) 
VALUES ('New Branch', 'สาขาใหม่', '110', '02-999-9999', 'ที่อยู่สาขา', 'ชื่อผู้จัดการ');
```

## โครงสร้างโปรเจค

```
asterisk-callcenter/
├── agi_scripts/
│   └── call_routing.py          # AGI script หลัก
├── asterisk/
│   ├── extensions.conf          # Asterisk dialplan
│   ├── sip.conf                 # SIP configuration
│   ├── manager.conf             # AMI configuration
│   └── modules.conf             # Module configuration
├── config/
│   ├── google_speech.py         # Google Speech API integration
│   └── database.py              # Database connection
├── database/
│   ├── schema.sql               # Database schema
│   └── init_db.py               # Database initialization
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment variables template
├── install.sh                   # Installation script
└── README.md                    # Documentation
```

## การทดสอบ

### ทดสอบการเชื่อมต่อฐานข้อมูล

```bash
python3 -c "from config.database import Database; db = Database(); print(db.get_branch_extension('กรุงเทพ'))"
```

### ทดสอบ Google Speech API

```bash
python3 -c "from config.google_speech import GoogleSpeechService; gs = GoogleSpeechService(); print(gs.text_to_speech('สวัสดีครับ'))"
```

### ทดสอบการโทร

1. ตั้งค่า SIP client (เช่น Zoiper, X-Lite)
2. โทรไปยังหมายเลขที่ตั้งค่าไว้
3. ระบบจะถามสาขาที่ต้องการติดต่อ
4. พูดชื่อสาขา (เช่น "กรุงเทพ", "เชียงใหม่")
5. ยืนยันการโอนสาย

## การแก้ไขปัญหา

### ตรวจสอบ Log

```bash
# Asterisk logs
tail -f /var/log/asterisk/full

# AGI script logs
tail -f /var/log/asterisk/callcenter/agi.log

# System logs
journalctl -u callcenter-agi -f
```

### ปัญหาที่พบบ่อย

1. **AGI script ไม่ทำงาน**
   - ตรวจสอบ permissions: `chmod +x /var/lib/asterisk/agi-bin/call_routing.py`
   - ตรวจสอบ Python path ใน AGI script

2. **Google Speech API ไม่ทำงาน**
   - ตรวจสอบ GOOGLE_APPLICATION_CREDENTIALS
   - ตรวจสอบ API quotas และ billing

3. **ฐานข้อมูลเชื่อมต่อไม่ได้**
   - ตรวจสอบการตั้งค่าใน .env
   - ตรวจสอบ MySQL service: `systemctl status mysql`

## การพัฒนาต่อ

### เพิ่มฟีเจอร์ใหม่

1. **Multi-language Support**: รองรับหลายภาษา
2. **Call Recording**: บันทึกการสนทนา
3. **Analytics Dashboard**: แดชบอร์ดวิเคราะห์ข้อมูล
4. **WebRTC Integration**: รองรับการโทรผ่านเว็บเบราว์เซอร์

### การปรับแต่ง

- แก้ไขข้อความใน `system_config` table
- ปรับแต่งเสียง TTS ใน `config/google_speech.py`
- เพิ่ม validation rules ใน AGI script

## License

MIT License

## Support

สำหรับการสนับสนุน กรุณาติดต่อทีมพัฒนา