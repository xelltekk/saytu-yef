#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL doit contenir la connexion PostgreSQL Supabase}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/saytu-yef}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL_FILE="${BACKUP_DIR}/saytu-yef-${STAMP}.dump"
TEMP_FILE="${FINAL_FILE}.partial"
ROLE_FILE="${FINAL_FILE}.roles.json"
TEMP_ROLES="${ROLE_FILE}.partial"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
exec 9>"${BACKUP_DIR}/.backup.lock"
flock -n 9 || { echo 'Une sauvegarde est deja en cours.' >&2; exit 1; }
[[ ! -e "$FINAL_FILE" ]] || { echo 'Archive deja existante.' >&2; exit 1; }
trap 'rm -f "${TEMP_FILE}" "${TEMP_ROLES}"' EXIT

pg_dump --dbname="${SUPABASE_DB_URL}" --format=custom --compress=9 --file="${TEMP_FILE}"
pg_restore --list "${TEMP_FILE}" >/dev/null
dump_sha256="$(sha256sum "$TEMP_FILE" | awk '{print $1}')"
# Global role names are needed by ACLs/RLS; never export database login passwords.
psql --dbname="$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -c "
SELECT jsonb_build_object('version', 1, 'backup_file', 'saytu-yef-${STAMP}.dump',
  'dump_sha256', '${dump_sha256}',
  'roles', (SELECT jsonb_agg(jsonb_build_object('name', rolname, 'bypassrls', rolbypassrls,
    'inherit', rolinherit, 'canlogin', rolcanlogin, 'superuser', rolsuper) ORDER BY rolname)
    FROM pg_roles WHERE rolname !~ '^pg_'),
  'memberships', (SELECT coalesce(jsonb_agg(jsonb_build_object('role', r.rolname,
    'member', m.rolname, 'admin_option', am.admin_option, 'inherit_option', am.inherit_option,
    'set_option', am.set_option) ORDER BY r.rolname, m.rolname), '[]'::jsonb)
    FROM pg_auth_members am JOIN pg_roles r ON r.oid = am.roleid JOIN pg_roles m ON m.oid = am.member
    WHERE r.rolname !~ '^pg_' AND m.rolname !~ '^pg_'),
  'extensions', (SELECT jsonb_agg(jsonb_build_object('name', e.extname, 'version', e.extversion,
    'schema', n.nspname) ORDER BY e.extname) FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace));
" > "$TEMP_ROLES"
mv "$TEMP_ROLES" "$ROLE_FILE"
mv "${TEMP_FILE}" "${FINAL_FILE}"
sha256sum "${FINAL_FILE}" > "${FINAL_FILE}.sha256"
sha256sum "$ROLE_FILE" > "$ROLE_FILE.sha256"
chmod 600 "${FINAL_FILE}" "${FINAL_FILE}.sha256" "$ROLE_FILE" "$ROLE_FILE.sha256"

find "${BACKUP_DIR}" -maxdepth 1 -type f \( -name 'saytu-yef-*.dump' -o -name 'saytu-yef-*.dump.sha256' -o -name 'saytu-yef-*.dump.roles.json' -o -name 'saytu-yef-*.dump.roles.json.sha256' \) -mtime "+${RETENTION_DAYS}" -delete
echo "Sauvegarde vérifiée: ${FINAL_FILE}"
