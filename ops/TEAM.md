# Equipe Et Roles

## Changements

Liste compacte responsive, recherche sur nom/email sans distinction de casse ou d'accents, filtre de role, actualisation, modification explicite du nom complet et du role, confirmation de retrait et retour de succes/erreur. Les actions sont bloquees pendant le chargement ou une ecriture. Les formulaires et leur pied restent accessibles sur petit ecran. Une limite d'abonnement empeche l'ajout, pas la modification des membres existants.

L'email de connexion est en lecture seule : le modifier uniquement dans profiles desynchroniserait Supabase Auth. Le proprietaire et le compte de l'administrateur connecte ne sont pas modifiables depuis cette liste. Les autres membres restent modifiables par les administrateurs de leur boutique, y compris les administrateurs delegues. Le retrait conserve le compte utilisateur et suit le RPC existant; ce n'est pas une suppression Auth.

## Migration Et Securite

Source creee via le CLI Supabase : `supabase/migrations/20261025120024_team_member_edit.sql`. Cette migration n'est pas encore appliquee en production. Ne pas faire de db push global sur l'historique ancien non rapproche.

Le RPC public `update_team_member` est SECURITY INVOKER. Il appelle une fonction SECURITY DEFINER limitee dans le schema non expose `app_private`, avec search_path vide, droits explicites authenticated et aucun acces PUBLIC/anon. Ne pas ajouter app_private aux schemas exposes de la Data API.

La fonction verifie l'identite Auth, le role admin depuis profiles, l'acces actif, le rattachement a la meme boutique et la protection du proprietaire/de soi-meme. Elle verrouille les profils concernes et refuse une revision `updated_at` obsolete ou absente. Seuls full_name, role et l'horodatage serveur sont ecrits; la reponse ne contient que les champs de la liste. Aucun droit UPDATE supplementaire n'est accorde sur profiles et aucune politique RLS existante n'est elargie. Un changement de compte/role remonte une nouvelle liste sans conserver le formulaire precedent.

## Verification

- Suite complete : 264 tests passes, dont 26 nouveaux tests de validation, autorisations, isolation, revision et RPC client. PostgreSQL local ephemere PGlite, pas de modification de compte reel.
- TypeScript et ESLint verifies sur les fichiers modifies.
- `node scripts/test-team-browser.mjs` : 360/768/1440 px, liste, recherche et filtre, nom/role, annulation, retrait confirme, ajout, erreurs, limite d'abonnement et changement de role pendant un formulaire. Controle du pied de formulaire aussi a 360 x 480 px. Aucune requete vers la production pendant ces tests.
- Captures de recette dans `tmp/team-validation`, controlees visuellement. Le serveur local est accessible sur `http://127.0.0.1:3003/team`, avec authentification requise.

La migration et le deploiement sont a effectuer lors de la prochaine mise en ligne; le site de production n'a pas ete modifie par ce lot.
