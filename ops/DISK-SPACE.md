# Espace disque du VPS

## Nettoyage du 12 octobre 2026

Le disque de 19 Go etait rempli a 95 %, avec environ 982 Mo disponibles. Dix anciennes copies completes de juin occupaient environ 12 Go dans `/var/www/saytu-yef-backup-*`.
Ces dix copies ont ete exportees integralement, sans archive intermediaire sur le VPS, vers le dossier Windows prive `Documents/Saytu-Yef-Backups/application-archives`, puis retirees du VPS apres verification. Elles contiennent aussi leurs fichiers de configuration prives; ne pas partager ce dossier.
Chaque export est controle par SHA256 et lecture de la table des entrees tar. Avant toute suppression distante, le VPS recalcule l'empreinte de sa copie et exige qu'elle corresponde encore a l'archive Windows verifiee.
Les fichiers `.sha256`, manifests `verified-*.json` et le journal root `/var/backups/saytu-yef-application-archives/purged.log` conservent les preuves de copie et suppression.
Ce controle prouve l'integrite des archives, pas un test de demarrage de chaque ancienne application.

Ne sont pas supprimes : l'application active `/var/www/saytu-yef`, les sauvegardes PostgreSQL de `/var/backups/saytu-yef`, les fichiers Storage et les deux releases de secours les plus recentes (une seule presente lors de ce nettoyage).
Conserver un runtime ne garantit pas sa compatibilite avec la base actuelle : tout retour a une ancienne version doit coordonner code et migrations, comme indique dans `RETAIL-RELEASE.md`.
Les anciennes copies de juin doivent avoir plus de 30 jours. Les liens symboliques comme cible et les points de montage internes sont refuses. Archivage, purge et deploiement partagent un verrou exclusif.
Une copie encore referencee comme repertoire ou executable d'une application PM2 ne peut pas etre retiree. Un etat PM2 illisible bloque egalement la purge.

Resultat mesure : disque a 27 %, environ 14 Go disponibles, contre 95 % et 982 Mo avant. Les journaux sont passes de 720 Mo a 96 Mo apres application des limites. Les dix archives et leurs SHA256 sont conserves sur Windows avec le manifest `verified-20261012.json`.
L'application garde le meme PID PM2 pendant l'operation; `/api/health` reste HTTP 200 avec PostgreSQL et Auth `ok`. Les timers de sauvegarde et surveillance sont actifs. Garde-fous verifies : sept controles Windows de noms, six controles du parseur PM2 et du classement des releases, huit controles VPS dont la protection du secours existant. Syntaxes Bash et PowerShell validees.

## Conservation durable

- `deploy-staged-vps.sh` construit en RAM puis copie le runtime persistant sans cache de build. Il ne copie pas tout le depot pour creer un secours.
- Apres redemarrage, seul le cache de build du runtime de secours est retire. Son code compile, ses dependances et fichiers publics sont conserves.
- Au-dela de deux secours, les plus anciens deviennent exportables. Trois secours deja presents bloquent un nouveau deploiement tant que l'archivage Windows n'a pas ete fait; aucune suppression silencieuse de release.
- La configuration journald est limitee a 200 Mo persistants, 50 Mo temporaires et 14 jours maximum. Une taille maximale peut raccourcir la duree effectivement conservee. Journald doit laisser 1 Go libre; cela ne constitue pas un quota pour les autres applications.
- Les sauvegardes PostgreSQL restent conservees pendant 14 jours selon le helper existant. La copie quotidienne automatique sur Windows n'est pas activee.
- Les archives privees Windows ne sont pas purgees automatiquement; surveiller egalement l'espace du PC.

## Utilisation

Installer le helper VPS depuis la version controlee :

```bash
sudo install -m 755 /var/www/saytu-yef/scripts/archive-old-vps.sh /usr/local/sbin/saytu-yef-archive-old
sudo /usr/local/sbin/saytu-yef-archive-old self-test
sudo /usr/local/sbin/saytu-yef-archive-old list
```

Archive seule, sans suppression du VPS :

```powershell
pwsh -NoProfile -File scripts/archive-old-vps-to-windows.ps1
```

Apres accord pour retirer les copies verifiees :

```powershell
pwsh -NoProfile -File scripts/archive-old-vps-to-windows.ps1 -RemoveVerifiedFromVps
```

Le serveur conserve toujours les deux releases les plus recentes, meme avec ce commutateur. Une copie incomplete reste `.partial` et n'autorise pas la suppression.

Garde-fous Windows, sans connexion ni suppression :

```powershell
pwsh -NoProfile -File scripts/archive-old-vps-to-windows.ps1 -SelfTest
node scripts/test-disk-guards.mjs
```

Installer `ops/journald-saytu-yef.conf` dans `/etc/systemd/journald.conf.d/60-saytu-yef-disk.conf`, puis redemarrer uniquement `systemd-journald`. Verifier `journalctl --disk-usage` et `/api/health`; un redemarrage de PM2 n'est pas necessaire pour ce nettoyage.
`setup-operations.sh` reinstalle egalement le helper d'archivage et ces limites. Il refuse de s'executer pendant un deploiement ou un archivage.
