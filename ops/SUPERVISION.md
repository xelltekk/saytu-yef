# Supervision du runtime Next.js

## Etat du lot

Prepare le 13 octobre 2026, non active en production. Le processus de production reste celui deja en ligne. Les essais utilisent une instance PM2 jetable, un PM2_HOME prive et le port local 3379; ils ne redemarrent pas le daemon PM2 de production.

## Processus surveille

`ecosystem.config.js` lance directement `node_modules/next/dist/bin/next`, en mode fork avec une instance, uniquement sur 127.0.0.1:3000. La limite existante de 500 Mio concerne ainsi Next.js et non plus le lanceur npm. Un avertissement est emis a 400 Mio; la limite PM2 reste a dimensionner sur des mesures de charge. Aucun second worker n'est ajoute sans mesure.

Le delai d'arret est de dix secondes, celui entre redemarrages de cinq secondes. Les demarrages instables sont limites a dix. Ces protections ne remplacent pas l'idempotence des encaissements ni une recette de concurrence.

Un simple `pm2 restart saytu-yef` garde le script de l'ancienne entree npm. Le helper `deploy-staged-vps.sh activate` recree uniquement l'entree nommee depuis le nouveau fichier ecosystem, pendant la pause des encaissements. Il conserve aussi l'ancienne configuration dans le secours de release. Ne pas utiliser `pm2 kill` sur le daemon de production.

Reference : [configuration PM2](https://pm2.keymetrics.io/docs/usage/application-declaration/), [limite de memoire PM2](https://pm2.keymetrics.io/docs/usage/memory-limit/).

## Decisions du moniteur

Le minuteur existant conserve sa frequence de deux minutes. Le nouveau controle compare l'acces public et `http://127.0.0.1:3000/api/health`.

- Base ou Auth indisponible : alerte de dependance, aucun redemarrage pour tenter de reparer Supabase.
- Acces public indisponible, Next local accessible : alerte d'acces public/Nginx/DNS/TLS, aucun redemarrage de Next.
- Probe locale en echec mais acces public valide : alerte de configuration de la probe, aucun redemarrage.
- Les deux acces sont indisponibles : attendre trois controles consecutifs et respecter quinze minutes entre tentatives. Seule une entree PM2 identifiee, online ou errored, peut etre redemarree. Un arret volontaire, une entree absente/ambigue ou des informations de supervision inconnues n'autorisent pas un redemarrage.
- Memoire elevee ou disque libre sous 2 Gio : avertissements sans redemarrage du moniteur. PM2 conserve sa propre politique de limite memoire.
- Pendant un deploiement/archivage ou un autre controle, le verrou partage fait sauter le controle sans intervention.

Le controle apres redemarrage valide de nouveau le JSON et les dependances, pas uniquement un HTTP 200. Un etat de supervision illisible interrompt le controle au lieu de reinitialiser le delai anti-boucle.

## Mesures et limites

`/var/lib/saytu-yef/monitor.json` conserve au plus 720 observations sur 24 heures, ecrit de maniere atomique avec des droits prives. Les mesures comprennent le PID Next, son RSS, le CPU PM2 si Next est supervise directement, la charge systeme, la memoire libre du systeme et l'espace disque libre.

Avec l'ancien lanceur, le moniteur peut retrouver un unique enfant `next-server` pour mesurer son RSS, mais signale `legacy_supervisor` : la limite PM2 ne porte toujours pas directement sur cet enfant. Aucune variable d'environnement PM2 ni ligne de commande complete n'est copiee dans les resultats.

Les statistiques sur une heure donnent le nombre de probes et d'echecs, ainsi que le p95 des probes de sante reussies. Une alerte de lenteur exige au moins dix probes reussies. Il ne s'agit ni du p95 des pages POS/rapports, ni du temps d'encaissement, ni d'une mesure de capacite a 100 boutiques. La collecte des erreurs et latences de vrais parcours, les attentes de verrous et les metriques CPU/IO de la base Supabase restent des travaux distincts.

Le journal JSON `/var/log/saytu-yef-monitor.log` dispose d'une rotation quotidienne, quatorze generations compressees, avec un seuil de rotation de 5 Mo lors du passage de logrotate. Les alertes de changement sont envoyees uniquement si `ALERT_WEBHOOK_URL` est deja configure; aucune nouvelle destination externe n'est creee. La livraison d'une alerte depend de ce service externe.

## Activation ulterieure

La premiere transition doit se faire pendant la pause des encaissements. L'ancien moniteur installe n'utilise pas encore le verrou partage : suspendre son minuteur et attendre/arreter son service avant l'activation. Installer ensuite les nouveaux fichiers avec `setup-operations.sh`; celui-ci recree les bibliotheques du moniteur, l'etat prive et la rotation, puis reactive le minuteur. Ne jamais remplacer seulement le shell sans ses deux modules Node.

Ordre pour l'operateur autorise, apres sauvegarde, migrations et preparation du candidat valide :

```bash
systemctl stop saytu-yef-monitor.timer
systemctl stop saytu-yef-monitor.service
/var/www/saytu-yef/scripts/deploy-staged-vps.sh activate COMMIT_COMPLET_VALIDE
APP_DIR=/var/www/saytu-yef /var/www/saytu-yef/scripts/setup-operations.sh
pm2 describe saytu-yef
systemctl start saytu-yef-monitor.service
systemctl status saytu-yef-monitor.service
```

Si l'activation echoue, garder les encaissements en pause et restaurer le runtime conserve avant de reactiver le minuteur. La configuration du secours permet de retrouver le lanceur precedent. Aucun basculement ni restauration n'est effectue par la preparation de ce lot.

Les nouveaux seuils optionnels sont decrits dans `saytu-yef-ops.env.example`. Ne pas recopier ce fichier sur `/etc/saytu-yef-ops.env` existant : conserver les valeurs et secrets deja configures.

Controle ponctuel sans fichier d'etat, notification ni redemarrage :

```bash
node /var/www/saytu-yef/scripts/monitor-runtime.mjs --read-only
```

Le mode lecture seule ne prend pas les verrous du wrapper et ne constitue pas une installation du moniteur.

## Recette isolee

Les tests unitaires couvrent les classifications HTTP/JSON, les pannes de dependances/proxy, les trois echecs, le delai anti-boucle, les arrets volontaires, l'ambiguite des processus, les seuils, la retention et le p95. Le script ci-dessous est limite aux dossiers `/var/tmp/saytu-yef-validation-*`; il cree un daemon PM2 prive, puis le supprime avec son propre PM2_HOME et verifie l'arret du Next jetable.

```bash
node scripts/verify-runtime-supervision.mjs /var/tmp/saytu-yef-validation-20261013 3379
```

La recette compare le PID PM2, le RSS mesure et `/proc/PID/status`. Les probes utilisent le serveur jetable et ne creent aucune vente. Un controle ponctuel en lecture seule de la production a egalement identifie le vrai enfant Next, avec les deux probes valides, sans changer son PID. Ce petit echantillon n'est pas un benchmark.

Resultats : 142 tests passent, dont 21 tests de supervision; TypeScript et ESLint passent. La recette Linux confirme aussi l'arret de l'ancien enfant npm avant le demarrage direct, les droits 0600 de l'etat et du journal et le refus d'intervenir si l'etat est corrompu. Les scripts Bash, l'unite systemd et la configuration logrotate sont verifies sans installer ni activer ces fichiers.
