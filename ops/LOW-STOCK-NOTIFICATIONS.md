# Notifications Vers La Fiche Produit

Le lien de chaque alerte de stock faible ou rupture contient l'identifiant exact de la variante : `/inventory?product=UUID`. La fiche se charge independamment des filtres et de la page du catalogue. Elle affiche photo, variante, stock, seuil minimum, prix, reference et code-barres.

Le compte caisse consulte la fiche sans pouvoir modifier ou ajuster le stock. Les autres roles reutilisent les actions existantes de modification et d'ajustement. L'ouverture ne produit aucune ecriture. La recherche est bornee a la boutique courante puis au groupe concerne, avec controles de session et annulation des anciennes requetes. Un produit absent ou inaccessible ne fait jamais ouvrir une autre variante.

## Verification

- TypeScript et ESLint valides.
- 197 tests valides sur les executions locales. Le test SQL existant des photos a depasse son delai pendant la suite complete (196 autres tests passes), puis passe seul en 8,33 secondes.
- `node scripts/test-notification-browser.mjs` : parcours simule a 360/768/1440 px, vrai Header et page Inventaire, variantes de meme nom, rupture, modification/ajustement, compte caisse, liens directs, conservation des autres parametres, erreurs, annulation et boutons visibles sur smartphone. Aucun acces aux donnees de production.

## Preparation Du 18 Octobre 2026

Code pousse : `b0d164600e0c8cadd0562ea3046f193f648834b3`. Build Linux Next 15.5.27 reussi, avec lint et types valides. L'avertissement Supabase/Edge sur `process.version` etait deja present. Aucune migration SQL ni nouvelle dependance.

Candidat persistant prepare : `/var/www/saytu-yef/.release-b0d164600e0c8cadd0562ea3046f193f648834b3`. La compilation et les marqueurs READY/COMMIT ont ete verifies avant activation. Le runtime Rapports PDF est reste actif pendant la preparation.

Sauvegarde privee Windows verifiee : `saytu-yef-20261018T204757Z.dump`, inventaire des roles associe et 8 fichiers Storage dans `storage-20261018T2049436130113Z`, sous `Documents/Saytu-Yef-Backups`.

Rotation terminee par le helper : `saytu-yef-release-69d962d4d19124c9cad5b164774a0dc3c360f6b2-20261014T200005Z` copie sur Windows puis retire du VPS apres controle SHA256 et lecture des 46 067 entrees. Archive de 290 464 983 octets, SHA256 `0172602da3c6a68d947dc5fd4b548f0d676549ad789e1bee50070923d670d81d`. Les deux secours recents sont conserves. Supervision reactivee apres archivage et preparation.

## Mise En Ligne Du 18 Octobre 2026

Pause des encaissements confirmee avant la bascule. Code `b0d164600e0c8cadd0562ea3046f193f648834b3`, active a 22:32 UTC par le helper de deploiement. Aucun changement SQL, de dependance ou de configuration. Le runtime precedent est conserve dans `/var/www/saytu-yef-release-844d6791b52c342fda9b8ffd14ad47467cc8f8c7-20261018T223229Z`.

Sauvegarde PostgreSQL supplementaire prise pendant la pause : `saytu-yef-20261018T223132Z.dump`, copie Windows et inventaire des roles verifies. Les empreintes completes avant/apres sont identiques pour 124 ventes, 148 articles vendus, 146 paiements, 53 produits et 48 mouvements de stock. Aucune transaction de test n'a ete creee en production.

Controles apres activation : `/api/health` indique PostgreSQL et Auth `ok`; connexion, service worker et asset actif de l'inventaire `page-4effd5f6e10e31dd.js` repondent HTTP 200. Les chaines de la nouvelle fiche et du lien de notification ont aussi ete controlees dans les assets du candidat. Le service worker est servi sans cache. PM2 est online, PID `1445456`, sans redemarrage automatique; le journal d'erreur est reste a 20 123 octets apres activation (sa derniere modification precede la bascule). Supervision et sauvegarde programmees actives. Disque a 40 %, environ 12 Go libres.

La recette authentifiee de la fiche en production reste a faire avec l'utilisateur; les essais de parcours automatises utilisent des donnees simulees. Rafraichir l'application avant de cliquer sur une notification de stock faible.
