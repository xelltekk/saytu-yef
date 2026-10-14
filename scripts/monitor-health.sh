#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# A deployment must never race with an automatic health restart.
exec 9>/var/lock/saytu-yef-deploy.lock
flock -n 9 || exit 0
exec 8>/var/lock/saytu-yef-monitor.lock
flock -n 8 || exit 0
exec /usr/bin/node /usr/local/lib/saytu-yef/monitor-runtime.mjs "$@"
