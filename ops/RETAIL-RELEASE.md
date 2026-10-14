# Ameliorations commerce et exploitation

## Production Au 14 Octobre 2026

Runtime applicatif `d4d5218281052d250a023fa234c8249b17008578` active a 14:06 UTC, apres autorisation explicite et pause des encaissements. Catalogue/POS pagines, rapports agreges, optimisation de lecture des articles et supervision directe de Next.js sont maintenant en ligne.

- Les deux migrations de durcissement/index du 13 octobre etaient deja presentes via `20261013100209_retail_access_and_catalog_performance`; elles ne sont pas rejouees.
- Les migrations `20261013165734_catalogue_pagination.sql`, `20261013200735_rapports_agreges.sql` et `20261014133001_sale_items_read_policy_performance.sql` sont appliquees atomiquement sous `20261014140548_catalogue_reports_read_optimization`. Ne pas rejouer l'historique complet ni ces fichiers individuellement sur cette production.
- Sauvegarde fraiche `saytu-yef-20261014T140026Z.dump`, copie Windows SHA256 verifiee et inventaire des roles associe. Cinq fichiers Storage copies/verifies dans `Documents/Saytu-Yef-Backups/storage-20261014T1402322518227Z`.
- Build Linux Next.js 15.5.27 reussi dans un montage temporaire, puis candidat copie sur disque avant tout changement SQL. L'avertissement Supabase `process.version` dans l'Edge Runtime reste non bloquant; le build n'est pas declare sans avertissement.
- Empreintes integrales identiques avant/apres des 119 ventes, 143 articles, 140 versements, 51 variantes produits et 43 mouvements de stock. Aucune vente fictive ni charge de test en production; aucun marqueur/jeu `load_lab` installe.
- PM2 supervise directement Next, mode fork, PID initial 1323319. Moniteur et sauvegardes actifs, service de controle termine avec succes; rotation des journaux verifiee. Etat et journal de supervision proteges en 0600, y compris le journal herite de l'ancien moniteur.
- `/api/health` local/public valide : PostgreSQL et Auth `ok`. `/login` HTTP 200 et service worker HTTP 200 avec revalidation obligatoire. RPC privilegies anonymes refuses; les trois nouveaux RPC de lecture sont SECURITY INVOKER, autorises a authenticated seulement.
- Lecture catalogue/rapport annuel/code-barres verifiee avec le vrai role SQL authenticated et des claims simules, sans ecriture. Ce controle n'est pas une connexion navigateur avec JWT signe; les parcours utilisateur et le materiel sont a reverifier en boutique apres rafraichissement.
- Secours executable conserve : `/var/www/saytu-yef-release-7f19313c1be060310f95391091a372dcc48bc0ef-20261014T140614Z`, avec l'ancienne configuration PM2.

L'audit securite apres migration retrouve les avertissements connus : 34 RPC SECURITY DEFINER accessibles au role connecte et controles, protection des mots de passe compromis desactivee; trois tables internes RLS sans politique restent directement inaccessibles. Aucune alerte SECURITY DEFINER anonyme. References : [RPC connectes](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [tables internes sans politique](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

La validation de charge reste locale : deux boutiques, jusqu'a six caissiers et 36 500 ventes fictives. La capacite a 100 boutiques n'est pas certifiee. Les sessions navigateur/PWA doivent etre rafraichies avant reprise des encaissements.

## Historique Du 12 Octobre

Version applicative `259e878dedf53229e25ca2cada92278f8f979a3e` deployee le 12 octobre 2026 a 16:07 UTC, apres accord explicite et pause des encaissements.
Les deux migrations ci-dessous ont ete appliquees ensemble, dans leur ordre, en une migration atomique Supabase `20261012160727_retail_reliability_and_workflows`. Ne pas les rejouer individuellement sur cette production.
La copie hors VPS a ete telechargee sur Windows dans `Documents/Saytu-Yef-Backups` et son SHA256 verifie. Les deux logos actuellement presents dans Storage ont aussi ete copies et verifies.
Le helper de sauvegarde du VPS inclut maintenant les proprietaires et droits SQL. Chaque nouvelle archive est accompagnee d'un inventaire des roles et appartenances, lie au SHA256 du dump. Les mots de passe des roles PostgreSQL ne sont pas exportes.
La copie quotidienne Windows est optionnelle et n'est pas activee sans accord.

