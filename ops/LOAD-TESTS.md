# Banc de charge local - 14 octobre 2026

## Etat actuel

Les optimisations applicatives/SQL validees par ces essais sont deployees en production le 14 octobre 2026 a 14:06 UTC (runtime `d4d5218281052d250a023fa234c8249b17008578`). Les paragraphes de diagnostic ci-dessous conservent la chronologie avant mise en ligne. Les fixtures, comptes et essais de charge restent exclusivement locaux; aucun RPC de marqueur ni donnee fictive n'est installe en production. Details : [RETAIL-RELEASE.md](RETAIL-RELEASE.md).

Le proprietaire a choisi Supabase local sur son PC Windows avec Docker. Docker Desktop est installe et son moteur Linux/WSL 2 repond (contexte `desktop-linux`). Aucun resultat de capacite a 100 boutiques n'est encore acquis.

Le projet local est initialise hors du dossier web XAMPP : `C:/Users/BAMBA/AppData/Local/SaytuYefLoadLab/supabase/config.toml`. Il porte l'identifiant `saytu-yef-load-lab`, utilise PostgreSQL 17 et les ports API 55321 / base 55322. Il n'est lie a aucun projet cloud. Studio, Realtime, Edge Runtime, SMTP local et Analytics sont desactives. Storage est necessaire a l'installation de la migration des logos, meme pour les mesures de lecture sans photos.

La configuration et les comptes de test restent independants de `.env.local`, du dossier `supabase/` du projet applicatif et de l'application locale actuellement ouverte. Aucune sauvegarde de production n'est utilisee.

Attention : le CLI publie ici les ports Docker sur toutes les interfaces, pas uniquement sur loopback. Le lanceur de charge ne contacte que 127.0.0.1, mais cela ne constitue pas un pare-feu. Ne pas rediriger ces ports sur le routeur; arreter les conteneurs du laboratoire apres les essais. Aucun reglage du pare-feu Windows n'a ete modifie automatiquement.

## Outillage prepare

- Supabase CLI 2.120.0, version verifiee et commandes init/start consultees via `--help`. L'initialisation ne lance aucun conteneur.
- Grafana k6 2.3.0 portable dans `.load-lab/tools/k6/k6-v2.3.0-windows-amd64/k6.exe`. Archive officielle verifiee par SHA-256 `112276d495e5741c968e2bc09ea6196099c1275bd6db9ee0875d173c7148ce43`. Aucune installation systeme k6 ni modification des dependances applicatives.
- `ops/load/reads.k6.js`, avec les contrats et scenarios dans `ops/load/spec.mjs`.
- `scripts/run-local-load.mjs`, qui ne charge aucun fichier d'environnement de production et exige le fichier prive `%LOCALAPPDATA%/SaytuYefLoadLab/credentials.json`.
- `scripts/prepare-local-load.mjs initialize`, installation sur une base locale vide uniquement, puis deux boutiques, huit comptes, douze variantes et cinquante ventes annuelles par boutique. Les commandes `verify` et `refresh` reverifient les acces et renouvellent les sessions fictives.

Les artefacts publics et simulations sous `.load-lab/` sont exclus de Git et du lint. Les sessions fictives locales ne sont pas placees dans ce dossier du depot, qui est sous le document root XAMPP. Le fichier `credentials.json` contient uniquement les sessions locales et une cle publique. `status.json`, les journaux CLI et `logins.json` sont egalement prives et peuvent contenir les cles locales d'administration ou les mots de passe generes des seuls comptes fictifs. Ne pas les publier ni les joindre aux rapports. Aucun mot de passe client reel n'est utilise.

L'initialisation reconstruit le schema historique du commit `86f562a186f04f796627c6b00d7f031e37a78738`, puis applique les migrations triees du depot dans une transaction. Adaptation du rejeu local : la migration `202607181930_support_console_ops.sql` change les colonnes OUT de `list_support_platform_accounts`; le preparateur supprime son ancienne signature juste avant sa recreation. Aucune migration de production n'est modifiee par cette adaptation. Les transactions internes du fichier des logos sont absorbees dans la transaction globale. Les tables Storage proviennent du vrai service Supabase, pas de tables factices.

