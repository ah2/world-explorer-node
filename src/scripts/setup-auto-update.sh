#!/bin/bash
# scripts/setup-auto-update.sh

echo "🚀 Setting up PM2 auto-update for World Explorer"

# Configuration
APP_DIR="/var/www/world-explorer"
LOG_DIR="/var/log/world-explorer"
PM2_APP_NAME="world-explorer"

# Create directories
echo "📁 Creating directories..."
sudo mkdir -p $APP_DIR
sudo mkdir -p $LOG_DIR
sudo chown -R $USER:$USER $LOG_DIR

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x scripts/auto-pull.sh

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Start or restart the app with PM2
echo "🔄 Starting/restarting app with PM2..."
pm2 stop $PM2_APP_NAME 2>/dev/null || true
pm2 delete $PM2_APP_NAME 2>/dev/null || true
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save
pm2 startup

# Setup cron job for auto-pull
echo "📅 Setting up cron job for auto-pull..."
CRON_JOB="*/5 * * * * /bin/bash $APP_DIR/scripts/auto-pull.sh"
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ Auto-update setup complete!"
echo "📋 Logs: $LOG_DIR/auto-pull.log"
echo "🔄 Auto-pull runs every 5 minutes"
echo "🚀 App will auto-restart after update"