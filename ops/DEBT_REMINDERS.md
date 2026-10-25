# Relances Et Paiement Mobile

Le constructeur commun `src/lib/debtReminders.ts` ajoute aux relances de dette : "Vous pouvez payer par Wave ou Orange Money au [numero de la boutique]." Le compte client (WhatsApp et copie du rappel) et le detail d'une vente utilisent le meme constructeur. Le montant restant, le nom du client, celui de l'entreprise et la reference du recu pour une vente individuelle sont conserves.

Le numero provient uniquement du profil entreprise charge dans `useAccountStore.business.phone`. Aucun repli vers les metadonnees personnelles du membre caisse. Sans numero exploitable, la ligne de paiement mobile est omise; la relance reste utilisable. Les numeros locaux sont conserves, le prefixe international 00 est transforme en + et les espaces superflus sont normalises. La verification est syntaxique, pas une verification de l'existence d'un portefeuille Wave/Orange Money.

Aucun envoi automatique et aucune nouvelle ecriture de donnees. Les liens WhatsApp preparaient deja un message encode; le bouton de copie utilise le meme texte. Les notes et historiques de relance existants ne sont pas modifies. Le changement de telephone dans les parametres recharge deja le profil entreprise apres enregistrement.

Verification : 16 tests dedies (montant, reference, noms, numero absent/invalide, actualisation du numero et encodage WhatsApp), suite complete de 282 tests reussie, TypeScript et ESLint valides. Aucune migration Supabase necessaire.

## Livraison

Runtime actif le 25 octobre 2026 : `39da44c6196a56ff09257a5a27789b6211f2c1a4`, build `D4ZulE28gh9CP-Il2CAgC`. Pause des encaissements confirmee. Sauvegarde avant bascule copiee sur Windows et SHA256 verifie : `saytu-yef-20261025T182231Z.dump`, inventaire de roles sans mots de passe, Storage `storage-20261025T1825390072444Z` (13 fichiers verifies).

Compilation Next, lint et TypeScript de production reussis, avec l'avertissement Supabase/Edge `process.version` deja present avant cette version. Aucune migration appliquee. Les empreintes completes et volumes des profils, ventes, produits, lignes de vente, paiements, mouvements de stock et depenses sont strictement identiques avant et apres bascule.

Sante de production : base et Auth OK, connexion et service worker HTTP 200, worker avec Cache-Control `no-store, must-revalidate, no-cache`. Le nouveau texte est present dans un chunk effectivement servi en HTTP 200; les 33 ressources des manifestes des pages Clients/Ventes ont ete verifiees. Les deux pages redirigent les visiteurs non connectes vers la connexion. PM2 : PID 166889, online, zero redemarrage. Timers de sauvegarde et surveillance reactives apres preparation/bascule.

Secours conserve : `/var/www/saytu-yef-release-2e016bae3d68c0c5409fafa8cec2e5311920a3e4-20261025T184920Z`. Ancienne release archivee puis retiree apres verification Windows : 291 110 690 octets, 46 196 entrees, SHA256 `123c7e68885184c23c217b4996c4fbccc74c273283a60b45a8d53198b3ae64af`. Les deux secours recents etaient proteges pendant cette rotation.

Le transfert de cette ancienne release a pris environ 22 minutes sur la liaison du moment. Pour les prochaines livraisons, effectuer la rotation et preparer le build avant de demander la pause, puis prendre une sauvegarde recente et confirmer la pause juste avant la bascule; ne pas supprimer un secours non verifie pour raccourcir l'attente.

Aucune relance reelle envoyee pendant les essais. La recette humaine reste de preparer une relance, verifier le numero de l'entreprise et le montant, puis envoyer uniquement au client souhaite.
