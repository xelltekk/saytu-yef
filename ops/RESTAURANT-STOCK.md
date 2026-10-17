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
