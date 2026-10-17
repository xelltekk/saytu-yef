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
