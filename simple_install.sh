#!/bin/bash

# Simple Install Script for Asterisk AEP Client
# สคริปต์ติดตั้งแบบง่ายสำหรับ Asterisk AEP Client

echo "🚀 เริ่มติดตั้ง Simple Asterisk AEP Client"
echo "=" * 50

# ตรวจสอบ Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js ไม่ได้ติดตั้ง กรุณาติดตั้ง Node.js ก่อน"
    exit 1
fi

echo "✅ Node.js พร้อมใช้งาน"

# ตรวจสอบ npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm ไม่ได้ติดตั้ง กรุณาติดตั้ง npm ก่อน"
    exit 1
fi

echo "✅ npm พร้อมใช้งาน"

# ติดตั้ง dependencies
echo "📦 ติดตั้ง dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ ติดตั้ง dependencies สำเร็จ"
else
    echo "❌ ติดตั้ง dependencies ล้มเหลว"
    exit 1
fi

# ตรวจสอบไฟล์ .env
if [ ! -f ".env" ]; then
    echo "⚠️  ไฟล์ .env ไม่พบ สร้างไฟล์ .env จาก .env.example"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ สร้างไฟล์ .env สำเร็จ"
        echo "⚠️  กรุณาแก้ไขไฟล์ .env ตามการตั้งค่าของคุณ"
    else
        echo "❌ ไฟล์ .env.example ไม่พบ"
        exit 1
    fi
fi

# ตรวจสอบไฟล์ service-account-key.json
if [ ! -f "service-account-key.json" ]; then
    echo "⚠️  ไฟล์ service-account-key.json ไม่พบ"
    echo "กรุณาวางไฟล์ Google Cloud service account key ในโฟลเดอร์โปรเจค"
fi

# ตรวจสอบฐานข้อมูล
echo "📊 ตรวจสอบฐานข้อมูล..."
if command -v mysql &> /dev/null; then
    echo "✅ MySQL พร้อมใช้งาน"
    echo "⚠️  กรุณาเรียกใช้คำสั่ง: mysql -u root -p < asterisk_config.sql"
else
    echo "⚠️  MySQL ไม่พบ กรุณาติดตั้ง MySQL ก่อน"
fi

# ตรวจสอบ Asterisk
echo "📞 ตรวจสอบ Asterisk..."
if command -v asterisk &> /dev/null; then
    echo "✅ Asterisk พร้อมใช้งาน"
    echo "⚠️  กรุณาเพิ่มการตั้งค่าใน simple_asterisk_config.conf ลงในไฟล์ config ของ Asterisk"
else
    echo "⚠️  Asterisk ไม่พบ กรุณาติดตั้ง Asterisk ก่อน"
fi

# สร้าง systemd service
echo "🔧 สร้าง systemd service..."
cat > /etc/systemd/system/simple-asterisk-aep-client.service << EOF
[Unit]
Description=Simple Asterisk AEP Client
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node simple_index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# เปิดใช้งาน service
systemctl daemon-reload
systemctl enable simple-asterisk-aep-client

echo "✅ สร้าง systemd service สำเร็จ"

# ตั้งค่าฟีร์วอลล์
echo "🔥 ตั้งค่าฟีร์วอลล์..."
if command -v ufw &> /dev/null; then
    ufw allow 3000/tcp
    ufw allow 4573/tcp
    echo "✅ ตั้งค่าฟีร์วอลล์สำเร็จ"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=3000/tcp
    firewall-cmd --permanent --add-port=4573/tcp
    firewall-cmd --reload
    echo "✅ ตั้งค่าฟีร์วอลล์สำเร็จ"
else
    echo "⚠️  ไม่พบฟีร์วอลล์ กรุณาติดตั้งและตั้งค่าฟีร์วอลล์เอง"
fi

# ทดสอบระบบ
echo "🧪 ทดสอบระบบ..."
node simple_test.js

if [ $? -eq 0 ]; then
    echo "✅ การทดสอบระบบสำเร็จ"
else
    echo "⚠️  การทดสอบระบบมีปัญหา กรุณาตรวจสอบการตั้งค่า"
fi

echo ""
echo "🎉 การติดตั้งเสร็จสิ้น!"
echo "=" * 50
echo "📋 ขั้นตอนต่อไป:"
echo "1. แก้ไขไฟล์ .env ตามการตั้งค่าของคุณ"
echo "2. วางไฟล์ service-account-key.json"
echo "3. เรียกใช้: mysql -u root -p < asterisk_config.sql"
echo "4. เพิ่มการตั้งค่าใน simple_asterisk_config.conf ลงในไฟล์ config ของ Asterisk"
echo "5. เริ่มระบบ: systemctl start simple-asterisk-aep-client"
echo "6. ตรวจสอบสถานะ: systemctl status simple-asterisk-aep-client"
echo "7. ดู logs: journalctl -u simple-asterisk-aep-client -f"
echo ""
echo "🌐 API Endpoints:"
echo "- Health Check: http://localhost:3000/health"
echo "- Status: http://localhost:3000/api/status"
echo "- Connect: POST http://localhost:3000/api/connect"
echo "- Disconnect: POST http://localhost:3000/api/disconnect"