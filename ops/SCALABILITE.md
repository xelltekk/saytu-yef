# Audit de scalabilite - 13 octobre 2026

## Mise En Ligne Du 14 Octobre

Les lots catalogue, rapports, optimisation RLS des articles et supervision prepares ci-dessous sont deployes le 14 octobre 2026 a 14:06 UTC, runtime `d4d5218281052d250a023fa234c8249b17008578`. Les paragraphes de preparation et leurs mentions "non active" decrivent l'etat avant ce deploiement. Voir [RETAIL-RELEASE.md](RETAIL-RELEASE.md) pour la sauvegarde, les versions SQL combinees, les empreintes financieres et les controles de production. Aucune charge fictive n'est envoyee en production; la cible 100 boutiques reste a valider.

## Verdict

Cible confirmee par le proprietaire : 100 boutiques avec plus de 500 produits chacune dans les douze prochains mois. Cela represente plus de 50 000 produits; les variantes peuvent augmenter le nombre de lignes au-dela du nombre de fiches produit.

Cette cible est compatible avec l'architecture Next.js + Supabase/PostgreSQL actuelle, a condition de borner les lectures et le travail dans le navigateur. Il n'est pas necessaire de repartir sur des microservices. Ce jugement architectural n'est pas une certification de capacite : aucun test de charge a 100 boutiques n'a ete realise.

Audit en lecture seule : code, metadonnees PostgreSQL, statistiques existantes et ressources du VPS. Aucun encaissement, migration SQL, redemarrage ou changement d'offre n'est effectue. Aucun test de charge n'est envoye en production.

## Situation observee

| Element | Observation |
| --- | --- |
| VPS | 4 vCPU, 11 955 Mio de RAM, environ 10 959 Mio disponibles |
| Disque du VPS | 19 Go, 29 % occupes, environ 14 Go libres |
| Charge systeme | 0,08 / 0,02 / 0,01 sur 1 / 5 / 15 minutes |
| Application | Un processus Next.js, environ 326 Mio RSS; superviseur npm environ 78 Mio |
| PostgreSQL heberge | Environ 15,8 Mo pour la base; distinct du disque et de la RAM du VPS |
| Connexions PostgreSQL | 14 observees, dont une active pour l'audit; plafond configure 60; aucun verrou en attente a cet instant |
| Comptes | 20 profils, dont 18 profils racines; cela ne prouve pas 18 boutiques commerciales actives |
| Catalogue | 46 lignes produit, 28 images inline, 1 147 612 octets de texte image inline |
| Historique | Statistiques estimant 119 ventes, 143 articles vendus et 140 versements |

Ces chiffres sont des instantanes a faible charge. Les estimations de lignes des tables proviennent de `pg_stat_user_tables`, pas d'un inventaire financier. La production continue a evoluer pendant l'audit.

Les statistiques SQL existantes donnent des moyennes d'environ 6,39 ms pour la famille produits, 1,97 ms pour les ventes et 17,82 ms pour les comptes clients. Ces familles regroupent des requetes differentes et des executions historiques depuis la derniere remise a zero des statistiques; elles ne representent pas le p95 d'un parcours ni un benchmark a 50 000 produits.

Les dix navigations desktop de production mesurees precedemment ont un candidat LCP observe entre 652 et 1 288 ms. Elles utilisent un petit jeu de donnees et ne certifient ni le chargement de tous les widgets ni la tenue en charge. Voir `BOUTIQUE-VALIDATION.md` pour les limites de la methode.

## Priorites

### 1. Catalogue et POS : chargement non borne

`getProducts()` lit toutes les lignes autorisees, avec les photos et les relations categorie/fournisseur. `readAllPages()` fait des appels de 500 lignes jusqu'a avoir tout accumule en memoire. C'est une pagination de transport, pas une limitation du catalogue affiche.

