# Exploitation Saytu Yëf

Validation scanner/imprimante, mesures de rapidite et etat des corrections de securite : voir [BOUTIQUE-VALIDATION.md](BOUTIQUE-VALIDATION.md).

Audit pour l'objectif de 100 boutiques avec plus de 500 produits chacune : voir [SCALABILITE.md](SCALABILITE.md). Il distingue les observations actuelles des capacites restant a prouver en environnement isole.

Supervision directe de Next.js, seuils, decisions de redemarrage et transition depuis l'ancien lanceur : voir [SUPERVISION.md](SUPERVISION.md). Ce nouveau lot est prepare, non active.

Banc de charge local choisi par le proprietaire, protections k6 et etapes encore requises pour Docker : voir [LOAD-TESTS.md](LOAD-TESTS.md). Les essais sur la vraie base de test n'ont pas encore ete executes.

Gestion de l'espace disque et archivage des anciens secours : voir [DISK-SPACE.md](DISK-SPACE.md). Le helper de deploiement borne le nombre de secours; leur retrait exige une copie Windows verifiee et conserve les deux plus recents.

Les fichiers de ce dossier installent deux minuteurs systemd sur le VPS :

- contrôle de `/api/health` toutes les deux minutes, alertes et redémarrage conditionnel de Next.js en cas d'indisponibilité confirmée ;
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
