// pm2-auto-update.config.js
module.exports = {
    apps: [{
        name: 'world-explorer-updater',
        script: 'scripts/pm2-auto-update.js',
        instances: 1,
        exec_mode: 'fork',
        env: {
            NODE_ENV: 'production'
        },
        error_file: '/var/log/pm2/world-explorer-updater-error.log',
        out_file: '/var/log/pm2/world-explorer-updater-out.log',
        log_file: '/var/log/pm2/world-explorer-updater-combined.log',
        time: true,
        autorestart: true,
        max_restarts: 10,
        watch: false,
        cron_restart: '0 */6 * * *' // Restart every 6 hours
    }]
};