L'inventaire et le POS filtrent ensuite localement et rendent tous les groupes correspondants. A 500 produits simples, cela peut produire 500 composants, plus les images; avec les variantes, le volume brut augmente encore. La recherche scanner depend du catalogue deja charge. Le cout concerne chaque boutique, pas les 50 000 lignes globales, puisque les politiques de boutique limitent les lignes visibles.

Actions recommandees : pagination serveur pour l'inventaire, chargement progressif ou virtualisation pour la grille du POS, recherche exacte d'une variante par code-barres/SKU sans attendre le catalogue entier. Conserver le rapprochement du panier restaure et les controles de stock du RPC; une grille partielle ne doit pas supprimer les articles du panier absents de sa page courante. Les exports complets doivent utiliser un parcours distinct des listes interactives.

Sources : `src/lib/supabase/queries.ts:207`, `src/lib/pagination.ts:1`, `src/components/inventory/ProductTable.tsx:200` et `:1119`, `src/components/sales/POSInterface.tsx:128` et `:807`.

### 2. Rapports : historique entier calcule dans le navigateur

`getReportsData()` recupere toutes les ventes et leurs articles sur la periode, tous les versements correspondants et tout le catalogue utile, puis calcule les statistiques en JavaScript. La periode est filtree, mais le nombre de lignes n'est pas borne.

Exemple de dimensionnement, pas une mesure : 50 ventes par jour pendant un an donnent 18 250 ventes par boutique. La lecture a 500 lignes exige 37 appels pour les ventes, avant les versements, les articles et les autres donnees. Sur 100 boutiques, ce scenario genere environ 1,825 million de ventes par an. Le nombre de produits seul ne dimensionne donc pas les rapports.

Actions recommandees : totaux, marges et series temporelles calcules par des RPC SQL controles par boutique et vendeur; details pagines; CSV volumineux produit par lots ou en tache de fond. Conserver la distinction entre date de vente et date de versement ainsi que les couts historiques deja captures.

Le RPC des comptes clients borne sa reponse a 30 clients, mais agrege les clients et leur historique avant la pagination, pour calculer les soldes, filtres et totaux. Mesurer ce cout a plusieurs dizaines de milliers de ventes par boutique avant d'ajouter des soldes precalcules; leur maintenance doit rester transactionnelle pour ne pas reintroduire les erreurs de dettes.

Sources : `src/lib/supabase/queries.ts:1349` et `:1407`, `src/lib/supabase/retail.ts:13`, `supabase/migrations/20261011001011_retail_workflows.sql:116`.

### 3. Images : terminer la sortie des donnees inline

Les nouvelles images du formulaire disposent deja d'un upload vers Storage. Les anciennes images inline restent dans les reponses du catalogue tant que leurs fiches ne sont pas reenregistrees.

A proportion et taille identiques au catalogue actuel, 500 lignes representeraient environ 12,5 Mo de texte image inline non compresse, sans compter les autres champs. C'est une extrapolation illustrative, pas le poids reseau garanti d'une future boutique : compression HTTP, nombre d'images et nouvelles URL Storage changent ce volume.

Actions recommandees : migration controlee des anciennes images vers Storage apres sauvegarde, formats et dimensions adaptes, miniatures, chargement differe, reutilisation de l'image commune d'un groupe. Pas de conversion massive en production pendant cet audit.

Sources : `src/lib/supabase/retail.ts:29`, `src/components/inventory/AddProductModal.tsx`, `src/lib/supabase/queries.ts:212`.

### 4. Supervision : surveiller le processus qui sert vraiment les pages

Le processus gere par PM2 est `/usr/bin/npm` (PID observe 1275430), avec une limite memoire de 500 Mio et sans PID de supervision alternatif. Il lance un shell puis Next.js (PID observe 1275451). Les RSS observes sont environ 78 Mio pour npm et 326 Mio pour Next.js.

Le code PM2 installe collecte `pidusage` pour le PID gere, sauf substitution explicite `axm_options.pid`, absente ici. La limite configuree ne surveille donc pas directement la consommation du processus Next.js. La surveillance HTTP existante controle la disponibilite, mais pas la latence p95 ni la saturation avant une panne.

