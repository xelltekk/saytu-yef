#!/usr/bin/env bash
set -Eeuo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL doit contenir la connexion PostgreSQL Supabase}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/saytu-yef}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL_FILE="${BACKUP_DIR}/saytu-yef-${STAMP}.dump"
TEMP_FILE="${FINAL_FILE}.partial"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
trap 'rm -f "${TEMP_FILE}"' EXIT

pg_dump --dbname="${SUPABASE_DB_URL}" --format=custom --compress=9 --no-owner --no-privileges --file="${TEMP_FILE}"
pg_restore --list "${TEMP_FILE}" >/dev/null
mv "${TEMP_FILE}" "${FINAL_FILE}"
sha256sum "${FINAL_FILE}" > "${FINAL_FILE}.sha256"
chmod 600 "${FINAL_FILE}" "${FINAL_FILE}.sha256"

find "${BACKUP_DIR}" -type f \( -name 'saytu-yef-*.dump' -o -name 'saytu-yef-*.dump.sha256' \) -mtime "+${RETENTION_DAYS}" -delete
echo "Sauvegarde vérifiée: ${FINAL_FILE}"
