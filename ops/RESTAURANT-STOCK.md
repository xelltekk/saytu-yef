# Produits sans suivi de stock

## Fonctionnement

Chaque variante peut desactiver le suivi du stock et utiliser sa disponibilite manuelle. Les produits existants restent suivis par defaut. Les plats sans suivi peuvent etre vendus avec une quantite disponible nulle; les quantites vendues et les couts unitaires restent enregistres normalement.

- La fiche produit propose `Sans suivi de stock` et `Disponible a la vente`. Les quantites initiales et seuils ne sont pas demandes sans suivi.
- Dans l'inventaire, ouvrir les variantes pour changer rapidement la disponibilite d'un plat. Seuls les gestionnaires de stock peuvent le faire; les caissiers ne changent pas ces reglages.
- Le panier ne plafonne pas les plats sans suivi. Les articles classiques gardent leurs limites et leurs controles transactionnels.
- Les notifications de stock, suggestions fournisseur, valeurs et quantites de stock excluent les produits sans suivi. Leurs ventes restent incluses dans les rapports et les factures.
- Une vente memorise cote serveur si elle a effectivement decompte le stock. Un remboursement ne restitue que les quantites decomptees a l'origine, meme si le reglage du produit change ensuite.
- Desactiver le suivi conserve le stock physique existant mais le retire des totaux affiches. Reactiver le suivi reprend ce solde; utiliser ensuite l'ajustement d'inventaire si un nouveau comptage est necessaire.
- La disponibilite ne se reinitialise pas automatiquement chaque jour. Aucune gestion de recettes, ingredients, tables ou cuisine n'est ajoutee.

## Installation Coordonnee

Migration : `supabase/migrations/20261017163255_restaurant_stock_optional.sql`, apres les migrations de fiabilite, commandes fournisseur et pagination du catalogue. Ne pas rejouer tout l'historique en production. Le fichier `schema.sql` decrit aussi les nouvelles colonnes; les fonctions et protections sont installees par la migration.

Construire et verifier le frontend avant de publier, sauvegarder, puis appliquer cette migration pendant une pause des encaissements et activer le nouveau build. Rafraichir les navigateurs/PWA. Les anciennes lignes de vente recoivent `stock_tracked=true`, sans reconstruire leur historique depuis le mode actuel des produits. Les RPC existants gardent leurs autorisations; les fonctions de trigger restent interdites a l'appel direct.

Tests locaux : PostgreSQL embarque pour ventes, dettes, reprises, remboursements et permissions; catalogue de 100 boutiques fictives; tests navigateur isoles pour plats, boissons, disponibilite, creation et paiement simule. Aucun essai de vente en production.

## Mise En Ligne Du 17 Octobre 2026

Encaissements mis en pause avec confirmation explicite. Code `3fcc5eb769034ae6534064ca581f4e346659d14e`, active a 17:13 UTC apres installation du lockfile et build Linux reussi (Next 15.5.27, lint et types inclus). Le build conserve l'avertissement Supabase/Edge sur `process.version`; aucun changement de dependances n'est inclus dans cette version.

Migration hebergee `20261017171337_restaurant_stock_optional`, issue du fichier `20261017163255_restaurant_stock_optional.sql`. Seule cette migration manquante a ete appliquee, pas tout l'historique du depot. Les 51 produits historiques restent suivis et disponibles par defaut; les 144 lignes de vente gardent `stock_tracked=true`.

Sauvegarde PostgreSQL `saytu-yef-20261017T170605Z.dump` et inventaire des roles copies et verifies sur Windows. Les 7 fichiers Storage sont verifies dans `Documents/Saytu-Yef-Backups/storage-20261017T1707245926686Z`. Le secours immediat est `/var/www/saytu-yef-release-19f70a66fc8b37011ed78404b7281d29a9c50c85-20261017T171350Z`.

Les empreintes des donnees historiques avant/apres sont identiques : 120 ventes, 144 articles vendus, 142 paiements, 51 produits et 45 mouvements de stock. Les nouvelles colonnes sont exclues de cette comparaison; leurs valeurs par defaut sont controlees separement. Aucun produit de restaurant ni transaction de test n'a ete cree en production.

Validation : 180 tests automatises, TypeScript et ESLint; parcours navigateur isoles a 360, 768 et 1440 px; build de production reussi. En production, lecture des RPC catalogue sous le role `authenticated`, filtre sans suivi et recherche de reference absente verifies sans ecriture. RLS actif, RPC catalogue/remboursement interdits a `anon`, fonctions de trigger privees. Les avis de securite Supabase restent a 3 informations internes, 34 avertissements sur les RPC authentifies existants et 1 avertissement de protection des mots de passe compromis desactivee; aucune nouvelle alerte.

`/api/health` repond `ok` avec PostgreSQL et Auth `ok`; connexion, service worker, manifest et chunks actifs inventaire/vente repondent HTTP 200. Le service worker est servi sans cache. PM2 est stable, sans redemarrage automatique ni nouvelle ecriture au journal d'erreur pendant les controles. Timers de supervision et sauvegarde actifs, controle manuel de supervision reussi; disque a 40 %, environ 12 Go libres. Rafraichir les navigateurs/PWA avant de configurer les plats sans suivi. La connexion utilisateur et les impressions physiques n'ont pas ete rejouees en production pendant ce deploiement.
