#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ "$EUID" == 0 ]] || { echo 'Executer en root.' >&2; exit 1; }
phase="${1:?prepare ou activate}"
ref="${2:?Commit a deployer}"
[[ "$ref" =~ ^[a-f0-9]{40}$ ]] || { echo 'Commit invalide.' >&2; exit 1; }
root=/var/www/saytu-yef
stage="/var/tmp/saytu-yef-stage-$ref"
candidate="$root/.release-$ref"
[[ "$(readlink -f "$root")" == "$root" ]] || { echo 'Checkout inattendu.' >&2; exit 1; }
exec 9>/var/lock/saytu-yef-deploy.lock
flock -n 9 || { echo 'Deploiement deja en cours.' >&2; exit 1; }

case "$phase" in
  prepare)
    command -v rsync >/dev/null
    previous_count="$(find /var/www -mindepth 1 -maxdepth 1 -type d -name 'saytu-yef-release-*' | wc -l)"
    [[ "$previous_count" -lt 3 ]] || { echo 'Archiver les anciennes releases sur Windows avant un nouveau deploiement; deux secours sont conserves.' >&2; exit 1; }
    git -C "$root" cat-file -e "$ref^{commit}"
    [[ ! -e "$stage" && ! -e "$candidate" ]] || { echo 'Candidat deja present.' >&2; exit 1; }
    mkdir -m 700 "$stage" "$candidate"
    # Compilation is temporary; the final candidate is copied to persistent disk.
    mount -t tmpfs -o size=3G,nosuid,nodev,mode=0700 tmpfs "$stage"
    cleanup_stage() {
      cd "$root"
      if mountpoint -q "$stage"; then umount "$stage" || echo "Montage temporaire a liberer: $stage" >&2; fi
    }
    trap cleanup_stage EXIT
    git -C "$root" archive "$ref" | tar -x -C "$stage"
    ln -s "$root/.env" "$stage/.env"
    cd "$stage"
    npm ci --include=dev --cache "$stage/.npm-cache" --no-audit --no-fund
    npm run build
    [[ -s .next/BUILD_ID ]]
    node --check public/sw.js
    # Retain prior immutable chunks for clients which have not refreshed yet.
    rsync -a --ignore-existing "$root/.next/static/" "$stage/.next/static/"
    required="$(du -sk node_modules public | awk '{sum += $1} END {print sum}')"
    required=$((required + $(du -sk .next --exclude=cache | awk '{print $1}') + 204800))
    available="$(df -Pk "$root" | awk 'NR == 2 {print $4}')"
    [[ "$available" -gt "$required" ]] || { echo 'Espace insuffisant pour le candidat durable.' >&2; exit 1; }
    rsync -a node_modules/ "$candidate/node_modules/"
    rsync -a --exclude=cache .next/ "$candidate/.next/"
    rsync -a "$root/public/" "$candidate/public/"
    rsync -a public/ "$candidate/public/"
    printf '%s\n' "$ref" > "$candidate/COMMIT"
    touch "$candidate/READY"
    echo "Candidat construit et copie sur disque: $candidate"
    ;;
  activate)
    [[ -f "$candidate/READY" && "$(cat "$candidate/COMMIT")" == "$ref" && -s "$candidate/.next/BUILD_ID" ]]
    [[ "$(git -C "$root" branch --show-current)" == master ]]
    changes="$(git -C "$root" status --porcelain --untracked-files=no)"
    [[ -z "$changes" || "$changes" == ' M public/sw.js' ]] || { echo 'Changements inattendus dans le checkout.' >&2; exit 1; }
    old="$(git -C "$root" rev-parse HEAD)"
    backup="/var/www/saytu-yef-release-$old-$(date -u +%Y%m%dT%H%M%SZ)"
    mkdir -m 700 "$backup"
    git -C "$root" merge --ff-only "$ref"
    pm2 stop saytu-yef
    # Never remove the previous executable version during the cutover.
    mv "$root/.next" "$backup/.next"
    mv "$root/node_modules" "$backup/node_modules"
    mv "$root/public" "$backup/public"
    mv "$candidate/.next" "$root/.next"
    mv "$candidate/node_modules" "$root/node_modules"
    mv "$candidate/public" "$root/public"
    printf '%s\n' "$old" > "$backup/COMMIT"
    printf '%s\n' "$backup" > "$candidate/PREVIOUS_RELEASE"
    cd "$root"
    pm2 restart saytu-yef --update-env
    pm2 save
    # Only disposable build caches are cleared, after the application is restarted.
    if [[ -d "$backup/.next/cache" && "$(readlink -f "$backup/.next/cache")" == "$backup/.next/cache" ]]; then
      rm -rf -- "$backup/.next/cache"
    fi
    touch "$candidate/ACTIVE"
    echo "Version active: $ref. Ancien runtime conserve: $backup"
    ;;
  *) echo 'Phase inconnue.' >&2; exit 1 ;;
esac
