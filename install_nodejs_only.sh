#!/bin/bash

# Installation script for Node.js AEP Client (for existing Asterisk)

echo "Installing Node.js AEP Client for existing Asterisk..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Check if Asterisk is installed
if ! command -v asterisk &> /dev/null; then
    echo "Asterisk is not installed. Please install Asterisk first."
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
    mysql-client \
    git \
    wget \
    curl \
    build-essential

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Create necessary directories
mkdir -p logs
mkdir -p /tmp/callcenter

# Set permissions
chmod +x *.js
chmod +x test/test_system.js

# Install Asterisk AEP configuration
echo "Installing Asterisk AEP configuration..."
./asterisk_config/install_asterisk_config.sh

# Create systemd service for the application
echo "Creating systemd service..."
cat > /etc/systemd/system/callcenter-aep-client.service << EOF
[Unit]
Description=Call Center AEP Client
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/workspace
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=ASTERISK_HOST=127.0.0.1
Environment=ASTERISK_AEP_PORT=4573
Environment=AEP_SECRET=aeap_secret_key_123
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "Enabling and starting service..."
systemctl daemon-reload
systemctl enable callcenter-aep-client
systemctl start callcenter-aep-client

# Set up firewall rules
echo "Setting up firewall rules..."
ufw allow 3000/tcp  # HTTP API
ufw allow 4573/tcp  # AEP (if needed)

echo "Installation completed!"
echo ""
echo "Next steps:"
echo "1. Copy your Google Cloud service account key to /workspace/"
echo "2. Update .env file with your configuration"
echo "3. Restart service: systemctl restart callcenter-aep-client"
echo "4. Test the system: npm test"
echo "5. Test the API: curl http://localhost:3000/health"
echo "6. Test AEP connection: telnet localhost 4573"
echo "7. Test call routing by calling extension 9999"