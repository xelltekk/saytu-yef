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

response="$(curl --silent --show-error --max-time 12 "${HEALTH_URL}" 2>/dev/null || true)"
health_state="$(printf '%s' "$response" | node -e '
  let body = ""; process.stdin.on("data", chunk => body += chunk);
  process.stdin.on("end", () => {
    try {
      const value = JSON.parse(body);
      if (value.app !== "saytu-yef") return console.log("unreachable");
      console.log(value.status === "ok" && value.dependencies?.database === "ok" && value.dependencies?.auth === "ok"
        ? "ok" : "dependency");
    } catch { console.log("unreachable"); }
  });' 2>/dev/null || printf 'unreachable')"
if [[ "$health_state" == 'ok' ]]; then
  log 'OK application et base de données disponibles'
  exit 0
fi

# A reachable application cannot repair a Supabase outage by restarting itself.
if [[ "$health_state" == 'dependency' ]]; then
  log 'DEGRADE application accessible, dependance base ou Auth indisponible; pas de redemarrage'
  notify 'application accessible mais base ou Auth indisponible'
  exit 1
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
