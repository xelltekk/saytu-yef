# Validation boutique - 13 octobre 2026

## Etat et limites

Les corrections SQL sont appliquees en production. Le correctif frontend du scanner est teste localement, mais n'est pas encore deploye. Aucun encaissement fictif ni redemarrage PM2 n'a ete effectue pendant cette validation.

Lint et verification TypeScript sont valides. Le build Linux Next.js 15.5.27 a reussi dans `/var/tmp/saytu-yef-validation-20261013`, avec le correctif scanner et les dependances Linux existantes. Il reste un avertissement Supabase sur `process.version` dans le runtime Edge et les avertissements de cache webpack; le build n'a pas ete active.

Le proprietaire confirme disposer d'un compte de test. Son mot de passe ne doit pas etre partage ni conserve dans un script. La connexion et les essais sur le materiel restent manuels.

## Scanner et impression

Le lecteur global est suspendu dans une fenetre modale et dans les champs de saisie. Une lecture en attente est annulee si une fenetre de paiement s'ouvre ou si le navigateur perd le focus. Les dates des evenements clavier servent a mesurer les intervalles de lecture; une tolerance sur la premiere paire evite de perdre le premier chiffre lors d'un demarrage a froid.

Les 86 tests automatises passent, dont huit tests du lecteur et cinq tests PostgreSQL isoles sur les droits et politiques d'acces. Les essais navigateur se font a 360, 768 et 1440 pixels; ils controlent la lecture unique, les protections modales, la saisie libre et le debordement horizontal. Le navigateur de test simule la commande d'impression : cela ne valide pas une imprimante physique.

Confirmation du proprietaire le 13 octobre : lecture des codes correcte et papier 80 mm. Apres impression du ticket test, il confirme que le resultat sur papier est correct, lisible et sans texte coupe. Ces validations physiques sont rapportees par l'utilisateur, pas observees directement par l'agent. Le modele d'imprimante, la facture A4, les etiquettes A4 et le parcours POS complet ne sont pas encore confirmes.

Page materiel locale, avec documents fictifs et sans acces a la base :

```powershell
node scripts/hardware-validation.mjs
```

Ouvrir http://127.0.0.1:4319. Lire le code EAN-13 `2901234567896`, verifier une seule lecture et les treize chiffres. Refaire la lecture avec la fenetre de controle ouverte et avec le champ de saisie actif : le compteur ne doit pas augmenter. Essayer une lecture sans suffixe puis avec les suffixes Entree et Tab selon la configuration du lecteur.

Imprimer le ticket test 80 mm, la facture A4 et l'etiquette A4 a taille reelle, sans ajustement automatique. Verifier les marges, les montants, le logo, l'absence de texte coupe et la relecture du code imprime. Le papier 80 mm et le ticket test sont confirmes par le proprietaire; le modele d'imprimante reste a renseigner. Cette validation ne s'applique pas a une imprimante 58 mm.

Dans la boutique de test, verifier ensuite le produit simple et chaque variante : code existant, code genere, scans repetes qui augmentent la quantite, code inconnu sans ajout, stock insuffisant sans survente. Verifier remise + acompte, versement restant et remboursement. Ces operations doivent etre reservees a des donnees de test, pas a des comptes clients reels.

Test navigateur reproductible, avec Playwright disponible dans le runtime Codex ou via `BROWSER_RUNTIME_MODULES` :

```powershell
node scripts/test-hardware-browser.mjs
```

Les captures sont locales dans `tmp/hardware-validation`. Les documents utilisent les fonctions d'impression de l'application, mais ne remplacent pas les essais depuis une vente reelle de test.

## Rapidite avec les donnees reelles

Lecture seule sur le compte ayant le plus de produits : 17 produits, 611 443 octets d'images inline. Les empreintes des donnees et les volumes restent identiques avant/apres.

| Mesure SQL | Avant | Apres |
| --- | --- | --- |
| Execution a froid | 37,419 ms | 32,358 ms |
| Execution mediane, trois passages | 2,239 ms | 2,418 ms |
| Planification a chaud | 0,746-0,763 ms | 0,333-0,355 ms |
| Sous-plans d'identite calcules une fois | 0 | 3 |

Ces trois passages ne demontrent pas une acceleration globale de l'application. Les politiques calculent maintenant l'identite une fois par requete, ce qui evite du travail repete quand le catalogue augmente. Le transfert d'images et le rendu des pages connectees restent a mesurer. Le catalogue global contient 46 produits dont 28 images inline, environ 1,15 Mo d'images.

