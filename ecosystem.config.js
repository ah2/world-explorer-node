// ecosystem.config.js
module.exports = {
    apps: [{
        name: 'world-explorer',
        script: 'src/app.js',
        instances: 1,
        exec_mode: 'fork',
        
        // Environment variables
        env: {
            NODE_ENV: 'production',
            PORT: 5000,
            BASE_PATH: '/world-explorer'
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 5000,
            BASE_PATH: '/world-explorer'
        },
        
        // Auto-restart settings
        watch: false, // We'll use git pull instead
        watch_delay: 1000,
        ignore_watch: ['node_modules', 'logs', 'data'],
        
        // Logging
        error_file: '/var/log/pm2/world-explorer-error.log',
        out_file: '/var/log/pm2/world-explorer-out.log',
        log_file: '/var/log/pm2/world-explorer-combined.log',
        time: true,
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        
        // Restart strategies
        max_memory_restart: '120M',
        min_uptime: '10s',
        max_restarts: 10,
        restart_delay: 4000,
        
        // Auto-update settings
        cron_restart: '0 0 * * *', // Restart daily at midnight
        instances: 1,
        autorestart: true,
        listen_timeout: 5000,
        kill_timeout: 3000,
        shutdown_with_message: true,
        
        // Custom script to run before start
        pre_start: 'npm install --production',
        post_start: 'echo "✅ World Explorer started successfully!"',
        
        // Enable source map support
        source_map_support: true,
        
        // Instance settings
        instance_var: 'INSTANCE_ID',
        combine_logs: true,
        
        // Error handling
        exp_backoff_restart_delay: 100,
        
        // Watch for file changes (optional)
        // watch: ['src'],
        // ignore_watch: ['node_modules', 'data'],
    }],
    
    // Deployment configuration (optional)
    deploy: {
        production: {
            user: 'hamd',
            host: 'https://hamd.apps.libraryofcode.dev/',
            ref: 'origin/main',
            repo: 'git@github.com:ah2/world-explorer-node.git',
            path: '/var/www/world-explorer',
            'pre-deploy': 'git fetch --all',
            'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
            'pre-setup': ''
        }
    }
};