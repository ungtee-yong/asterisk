#!/bin/bash

# Installation script for Asterisk Call Center with Node.js and AEP

echo "Installing Asterisk Call Center with Node.js and AEP..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Update system packages
echo "Updating system packages..."
apt-get update

# Install Node.js (using NodeSource repository)
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install required system packages
echo "Installing system packages..."
apt-get install -y \
    asterisk \
    asterisk-modules \
    mysql-server \
    mysql-client \
    git \
    wget \
    curl \
    build-essential

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Create necessary directories
mkdir -p /var/log/asterisk/callcenter
mkdir -p /var/lib/asterisk/sounds/custom
mkdir -p logs

# Copy Asterisk configuration files
echo "Copying Asterisk configuration files..."
cp asterisk/extensions.conf /etc/asterisk/
cp asterisk/sip.conf /etc/asterisk/
cp asterisk/manager.conf /etc/asterisk/
cp asterisk/modules.conf /etc/asterisk/
cp asterisk/aeap.conf /etc/asterisk/

# Set permissions for AGI script
echo "Setting up AGI script..."
chmod +x agi_scripts/call_routing.js
cp agi_scripts/call_routing.js /var/lib/asterisk/agi-bin/

# Set up MySQL database
echo "Setting up MySQL database..."
mysql -u root -p < database/schema.sql

# Create systemd service for the application
echo "Creating systemd service..."
cat > /etc/systemd/system/callcenter-nodejs.service << EOF
[Unit]
Description=Call Center Node.js Service with AEP
After=network.target mysql.service asterisk.service

[Service]
Type=simple
User=asterisk
Group=asterisk
WorkingDirectory=/workspace
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Create systemd service for AEP server
echo "Creating AEP server service..."
cat > /etc/systemd/system/callcenter-aep.service << EOF
[Unit]
Description=Call Center AEP Server
After=network.target mysql.service

[Service]
Type=simple
User=asterisk
Group=asterisk
WorkingDirectory=/workspace
Environment=NODE_ENV=production
ExecStart=/usr/bin/node aep_server.js
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
systemctl enable callcenter-nodejs
systemctl enable callcenter-aep

systemctl start mysql
systemctl start asterisk
systemctl start callcenter-nodejs
systemctl start callcenter-aep

# Set up firewall rules
echo "Setting up firewall rules..."
ufw allow 5060/udp  # SIP
ufw allow 10000:20000/udp  # RTP
ufw allow 5038/tcp  # AMI
ufw allow 4573/tcp  # AEP
ufw allow 3000/tcp  # HTTP API

echo "Installation completed!"
echo ""
echo "Next steps:"
echo "1. Copy your Google Cloud service account key to /workspace/"
echo "2. Update .env file with your configuration"
echo "3. Restart services: systemctl restart asterisk callcenter-nodejs callcenter-aep"
echo "4. Test the system: npm test"
echo "5. Test the API: curl http://localhost:3000/health"
echo "6. Test AEP connection: telnet localhost 4573"