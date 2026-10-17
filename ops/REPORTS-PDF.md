# Export Des Rapports En PDF

La page Rapports conserve le CSV et ajoute un telechargement PDF A4 direct. Le module PDF est charge uniquement lors de l'export. Aucune nouvelle dependance ni migration SQL n'est necessaire.

Le document reprend les dates effectives et le fuseau du snapshot charge, ainsi que son vendeur applique par le serveur. Un caissier conserve le perimetre de son rapport personnel. Les donnees restent lues par les RPC et autorisations existants; aucun acces privilegie n'est ajoute.

Contenu : identite et logo de la societe, six indicateurs, etats de paiement, graphique revenus/benefice, periodes completes, modes de paiement, performance des vendeurs, principaux clients de la synthese et liste complete des produits vendus. Le graphique affiche les 12 dernieres periodes si la serie est plus longue; le tableau ne tronque pas la serie. Le classement clients n'est pas l'export exhaustif des comptes clients.

Les versements rattaches aux ventes selectionnees sont distingues des encaissements effectivement recus pendant la periode. Les soldes sont ceux au moment de l'export. Les couts historiques estimes sont signales; le benefice brut n'est pas un resultat net apres charges.

Les pages produits sont chargees via `getReportProductsForExport`, avec verification de version, boutique et vendeur. Un changement des ventes/versements impose une actualisation; un changement de filtre ou de role annule l'export en cours. Aucune vente ni ecriture n'est faite pour produire un PDF.

Le logo utilise la validation existante, une requete sans credentials et un delai borne. S'il est indisponible, le PDF est quand meme genere et un message le signale. Les noms de produits sont renvoyes a la ligne et peuvent continuer sur plusieurs pages; les en-tetes et pieds de page sont repetes. Les polices PDF standard couvrent les accents francais; les caracteres non pris en charge sont remplaces par `?` sans faire echouer l'export.

## Verification Locale

- `npm run typecheck`
- `npx vitest run --config vitest.config.mts --maxWorkers 2`
- `node scripts/test-reports-browser.mjs` : backend simule, toutes les requetes externes bloquees sauf le logo fictif intercepte; 123 produits, CSV/PDF, dates, vendeur, caissier, annulation, erreur de version, logo indisponible et affichages 360/768/1440 px.
- `node scripts/preview-report-pdf.mjs` : exemple `output/pdf/rapport-demonstration.pdf` et fixtures de stress/rapport vide dans `tmp/pdfs/report-preview`, exclusivement des donnees fictives.

Avant livraison, rendre les PDF avec Poppler et verifier visuellement les pages. Le script de preview n'utilise pas la base de production. Les PDF de demonstration ne doivent pas etre presentes comme des documents de la boutique reelle.

## Mise En Ligne Du 17 Octobre 2026

Pause des encaissements confirmee avant la bascule. Code `0c894659e95958dd674995b8a910d5e57efb0af2`, active a 23:31 UTC. Aucune migration SQL, modification des RPC ou nouvelle dependance. Le build Linux Next 15.5.27 termine avec lint et types valides; il conserve l'avertissement Supabase/Edge deja present sur `process.version`. La page Rapports passe de 22,3 a 22,8 ko, avec un First Load JS toujours arrondi a 339 ko; le PDF reste un chargement a la demande.

185 tests automatises passent, dont un cas supplementaire de vendeur exceptionnellement long : les en-tetes repetes sont limites a deux lignes avec indication de continuation. Les donnees des tableaux ne sont pas tronquees. Recette navigateur simulee a 360/768/1440 px : PDF et CSV complets de 123 produits, vendeur/caissier, annulation, erreur de version et logo indisponible. PDF fictifs controles par extraction de texte, geometrie et rendu Poppler; aucune transaction de test ni export authentifie de donnees reelles n'a ete cree en production.

Les empreintes completes avant/apres sont identiques : 123 ventes, 147 articles vendus, 145 paiements, 53 produits et 47 mouvements de stock. Le secours immediat est `/var/www/saytu-yef-release-4aa7e663c34fb0b03ef8f3488fe5ccd91edafd14-20261017T233108Z` (runtime restaurant conserve).

Sauvegarde avant preparation : `saytu-yef-20261017T175836Z.dump`, roles verifies et 8 fichiers Storage dans `storage-20261017T1800157712170Z`. Copie supplementaire apres deploiement : `saytu-yef-20261017T233227Z.dump`, roles verifies et 8 fichiers dans `storage-20261017T2333356170101Z`. Les deux ensembles sont dans le dossier Windows prive `Documents/Saytu-Yef-Backups`.

En production : `/api/health` indique PostgreSQL et Auth `ok`; connexion, service worker, chunk actif Rapports (`page-5fa194ddbacabb5c.js`) et module PDF (`320.76dcf34de60c0ad1.js`) repondent HTTP 200. Le service worker est servi sans cache. PM2 reste stable, sans redemarrage automatique ni nouvelle entree dans le journal d'erreur depuis l'activation. Timers de supervision/sauvegarde actifs et controle manuel de supervision reussi. Disque a 40 %, environ 12 Go libres. Rafraichir les navigateurs/PWA avant d'utiliser `Exporter PDF` dans Rapports.
