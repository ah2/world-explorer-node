// scripts/pm2-auto-update.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const APP_NAME = 'world-explorer';
const APP_DIR = '/var/www/world-explorer';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const LOG_FILE = '/var/log/world-explorer/auto-update.log';

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Log function
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    fs.appendFileSync(LOG_FILE, logMessage);
}

// Check for updates
async function checkForUpdates() {
    log('🔍 Checking for updates...');
    
    try {
        // Check if app is running
        const statusCheck = await execCommand(`pm2 describe ${APP_NAME}`);
        if (!statusCheck.includes('online')) {
            log('⚠️ App is not running, attempting to start...');
            await execCommand(`pm2 start ${APP_NAME}`);
            log('✅ App started');
            return;
        }
        
        // Check if there are new commits
        const fetchOutput = await execCommand(`cd ${APP_DIR} && git fetch origin main`);
        
        const checkOutput = await execCommand(`cd ${APP_DIR} && git rev-list HEAD..origin/main --count`);
        const commitCount = parseInt(checkOutput.trim());
        
        if (commitCount > 0) {
            log(`📥 Found ${commitCount} new commits`);
            
            // Pull and restart
            await execCommand(`cd ${APP_DIR} && git pull origin main`);
            await execCommand(`cd ${APP_DIR} && npm install --production`);
            await execCommand(`pm2 reload ${APP_NAME}`);
            
            log('✅ Update completed successfully!');
        } else {
            log('✅ No updates available');
        }
    } catch (error) {
        log(`❌ Error during update check: ${error.message}`);
    }
}

// Execute command as promise
function execCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout || stderr);
            }
        });
    });
}

// Start monitoring
log('🚀 PM2 Auto-Update Monitor started');
log(`📋 Checking for updates every ${CHECK_INTERVAL / 1000} seconds`);

// Initial check
checkForUpdates();

// Set up interval
setInterval(checkForUpdates, CHECK_INTERVAL);

// Handle process termination
process.on('SIGINT', () => {
    log('👋 Monitor stopped');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('👋 Monitor terminated');
    process.exit(0);
});