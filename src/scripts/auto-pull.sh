#!/bin/bash
# scripts/auto-pull.sh

# Configuration
APP_DIR="/var/www/world-explorer"
BRANCH="main"
LOG_FILE="/var/log/world-explorer/auto-pull.log"
LOCK_FILE="/tmp/world-explorer-auto-pull.lock"

# Create log directory if it doesn't exist
mkdir -p /var/log/world-explorer

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if script is already running
if [ -f $LOCK_FILE ]; then
    log "⚠️ Auto-pull already running, exiting"
    exit 1
fi

# Create lock file
touch $LOCK_FILE

# Start auto-pull
log "🚀 Starting auto-pull for World Explorer"

# Check if directory exists
if [ ! -d "$APP_DIR" ]; then
    log "❌ App directory not found: $APP_DIR"
    rm -f $LOCK_FILE
    exit 1
fi

# Change to app directory
cd $APP_DIR || {
    log "❌ Cannot cd to $APP_DIR"
    rm -f $LOCK_FILE
    exit 1
}

# Check if git repository exists
if [ ! -d ".git" ]; then
    log "❌ Not a git repository: $APP_DIR"
    rm -f $LOCK_FILE
    exit 1
fi

# Fetch latest changes
log "📥 Fetching latest changes from $BRANCH..."
git fetch origin $BRANCH >> $LOG_FILE 2>&1

if [ $? -ne 0 ]; then
    log "❌ Git fetch failed"
    rm -f $LOCK_FILE
    exit 1
fi

# Check if there are new changes
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$BRANCH)

if [ "$LOCAL" = "$REMOTE" ]; then
    log "✅ No changes detected, repository is up to date"
    rm -f $LOCK_FILE
    exit 0
fi

# Pull latest changes
log "📥 Pulling latest changes from $BRANCH..."
git pull origin $BRANCH >> $LOG_FILE 2>&1

if [ $? -ne 0 ]; then
    log "❌ Git pull failed"
    rm -f $LOCK_FILE
    exit 1
fi

# Install dependencies
log "📦 Installing dependencies..."
npm install --production >> $LOG_FILE 2>&1

if [ $? -ne 0 ]; then
    log "❌ npm install failed"
    rm -f $LOCK_FILE
    exit 1
fi

# Restart the app
log "🔄 Restarting World Explorer..."
pm2 reload world-explorer >> $LOG_FILE 2>&1

if [ $? -eq 0 ]; then
    log "✅ App restarted successfully!"
    pm2 status world-explorer >> $LOG_FILE 2>&1
else
    log "❌ Failed to restart app"
    rm -f $LOCK_FILE
    exit 1
fi

# Cleanup
rm -f $LOCK_FILE

log "✅ Auto-pull completed successfully"
exit 0