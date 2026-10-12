#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ "$EUID" == 0 ]] || { echo 'Executer en root.' >&2; exit 1; }
mode="${1:?list, export, checksum, purge ou self-test}"
base=/var/www
records=/var/backups/saytu-yef-application-archives
[[ "$(readlink -f "$base")" == "$base" ]] || exit 1

eligible() {
  local name="$1" target="$base/$1"
  [[ "$name" =~ ^saytu-yef-backup-[0-9]{8}-[0-9]{6}$ || "$name" =~ ^saytu-yef-release-[a-f0-9]{40}-[0-9]{8}T[0-9]{6}Z$ ]] || return 1
  [[ -d "$target" && ! -L "$target" && "$(readlink -f "$target")" == "$target" ]] || return 1
  if [[ "$name" == saytu-yef-release-* ]]; then
    # Always retain the two newest previous executable releases on the VPS.
    local protected
    protected="$(find "$base" -mindepth 1 -maxdepth 1 -type d -name 'saytu-yef-release-*' -printf '%f\n' | grep -E '^saytu-yef-release-[a-f0-9]{40}-[0-9]{8}T[0-9]{6}Z$' | sort -t- -k5,5r | sed -n '1,2p')"
    if grep -Fxq "$name" <<< "$protected"; then return 1; fi
  else
    [[ -n "$(find "$target" -maxdepth 0 -mtime +30 -print)" ]] || return 1
  fi
  # Refuse any separate mount within a target, including the target itself.
  if findmnt -rn -o TARGET | awk -v p="$target" '$0 == p || index($0,p"/") == 1 {found=1} END {exit !found}'; then return 1; fi
}

archive() {
  # No archive is written to the nearly-full VPS; deterministic bytes allow a second check.
  tar --sort=name --format=gnu -cf - -C "$base" "$name" | gzip -n -1
}

if [[ "$mode" == self-test ]]; then
  checks=0
  for name in '../saytu-yef' 'saytu-yef' 'saytu-yef-backup-20260627-131410;id' 'saytu-yef-backup-20260627-131410/child' 'saytu-yef-release-abc-20261012T160741Z' '/var/backups/saytu-yef' 'saytu-yef-backup-00000000-000000'; do
    if eligible "$name"; then echo 'Cible dangereuse acceptee.' >&2; exit 1; fi
    checks=$((checks + 1))
  done
  while IFS= read -r name; do
    if eligible "$name"; then echo 'Release de secours non protegee.' >&2; exit 1; fi
    checks=$((checks + 1))
  done < <(find "$base" -mindepth 1 -maxdepth 1 -type d -name 'saytu-yef-release-*' -printf '%f\n' | grep -E '^saytu-yef-release-[a-f0-9]{40}-[0-9]{8}T[0-9]{6}Z$' | sort -t- -k5,5r | sed -n '1,2p')
  echo "$checks controles VPS passes; aucune suppression."
  exit 0
fi

exec 9>/var/lock/saytu-yef-deploy.lock
flock -n 9 || { echo 'Deploiement ou archivage deja en cours.' >&2; exit 1; }

if [[ "$mode" == list ]]; then
  while IFS= read -r name; do
    if eligible "$name"; then printf '%s\n' "$name"; fi
  done < <(find "$base" -mindepth 1 -maxdepth 1 -type d \( -name 'saytu-yef-backup-*' -o -name 'saytu-yef-release-*' \) -printf '%f\n' | sort)
  exit 0
fi

name="${2:?Nom de copie requis}"
eligible "$name" || { echo 'Cible refusee ou version de secours protegee.' >&2; exit 1; }
mkdir -p "$records"
chmod 700 "$records"
[[ ! -L "$records" && "$(readlink -f "$records")" == "$records" ]] || exit 1
record="$records/$name.sha256"

case "$mode" in
  export)
    partial="$record.partial"
    trap 'rm -f -- "$partial"' EXIT
    # tee's process substitution must finish before publishing the checksum.
    mkfifo "$records/$name.pipe"
    trap 'rm -f -- "$partial" "$records/$name.pipe"' EXIT
    sha256sum < "$records/$name.pipe" > "$partial" & digest_pid=$!
    archive | tee "$records/$name.pipe"
    wait "$digest_pid"
    mv "$partial" "$record"
    ;;
  checksum)
    [[ -s "$record" && ! -L "$record" ]] || { echo 'Archive non terminee.' >&2; exit 1; }
    awk '{print $1}' "$record"
    ;;
  purge)
    expected="${3:?Empreinte de la copie Windows requise}"
    [[ "$expected" =~ ^[a-f0-9]{64}$ && -f "$record" && ! -L "$record" ]] || exit 1
    [[ "$(awk '{print $1}' "$record")" == "$expected" ]] || { echo 'Empreinte archive differente.' >&2; exit 1; }
    current="$(archive | sha256sum | awk '{print $1}')"
    [[ "$current" == "$expected" ]] || { echo 'Copie VPS modifiee depuis son export; aucune suppression.' >&2; exit 1; }
    eligible "$name" || exit 1
    [[ -s /var/www/saytu-yef/.next/BUILD_ID && -f /var/www/saytu-yef/.env ]] || exit 1
    references="$(pm2 jlist | node -e '
      let input=""; process.stdin.on("data", chunk => input += chunk);
      process.stdin.on("end", () => {
        try {
          const apps=JSON.parse(input); if (!Array.isArray(apps)) throw new Error();
          for (const app of apps) for (const key of ["pm_cwd", "pm_exec_path"])
            if (typeof app.pm2_env?.[key] === "string") console.log(app.pm2_env[key]);
        } catch { process.exitCode=1; }
      });')" || { echo 'Etat PM2 non verifiable; aucune suppression.' >&2; exit 1; }
    while IFS= read -r reference; do
      [[ -z "$reference" ]] && continue
      resolved="$(readlink -m "$reference")"
      [[ "$resolved" != "$base/$name" && "$resolved" != "$base/$name/"* ]] || { echo 'Copie referencee par PM2; aucune suppression.' >&2; exit 1; }
    done <<< "$references"
    # Only a named, checked archived copy is removed; never the live checkout or database backups.
    rm -rf -- "$base/$name"
    printf '%s %s %s\n' "$(date -u +%FT%TZ)" "$name" "$expected" >> "$records/purged.log"
    echo "Ancienne copie archivee retiree: $name"
    ;;
  *) echo 'Mode inconnu.' >&2; exit 1 ;;
esac
