# Depenses De La Boutique

## Perimetre

Les cinq blocs ajoutent les frais d'exploitation payes, une photo de justificatif privee, un suivi par mois/categorie, une estimation apres frais dans Rapports/CSV/PDF, et un acces exclusif au proprietaire. Les achats de stock sont exclus des categories de frais usuelles car leur cout est deja pris en compte dans la marge des ventes. Le resultat affiche est une estimation de gestion, pas un resultat comptable.

Les depenses ne creent aucun mouvement de caisse ou de stock. Le montant est un entier positif en FCFA, au maximum 999 999 999 999. La date est une date civile de paiement; les rapports reprennent les memes bornes locales que la periode des ventes. Les rapports par vendeur n'integrent jamais les frais globaux de la boutique.

La liste est paginee (25 lignes, maximum serveur 50) et les totaux sont calcules cote PostgreSQL sur toute la selection. Les agregations ne materialisent pas les notes ni les chemins de justificatif de toutes les lignes. Les modifications utilisent une revision optimiste; une revision obsolete est refusee. La creation conserve un identifiant stable pour reconnaitre une nouvelle tentative identique apres une reponse reseau perdue. L'annulation conserve la ligne, la gele et l'exclut des totaux.

## Acces Et Photos

La route serveur, la navigation et le client verifient l'identite du proprietaire et le role admin issu du profil. Les politiques RLS et le RPC imposent aussi `auth.uid() = current_account_id()`, le role admin et l'etat actif du compte. Les administrateurs delegues, employes et caissiers ne voient pas ces informations. Aucune nouvelle fonction SECURITY DEFINER n'est ajoutee.

Les photos JPG/PNG/WebP de 5 Mo maximum sont redimensionnees a 1800 pixels et converties en JPEG. Bucket `expense-receipts` prive, chemins UUID sous le dossier du proprietaire. Lecture par telechargement authentifie puis URL blob locale revoquee a la fermeture; aucune URL publique ni URL signee persistante. Les anciennes photos ne sont pas supprimees automatiquement lors d'une annulation/remplacement, pour eviter de casser une reference apres un resultat reseau ambigu.

La copie Windows sait maintenant copier ce bucket prive via SSH et `/usr/local/lib/saytu-yef/backup-private-storage.mjs`. La cle serveur reste exclusivement dans `/etc/saytu-yef-storage.key`, root:root, mode 600. L'outil de configuration demande la cle en saisie masquee et valide son acces au projet. Ne jamais publier ce fichier, copier sa valeur dans le chat, ou l'ajouter aux variables NEXT_PUBLIC. Le lecteur de sauvegarde borne les chemins, types et tailles, interdit les redirections, verifie la version/longueur et ne renvoie que le binaire. Le manifest Windows conserve les SHA256 et est compare a un nouvel inventaire Storage avant de declarer la copie complete.

## Verification Locale

