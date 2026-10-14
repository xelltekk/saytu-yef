// Configuration PM2 — gère le process Next.js (redémarrage auto, survit aux reboots)
module.exports = {
  apps: [
    {
      name: 'saytu-yef',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1 -p 3000',
      cwd: '/var/www/saytu-yef',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 10000,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
}