Actions recommandees : superviser directement le processus Next.js; mesurer sa memoire, la latence, le debit et les erreurs. Evaluer ensuite deux workers sur le meme VPS si le CPU ou les temps de reponse le justifient. Ne pas simplement augmenter `instances` avec le wrapper npm actuel. Pour plusieurs instances, utiliser le meme build et examiner la coherence des caches et du deploiement.

Un second worker sur le meme VPS ne protege pas d'une panne du VPS. La disponibilite de 100 boutiques exige aussi un objectif de reprise, des alertes actionnables et un secours documente; un second serveur pourra etre decide sur cette base, pas sur le seul nombre de comptes.

Sources : `ecosystem.config.js:6`, `ecosystem.config.js:12`, `scripts/monitor-health.sh:17`; arbre des processus et code PM2 du VPS consultes en lecture seule.

Reference : [auto-hebergement et plusieurs instances Next.js 15](https://nextjs.org/docs/15/app/guides/self-hosting).

### 5. Alertes et exports volumineux

Les notifications selectionnent les 30 produits actifs ayant les plus petites quantites, puis filtrent `quantity <= min_quantity` dans le navigateur. Avec des seuils differents, des produits reellement sous leur seuil peuvent etre absents de ces 30 candidats. Filtrer selon le seuil en SQL avant de limiter les notifications, sans changer le choix de notifications stock uniquement.

L'export d'etiquettes developpe toutes les copies en memoire, genere tous leurs PNG et construit le PDF dans le navigateur. La selection d'une partie des produits est deja disponible, mais aucun plafond global d'etiquettes n'est applique dans ce parcours. Ajouter des lots, un plafond explicite, une progression, la possibilite d'annuler et la reutilisation des images pour les copies identiques. Ne pas supposer qu'un export de 500 produits avec 20 copies chacun est equivalent a 500 etiquettes.

Sources : `src/hooks/useNotifications.ts:138`, `src/components/inventory/BarcodeLabelsModal.tsx:141`, `src/lib/barcodes.ts:197` et `:428`.

### 6. Sauvegardes et quotas : la croissance continue apres le catalogue

La sauvegarde PostgreSQL du VPS conserve 14 jours. La copie Storage Windows lit tout l'inventaire puis telecharge les objets sequentiellement dans un nouveau snapshot; elle ne constitue pas une sauvegarde incrementale. La copie Windows ne purge pas automatiquement les anciennes versions. Avec des dizaines de milliers d'images, le temps de transfert et le disque Windows peuvent devenir la limite d'exploitation.

Actions recommandees : mesurer le temps et la taille des sauvegardes; definir retention, copie hors site automatique, objectif de perte acceptable et temps de restauration. Concevoir une sauvegarde Storage incrementale/versionnee avec manifestes restaurables, pas un simple miroir qui effacerait les anciennes versions. Refaire les essais de restauration avec le volume cible.

Les 60 connexions PostgreSQL configurees ne signifient pas 60 utilisateurs maximum : les services Auth, PostgREST, Storage et les connexions administratives partagent ce budget. L'offre et le compute Supabase, leurs limites CPU/IO, Storage et egress ne sont pas determines par cet audit SQL. Les verifier avant une decision commerciale ou une hausse de capacite; la RAM du VPS ne renforce pas la base hebergee chez Supabase.

Sources : `scripts/backup-supabase.sh:7`, `scripts/backup-storage-to-windows.ps1:20`, `scripts/backup-to-windows.ps1:111`.

Reference : [gestion des connexions Supabase](https://supabase.com/docs/guides/database/connection-management).

## Points solides a conserver

- Isolation des boutiques et index de lecture par compte/date deja presents.
- Index unique de code-barres normalise par boutique, cles d'idempotence des ventes et versements.
- Transactions de vente, verrouillage du stock et validations de concurrence deja testes sur des donnees isolees.
- Verrou du proprietaire par boutique dans plusieurs RPC financiers : il serialise les ecritures d'une boutique, pas celles de toutes les boutiques. Ne pas le retirer sans une preuve equivalente de fiabilite des quotas, remboursements et stocks.
- Historique des ventes et details clients deja limites par page; notifications sans photos.
- Sauvegardes et restauration deja verifiees a petit volume, controles de sante et archivage des anciens builds en place.

L'audit performance Supabase actuel ne renvoie qu'une famille INFO d'index inutilises (21 constats). Cela n'est ni une preuve de capacite sous charge ni une raison suffisante de supprimer des index avec si peu de donnees. Les index composites supplementaires doivent etre choisis sur des plans EXPLAIN du volume cible, pas ajoutes partout.

References : [audit des index inutilises](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), [optimisation des requetes](https://supabase.com/docs/guides/database/query-optimization).

## Politique commerciale distincte

Le plan Starter est limite a 500 lignes produit; le plan Pro n'a pas de plafond produit dans la configuration actuelle. La capacite technique et ce quota commercial sont deux sujets differents. Clarifier si la promesse de 500 produits inclut les variantes avant de vendre une offre a des boutiques avec plus de 500 references. Aucun abonnement ni quota n'est modifie par l'audit.

Source : `src/lib/subscriptions.ts:404` et `:414`.

## Plan de validation avant generalisation

1. Borner le catalogue, le rendu du POS et la recherche scanner; migrer les anciennes images de maniere controlee.
2. Faire calculer les rapports en base et separer listes interactives, details et exports.
3. Corriger la supervision du processus Next.js et etablir des mesures de latence, memoire, erreurs et attente de verrous.
4. Preparer un environnement isole avec 100 boutiques fictives et 1 000 variantes chacune pour garder une marge sur les 500 produits. Ajouter un historique annuel realiste, sans copier les identifiants des clients reels.
5. Tester des montees progressives de sessions simultanees. Faute de nombre confirme de caissiers, les scenarios de 100 sessions (une par boutique) et 300 sessions (trois par boutique) sont des hypotheses a valider, pas un besoin annonce par le proprietaire. Inclure les ouvertures simultanees le matin et les encaissements de plusieurs caissiers dans la meme boutique.
6. Mesurer les parcours avec smartphone, reseau contraint, scanner, rapports longs, etiquettes et sauvegardes; comparer avant/apres sur le meme jeu de donnees.

Objectifs proposes pour cette recette, pas resultats acquis : contenu principal p95 sous 2,5 s sur les appareils cibles, confirmation de vente p95 sous 2 s dans les conditions reseau definies, aucune survente ni double encaissement, aucune lecture entre boutiques. Mesurer les erreurs techniques separement des refus metier normaux. Definir aussi l'objectif de disponibilite et de reprise avec le proprietaire.

Le passage a 100 boutiques ne doit etre annonce comme valide qu'apres ces tests. A ce stade, la priorite est de reduire le travail par ecran et de prouver la capacite, pas d'acheter un VPS plus gros ou d'introduire Kubernetes, Redis ou du partitionnement sans mesure.

## Premier lot implemente, non deploye (13 octobre 2026)

- Inventaire et POS : pages de 24 groupes complets, recherche/filtres/tri en base, photos chargees uniquement pour la page. Aucun decoupage des variantes lors de l'edition ou de la suppression.
- Totaux de stock et options de filtres calcules sur toute la boutique, pas uniquement sur la page courante.
- Scanner : recherche exacte en base, independante de la page; compatibilite avec la normalisation precedente des references; refus des SKU ambigus. Les scans successifs sont traites dans leur ordre d'arrivee.
- Panier : verification des seuls IDs du panier, conservation des articles hors page, protection du payload d'une tentative de paiement dont le resultat est inconnu.
- CSV, selection des etiquettes et reapprovisionnement : chargements complets explicites par lots de 50 groupes, sans photos. L'export est refuse si le catalogue change entre deux lots, pour eviter un fichier incomplet. Une edition depuis le reapprovisionnement recharge le groupe complet avec ses images.
- Migration additive : `supabase/migrations/20261013165734_catalogue_pagination.sql`. Fonctions SECURITY INVOKER, recherche par boutique, RLS conservee, controle de compte actif, EXECUTE uniquement authenticated. Aucun changement des donnees de vente ni des abonnements.

Validation SQL et client : 103 tests unitaires passent, dont un jeu PGlite isole de 100 boutiques x 1 000 variantes (500 groupes par boutique). Ce jeu ne contient aucun client reel. Il valide les resultats et l'isolation, pas les performances p95 de Supabase ni 100 caissiers simultanes. Compilation Next.js de production reussie dans `/var/tmp/saytu-yef-validation-20261013`, sans toucher au processus de production.

Recette navigateur reproductible : `node scripts/test-catalogue-browser.mjs`. Composants reels, donnees simulees, aucun acces a Supabase, fenetre Edge jetable; scanner HID simule et saisie de code dans le champ de recherche. Les essais du scanner et de l'imprimante physiques restent une recette en boutique apres activation.

Recette reussie a 360, 768 et 1 440 pixels : pagination, ajout d'une variante hors page, scans successifs simules, conservation du panier, recherche dont les anciennes reponses sont ignorees, export CSV des 120 variantes du jeu navigateur, selection des 120 etiquettes et edition complete depuis le reapprovisionnement. Aucun debordement horizontal constate; le total du panier mobile n'est plus tronque. Captures et CSV dans `tmp/catalogue-validation/`. TypeScript, ESLint et `git diff --check` passent.

Avant activation : appliquer cette seule nouvelle migration apres verification de l'historique SQL, puis deployer un build valide. Ne pas lancer un `db push` de toutes les migrations historiques non rapprochees. Ne pas activer le nouveau frontend sans les fonctions SQL : il affiche une erreur de migration, sans revenir silencieusement a un chargement integral.

Suite restante : agregation des rapports en base, migration controlee des anciennes photos inline vers Storage, supervision du vrai processus Next.js, historique annuel fictif et essais de charge concurrents. Les limites des exports/etiquettes volumineux et la retention des sauvegardes restent a traiter.

## Deuxieme lot implemente, non deploye : rapports

- Les rapports utilisent maintenant une fonction SQL de synthese. Le navigateur ne telecharge plus les ventes, leurs articles ou tout le catalogue pour calculer les indicateurs. La reponse contient les totaux, les periodes, les dix premiers produits, huit clients et le classement des vendeurs.
- Les montants factures et soldes des ventes de la periode restent distincts des versements effectivement recus sur cette periode, y compris pour une dette plus ancienne. Les ventes annulees/remboursees sont exclues. Les couts historiques des articles sont conserves; les anciens articles sans cout capture restent marques comme estimes.
- La fonction controle le compte actif, la boutique et le role en base. Un caissier ne peut pas contourner sa vue personnelle en transmettant un autre vendeur. Les demandes anonymes, les boutiques et vendeurs etrangers sont refuses. Fonctions SECURITY INVOKER, RLS conservee, EXECUTE uniquement authenticated.
- Le CSV des produits est charge uniquement sur demande, par lots de 50 agregats avec un curseur de revenus/identifiant. Le curseur conserve le decimal exact PostgreSQL pour ne pas repeter une ligne apres une repartition de remise. Une empreinte des resultats refuse l'export si les ventes ou versements changent entre la synthese et les lots. Cette empreinte assure la coherence, pas l'autorisation.
- Les requetes d'une ancienne periode sont annulees et leurs reponses tardives ignorees. Une modification du compte, de la boutique ou du role invalide les donnees affichees et l'export en cours.
- Migration additive de lecture seule : `supabase/migrations/20261013200735_rapports_agreges.sql`. Aucun encaissement, remboursement, abonnement ou solde n'est modifie par cette migration.

Validation : 121 tests passent, dont dix essais SQL de rapports sur PGlite. Un jeu isole de 18 250 ventes fictives avec articles et versements valide une annee de resultats, douze periodes et une reponse JSON inferieure a 15 000 caracteres. Les cas couvrent les remises, taxes, paiements tardifs, anciennes dettes, couts historiques, periodes vides, fuseau horaire, roles, boutiques et curseurs decimaux. Il ne s'agit pas d'une mesure de latence Supabase ni d'un essai de 100 utilisateurs simultanes.

Recette reproductible : `node scripts/test-reports-browser.mjs`. Page reelle dans une fenetre Edge jetable, comptes et donnees simules, aucun acces Supabase et aucune ecriture financiere. Verification a 360, 768 et 1 440 pixels : periodes, reponses tardives, vendeur, dates personnalisees, vue caisse, graphiques et CSV des 123 produits du jeu navigateur au lieu des dix premiers. Captures et fichiers dans `tmp/reports-validation/`.

TypeScript, ESLint et compilation Next.js de production passent. La compilation est executee dans `/var/tmp/saytu-yef-validation-20261013`, jamais dans le dossier de production. Les deux nouvelles migrations catalogue et rapports ne sont pas appliquees. Aucun processus de production n'est redemarre.

Avant activation, rapprocher l'historique SQL puis appliquer uniquement les migrations catalogue/rapports encore absentes; deployer ensuite le frontend valide. Ne pas utiliser un `db push` global sur l'historique non rapproche. Le frontend signale une migration absente sans revenir au telechargement integral de l'historique.

Limites restantes : l'agregation lit encore l'historique utile en base et chaque lot CSV recalcule la synthese pour verifier sa coherence. Mesurer les plans SQL et la latence sur un environnement Supabase isole au volume cible avant d'ajouter des precalculs ou exports en arriere-plan. La migration des photos inline, la supervision directe de Next.js, les essais concurrents, les gros PDF d'etiquettes et la retention des sauvegardes restent a traiter.

## Troisieme lot prepare, non active : supervision

PM2 est configure pour lancer directement Next.js, avec une seule instance liee a l'interface locale. Le nouveau moniteur compare les acces local/public, mesure le vrai PID et le RSS, conserve un historique borne et distingue les dependances des pannes applicatives. Les redemarrages du moniteur exigent trois echecs consecutifs des deux acces et un delai de quinze minutes; les arrets volontaires, donnees PM2 inconnues/ambigues et deploiements sont proteges.

Les journaux du moniteur ont une rotation bornee. Les alertes de lenteur utilisent uniquement le p95 des probes de sante, pas celui des pages ou des paiements. La limite PM2 existante de 500 Mio porte maintenant sur Next dans la configuration preparee; sa valeur reste a confirmer en charge. Aucun worker ni serveur supplementaire n'est active.

Recette PM2 isolee reussie sur le VPS : daemon prive, port 3379, PID et RSS compares a `/proc`, probes sans ecriture, puis arret du processus jetable. La production n'est ni redemarree ni reconfiguree. Installation, ordre d'activation, limites et verification sont detailles dans [SUPERVISION.md](SUPERVISION.md).

Suite : environnement de charge concurrent isole et vrais parcours, migration des anciennes photos, limites des etiquettes volumineuses et retention des sauvegardes. La cible de 100 boutiques reste a prouver sous charge.

## Banc local et premier smoke reel, 14 octobre

Le proprietaire a choisi Supabase local sur son PC avec Docker. Le moteur Linux/WSL 2 fonctionne maintenant. Un projet local separe est initialise hors du webroot XAMPP, sans lien cloud, sans copie de donnees de production et sans changement de `.env.local`.

Un lanceur k6 prepare les scenarios smoke, 100 proprietaires et l'hypothese de 300 caissiers. Il refuse les adresses distantes, sessions/cles privilegiees, marqueurs absents et jeux trop petits. Les latences sont separees par operation et palier. Le jeu cible exige 100 boutiques avec 1 200 variantes et 18 250 ventes annuelles chacune; il n'est pas encore genere.

17 tests de garde et cinq recettes du moteur k6 sur un serveur HTTP simule passent. Le schema historique et 28 migrations sont maintenant installes dans la vraie base Docker. Deux boutiques fictives, huit comptes, vingt-quatre variantes et cent ventes historiques permettent les premieres verifications Auth/RLS/RPC reelles : les huit comptes passent, y compris l'isolation des produits, codes-barres et rapports entre boutiques/vendeurs.

Le smoke reel k6 passe : cinq cycles, treize requetes HTTP, aucune erreur HTTP/contrat/isolation; p95 catalogue 205 ms et scanner 65 ms sur cinq mesures chacun, un rapport annuel a 119 ms. Ce petit jeu ne prouve pas la capacite cible et ne mesure pas le frontend Next.js. La RAM du PC a ete presque epuisee au demarrage; aucun grand jeu ni scenario 100/300 comptes n'est lance. Extension progressive des fixtures, plans SQL, ressources/verrous et parcours financiers concurrents restent a faire. Voir [LOAD-TESTS.md](LOAD-TESTS.md).

## Paliers Annuels Et Correction RLS Locale

Le jeu est maintenant etendu sans suppression a deux boutiques de 600 groupes / 1 200 variantes et 18 250 ventes annuelles chacune. Les huit comptes Auth fictifs, les RLS et les RPC applicatifs restent reels. Les anciens resultats sont conserves, les comptes/montants reverifies, et une repetition de l'extension ne duplique pas les donnees.

Le premier palier de deux proprietaires echoue uniquement sur la lenteur du rapport annuel : p95 5,4 s. Le diagnostic SQL montre le cout du controle de compte repete pour chaque article. Une nouvelle migration preparee, `20261014133001_sale_items_read_policy_performance.sql`, conserve l'autorisation via les ventes et leur RLS, mais utilise un ensemble non correle avec identite evaluee une fois. Aucune ecriture ni droit supplementaire n'est autorise. EXPLAIN ANALYZE sous le role authenticated passe de 149 261 a 4 046 shared hits; le temps de cet essai SQL passe de 2 515 a 599 ms sans changer JIT/work_mem globalement.

Apres application dans Docker uniquement, le meme palier de deux proprietaires passe : 116 cycles / 240 requetes, p95 catalogue 58 ms, scanner 13 ms, rapport annuel 1,95 s. Le palier de six caissiers passe egalement : 349 cycles / 722 requetes, p95 catalogue 96 ms, scanner 22 ms, rapports personnels 507 ms. Zero erreur HTTP, de contrat ou d'isolation; seuils initiaux inchanges. Les rapports caissiers couvrent moins de ventes et ne sont pas une comparaison directe avec ceux du proprietaire. Les petits echantillons (six / dix-huit rapports) et les ressources variables du PC limitent la precision de ces mesures.

Les donnees et sessions restent hors du webroot. La RAM de l'hote est relevee pendant les runs, avec garde-fous de lancement/arret; elle n'est pas une mesure CPU/RSS exhaustive. Le CLI advisors local ne rapporte pas d'issue. Les tests de rapports conservent la validation de taxes, remises, couts historiques, dettes/versements et isolation de comptes. La production et le serveur de developpement local n'ont pas ete modifies/redemarres par ce lot.

Verification finale : 163 tests sur 26 fichiers, TypeScript et ESLint cible passent. Le laboratoire est arrete, donnees/preuves conservees.

Apres les benchmarks, arret du seul serveur local de developpement sur 3003 sur autorisation explicite du proprietaire. Aucun effet sur les mesures precedentes ni sur la production.

Avant un futur deploiement, rapprocher aussi cette nouvelle migration de l'etat reel de production, apres les migrations catalogue/rapports precedentes encore absentes. Ne pas lancer un `db push` global sur l'ancien historique non rapproche. La cible 100 boutiques, 1,825 million de ventes, les ecritures financieres concurrentes, les photos et les vrais parcours Next.js restent a valider.