- 238 tests Vitest passent, dont RLS/table/RPC/Storage, isolation des boutiques, administrateurs delegues, bornes de dates, montants, pagination, conflits de revision, annulation et invalidation des exports.
- TypeScript et ESLint valides.
- `node scripts/test-expenses-browser.mjs` : 360/768/1440 px, mois/categories, creation avec photo, consultation authentifiee simulee, modification/annulation, pagination, erreurs et changement de role.
- `node scripts/test-reports-browser.mjs` : CSV/PDF, calcul apres frais, proprietaire/equipe/vendeur/caissier, sans acces a la production.
- PDF fictif de huit pages controle avec Poppler et inspection visuelle de la page de depenses : 492 000 FCFA de marge brute, 30 000 FCFA de frais, estimation 462 000 FCFA. Aucune facture ni depense reelle creee par ces recettes.
- `scripts/test-windows-backups.ps1` : 14 tests passes. Le lecteur prive est teste avec des reponses HTTP simulees (refus d'acces, redirection interdite, mauvaise version, taille et flux incomplets).

## Livraison

Migration source : `supabase/migrations/20261024172941_owner_expenses.sql`, creee via le CLI Supabase. Appliquer uniquement ce lot apres sauvegarde; ne pas lancer un db push global sur l'historique ancien non rapproche. Conserver la correspondance avec la version enregistree par l'outil de migration de production.

Livraison realisee le 25 octobre 2026, apres confirmation de pause des encaissements. Runtime : `6c0efa97090a6058764d8b4234faf3d8a1563861`. La compilation sur le VPS, TypeScript et ESLint ont reussi. Le build conserve un avertissement existant Supabase/Edge concernant `process.version`, sans echec de compilation.

La migration source ci-dessus correspond a la migration de production `20261025113837_owner_expenses`, appliquee seule par l'outil Supabase. RLS actif, trois politiques sur la table, aucun acces anonyme, aucun droit DELETE pour authenticated, et trois fonctions SECURITY INVOKER verifies apres application. Le bucket est prive, limite a 5 Mo et aux trois types d'image attendus. Aucun nouvel avis de securite concernant les depenses; les avertissements preexistants des autres modules restent hors de ce lot.

La configuration de la cle de sauvegarde a ete verifiee sur le VPS sans lire sa valeur dans les sorties. Le lecteur prive y est installe. Un fichier technique PNG de 68 octets a permis de verifier la lecture authentifiee (HTTP 200), le refus d'URL publique (HTTP 400), puis sa copie Windows avec les 13 fichiers existants. Manifest : `Documents/Saytu-Yef-Backups/storage-20261025T1139020275428Z/manifest.json`. Le fichier technique a ete supprime ensuite; aucune depense, vente ou ecriture financiere fictive n'a ete creee en production.

Sauvegardes de base copiees et empreintes SHA256 verifiees sur le PC : `saytu-yef-20261025T022400Z.dump` avant migration et `saytu-yef-20261025T114017Z.dump` apres migration, avec leurs inventaires de roles sans mots de passe. Copie finale Storage : `storage-20261025T1140468249663Z`, 13 fichiers, memes metadonnees et SHA256 qu'avant le deploiement. Le bucket prive et la table des depenses sont vides apres retrait du fichier technique.

Les volumes et empreintes completes des lignes sont strictement identiques avant et apres bascule :

| Table | Lignes | Empreinte MD5 de comparaison |
| --- | ---: | --- |
| sales | 125 | f5b922f66ae1923abf10e816ca064890 |
| products | 58 | 46ffaab348eb3171fb93d013cd68503c |
| sale_items | 149 | 9b9eec234f7a1e56ab71dab945f53362 |
| sale_payments | 147 | f36fd19538015f202b92aa57fff17119 |
| stock_movements | 49 | 53a2927063f355d5bdcfb7b1da501cc2 |

Sante production : base et Auth OK, connexion et cinq ressources statiques HTTP 200, service worker HTTP 200 avec `no-store, must-revalidate, no-cache`. Un visiteur non connecte sur `/expenses` est redirige vers `/login`. PM2 stable (PID 152159, zero redemarrage), journal d'erreur inchange pendant les controles (75 268 octets). Timers de surveillance et sauvegarde actifs. Disque : 40 % utilises, environ 12 Go disponibles.

Ancien runtime conserve pour retour arriere : `/var/www/saytu-yef-release-76d2324fbd2884551a66562ceb87b424fcf94683-20261025T113928Z`. Une archive plus ancienne a ete exportee et verifiee sur Windows avant rotation : 290 595 242 octets, 46 096 entrees, SHA256 `8dbb7dfcb4443105e4172b953d942ce956d034a1c9b5dff73697f0c9b80af613`. Le retour arriere applicatif peut conserver les nouvelles structures additives sans les supprimer.

Reste une recette humaine avec le compte proprietaire en boutique : saisie d'une depense reelle avec photo puis consultation des rapports et du PDF. Les parcours connectes ont ete testes localement avec donnees fictives, pas avec les identifiants d'un client en production.
