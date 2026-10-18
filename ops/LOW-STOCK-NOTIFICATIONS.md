# Notifications Vers La Fiche Produit

Le lien de chaque alerte de stock faible ou rupture contient l'identifiant exact de la variante : `/inventory?product=UUID`. La fiche se charge independamment des filtres et de la page du catalogue. Elle affiche photo, variante, stock, seuil minimum, prix, reference et code-barres.

Le compte caisse consulte la fiche sans pouvoir modifier ou ajuster le stock. Les autres roles reutilisent les actions existantes de modification et d'ajustement. L'ouverture ne produit aucune ecriture. La recherche est bornee a la boutique courante puis au groupe concerne, avec controles de session et annulation des anciennes requetes. Un produit absent ou inaccessible ne fait jamais ouvrir une autre variante.

## Verification

- TypeScript et ESLint valides.
- 197 tests valides sur les executions locales. Le test SQL existant des photos a depasse son delai pendant la suite complete (196 autres tests passes), puis passe seul en 8,33 secondes.
- `node scripts/test-notification-browser.mjs` : parcours simule a 360/768/1440 px, vrai Header et page Inventaire, variantes de meme nom, rupture, modification/ajustement, compte caisse, liens directs, conservation des autres parametres, erreurs, annulation et boutons visibles sur smartphone. Aucun acces aux donnees de production.

## Preparation Du 18 Octobre 2026

Code pousse : `b0d164600e0c8cadd0562ea3046f193f648834b3`. Build Linux Next 15.5.27 reussi, avec lint et types valides. L'avertissement Supabase/Edge sur `process.version` etait deja present. Aucune migration SQL ni nouvelle dependance.

Candidat persistant : `/var/www/saytu-yef/.release-b0d164600e0c8cadd0562ea3046f193f648834b3`. **La bascule n'est pas encore effectuee : confirmation de pause des encaissements attendue.** Le runtime Rapports PDF reste actif; le checkout VPS est encore `844d6791b52c342fda9b8ffd14ad47467cc8f8c7`.

Sauvegarde privee Windows verifiee : `saytu-yef-20261018T204757Z.dump`, inventaire des roles associe et 8 fichiers Storage dans `storage-20261018T2049436130113Z`, sous `Documents/Saytu-Yef-Backups`.

Rotation terminee par le helper : `saytu-yef-release-69d962d4d19124c9cad5b164774a0dc3c360f6b2-20261014T200005Z` copie sur Windows puis retire du VPS apres controle SHA256 et lecture des 46 067 entrees. Archive de 290 464 983 octets, SHA256 `0172602da3c6a68d947dc5fd4b548f0d676549ad789e1bee50070923d670d81d`. Les deux secours recents sont conserves. Supervision reactivee apres archivage et preparation.

Avant activation : reconfirmer la pause, verifier le marqueur READY du candidat et l'etat du VPS. Utiliser le helper `deploy-staged-vps.sh activate` avec le commit complet ci-dessus, moniteur temporairement suspendu puis reactive. Apres activation : controler sante PostgreSQL/Auth, PM2, journal, connexion, service worker et assets actifs de l'inventaire. Ne pas annoncer la mise en ligne sur la seule reussite de la preparation.