## Verification du deploiement

- Build Linux Next.js 15.5.27 termine avant toute modification SQL, dans un montage RAM temporaire; candidat copie ensuite sur disque persistant.
- Sauvegarde fraiche `saytu-yef-20261012T160624Z.dump` copiee sur le PC avec SHA256 et inventaire des roles verifies; deux fichiers Storage sauvegardes et verifies.
- Empreintes financieres identiques avant/apres : 115 ventes, 138 articles vendus, 135 versements et 46 produits. Aucun encaissement fictif en production.
- `/api/health` HTTP 200 : PostgreSQL et Auth `ok`. Nouveaux RPC de vente et versement presents, ancienne fonction de versement interdite au navigateur, vente interdite au role anonyme.
- Remise stockee en `numeric(15,2)`; RLS active sur les nouvelles tables clients, relances et commandes fournisseurs.
- PM2 redemarre avec succes, moniteur mis a jour et execute avec succes, timers de surveillance et sauvegarde actifs.
- Ancien runtime conserve dans `/var/www/saytu-yef-release-ad817726133b9bea04f6595e3d3eb5769c3e4a14-20261012T160741Z`; son cache de compilation dispensable est retire pour liberer le disque. Anciennes sauvegardes conservees.
- Rafraichir toutes les sessions navigateur/PWA avant de reprendre les encaissements. Les tests de connexion et operations reelles restent a faire par la boutique; scanner et imprimante restent a valider sur le materiel.