Le jeu historique est construit directement en SQL. Les seuls triggers utilisateur de `sale_items` sont suspendus dans la transaction de fabrication, puis reactives, avec couts explicites et stock constant. Cela n'est pas un test de checkout, d'ecriture de stock ni de concurrence financiere. Les vraies politiques RLS, RPC catalogue/rapports et sessions Auth sont conservees et exercees par huit comptes non privilegies.

References : [Supabase local et CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [Docker Desktop Windows](https://docs.docker.com/desktop/setup/install/windows-install/), [API load testing k6](https://grafana.com/docs/k6/latest/testing-guides/api-load-testing/).

## Protections avant la charge

Seule une adresse litterale `http://127.0.0.1:PORT` est acceptee. Les domaines de production/cloud, localhost avec resolution DNS, chemins, identifiants dans l'URL et redirections sont refuses. Les requetes ne suivent aucune redirection.

Le fichier doit declarer un jeu marque `saytu-load-read-v1`, un identifiant de run et des comptes uniques, avec leurs boutiques, roles et variantes attendues. Chaque JWT doit avoir le sujet correspondant, le role authenticated, l'emetteur local exact et une duree de validite suffisante pour le scenario. Les cles service_role et les sessions privilegiees sont refusees. Le decodeur client ne valide pas la signature; cette verification reste celle de Supabase Auth/PostgREST sur la vraie base.

Avant toute boucle de charge, tous les comptes du scenario doivent recevoir un marqueur concordant de `load_test_identity`. Cette fonction est propre a la base de test et ne doit jamais etre ajoutee en production. Sans elle, le banc s'arrete apres les probes de verification; il ne retombe pas sur une cible distante.

Le lanceur utilise une configuration k6 vide et privee, supprime les variables K6/proxy heritees, desactive le rapport d'usage et ne transmet que les chemins et le profil au runtime JavaScript. Aucun export Grafana Cloud ni destination de metriques externe n'est configure. Les resumes locaux ne contiennent ni JWT, ni cle API, ni corps de reponse.

## Scenarios prevus

`smoke` : un proprietaire fictif, cinq cycles, maximum une minute. C'est le premier controle a lancer apres initialisation, pas une preuve de capacite.

`owners2` / `cashiers6` : paliers pilotes de deux minutes, respectivement deux proprietaires ou six caissiers (trois par boutique, hypothese de test). Ils exigent deux boutiques, 1 200 variantes et 18 250 ventes annuelles chacune. Les effectifs doivent correspondre exactement; les minimums sont 80 / 240 cycles termines dans le palier. Ce ne sont pas des substituts aux jeux et scenarios 100/300.

`shops100` : une boutique par proprietaire, 100 proprietaires distincts; montees et paliers a 5, 10, 25, 50 et 100 acces. Chaque montee dure 30 secondes, chaque palier une minute, puis descente finale : huit minutes au total, hors verification initiale et delais de fin.

`cashiers300` : hypothese de trois caissiers par boutique, non confirmee comme besoin commercial. Paliers a 5, 25, 50, 100, 200 et 300 acces, pour neuf minutes trente hors verification initiale et delais de fin. Le jeu doit inclure exactement trois caissiers par boutique; leurs rapports sont limites a leurs propres ventes.

Les deux grands scenarios exigent 100 boutiques, au moins 1 200 variantes par boutique (600 groupes si deux variantes par groupe) et au moins 18 250 ventes par boutique. Le jeu cible represente 1,825 million de ventes annuelles avant leurs articles/versements. Ce volume n'est pas encore genere.

Chaque cycle lit une page catalogue bornee, alterne inventaire/POS et recherche une variante par code-barres. Un rapport annuel est lu tous les vingt cycles. La pause de deux secondes represente un temps d'action utilisateur. Les sessions sont preparees avant le run : le banc ne mesure pas les connexions Auth en charge.

## Mesures et seuils proposes

Les latences sont classees par operation et par palier; les rampes ne sont pas melangees aux paliers mesures. Chaque palier exige au moins cinquante cycles acheves; le smoke en exige cinq. Les seuils proposes sont p95 catalogue sous 2,5 s, scanner sous 1,5 s et rapport annuel sous 5 s. Ils sont des objectifs de recette, pas des resultats acquis. Le rapport annuel est moins frequent que les autres lectures; interpreter son p95 avec le nombre d'observations disponible.

Toute incoherence de resultat ou lecture entre boutiques interrompt immediatement le run. Les lectures verifient le proprietaire, les IDs produits attendus, le nombre de variantes, les bornes de reponse, les comptes annuels et le perimetre des caissiers. Le taux d'erreurs HTTP doit rester sous 1 %. Les fichiers de resultats sont conserves sous `%LOCALAPPDATA%/SaytuYefLoadLab/results/`.

Il s'agit d'un modele ferme de VU : quand le serveur ralentit, le debit baisse. Le run ne garantit pas un debit fixe de transactions et ne simule pas 100 navigateurs complets. Aucun checkout, versement, remboursement, imprimante ou scanner physique n'est exerce par ce premier script. Les essais financiers concurrents et la mesure des vrais ecrans Next.js restent a ajouter.

Un succes local ne certifiera pas la production : PC, Docker et PostgreSQL local n'ont pas le meme compute, reseau, pooling, Auth, caches et latences que le VPS et Supabase heberge. Il faudra relever les ressources du generateur et des conteneurs, les plans SQL et l'attente de verrous, puis tester les parcours complets avant toute conclusion de capacite.

## Verification du moteur sans Docker

`src/lib/loadSpec.test.ts` : 17 tests de garde passent, notamment cible locale, JWT/roles, expiration, volumes, contrats et separation des paliers. TypeScript et ESLint ciblant les nouveaux fichiers passent.

`scripts/test-load-runner.mjs` lance le vrai k6 contre un faux serveur HTTP jetable et des JWT sans signature utilisable. Les cinq cas passent : resultat conforme, catalogue d'une autre boutique, variante scanner d'une autre boutique, marqueur absent et redirection. Ces essais verifient l'arret et l'absence de jetons dans les journaux/resultats. Leurs latences ne sont pas des mesures de l'application.

```powershell
$env:LOCAL_K6_BINARY = (Resolve-Path '.load-lab/tools/k6/k6-v2.3.0-windows-amd64/k6.exe').Path
node scripts/test-load-runner.mjs
```

## Premier essai reel, 14 octobre

Docker Desktop 4.95.0 / moteur 29.8.2, PostgreSQL 17.11.0.004 et le vrai Auth/PostgREST locaux. Installation du schema initial et des 28 migrations reussie. Le petit jeu contient deux boutiques, huit comptes, vingt-quatre variantes, cent ventes et leurs articles/versements fictifs.

Verification reelle des huit comptes reussie : marqueur, catalogue, rapport annuel et perimetre vendeur; SELECT RLS d'un produit etranger vide, scanner etranger sans produit, vendeur etranger refuse pour l'admin et perimetre personnel force pour le caissier. Marqueur et catalogue refuses pour l'anonyme. Renouvellement des sessions puis reverification reussis. Une seconde initialisation est refusee avec code 1, sans reinitialiser la base.

Resultat prive : `results/smoke-2026-10-14T12-02-21-493Z.json`. k6 termine avec code 0, cinq cycles acheves, treize requetes HTTP, aucune erreur HTTP, de contrat ou d'isolation; tous les seuils du smoke passent. Catalogue : cinq observations, p95 205 ms; scanner : cinq observations, p95 65 ms; rapport : une seule observation a 119 ms, insuffisante pour conclure sur une distribution de latences.

Ce sont des mesures locales sur un tout petit jeu, pas une mesure des pages Next.js ni du volume cible. La RAM libre a varie d'environ 150 Mo pendant les premiers demarrages a 1,8 Go avant le smoke; aucun grand scenario n'est lance sur cette machine saturee. Les conteneurs observes consomment environ 306 Mio au total hors VM/cache WSL et generateur; ce point instantane n'est pas un pic mesure.

Verification syntaxique Node et ESLint du preparateur : reussies. Les dix-sept tests du contrat du banc repassent. La suite applicative complete n'a pas ete relancee pour ce seul ajout d'outillage.

## Reprise Et Suite

### Diagnostic Et Correction Locale

Premier pilote owners2 : `owners2-2026-10-14T13-23-44-308Z.json`, 110 cycles et 228 requetes, zero erreur de contrat/isolation/HTTP. Le seuil annuel echoue : p95 5 405 ms (six rapports), contre 75 ms catalogue et 14 ms scanner. La RAM libre minimale relevee est 1 345 Mio, sans arret memoire. Ce resultat est conserve comme echec, pas gomme par un changement de seuil.

La politique `Account members can read sale items` faisait un EXISTS correle et recalculait `current_account_id()` pour chaque ligne. La migration `20261014133001_sale_items_read_policy_performance.sql` remplace seulement cette politique SELECT par un ensemble des ventes autorisees, avec identite evaluee une fois. Les RLS de sales continuent de s'appliquer; aucune politique d'ecriture ni privilege n'est elargi. La production n'a pas recu cette migration.

Diagnostic reproductible : `node scripts/prepare-local-load.mjs diagnose`. EXPLAIN ANALYZE/BUFFERS sur le vrai RPC en role authenticated, avec les claims d'un compte fictif. Le candidat est applique dans une transaction annulee pour la comparaison. Avant correction persistante, le plan externe mesure 2 515 ms / 149 261 shared hits avec la politique courante, contre 599 ms / 4 046 shared hits avec le candidat (JIT on dans les deux cas). Le test JIT off ne montre pas un avantage constant; aucun reglage global JIT/work_mem n'est modifie. Ces plans externes ne montrent pas les noeuds internes du RPC; ne pas leur attribuer une ventilation inexistante.

Apres application locale via `node scripts/prepare-local-load.mjs optimize`, les huit comptes repassent les controles de montants (facture, encaisse, reste, quantites et benefices), d'articles propres/etrangers et de codes-barres. 31 tests cibles passent, dont le rapport annuel de 18 250 ventes, remises/taxes/couts historiques et le changement de compte entre deux SELECT. CLI `db advisors --local --type all --fail-on error` retourne `No issues found`; cela ne remplace pas l'audit de securite complet de l'application.

Second pilote identique owners2 : `owners2-2026-10-14T13-36-05-425Z.json`, code 0, 116 cycles et 240 requetes, tous les seuils passes, zero erreur. p95 catalogue 58 ms (116 mesures), scanner 13 ms (116), rapport annuel 1 954 ms (six). RAM libre minimale 2 035 Mio; pas d'arret memoire. Le faible nombre de rapports et les variations de ressources du PC limitent la precision et l'attribution de cette comparaison. Les preuves SQL A/B et les resultats financiers/RLS sont conserves en complement. Aucun certificat 100 boutiques n'en decoule.

Pilote cashiers6 : `cashiers6-2026-10-14T13-39-05-835Z.json`, code 0, 349 cycles, 722 requetes, tous les seuils passes, aucune erreur HTTP/contrat/isolation. p95 catalogue 96 ms et scanner 22 ms (349 mesures chacun), rapports personnels 507 ms (18 mesures). Chaque rapport porte sur 6 083 ou 6 084 ventes du caissier, et non sur les 18 250 ventes de la boutique : ne pas comparer directement ses temps au rapport proprietaire. RAM libre minimale 2 061 Mio, aucun arret memoire. Le releve Docker ponctuel est conserve dans `cashiers6-container-snapshot.json`; il ne donne pas les pics CPU/RSS du run.

Une nouvelle execution de `expand` sur le jeu deja etendu repasse les controles sans ajouter de doublons : toujours 2 400 variantes et 36 500 ventes, articles et versements. Pendant les paliers, le serveur local 3003 restait actif. Les premieres restrictions de RAM ont empeche un lancement premature; les pilotes ont ensuite pu demarrer une fois les controles de code termines et la RAM liberee.

Apres les essais, le proprietaire a explicitement autorise l'arret du serveur local 3003. Son worker Next, son lanceur Next dev et le wrapper dev-local ont ete identifies avant arret; aucun processus d'un autre port ni service de production n'est vise. Cet arret intervient apres les mesures et n'explique donc pas leurs gains.

Verification finale : suite complete 163 tests / 26 fichiers, TypeScript sans emission et ESLint cible reussis. Laboratoire arrete sans suppression de ses volumes. Aucun deploiement, redemarrage ou changement de donnees de production.

Les cinq recettes natives k6 contre le serveur simule repassent apres ajout des compteurs d'observations : conforme, produit etranger, scanner etranger, marqueur absent et redirection refusee. Ce sont des tests des garde-fous, pas des mesures de capacite.

Le jeu local a ete etendu de facon additive a 2 400 variantes et 36 500 ventes, articles et versements. `node scripts/prepare-local-load.mjs expand` verifie le marqueur avant toute ecriture, prend un verrou de preparation, effectue les ajouts et controles de comptes dans une transaction, reactive les triggers, puis verifie les huit comptes avant de remplacer atomiquement le fichier prive des sessions. Les anciennes preuves de smoke sont conservees. La reprise apres validation SQL et avant ecriture du fichier accepte le marqueur cible; elle ne duplique pas les lignes. Aucun `DELETE`, `TRUNCATE` ni reset n'est utilise.

L'extension exige au moins 1 Gio de RAM libre. Le smoke exige 256 Mio, les pilotes 1 Gio avant lancement et les grands scenarios 2 Gio. Le lanceur releve la RAM libre de l'hote toutes les deux secondes dans un fichier prive `.json.host.json`; trois mesures consecutives sous 128 Mio arretent le seul processus k6 et rendent le run non valide. Ce releve ne mesure ni CPU ni RSS du generateur/conteneurs et n'est pas une preuve de saturation a lui seul.

Avant la prochaine reprise, ouvrir Docker Desktop, verifier la RAM et ne demarrer que ce laboratoire. Le binaire Docker per-user de ce PC est `C:/Users/BAMBA/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe`; il n'etait pas dans le PATH de la session de travail.

Demarrage (la sortie CLI contient des cles locales et doit rester dans le dossier prive) :

```powershell
$lab = "$env:LOCALAPPDATA/SaytuYefLoadLab"
$env:PATH = "$env:LOCALAPPDATA/Programs/DockerDesktop/resources/bin;" + $env:PATH
$env:DOCKER_HOST = 'npipe:////./pipe/dockerDesktopLinuxEngine'
npx --yes supabase@2.120.0 start --workdir $lab --exclude 'realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor' *> "$lab/start-resume.log"
```

Le preparateur `initialize` refuse maintenant cette base non vide : il ne la detruit pas pour recommencer. Les sessions expirent; renouveler les seules sessions fictives avec `refresh`, qui verifie de nouveau les contrats avant de les ecrire :

```powershell
$env:LOCAL_DOCKER_BINARY = "$env:LOCALAPPDATA/Programs/DockerDesktop/resources/bin/docker.exe"
node scripts/prepare-local-load.mjs refresh
$env:LOCAL_K6_BINARY = (Resolve-Path '.load-lab/tools/k6/k6-v2.3.0-windows-amd64/k6.exe').Path
node scripts/run-local-load.mjs smoke
node scripts/run-local-load.mjs owners2
node scripts/run-local-load.mjs cashiers6
```

Les profils `shops100` et `cashiers300` refusent volontairement ce jeu a deux boutiques. L'extension additive du volume par boutique est implementee; il reste a creer progressivement les autres boutiques et leurs comptes, generer tout le volume cible avec suffisamment de RAM/disque et relever plans SQL, ressources et verrous avant les grands runs. Les parcours financiers concurrents restent egalement a tester. Aucun service de production n'est modifie ni redeploye par ce lot.

Arret du seul laboratoire, sans suppression de ses volumes :

```powershell
npx --yes supabase@2.120.0 stop --project-id saytu-yef-load-lab --workdir $lab
```
