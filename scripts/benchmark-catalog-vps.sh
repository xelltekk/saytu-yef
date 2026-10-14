#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$EUID" == 0 ]] || { echo 'Executer en root.' >&2; exit 1; }
set -a
source /etc/saytu-yef-ops.env
set +a
: "${SUPABASE_DB_URL:?Connexion PostgreSQL protegee absente}"
node "$(dirname "$(readlink -f "$0")")/benchmark-catalog-vps.mjs"