Le disque du VPS etait tres rempli par les anciennes sauvegardes applicatives. Le nettoyage autorise du 12 octobre a archive integralement les dix copies de juin sur Windows, puis les a retirees apres verification : disque de 95 % a 27 %, environ 14 Go libres. Le runtime de secours recent et les sauvegardes de base sont conserves. Voir `DISK-SPACE.md` pour la politique de retention et les garde-fous.
L'audit Supabase ne signale plus les quatre fonctions au `search_path` mutable. Le durcissement du 13 octobre retire les acces anonymes aux fonctions privilegiees : aucun avertissement anonyme, 34 avertissements authentifies sur des RPC volontairement exposes et controles. La protection contre les mots de passe compromis reste desactivee. Les trois tables internes sans politique RLS restent inaccessibles directement. Voir [BOUTIQUE-VALIDATION.md](BOUTIQUE-VALIDATION.md) pour les migrations deja appliquees, leurs limites et les essais restant a faire.
References : [fonctions privilegiees publiques](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [protection des mots de passe](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Fonctionnalites

- Vente transactionnelle avec stock verrouille, remise monetaire, paiements mixtes et identifiant de reprise.
- Prix de revient capture lors des nouvelles ventes. Les anciens articles restent signales comme estimations dans les rapports.
- Rapports pagines, encaissements dates selon les versements, export CSV correspondant.
- Comptes clients persistants, echeances, filtre des retards, historique pagine et reglement global des dettes les plus anciennes.
- Journal manuel des relances. Un lien WhatsApp ne constitue pas une preuve de livraison.
- Paniers en attente, separes entre utilisateurs. Une tentative reseau non confirmee conserve son identifiant.
- Commandes fournisseurs suggerees a partir du stock faible, reception atomique et protection contre une double reception.
- Indicateurs SaaS actifs, MRR estime, renouvellements proches et boutiques inactives reserves aux operateurs autorises.
- Nouvelles photos produits dans Storage au lieu de texte base64 dans les lignes produits. Les anciennes photos sont converties lors de l'enregistrement de leur fiche, pas automatiquement en masse.
- Controles de sante PostgreSQL et Auth distincts; le moniteur ne redemarre pas l'application pour une panne externe de Supabase.

## Mise en ligne coordonnee

Les anciens RPC de vente et de versement deviennent prives. Ne pas appliquer le SQL seul tant que l'ancien frontend est utilise.

1. Verifier une sauvegarde recente et reserver une courte interruption des encaissements.
2. Installer les dependances avec `npm ci` et terminer `npm run build` avec succes avant de changer la base.
3. Pendant l'interruption, appliquer les migrations, dans cet ordre :
   - `20261011000521_retail_reliability.sql`
   - `20261011001011_retail_workflows.sql`
4. Redemarrer PM2 sur le nouveau build et rafraichir les navigateurs/PWA des caissiers.
5. Verifier `/api/health`, connexion, vente remise + acompte, vente mixte, dette puis versement global, remboursement et reception fournisseur.
6. Reinstaller le moniteur avec le script d'exploitation existant lorsque le nouvel endpoint est disponible.

Ne pas redemarrer PM2 apres un build en echec. Un retour a l'ancien code exige aussi une strategie de compatibilite SQL : ses anciens RPC ne sont plus accessibles aux clients.

## Sauvegarde sur Windows

Copie manuelle : `pwsh -NoProfile -File scripts/backup-to-windows.ps1`

Apres accord, ajouter `-InstallDailyTask` pour une copie a 03 h lorsque la session Windows est ouverte, avec rattrapage au prochain demarrage possible.
Le repertoire Windows est prive et aucun mot de passe n'est enregistre dans la tache. La cle SSH existante reste sur le PC.
La copie conserve les fichiers locaux; aucune purge automatique n'est configuree.
La commande copie le dernier dump PostgreSQL puis cree un dossier `storage-<date UTC>` avec les fichiers des buckets publics, un inventaire et des empreintes SHA256. Les anciennes images base64 restent dans le dump PostgreSQL.
Les droits du dossier Windows sont limites a l'utilisateur courant, SYSTEM et Administrateurs avant toute copie.
Les noms locaux sont des empreintes, pas des chemins fournis par la base. Taille, ETag et stabilite de l'inventaire sont verifies. Un echec laisse un dossier `.partial`, jamais declare comme une copie terminee.
Un bucket prive non vide fait echouer la copie Storage : un acces serveur protege devra alors etre configure. Aucun secret Storage n'est copie dans le depot.
Le dump et Storage sont pris a des instants distincts. Pour une restauration exactement synchronisee, interrompre les modifications et prendre une nouvelle sauvegarde des deux.
`-SkipStorage` demande explicitement une copie de la base seule. Aucune tache quotidienne Windows n'a encore ete installee.

Reverification locale : `pwsh -NoProfile -File scripts/verify-storage-backup.ps1 -BackupPath <dossier-storage>`.
Tests des garde-fous : `pwsh -NoProfile -File scripts/test-windows-backups.ps1` (14 tests, donnees fictives).
Integrite avant restauration : `pwsh -NoProfile -File scripts/test-restore-guards.ps1` (7 tests, donnees fictives).

## Restauration et verifications restantes

`scripts/test-backup-restore.sh` restaure atomiquement, avec les proprietaires et ACLs, uniquement dans une base vide nommee `saytu_restore_test_*` et refuse une autre cible. Ses roles et extensions compatibles doivent deja etre prepares.
Fournir `RESTORE_TEST_DB_URL` par un environnement protege et `BACKUP_FILE` avec son fichier `.sha256`.

Le runner Windows `scripts/test-backup-restore-windows.ps1` cree son propre cluster PostgreSQL, protege par un mot de passe aleatoire temporaire, sur `127.0.0.1:55439`. Il refuse un port occupe, controle les empreintes de l'archive et de l'inventaire des roles et ne supprime aucune base existante. Il conserve les proprietaires, ACLs, appartenances et attributs superuser sauvegardes (requis pour les proprietaires des event triggers Supabase), mais desactive les connexions des roles importes. Le compte administratif aleatoire du cluster de test reste distinct.
Le runner arrete son cluster dans `finally`, efface le fichier d'initialisation du mot de passe et conserve les donnees et diagnostics dans le dossier Windows prive `restore-tests/<date>-<identifiant>`.

Commande pour le test des deux migrations sur la copie :

```powershell
pwsh -NoProfile -File scripts/test-backup-restore-windows.ps1 -AllowEmptyVaultOmission -TestPendingMigrations
```

Sans `-AllowEmptyVaultOmission`, toute extension absente bloque le test. Sur PostgreSQL Windows, seule l'extension Supabase Vault manque. Son exclusion explicite exige que le dump lui-meme contienne une table de secrets vide et n'omet que ses huit entrees identifiees : extension, commentaire, donnees et cinq ACLs. Le schema Vault vide reste present. Une entree differente ou un secret sauvegarde bloque le test.
Ce mode teste les donnees de l'application, Auth et les metadonnees Storage, pas une plateforme Supabase complete. Les appartenances aux roles internes `pg_*`, mots de passe PostgreSQL, services Auth/Storage, cles JWT, SMTP et fichiers Storage ne sont pas recrees par ce runner. Les fichiers Storage disposent de leur verification distincte ci-dessus. Pour une vraie reprise de la plateforme, utiliser une instance Supabase compatible et reconfigurer les services secrets hors du depot.
Le rapport prive contient les exclusions, comptes de lignes, contraintes et empreintes financieres avant/apres migration. Les migrations doivent conserver les ventes, articles, paiements et stocks historiques.
Reference : [restauration Supabase sur une instance compatible](https://supabase.com/docs/guides/self-hosting/restore-from-platform).

Test reel valide le 11 octobre 2026 sur PostgreSQL Windows 18.1, avec `saytu-yef-20261011T131955Z.dump` : 114 ventes, 136 articles vendus, 135 paiements, 47 produits, 20 profils, 20 comptes Auth et 2 objets Storage. Les deux migrations ont reussi; les quatre empreintes des ventes, articles, paiements et stocks sont identiques avant/apres. Aucune contrainte publique non validee n'est presente. Les anciens RPC financiers sont interdits au navigateur et les nouveaux RPC autorises au role authentifie seulement. Le cluster temporaire est arrete.
Rapport prive : `Documents/Saytu-Yef-Backups/restore-tests/20261011T134237Z-fc71462d5b8f42edba4effff4871353e/report.json`. Les huit exclusions Vault sont listees explicitement. Les fichiers Storage ont ete verifies separement dans `storage-20261011T1321061719217Z`.
Le helper de sauvegarde corrige est installe sur le VPS et son execution systemd a termine avec `Result=success` et `ExecMainStatus=0`. Ce controle precedait le deploiement du 12 octobre decrit en tete du document.

## Concurrence reelle

```powershell
pwsh -NoProfile -File scripts/test-backup-restore-windows.ps1 -AllowEmptyVaultOmission -TestPendingMigrations -TestConcurrentWorkflows
```

Ce mode cree une seconde base locale a partir de la restauration, avec des boutiques et comptes fictifs. Les essais n'utilisent ni les identifiants des utilisateurs reels ni les secrets de production. Chaque paire opere avec le role `authenticated` et des claims SQL de test; cela ne remplace pas une connexion Auth HTTP avec verification JWT.
Une transaction de coordination bloque une ligne, puis `pg_stat_activity` doit confirmer deux backends distincts en attente d'un verrou avant sa liberation. Un lancement seulement sequentiel ne peut pas valider ces tests. Les processus ont des delais bornes et le cluster est arrete dans le runner principal.

Validation du 12 octobre 2026 : 13 scenarios passent, avec contention prouvee : survente, nouvelle tentative de vente identique, tentative contradictoire, derniere vente gratuite autorisee, versement identique, depassement de dette, versements distincts sans perte, reglement global identique, reglement global/individuel, remboursement double, reception double, remboursement/versement et reception/vente.
Le test initial a reproduit un interblocage remboursement/versement, dans la verification de cle etrangere de `stock_movements.user_id`. Les verrous de compte sont passes de `FOR UPDATE` a `FOR NO KEY UPDATE` dans les deux migrations desormais deployees. Ils continuent a serialiser les encaissements, quotas et ajustements de stock, tout en laissant passer les controles FK `KEY SHARE`. Les verrous sur les ventes et produits restent inchanges.
Les empreintes des lignes historiques des ventes, articles, paiements, produits, mouvements de stock, profils et comptes Auth sont identiques avant/apres les essais. La base source de restauration est egalement inchangee.
Rapport prive : `Documents/Saytu-Yef-Backups/restore-tests/20261012T141023Z-5bdd0f8b448f45e8bde37b78da455cd4/concurrency/report.json`.
`node scripts/test-concurrency-guards.mjs` valide sept refus/controles de configuration sans ouvrir de connexion PostgreSQL.
Reference : [modes de verrouillage PostgreSQL](https://www.postgresql.org/docs/18/explicit-locking.html).

Les 73 tests automatises de l'application passent avec deux workers. Le delai d'installation du schema PGlite est porte a 90 secondes pour le demarrage WASM a froid sur Windows, mesure a 26,6 secondes avant meme l'installation des tables. Les delais et assertions des tests metier restent inchanges.
Lint et verification TypeScript sont valides apres le correctif. Ces essais precedaient le deploiement et la migration atomique du 12 octobre decrits en tete du document.
Le serveur local lance le 11 octobre consomme beaucoup de CPU (1,78 seconde CPU mesuree sur un intervalle de deux secondes). Sa relance a ete refusee par l'environnement d'execution; une relance manuelle reste a faire. Aucun processus du VPS n'a ete arrete.
Les essais UI emploient un backend simule pour ne pas creer de transactions dans la production.
La lecture sur le scanner physique et l'impression thermique restent a verifier avec le materiel de la boutique.
Un controle de connexion automatise necessitera un compte technique dedie, pas le mot de passe du proprietaire.

## Dependances

Next.js passe de 15.5.19 a 15.5.27 sans changement majeur. Vitest passe a 5.0.3 avec configuration JSX Oxc et quatre processus maximum. Les 73 tests passent sur cette version. Le projet declare Node 22.12+, 24 ou 26+; le VPS utilise Node 22.22.3.
Les correctifs compatibles de Sharp, Tailwind et plusieurs dependances transitives ont ete installes. L'outil Terser de Workbox est remplace par 1.0.0 via une surcharge ciblee; le build PWA et les essais visuels sont verifies. Esbuild est declare explicitement pour les essais UI isoles.
Next utilise PostCSS 8.5.29 via une surcharge ciblee; son ancienne copie imbriquee 8.4.31 a ete retiree de la resolution. `npm ls postcss` et `npm ci --dry-run --ignore-scripts --no-audit --no-fund` sont valides.
Audit npm du 11 octobre 2026 : 6 alertes elevees, aucune critique, contre 25 alertes dont 2 critiques avant ces corrections. Avec `--omit=dev`, il reste 4 alertes elevees. Ce sont les alertes de la chaine `braces`/`micromatch`/`fast-glob` et de ses consommateurs PWA/ESLint; l'application n'est pas declaree sans vulnerabilites.
Aucun `npm audit fix --force` ni remplacement majeur de Next.js n'a ete effectue. Les dependances doivent etre installees avec le lockfile, pas en copiant `node_modules` de Windows vers Linux.

References de migration : [Vitest 5](https://vitest.dev/guide/migration/), [Vite/Oxc](https://vite.dev/guide/migration), [Terser 1.0](https://github.com/rollup/plugins/blob/master/packages/terser/CHANGELOG.md).
