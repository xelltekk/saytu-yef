// Configuration PM2 — gère le process Next.js (redémarrage auto, survit aux reboots)
module.exports = {
  apps: [
    {
      name: 'saytu-yef',
      script: 'npm',
      args: 'run start:vps',
      cwd: '/var/www/saytu-yef',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
}
