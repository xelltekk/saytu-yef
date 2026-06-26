# Exploitation Saytu Yëf

Les fichiers de ce dossier installent deux minuteurs systemd sur le VPS :

- contrôle de `/api/health` toutes les deux minutes et redémarrage PM2 en cas d'échec ;
- sauvegarde PostgreSQL Supabase chaque nuit à 02:15 UTC, vérifiée par `pg_restore`, avec conservation de 14 jours.

Après le déploiement :

```bash
sudo APP_DIR=/var/www/saytu-yef /var/www/saytu-yef/scripts/setup-operations.sh
sudo nano /etc/saytu-yef-ops.env
sudo systemctl start saytu-yef-backup.service
sudo systemctl status saytu-yef-backup.service
```

La variable `SUPABASE_DB_URL` doit utiliser la chaîne PostgreSQL fournie dans les paramètres Supabase. Le fichier `/etc/saytu-yef-ops.env` reste lisible uniquement par root.

Vérification d'une restauration sans écraser la production :

```bash
createdb saytu_yef_restore_test
pg_restore --clean --if-exists --no-owner --dbname=saytu_yef_restore_test /var/backups/saytu-yef/LE_FICHIER.dump
dropdb saytu_yef_restore_test
```
