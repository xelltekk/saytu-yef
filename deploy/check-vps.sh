#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3000}"

check() {
  local path="$1"
  local expected="$2"
  local url="${BASE_URL}${path}"
  local status

  status="$(curl -L -s -o /tmp/saytu-yef-check.out -w '%{http_code}' "$url")"
  if [[ "$status" != "$expected" ]]; then
    echo "ERREUR ${path}: HTTP ${status}, attendu ${expected}"
    echo "Reponse:"
    sed -n '1,20p' /tmp/saytu-yef-check.out
    exit 1
  fi

  echo "OK ${path} -> HTTP ${status}"
}

check_contains() {
  local path="$1"
  local expected_text="$2"
  local url="${BASE_URL}${path}"

  curl -L -fsS "$url" -o /tmp/saytu-yef-check.out
  if ! grep -q "$expected_text" /tmp/saytu-yef-check.out; then
    echo "ERREUR ${path}: texte attendu introuvable: ${expected_text}"
    sed -n '1,20p' /tmp/saytu-yef-check.out
    exit 1
  fi

  echo "OK ${path} contient ${expected_text}"
}

check /api/health 200
check_contains /api/health '"status":"ok"'
check /manifest.json 200
check /sw.js 200
check /offline 200

echo "Controle VPS termine pour ${BASE_URL}"
