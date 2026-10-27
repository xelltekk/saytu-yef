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

## Livraison Du 27 Octobre 2026

Version runtime : `8fb13284baf56e65447c8ae2e52a2bd2fee25c43`, build `81kSfoEb1JmS1lkaEujDM`.
Pause des encaissements et transferts confirmee, anciens ecrans fermes avant la migration et la bascule.
Le candidat a ete compile sur le VPS avant la pause. Compilation, lint et TypeScript reussis,
avec l'avertissement Supabase/Edge `process.version` deja present dans la version precedente.

Migration `abroad_partial_transfers` appliquee avec succes, version distante `20261027131110`
(source locale `20261027100635_abroad_partial_transfers.sql`). Les 16 saisies sont conservees,
dont 13 activations historiques reprises comme transferts complets. Aucun recu artificiel n'a ete cree.
Controle des soldes : aucune incoherence. RLS du journal active, aucune insertion directe accordee
au navigateur, RPC publique invoker, appel anonyme refuse en HTTP 401. Les avis de securite Supabase
restent identiques au controle initial; aucun nouvel avis sur ce module. Les avis preexistants
sur les RPC privilegiees et la protection des mots de passe divulgues restent a traiter separement.

Sauvegarde recente prise pendant la pause puis copiee sur Windows avec empreintes verifiees :
`saytu-yef-20261027T130902Z.dump`, inventaire des roles sans mots de passe et
`storage-20261027T1310402150937Z` (13 fichiers). Une premiere copie preparatoire avait egalement ete verifiee.
Ancien secours archive sur Windows et retire apres verification :
`saytu-yef-release-46034950772380d20b851e6d0050af0b843bc1c5-20261025T123836Z`,
291 324 151 octets, 46 251 entrees, SHA256
`2cd09bfb669878acc29fe9059a7b3721ee52d91c59a41b87b38513fc98834da8`.
Les deux secours les plus recents ont ete proteges pendant cette rotation.

Empreintes et volumes des profils, produits, ventes, lignes, paiements, mouvements de stock,
depenses, sessions de caisse et anciennes colonnes des saisies etrangeres strictement identiques
avant/apres migration et activation. Aucun transfert ni vente de test cree en production.
Suite locale de 327 tests reussie; tests Edge de transferts et de photos/hors ligne valides sur
360, 768 et 1440 px. Les 15 ressources du manifeste Saisie etrangere ont repondu en HTTP 200,
avec les nouveaux controles et la RPC dans les fichiers servis. Visiteur non connecte redirige
en HTTP 307 vers la connexion; le test a produit uniquement la trace attendue de session absente.

Sante production : base et Auth OK, connexion et service worker HTTP 200, worker sans cache HTTP.
PM2 : PID 212642, online, zero redemarrage au controle. Timers de sauvegarde et surveillance actifs;
disque a 40 %, environ 12 Go disponibles. Secours immediat conserve :
`/var/www/saytu-yef-release-acf2be960edad916920f1b8b5347cb3762e51660-20261027T131129Z`.
La base conserve la migration : un retour au runtime precedent ne doit pas remettre les anciens
transferts en service sans adapter leur ecriture directe du drapeau `activated`.

Avant la reprise, actualiser l'application sur tous les appareils pour utiliser le nouvel ecran.
