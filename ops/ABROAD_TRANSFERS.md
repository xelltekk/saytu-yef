# Transferts partiels des saisies etrangeres

## Comportement

- La quantite saisie reste le total achete. Le compteur transfere et le reliquat sont distincts.
- Le premier transfert cree une fiche stock avec la photo, la categorie et les prix FCFA.
- Les transferts suivants alimentent cette meme fiche, sans changer ses prix ni les quantites deja vendues.
- Une saisie partiellement ou totalement transferee ne peut plus etre supprimee par le navigateur.
- La modification du total achete ne peut pas descendre sous le nombre deja transfere.
- Les filtres permettent de retrouver les saisies terminees. L'historique affiche les 50 derniers envois.
- Les anciennes activations sont considerees comme integralement transferees, sans inventer de destination ou de recu.
- Une destination supprimee ou passee en mode sans stock bloque les envois suivants avec un message explicite.

## Integrite et acces

`public.transfer_abroad_product` appelle un helper prive `app_private`, reserve aux gestionnaires de stock actifs.
La transaction verrouille le compte, la saisie puis la destination : creation/reapprovisionnement, mouvement,
recu et compteur sont valides ensemble ou annules ensemble. Une cle de requete identique renvoie le meme recu.
Le compteur attendu refuse aussi une demande obsolete issue d'un autre onglet ou d'une reouverture apres coupure.
Le journal est en lecture seule, filtre par boutique via RLS. Les prix et plafonds sont verifies sur le serveur.

## Mise en ligne

Cette modification n'applique aucune migration a la production automatiquement.
Appliquer `supabase/migrations/20261027100635_abroad_partial_transfers.sql` pendant la pause des encaissements et des transferts de stock,
puis activer le nouveau build. L'ancienne version ne doit pas transferer pendant cette transition : son ecriture
directe du drapeau `activated` est intentionnellement refusee par le nouveau garde-fou.
Les anciens clients PWA doivent recuperer la nouvelle version avant de transferer. Ne pas laisser un ancien
ecran de transfert ouvert : son insertion directe d'un produit precede la mise a jour du drapeau desormais protegee.

## Verification locale

```powershell
npm run test -- --maxWorkers=1
npm run typecheck
node scripts/test-abroad-transfer-browser.mjs
node scripts/test-abroad-browser.mjs
```

Les tests PostgreSQL utilisent une base PGlite ephemere. Les essais Edge isolent les donnees et bloquent tout
appel HTTPS externe : aucun stock reel n'est modifie. Ils couvrent les ecrans 360, 768 et 1440 px, le pied
de dialogue a 480 px de hauteur, les quantites invalides, un transfert en deux fois et une reponse reseau perdue.
Les tests de requetes obsoletes ne remplacent pas un essai de charge multi-connexions.
