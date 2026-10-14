#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Exécutez ce script en tant que root.' >&2
  exit 1
fi

APP_DIR="${APP_DIR:-/var/www/saytu-yef}"
exec 9>/var/lock/saytu-yef-deploy.lock
flock -n 9 || { echo 'Deploiement ou archivage en cours; reessayer ensuite.' >&2; exit 1; }
install -d -m 700 /var/backups/saytu-yef
install -m 755 "${APP_DIR}/scripts/backup-supabase.sh" /usr/local/sbin/saytu-yef-backup
install -m 755 "${APP_DIR}/scripts/monitor-health.sh" /usr/local/sbin/saytu-yef-monitor
install -d -m 755 /usr/local/lib/saytu-yef
install -d -m 700 /var/lib/saytu-yef
if [[ -e /var/log/saytu-yef-monitor.log ]]; then
  [[ -f /var/log/saytu-yef-monitor.log && ! -L /var/log/saytu-yef-monitor.log ]] || { echo 'Journal de supervision inattendu.' >&2; exit 1; }
  chmod 600 /var/log/saytu-yef-monitor.log
fi
install -m 644 "${APP_DIR}/scripts/monitor-runtime.mjs" "${APP_DIR}/scripts/monitor-policy.mjs" /usr/local/lib/saytu-yef/
install -m 644 "${APP_DIR}/ops/logrotate-saytu-yef-monitor.conf" /etc/logrotate.d/saytu-yef-monitor
install -m 755 "${APP_DIR}/scripts/archive-old-vps.sh" /usr/local/sbin/saytu-yef-archive-old
install -d -m 755 /etc/systemd/journald.conf.d
install -m 644 "${APP_DIR}/ops/journald-saytu-yef.conf" /etc/systemd/journald.conf.d/60-saytu-yef-disk.conf
install -m 644 "${APP_DIR}/ops/systemd/"*.service "${APP_DIR}/ops/systemd/"*.timer /etc/systemd/system/

if [[ ! -f /etc/saytu-yef-ops.env ]]; then
  install -m 600 "${APP_DIR}/ops/saytu-yef-ops.env.example" /etc/saytu-yef-ops.env
  echo 'Complétez /etc/saytu-yef-ops.env avant de lancer la sauvegarde.'
fi

systemctl daemon-reload
systemctl restart systemd-journald.service
systemctl enable --now saytu-yef-monitor.timer saytu-yef-backup.timer
systemctl list-timers 'saytu-yef-*' --no-pager
