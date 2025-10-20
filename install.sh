#!/bin/bash

# Installation script for Asterisk Call Center with Google Speech Integration

echo "Installing Asterisk Call Center with Google Speech Integration..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Update system packages
echo "Updating system packages..."
apt-get update

# Install required system packages
echo "Installing system packages..."
apt-get install -y \
    asterisk \
    asterisk-modules \
    python3 \
    python3-pip \
    python3-venv \
    mysql-server \
    mysql-client \
    git \
    wget \
    curl

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install -r requirements.txt

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Copy Asterisk configuration files
echo "Copying Asterisk configuration files..."
cp asterisk/extensions.conf /etc/asterisk/
cp asterisk/sip.conf /etc/asterisk/
cp asterisk/manager.conf /etc/asterisk/
cp asterisk/modules.conf /etc/asterisk/

# Set permissions for AGI script
echo "Setting up AGI script..."
chmod +x agi_scripts/call_routing.py
cp agi_scripts/call_routing.py /var/lib/asterisk/agi-bin/

# Create necessary directories
mkdir -p /var/log/asterisk/callcenter
mkdir -p /var/lib/asterisk/sounds/custom

# Set up MySQL database
echo "Setting up MySQL database..."
mysql -u root -p < database/schema.sql

# Create systemd service for the application
echo "Creating systemd service..."
cat > /etc/systemd/system/callcenter-agi.service << EOF
[Unit]
Description=Call Center AGI Service
After=network.target mysql.service asterisk.service

[Service]
Type=simple
User=asterisk
Group=asterisk
WorkingDirectory=/workspace
Environment=PATH=/workspace/venv/bin
ExecStart=/workspace/venv/bin/python /var/lib/asterisk/agi-bin/call_routing.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
echo "Enabling and starting services..."
systemctl daemon-reload
systemctl enable mysql
systemctl enable asterisk
systemctl enable callcenter-agi

systemctl start mysql
systemctl start asterisk
systemctl start callcenter-agi

# Set up firewall rules
echo "Setting up firewall rules..."
ufw allow 5060/udp  # SIP
ufw allow 10000:20000/udp  # RTP
ufw allow 5038/tcp  # AMI

echo "Installation completed!"
echo ""
echo "Next steps:"
echo "1. Copy your Google Cloud service account key to /workspace/"
echo "2. Update .env file with your configuration"
echo "3. Restart services: systemctl restart asterisk callcenter-agi"
echo "4. Test the system by calling your Asterisk server"