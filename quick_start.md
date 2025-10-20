# Quick Start Guide - Node.js AEP Client

คู่มือเริ่มต้นใช้งาน Node.js AEP Client สำหรับ Asterisk ที่มีอยู่แล้ว

## 🚀 การติดตั้งแบบรวดเร็ว

### 1. ติดตั้งระบบ

```bash
# Clone repository
git clone <repository-url>
cd asterisk-callcenter-aep-client

# ติดตั้ง Node.js และ dependencies
sudo ./install_nodejs_only.sh
```

### 2. ตั้งค่า Google Cloud

```bash
# วาง Google Cloud service account key
cp your-service-account-key.json /workspace/service-account-key.json

# แก้ไขไฟล์ .env
cp .env.example .env
nano .env
```

### 3. ตั้งค่าฐานข้อมูล

```bash
# สร้างฐานข้อมูล
mysql -u root -p < database/schema.sql
```

### 4. เริ่มระบบ

```bash
# เริ่ม service
sudo systemctl start callcenter-aep-client

# ตรวจสอบสถานะ
sudo systemctl status callcenter-aep-client
```

## 🧪 การทดสอบ

### ทดสอบระบบทั้งหมด

```bash
npm test
```

### ทดสอบการเชื่อมต่อ

```bash
# ทดสอบ HTTP API
curl http://localhost:3000/health

# ทดสอบ AEP Status
curl http://localhost:3000/api/aep/status

# ทดสอบการเชื่อมต่อ AEP
telnet localhost 4573
```

### ทดสอบการโทร

1. ตั้งค่า SIP client
2. โทรไปยัง extension 9999 (test extension)
3. ระบบจะถามสาขาที่ต้องการติดต่อ
4. พูดชื่อสาขา
5. ยืนยันการโอนสาย

## 🔧 การตั้งค่า Asterisk

ระบบจะติดตั้ง AEP configuration ใน Asterisk โดยอัตโนมัติ แต่ถ้าต้องการติดตั้งเอง:

```bash
# ติดตั้ง AEP configuration
sudo ./asterisk_config/install_asterisk_config.sh

# รีโหลด Asterisk
asterisk -rx "module reload"
```

## 📊 การตรวจสอบสถานะ

### ตรวจสอบ Logs

```bash
# Application logs
tail -f logs/combined.log

# System logs
sudo journalctl -u callcenter-aep-client -f

# Asterisk logs
tail -f /var/log/asterisk/full
```

### ตรวจสอบ AEP

```bash
# ตรวจสอบ AEP module
asterisk -rx "module show like aeap"

# ตรวจสอบ AEP settings
asterisk -rx "aeap show settings"

# ตรวจสอบ AEP connections
asterisk -rx "aeap show connections"
```

## 🆘 การแก้ไขปัญหา

### AEP ไม่เชื่อมต่อ

```bash
# ตรวจสอบ port 4573
netstat -tlnp | grep 4573

# ตรวจสอบ firewall
ufw status

# รีสตาร์ท service
sudo systemctl restart callcenter-aep-client
```

### Google Speech API ไม่ทำงาน

```bash
# ตรวจสอบ credentials
ls -la /workspace/service-account-key.json

# ตรวจสอบ environment variables
cat .env | grep GOOGLE
```

### ฐานข้อมูลเชื่อมต่อไม่ได้

```bash
# ตรวจสอบ MySQL
sudo systemctl status mysql

# ทดสอบการเชื่อมต่อ
mysql -u callcenter_user -p callcenter
```

## 📞 การสนับสนุน

หากพบปัญหา กรุณาติดต่อทีมพัฒนา หรือดูเอกสารเพิ่มเติมใน `README_AEP_CLIENT.md`