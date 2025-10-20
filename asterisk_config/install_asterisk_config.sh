#!/bin/bash

# Script สำหรับติดตั้ง AEP configuration ใน Asterisk ที่มีอยู่แล้ว

echo "Installing AEP configuration for existing Asterisk..."

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

# Backup existing configuration
echo "Backing up existing configuration..."
cp /etc/asterisk/extensions.conf /etc/asterisk/extensions.conf.backup.$(date +%Y%m%d_%H%M%S)
cp /etc/asterisk/modules.conf /etc/asterisk/modules.conf.backup.$(date +%Y%m%d_%H%M%S)
cp /etc/asterisk/manager.conf /etc/asterisk/manager.conf.backup.$(date +%Y%m%d_%H%M%S)

# Copy AEP configuration files
echo "Copying AEP configuration files..."

# Copy aeap.conf
cp asterisk_config/aeap.conf /etc/asterisk/

# Add AEP modules to modules.conf
echo "" >> /etc/asterisk/modules.conf
echo "; AEP Configuration" >> /etc/asterisk/modules.conf
cat asterisk_config/modules_aep.conf >> /etc/asterisk/modules.conf

# Add AEP manager to manager.conf
echo "" >> /etc/asterisk/manager.conf
echo "; AEP Manager Configuration" >> /etc/asterisk/manager.conf
cat asterisk_config/manager_aep.conf >> /etc/asterisk/manager.conf

# Add AEP extensions to extensions.conf
echo "" >> /etc/asterisk/extensions.conf
echo "; AEP Extensions Configuration" >> /etc/asterisk/extensions.conf
cat asterisk_config/extensions_aep.conf >> /etc/asterisk/extensions.conf

# Set permissions
chown asterisk:asterisk /etc/asterisk/aeap.conf
chmod 644 /etc/asterisk/aeap.conf

# Reload Asterisk configuration
echo "Reloading Asterisk configuration..."
asterisk -rx "module reload"

# Check if AEP module is loaded
echo "Checking AEP module status..."
if asterisk -rx "module show like aeap" | grep -q "res_aeap.so"; then
    echo "✓ AEP module loaded successfully"
else
    echo "✗ AEP module not loaded. Please check configuration."
fi

# Check AEP configuration
echo "Checking AEP configuration..."
if asterisk -rx "aeap show settings" | grep -q "enabled.*yes"; then
    echo "✓ AEP is enabled"
else
    echo "✗ AEP is not enabled. Please check configuration."
fi

echo "AEP configuration installation completed!"
echo ""
echo "Next steps:"
echo "1. Start your Node.js application: node index.js"
echo "2. Test AEP connection: telnet localhost 4573"
echo "3. Test call routing by calling extension 9999"
echo "4. Check Asterisk logs: tail -f /var/log/asterisk/full"