Benchmark SQL protege sur le VPS : `sudo bash scripts/benchmark-catalog-vps.sh`. Il lit la configuration root existante, ne publie aucun identifiant client ni secret et termine sa transaction par ROLLBACK.

Pour les mesures connectees, demarrer l'application manuellement :

```powershell
npm run dev
node scripts/measure-browser.mjs http://127.0.0.1:3003
```

Se connecter soi-meme au compte de test dans la fenetre Edge dediee. Le script navigue en lecture sur dashboard, inventaire, ventes, clients et rapports, deux fois. Il ne cree aucune vente et ne lit ni les mots de passe, ni les cookies, ni les contenus des reponses. Le rapport local `tmp/performance-validation/browser-metrics.json` contient uniquement des timings et metadonnees reseau expurgees des parametres d'URL.

Les mesures sont faites en mode local, pas en production ni sur smartphone. L'attente de calme reseau inclut 500 ms et peut expirer; elle n'est pas un temps de chargement metier. Les ressources externes peuvent afficher zero octet faute d'en-tetes Timing-Allow-Origin. Une redirection de permission doit etre distinguee d'une page effectivement chargee.

Mesure connectee du 13 octobre : deux passages reussis sur les cinq pages, avec le compte de test connecte manuellement. Toutes les destinations restent sur la page demandee et le calme reseau est atteint. Le script conserve le rapport apres chaque page et autorise 120 secondes pour les navigations locales; un premier essai s'etait interrompu a la limite precedente de 30 secondes sur l'inventaire.

| Page | Premier passage | Second passage |
| --- | --- | --- |
| Dashboard | 9,087 s | 23,878 s |
| Inventaire | 19,870 s | 18,416 s |
| Ventes | 44,901 s | 43,704 s |
| Clients | 32,854 s | 20,336 s |
| Rapports | 42,177 s | 16,725 s |

Ce sont des navigations completes jusqu'au calme reseau, pas des navigations SPA ni des temps de rendu final. Les etiquettes techniques `cold`/`warm` designent seulement les deux passages : le tableau de bord et certaines routes avaient deja ete compiles pendant la connexion et un essai precedent. Aucun LCP n'a ete observe sur les dix navigations; aucun temps d'affichage final n'est deduit du rapport.

Les documents locaux prennent environ 3,7 a 40,3 secondes au premier passage et 10,0 a 26,3 secondes au second. Les ressources mesurables de developpement representent environ 3,9 a 5,2 Mo par page. Les appels Supabase cote navigateur observes retournent HTTP 200 et durent generalement moins de 1,5 seconde, avec un appel Auth a 2,8 secondes au second passage. Plusieurs appels a une meme table ne prouvent pas une requete identique : le rapport supprime les parametres d'URL pour proteger les donnees.

Le chargement des notifications utilise deja `id,name,quantity,min_quantity,status,updated_at`, sans photo ni relation. Les metriques du catalogue du tableau de bord sont egalement projetees sans images. Aucun chargement d'images inutile n'est confirme dans ces deux parcours. La latence des reponses locales est reelle, mais son origine precise n'est pas etablie par ce test de developpement. La comparaison de production ci-dessous ne reproduit pas ces longues attentes sur les documents HTTP.

Le proprietaire autorise le 13 octobre la mesure connectee de production en lecture seule. La commande suivante accepte uniquement le domaine HTTPS de l'application et conserve les mesures locales dans leur fichier distinct :

```powershell
node scripts/measure-browser.mjs --production
```

Se connecter manuellement dans la nouvelle fenetre et la laisser visible pendant les essais. Le rapport `tmp/performance-validation/production-browser-metrics.json` ne contient ni contenu client, ni parametres d'URL, ni jetons. Le mode local rejette les domaines distants; le mode production rejette tout autre domaine, les identifiants dans l'URL et les parametres. Aucun code applicatif n'est deploye par cet outil.

Mesure de production terminee le 13 octobre : cinq pages, deux passages, compte de test connecte manuellement dans une session navigateur isolee. Les dix destinations correspondent aux pages demandees. Aucune operation commerciale n'est effectuee.

| Page | LCP API observe, premier passage | LCP API observe, second passage |
| --- | --- | --- |
| Dashboard | 708 ms | 1 208 ms |
| Inventaire | 1 288 ms | 740 ms |
| Ventes | 900 ms | 848 ms |
| Clients | 696 ms | 652 ms |
| Rapports | 836 ms | 1 164 ms |

