#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ "$EUID" == 0 ]] || { echo 'Executer avec sudo.' >&2; exit 1; }
key_file=/etc/saytu-yef-storage.key
[[ ! -e "$key_file" ]] || { echo 'Cle de sauvegarde deja configuree; aucune modification.'; exit 0; }
read -r -s -p 'Collez la cle SECRET Supabase (saisie masquee), puis Entree : ' key
printf '\n'
printf '%s' "$key" | node -e 'const fs=require("fs");const k=fs.readFileSync(0,"utf8");let valid=/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(k);try{valid ||= /^[A-Za-z0-9_.-]+$/.test(k)&&JSON.parse(Buffer.from(k.split(".")[1],"base64url")).role==="service_role"}catch{}process.exit(valid?0:1)' || { echo 'Utiliser une cle secret ou service_role, pas une cle publique.' >&2; exit 1; }
status="$(curl --silent --show-error --max-time 20 --config - --output /dev/null --write-out '%{http_code}' <<CONFIG
url = "https://lptxzfjdluupngqqqfrz.supabase.co/storage/v1/bucket"
header = "apikey: $key"
header = "Authorization: Bearer $key"
CONFIG
)"
[[ "$status" == 200 ]] || { unset key; echo 'Cle refusee par le projet Supabase; aucun fichier cree.' >&2; exit 1; }
temporary="$(mktemp /etc/.saytu-yef-storage-key.XXXXXX)"
trap '[[ -z "${temporary:-}" ]] || rm -f -- "$temporary"' EXIT
printf '%s' "$key" > "$temporary"
unset key
chmod 600 "$temporary"
chown root:root "$temporary"
mv -- "$temporary" "$key_file"
temporary=''
echo 'Cle de sauvegarde configuree et verifiee. Sa valeur ne sera pas affichee.'
