# Déploiement — Saytu Yëf sur VPS

VPS : `179.237.84.35` (Ubuntu) · Domaine : `saytu-yef.xelltekk.com` · Stack : Node + PM2 + Nginx + HTTPS

---

## 0. DNS (à faire en premier, chez Infomaniak)

Crée un enregistrement **A** :

| Type | Nom        | Valeur          | TTL  |
|------|------------|-----------------|------|
| A    | `saytu-yef` | `179.237.84.35` | 3600 |

> La propagation DNS peut prendre de quelques minutes à quelques heures.
> Vérifie avec : `ping saytu-yef.xelltekk.com` (doit répondre depuis 179.237.84.35).

---

## 1. Préparer le VPS

Connecte-toi en SSH :

```bash
ssh root@179.237.84.35
```

Mets à jour et installe les outils :

```bash
apt update && apt upgrade -y

# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git nginx

# PM2 (gestionnaire de process)
npm install -g pm2

# Vérifs
node -v && npm -v && nginx -v
```

---

## 2. Récupérer le code sur le VPS

### Option A — via GitHub (recommandé, mises à jour faciles)

Sur **ton PC Windows** (dans le dossier du projet) :
```powershell
git add -A
git commit -m "Préparation déploiement"
# crée un dépôt PRIVÉ sur github.com puis :
git remote add origin https://github.com/TON_COMPTE/saytu-yef.git
git push -u origin master
```

Sur le **VPS** :
```bash
mkdir -p /var/www && cd /var/www
git clone https://github.com/TON_COMPTE/saytu-yef.git saytu-yef
cd saytu-yef
```

### Option B — transfert direct (sans GitHub)

Sur **ton PC Windows** (PowerShell, depuis le dossier parent) :
```powershell
# Nécessite OpenSSH (inclus dans Windows 10/11)
scp -r "C:\xampp\htdocs\Saytu Yëf\saytu-yef" root@179.237.84.35:/var/www/saytu-yef
```
> Exclus `node_modules` et `.next` du transfert si possible (ils seront régénérés).

---

## 3. Variables d'environnement

Sur le VPS, dans `/var/www/saytu-yef`, crée le fichier `.env` :

```bash
nano .env
```

Colle (avec TES vraies valeurs Supabase, identiques à ton `.env.local`) :
```
NEXT_PUBLIC_SUPABASE_URL=https://ton-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ta_cle_anon
NEXT_PUBLIC_SITE_URL=https://saytu-yef.xelltekk.com
NODE_ENV=production
PORT=3000
```
Enregistre : `Ctrl+O`, `Entrée`, `Ctrl+X`.

---

## 4. Installer & compiler

```bash
cd /var/www/saytu-yef
npm ci
npm run verify
```

> Le build génère aussi les fichiers PWA dans `public/` (`sw.js`, Workbox, fallback). C'est normal : ne lance pas l'app avant que `npm run build` soit terminé.

Sur ton PC Windows, tu peux contrôler la build locale avec :
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\check-local.ps1 -BaseUrl http://127.0.0.1:3000
```

---

## 5. Lancer avec PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup           # exécute la commande qu'il affiche (pour démarrage auto au reboot)
pm2 status            # doit montrer "saytu-yef" en "online"
```

Test local sur le VPS :
```bash
curl -I http://127.0.0.1:3000   # doit répondre 200/307
curl -s http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:3000/manifest.json
curl -I http://127.0.0.1:3000/sw.js
curl -I http://127.0.0.1:3000/offline
bash deploy/check-vps.sh
```

---

## 6. Nginx (reverse proxy)

```bash
# copie le fichier fourni dans le projet
cp /var/www/saytu-yef/deploy/nginx.conf /etc/nginx/sites-available/saytu-yef
ln -s /etc/nginx/sites-available/saytu-yef /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default   # retire le site par défaut

nginx -t          # teste la config
systemctl reload nginx
bash /var/www/saytu-yef/deploy/check-vps.sh http://saytu-yef.xelltekk.com
```

À ce stade : `http://saytu-yef.xelltekk.com` doit afficher l'app.

---

## 7. HTTPS gratuit (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d saytu-yef.xelltekk.com
```
Réponds aux questions (email + redirection HTTP→HTTPS = oui). Certbot ajoute tout seul le bloc 443 et le renouvellement auto.

---

## 8. Pare-feu (si UFW actif)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## 9. Configurer Supabase pour la production

Dans le dashboard Supabase → **Authentication → URL Configuration** :
- **Site URL** : `https://saytu-yef.xelltekk.com`
- **Redirect URLs** : ajoute
  - `https://saytu-yef.xelltekk.com/auth/callback`
  - `https://saytu-yef.xelltekk.com/auth/reset-password`

(Sinon la connexion Google et le reset de mot de passe ne fonctionneront pas en prod.)

### Base de données

Dans Supabase → **SQL Editor** :

- Nouvelle base : exécute `supabase/schema.sql`
- Base déjà créée : exécute les fichiers dans `supabase/migrations/`, dans l'ordre

Migration importante pour la caisse :
```text
supabase/migrations/202606151612_harden_sales_stock.sql
```

Elle crée `create_sale_with_items`, utilisée par l'app pour enregistrer une vente complète et décrémenter le stock dans une seule transaction.

---

## 🔄 Mettre à jour l'app plus tard

Avec GitHub :
```bash
cd /var/www/saytu-yef
git pull
npm ci
npm run verify
pm2 reload saytu-yef
bash deploy/check-vps.sh
```

---

## ✅ Vérifications finales
- [ ] `https://saytu-yef.xelltekk.com` charge en HTTPS (cadenas vert)
- [ ] Connexion / inscription fonctionnent
- [ ] Les pages dashboard, ventes, inventaire s'affichent
- [ ] Sur Android Chrome, le bouton/option **Installer l'application** apparaît après quelques secondes
- [ ] `https://saytu-yef.xelltekk.com/manifest.json` répond en 200
- [ ] `https://saytu-yef.xelltekk.com/sw.js` répond en 200 avec `Cache-Control: no-cache`
- [ ] `https://saytu-yef.xelltekk.com/offline` affiche la page hors-ligne
- [ ] `https://saytu-yef.xelltekk.com/api/health` répond avec `status: ok`
- [ ] `pm2 status` = online · `pm2 logs saytu-yef` sans erreur