Les documents de ces navigations repondent en environ 332 a 907 ms. Les 115 appels Supabase enregistres retournent tous HTTP 200; le plus long prend 1 236 ms. Les essais de production et locaux utilisent le meme domaine Supabase, mais ne prouvent pas l'identite des jeux de donnees : les identifiants et contenus ne sont pas inspectes.

L'attente Playwright `networkidle` expire a 15 secondes sur les dix navigations de production. Les durees brutes de 15,7 a 16,9 secondes dans ce premier rapport indiquent l'expiration de cette attente, pas la duree de chargement. L'origine exacte de l'absence de calme reseau n'est pas determinee : les prechargements de navigation et les caches PWA sont observes, sans preuve qu'ils constituent la cause. Le script renseigne desormais `untilNetworkIdleMs: null` lorsqu'elle expire et conserve la fenetre d'observation dans `measurementWindowMs`. Le rapport original n'est pas reecrit pour changer les mesures historiques.

Le LCP ci-dessus est le dernier candidat de l'API observe pendant l'essai desktop, pas une validation de tous les widgets ou de toutes les donnees ni une mesure terrain au 75e percentile. Les ressources en cache rendent les volumes transferes incomparables aux bundles de developpement. La visibilite continue de la fenetre n'a pas ete journalisee pendant ce premier essai; le script la consigne desormais pour qualifier les prochaines mesures. Ne pas generaliser ces dix valeurs aux smartphones ou aux reseaux des boutiques.

References : [limites de l'attente networkidle](https://playwright.dev/docs/api/class-page#page-wait-for-load-state), [definition et limites de l'API LCP](https://web.dev/articles/lcp).

## Securite

Sauvegarde prealable `saytu-yef-20261013T100015Z.dump` copiee sur Windows, SHA256 et inventaire des roles verifies; deux objets Storage verifies separement.

Les fichiers `20261013094057_retail_access_hardening.sql` et `20261013095107_catalog_read_performance.sql` ont ete appliques ensemble, dans cet ordre, en une migration atomique Supabase `20261013100209_retail_access_and_catalog_performance`. Ne pas les rejouer individuellement sur cette production.

- Aucune fonction privilegiee callable par le role anonyme, contre 26 avertissements auparavant. L'endpoint de sante reste accessible.
- Fonctions de trigger interdites a l'appel direct navigateur; droits des RPC authentifies existants conserves, anciennes fonctions financieres privees non reouvertes.
- Tables internes de support et de reprise non accessibles directement. Les politiques permissives SELECT redondantes ont ete retirees sans supprimer les controles de boutique.
- Les futures fonctions creees par postgres ne recoivent plus le droit EXECUTE PUBLIC par defaut. Cette regle est globale pour ce createur; les fonctions futures d'autres schemas doivent recevoir leurs droits explicites. Les droits des fonctions existantes et des autres createurs ne sont pas modifies.
- REST anonyme verifie : sante HTTP 200, identite de boutique et liste des administrateurs HTTP 401. Aucun secret ni mot de passe journalise.

Restent 34 avertissements de fonctions privilegiees authentifiees : ces RPC font leurs propres controles de compte ou d'operateur et ne doivent pas etre revoques en bloc. Les trois tables internes avec RLS sans politique sont volontairement fermees. L'audit performance ne signale plus les politiques permissives multiples; les 25 index inutilises ne sont pas supprimes sur la seule base de cet indicateur.

La protection Auth contre les mots de passe compromis est encore desactivee. Supabase la reserve aux offres Pro et superieures; son activation ou un changement d'offre exige une decision du proprietaire. Voir [la documentation Auth](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) et [les fonctions privilegiees authentifiees](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Audit npm de production : quatre alertes elevees, aucune critique, dans la chaine PWA/braces/micromatch/fast-glob. Aucun correctif upstream de braces n'est disponible a cette date; le risque n'est pas declare resolu. Ne pas appliquer `npm audit fix --force` ni retrograder PWA automatiquement. Voir [l'avis de securite braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

## A terminer

- Lecture des codes et ticket physique 80 mm confirmes par le proprietaire; renseigner le modele d'imprimante et verifier encore la facture A4 et les etiquettes A4.
- Parcours POS complet avec variantes et paiements sur le compte de test.
- Mesures locales et de production faites; mesurer encore la disponibilite des donnees metier et les conditions smartphone avant de conclure sur tous les parcours.
- Deploiement du correctif scanner avec pause des encaissements autorisee; build isole deja valide.
- Decision sur la protection Auth et traitement de l'alerte upstream lorsqu'un correctif est disponible.
