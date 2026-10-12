#!/usr/bin/env bash
set -Eeuo pipefail
: "${RESTORE_TEST_DB_URL:?Configurer une base PostgreSQL de test isolee}"
: "${BACKUP_FILE:?Indiquer le fichier .dump a tester}"

# Fail closed: a successful test never justifies touching an existing application DB.
dbname="$(psql "$RESTORE_TEST_DB_URL" -Atqc 'select current_database()')"
if [[ "$dbname" != saytu_restore_test_* ]]; then
  echo 'La base cible doit commencer par saytu_restore_test_.' >&2
  exit 1
fi
tables="$(psql "$RESTORE_TEST_DB_URL" -Atqc "select count(*) from pg_tables where schemaname not in ('pg_catalog','information_schema')")"
if [[ "$tables" != 0 ]]; then
  echo 'La base de test doit etre vide. Aucun nettoyage automatique.' >&2
  exit 1
fi
expected="$(awk 'NR == 1 {print $1}' "$BACKUP_FILE.sha256")"
if [[ ! "$expected" =~ ^[[:xdigit:]]{64}$ ]]; then
  echo 'Empreinte SHA256 invalide.' >&2
  exit 1
fi
actual="$(sha256sum "$BACKUP_FILE" | awk '{print $1}')"
if [[ "${actual,,}" != "${expected,,}" ]]; then
  echo 'La sauvegarde ne correspond pas a son empreinte.' >&2
  exit 1
fi
# Roles and compatible extensions must already exist in the isolated instance.
# Keep ownership and ACLs, and roll back the entire restore on any error.
pg_restore --single-transaction --dbname="$RESTORE_TEST_DB_URL" "$BACKUP_FILE"
psql "$RESTORE_TEST_DB_URL" -v ON_ERROR_STOP=1 -Atqc "select 'ventes=' || count(*) from public.sales; select 'produits=' || count(*) from public.products;"
echo 'Restauration de test terminee. La base isolee est conservee pour verification.'
