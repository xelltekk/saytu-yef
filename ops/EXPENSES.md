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

La configuration de la cle de sauvegarde a ete verifiee sur le VPS sans lire sa valeur dans les sorties. Le lecteur prive y est installe. La migration et la bascule applicative sont encore en attente de la confirmation de pause des encaissements. Le retour arriere applicatif peut conserver les nouvelles structures additives sans les supprimer.
