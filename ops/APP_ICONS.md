# Icones A Bordure Degradee

## Generation

Le symbole original `public/brand/logo-saytu-yef-mark-v2.png` reste intact. Le generateur existant ajoute un cadre arrondi violet-turquoise sur fond blanc et compose le symbole sans recoloration. `node scripts/generate-icons.mjs` et `node scripts/generate-browser-icons.mjs` produisent maintenant les memes fichiers : favicon ICO/PNG, icone Next, Apple opaque, icones PWA et deux variantes maskable opaques avec symbole dans la zone centrale.

Les URL des icones et du manifeste portent `v=20261025-gradient` pour ne pas reutiliser les anciennes entrees CacheFirst. L'identite du manifeste (`id: /`), le scope et le start_url ne changent pas. Les icones ordinaires sont declarees any; les variantes dediees sont declarees maskable. Aucun logo commercial de boutique ni logo utilise dans les factures n'est modifie.

## Tests Et Publication

Livraison du 25 octobre 2026, apres confirmation de pause des encaissements. Runtime `2f3ec3ca80e588cada1edc9bfc30d76a75e6801e`, build `rvEAbl-ObY8RP65M4-sB7`.

- Quatre tests d'icones passent : ICO decodable et coherent avec les PNG, symbole preserve sur fond blanc, pixels de bordure colores et coins transparents, dimensions/alpha/manifestes coherents.
- ESLint des fichiers modifies valide. Compilation Next, lint et TypeScript de production reussis. Avertissement Supabase/Edge process.version historique, sans echec de compilation.
- Inspection visuelle des images a 32, 192 et 512 px. Variante arrondie pour navigateur, variante circulaire sur fond opaque pour les lanceurs maskable.
- Les 16 fichiers d'icones publies repondent en HTTP 200 et leur SHA256 correspond aux fichiers locaux. Manifeste publie identique et nouvelles references presentes dans le HTML de connexion.
- Sante production base et Auth OK, PID 160184, zero redemarrage lors des controles. Timers sauvegarde et surveillance actifs. Disque a 40 %, environ 12 Go disponibles.
- Aucune migration ni ecriture de donnees metier. Comparaison des volumes et empreintes completes des profils, ventes, produits, lignes de vente, paiements, mouvements de stock et depenses : tous inchanges.

Sauvegarde avant publication copiee et SHA256 verifie sur Windows : `Documents/Saytu-Yef-Backups/saytu-yef-20261025T135040Z.dump`, inventaire des roles sans mots de passe et Storage `storage-20261025T1352391293700Z` (13 fichiers verifies).

Secours applicatif conserve : `/var/www/saytu-yef-release-278f7e62e5bc5333235f9addbfd92ff1a35390c1-20261025T135641Z`. Rotation d'une release ancienne apres export Windows verifie : 290 945 237 octets, 46 164 entrees, SHA256 `bff1ba58c6c74105c154b6d21cdf211ea46af72b7ff06cd94df9d48fce7d28bd`. Les deux secours recents etaient proteges pendant la rotation.

Les fichiers web et les metadonnees sont verifies; le renouvellement d'une icone deja epinglee ou installee depend aussi du navigateur/lanceur du poste. Ne pas effacer les donnees de l'application pour forcer cette actualisation, notamment si des operations hors ligne sont en attente.
