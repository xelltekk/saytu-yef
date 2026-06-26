#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Exécutez ce script en tant que root.' >&2
  exit 1
fi

APP_DIR="${APP_DIR:-/var/www/saytu-yef}"
install -d -m 700 /var/backups/saytu-yef
install -m 755 "${APP_DIR}/scripts/backup-supabase.sh" /usr/local/sbin/saytu-yef-backup
install -m 755 "${APP_DIR}/scripts/monitor-health.sh" /usr/local/sbin/saytu-yef-monitor
install -m 644 "${APP_DIR}/ops/systemd/"*.service "${APP_DIR}/ops/systemd/"*.timer /etc/systemd/system/

if [[ ! -f /etc/saytu-yef-ops.env ]]; then
  install -m 600 "${APP_DIR}/ops/saytu-yef-ops.env.example" /etc/saytu-yef-ops.env
  echo 'Complétez /etc/saytu-yef-ops.env avant de lancer la sauvegarde.'
fi

systemctl daemon-reload
systemctl enable --now saytu-yef-monitor.timer saytu-yef-backup.timer
systemctl list-timers 'saytu-yef-*' --no-pager
