# Equipe Et Roles

## Changements

Liste compacte responsive, recherche sur nom/email sans distinction de casse ou d'accents, filtre de role, actualisation, modification explicite du nom complet et du role, confirmation de retrait et retour de succes/erreur. Les actions sont bloquees pendant le chargement ou une ecriture. Les formulaires et leur pied restent accessibles sur petit ecran. Une limite d'abonnement empeche l'ajout, pas la modification des membres existants.

L'email de connexion est en lecture seule : le modifier uniquement dans profiles desynchroniserait Supabase Auth. Le proprietaire et le compte de l'administrateur connecte ne sont pas modifiables depuis cette liste. Les autres membres restent modifiables par les administrateurs de leur boutique, y compris les administrateurs delegues. Le retrait conserve le compte utilisateur et suit le RPC existant; ce n'est pas une suppression Auth.

## Migration Et Securite

Source creee via le CLI Supabase : `supabase/migrations/20261025120024_team_member_edit.sql`. Appliquee seule en production sous la version `20261025123242_team_member_edit`. Ne pas faire de db push global sur l'historique ancien non rapproche.

Le RPC public `update_team_member` est SECURITY INVOKER. Il appelle une fonction SECURITY DEFINER limitee dans le schema non expose `app_private`, avec search_path vide, droits explicites authenticated et aucun acces PUBLIC/anon. Ne pas ajouter app_private aux schemas exposes de la Data API.

La fonction verifie l'identite Auth, le role admin depuis profiles, l'acces actif, le rattachement a la meme boutique et la protection du proprietaire/de soi-meme. Elle verrouille les profils concernes et refuse une revision `updated_at` obsolete ou absente. Seuls full_name, role et l'horodatage serveur sont ecrits; la reponse ne contient que les champs de la liste. Aucun droit UPDATE supplementaire n'est accorde sur profiles et aucune politique RLS existante n'est elargie. Un changement de compte/role remonte une nouvelle liste sans conserver le formulaire precedent.

## Verification

- Suite complete : 264 tests passes, dont 26 nouveaux tests de validation, autorisations, isolation, revision et RPC client. PostgreSQL local ephemere PGlite, pas de modification de compte reel.
- TypeScript et ESLint verifies sur les fichiers modifies.
- `node scripts/test-team-browser.mjs` : 360/768/1440 px, liste, recherche et filtre, nom/role, annulation, retrait confirme, ajout, erreurs, limite d'abonnement et changement de role pendant un formulaire. Controle du pied de formulaire aussi a 360 x 480 px. Aucune requete vers la production pendant ces tests.
- Captures de recette dans `tmp/team-validation`, controlees visuellement. Le serveur local est accessible sur `http://127.0.0.1:3003/team`, avec authentification requise.

## Livraison Du 25 Octobre 2026

Encaissements mis en pause avec confirmation utilisateur. Runtime actif : `e887fd04ad839b8d6b9e1fcb2ecf837758e8fd0f`, build `OGvlKlMXLWGlhFGiDfRgW`. Compilation, lint et controle TypeScript sur le VPS reussis. Avertissement Supabase/Edge `process.version` preexistant, sans echec de compilation. Aucun nouveau signalement concernant ce RPC dans les conseillers de securite; les avertissements historiques des autres fonctions restent hors de ce lot.

Verification reelle des droits : wrapper public invoker, fonction privee definer avec search_path vide, aucun EXECUTE anonyme, aucun droit de creation authenticated dans app_private, aucun droit de modification directe du role dans profiles. L'API refuse le schema app_private (HTTP 406 / PGRST106) et refuse un appel RPC anonyme (HTTP 401 / 42501). Aucun compte reel n'a ete modifie pendant les tests de livraison.

Sauvegardes completes copiees sur Windows avec SHA256 valide et inventaires de roles sans mots de passe : `saytu-yef-20261025T122918Z.dump` avant migration, puis `saytu-yef-20261025T123814Z.dump` apres migration. Cette seconde archive contient le schema et la fonction app_private. Les manifestes Storage `storage-20261025T1231562742136Z` et `storage-20261025T1238515600660Z` contiennent les memes 13 fichiers, memes metadonnees et SHA256.

Les volumes et empreintes completes des lignes sont identiques avant migration et apres bascule :

| Table | Lignes | MD5 de comparaison |
| --- | ---: | --- |
| profiles | 20 | bfb56313d1b5265567b8b17fe2789461 |
| sales | 127 | c411e521336f500b7aaf4b0d41847972 |
| products | 58 | 4fdf908493e81e2a3db578861bc4c4de |
| sale_items | 151 | 11463dbe56b803e22fd0de6da3cc7e76 |
| sale_payments | 149 | e067460cb6db4f445a78f4758a16d4d0 |
| stock_movements | 50 | 21a0ef872d1943efd92eb7a11ebef84a |
| expenses | 0 | d41d8cd98f00b204e9800998ecf8427e |

Sante production base et Auth OK. Connexion, cinq ressources de connexion et les 13 ressources du manifeste de la page Equipe HTTP 200. Visiteur non connecte sur /team redirige vers /login. Service worker HTTP 200, Cache-Control `no-store, must-revalidate, no-cache`. PM2 stable (PID 156347, zero redemarrage). Timers de sauvegarde et surveillance actifs. Disque a 40 %, environ 12 Go disponibles.

Runtime precedent conserve : `/var/www/saytu-yef-release-46034950772380d20b851e6d0050af0b843bc1c5-20261025T123836Z`. Avant compilation, une release plus ancienne a ete copiee et verifiee sur le PC puis retiree du VPS : 290 748 208 octets, 46 130 entrees, SHA256 `94f7aa9d9fdcf1a8ec9a5cd6d32596e13f0bf7a97a29233221d6731dcc4fd22a`. Les deux secours recents ont ete conserves pendant cette rotation.

Reste une recette humaine connectee avec un administrateur de boutique : ouvrir le crayon sur un membre, verifier le nom et le role, puis enregistrer uniquement un changement reel souhaite. Les essais visuels automatises ont utilise des donnees fictives locales.
