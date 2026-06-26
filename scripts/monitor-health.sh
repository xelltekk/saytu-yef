#!/usr/bin/env bash
set -Eeuo pipefail

APP_URL="${APP_URL:-https://saytu-yef.xelltekk.com}"
PM2_NAME="${PM2_NAME:-saytu-yef}"
LOG_FILE="${MONITOR_LOG:-/var/log/saytu-yef-monitor.log}"
HEALTH_URL="${APP_URL%/}/api/health"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$1" >> "${LOG_FILE}"; }
notify() {
  [[ -z "${ALERT_WEBHOOK_URL:-}" ]] && return 0
  curl --silent --show-error --max-time 10 --request POST \
    --header 'Content-Type: application/json' \
    --data "{\"text\":\"Saytu Yëf: $1\"}" "${ALERT_WEBHOOK_URL}" >/dev/null || true
}

if curl --fail --silent --show-error --max-time 12 "${HEALTH_URL}" >/dev/null; then
  log 'OK application et base de données disponibles'
  exit 0
fi

log 'ECHEC contrôle de santé, redémarrage PM2'
pm2 restart "${PM2_NAME}" --update-env >> "${LOG_FILE}" 2>&1 || true
sleep 8

if curl --fail --silent --show-error --max-time 12 "${HEALTH_URL}" >/dev/null; then
  log 'RETABLI après redémarrage PM2'
  notify 'service rétabli après redémarrage automatique'
  exit 0
fi

log 'CRITIQUE service toujours indisponible'
notify 'service indisponible après tentative de redémarrage'
exit 1
