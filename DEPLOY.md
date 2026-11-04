# DEPLOY — AMO-SCANS-FR

Procédure pas à pas pour publier le site sur **GitHub Pages** (cible par défaut), puis — en option — sur **Cloudflare Workers** (SSR).

| Élément                | Valeur                                      |
| ---------------------- | ------------------------------------------- |
| Compte GitHub          | `Assia123y`                                 |
| Dépôt                  | `amo-scans-fr`                              |
| Branche de déploiement | `main` (ou `master`)                        |
| URL du site            | <https://assia123y.github.io/amo-scans-fr/> |
| Base path              | `/amo-scans-fr/`                            |
| Build utilisé          | `npm run build:pages` → `dist/client`       |
| Workflow               | `.github/workflows/deploy-pages.yml`        |
| CI (contrôle)          | `.github/workflows/ci.yml`                  |

Rappels de vocabulaire :

- **base path** : préfixe d'URL sous lequel le site est servi. Un dépôt GitHub Pages « projet » (`<user>/<repo>`) est servi sous `/<repo>/` ; un dépôt `<user>.github.io` ou un domaine personnalisé est servi à `/`.
- les variables `VITE_*` sont **inlinées au build** : changer la base ou l'URL du site impose de **rebuilder**.

---

## A.0 Préflight — (re)créer le projet Supabase (OBLIGATOIRE)

⚠️ **Le projet Supabase d'origine (`yvjmuaofgxjibflbzybz`) ne résout plus en DNS** : le
sous-domaine `yvjmuaofgxjibflbzybz.supabase.co` n'existe pas (projet suspendu ou supprimé,
vérifié le 2026-11-03). Tant qu'il n'est pas recréé, le site se déploie mais reste vide :
toutes les lectures de données et l'authentification échouent (`ENOTFOUND`).

1. Créer un projet sur <https://supabase.com/dashboard> (plan gratuit suffisant).
2. Relever **Project URL** et la clé **anon/publishable** (Settings → API).
3. Appliquer le schéma : ouvrir **SQL Editor → New query**, coller tout le contenu de
   [`supabase/setup-all.sql`](supabase/setup-all.sql) et cliquer **Run**
   (« Success. No rows returned »). Alternative : `supabase link --project-ref <ref>` puis
   `supabase db push` (applique les mêmes migrations, une par une).
4. Mettre à jour `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` (et les variantes `VITE_*`)
   dans `.env.production`, puis rebuilder.
5. Créer le premier compte via `/auth` : il reçoit automatiquement les rôles `admin` + `author`.
6. **Authentification — URL Configuration** : Site URL = `https://assia123y.github.io/amo-scans-fr`,
   Redirect URLs = `…/auth` (production) et `http://localhost:8080/auth` (local).
7. **(Optionnel) Connexion Google** : Authentication → Providers → Google → activer, renseigner
   le Client ID / Secret créés dans Google Cloud Console, et ajouter
   `https://<project-ref>.supabase.co/auth/v1/callback` aux URI de redirection autorisés côté Google.
   Sans cette étape, le bouton « Continue with Google » affiche un message explicite invitant à
   utiliser e-mail + mot de passe. Le broker OAuth de Lovable (`/~oauth/initiate`) n'existe pas sur
   un hébergement statique : c'est pourquoi l'application utilise désormais l'OAuth Supabase natif.

---

## A. Créer le dépôt et pousser le code

### A.1 Créer le dépôt sur GitHub

1. Aller sur <https://github.com/new>.
2. **Owner** : `Assia123y` ; **Repository name** : `amo-scans-fr`.
3. Visibilité : **Public** (GitHub Pages gratuit pour un dépôt public ; un dépôt privé nécessite un plan payant pour publier Pages).
4. **Ne rien initialiser** (pas de README, pas de `.gitignore`, pas de licence) : le dépôt contient déjà ces fichiers et un dépôt pré-initialisé provoquerait un conflit au premier push.
5. Cliquer sur **Create repository**.

### A.2 Vérifier ce qui va être poussé (sécurité)

Avant le premier commit, s'assurer que les secrets ne partent pas :

```bash
git status --short
git ls-files | grep -E '(^|/)\.env$|\.env\.local$|^\.workspace/'   # doit être vide
```

Fichiers **à ne jamais committer** : `.env`, `.env.local`, `.env.*.local`, `.workspace/` (jeton Lovable). Ils sont déjà couverts par `.gitignore`.

Fichiers **volontairement committés** : `.env.example` (modèle) et `.env.production` (**valeurs publiques uniquement** : URL Supabase + clé anon/publishable + configuration SEO).

### A.3 Initialiser git et pousser

```bash
# à la racine du projet (là où se trouve package.json)
git init -b main
git add -A
git commit -m "chore: initial commit — AMO-SCANS-FR (TanStack Start + Supabase)"
git remote add origin https://github.com/Assia123y/amo-scans-fr.git
git push -u origin main
```

Variantes / pièges :

- **authentification** : GitHub n'accepte plus les mots de passe. Utiliser un **Personal Access Token** (`repo` scope, à saisir comme mot de passe) ou le **GitHub CLI** (`gh auth login`) / une clé SSH (`git@github.com:Assia123y/amo-scans-fr.git`).
- **branche** : si votre branche locale s'appelle `master`, soit pousser `master` (`git push -u origin master`), soit la renommer (`git branch -M main`). Les workflows acceptent `main` **et** `master`.
- **Windows** : git peut normaliser les fins de ligne. Si un diff massif apparaît sur les fichiers texte, ajouter un `.gitattributes` (`* text=auto eol=lf`) — non fourni actuellement.
- **`node_modules`, `dist`, `.wrangler`, `.tanstack`** ne doivent pas apparaître dans l'index (vérifier avec `git status`).

---

## B. Activer GitHub Pages (source = GitHub Actions)

1. Ouvrir le dépôt → **Settings** (onglet du dépôt).
2. Menu de gauche → **Pages**.
3. Section **Build and deployment** → **Source** : choisir **GitHub Actions**.
   - ⚠️ Ne **pas** choisir « Deploy from a branch » : le site est un artefact de build (`dist/client`), pas un dossier versionné.
   - Aucun dossier `/docs` n'est utilisé.
4. La section « GitHub Actions » affiche les workflows disponibles ; celui du dépôt est `Deploy to GitHub Pages`.

Le workflow `.github/workflows/deploy-pages.yml` fait :

1. `actions/checkout` puis **Node 22** avec cache npm ;
2. calcul du **base path** et de l'URL du site à partir du nom du dépôt :
   - `amo-scans-fr` → `VITE_BASE_PATH=/amo-scans-fr/`, `VITE_SITE_URL=https://<owner>.github.io/amo-scans-fr` ;
   - `<owner>.github.io` → `/` ;
3. `npm ci` ;
4. `npm run typecheck` (bloquant) ;
5. `npm run build:pages` → `dist/client` ;
6. `actions/upload-pages-artifact` (dossier `dist/client`) ;
7. déploiement avec `actions/deploy-pages` (environnement `github-pages`).

**Aucun secret GitHub n'est nécessaire.** Les seules valeurs Supabase utilisées sont publiques (clé anon/publishable).

---

## C. Premier déploiement : vérifier

1. Onglet **Actions** → workflow **Deploy to GitHub Pages** → le run se déclenche au push (sinon **Run workflow**).
2. Attendre la fin des deux jobs : `Build static site` puis `Deploy`.
3. Ouvrir <https://assia123y.github.io/amo-scans-fr/>.
   - Un premier déploiement peut prendre **1 à 5 minutes** (propagation Pages).
   - Page blanche au premier essai : vider le cache / forcer le rafraîchissement (`Ctrl+F5`), puis réessayer.
4. Vérifier la présence de `index.html`, `404.html`, `.nojekyll`, `sitemap.xml` et `robots.txt` dans l'artefact déployé (l'étape `Verify build output` de la CI fait exactement ce contrôle).
5. Vérifier l'URL du sitemap : <https://assia123y.github.io/amo-scans-fr/sitemap.xml>.

Déploiements suivants : chaque push sur `main`/`master` redéploie automatiquement. Les pull requests ne déploient pas (mais la CI les vérifie).

---

## D. Dépannage 404 / page blanche

| Symptôme                                                       | Cause                                                                                                                    | Correctif                                                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **404 « There isn't a GitHub Pages site here »** sur la racine | Pages non activé, ou source encore sur « Deploy from a branch »                                                          | Settings → Pages → Source = **GitHub Actions**, puis relancer le workflow.                                                                      |
| Workflow vert mais **404**                                     | L'artefact déployé ne contient pas `index.html` à sa racine (mauvais chemin d'upload)                                    | Vérifier que `upload-pages-artifact` pointe `path: dist/client` (et non `dist`).                                                                |
| **404 sur un deep link** (`/series/xxx`) après rechargement    | Comportement attendu de GitHub Pages : il n'y a pas de rewrite SPA ; le site sert `404.html` (qui **est** l'application) | Vérifier la présence de `dist/client/404.html`. La navigation interne fonctionne, seul le status HTTP est 404.                                  |
| **Page blanche, console remplie de 404 sur `/assets/...`**     | Base path incohérent : build fait pour `/` mais site servi sous `/amo-scans-fr/` (ou l'inverse)                          | Rebuilder avec `VITE_BASE_PATH` correct. Le workflow le calcule automatiquement ; en local, exporter la variable avant `npm run build:pages`.   |
| **404 sur les images / polices**                               | Même cause (base path) ou fichiers absents de `public/`                                                                  | Vérifier `dist/client/assets`, `dist/client/favicon.svg`, `dist/client/og-image.jpg`.                                                           |
| **Page blanche sans erreur 404**                               | Erreur JS au démarrage, souvent variables Supabase absentes                                                              | Ouvrir la console ; vérifier `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` (`.env.production` ou variables du workflow).                  |
| **Le site affiche l'ancienne version**                         | Cache navigateur / CDN Pages                                                                                             | Attendre 1–2 min, `Ctrl+F5`, tester en navigation privée.                                                                                       |
| **Le déploiement échoue sur `npm run typecheck`**              | Erreur TypeScript                                                                                                        | Reproduire localement `npm ci && npm run typecheck`, corriger, repousser.                                                                       |
| **Dépôt renommé**                                              | Le base path calculé change automatiquement, mais `.env.production` et cette doc référencent encore l'ancien nom         | Mettre à jour `.env.production` (`VITE_SITE_URL`, `VITE_BASE_PATH`) et l'URL dans `public/robots.txt`.                                          |
| **Domaine personnalisé**                                       | Servi à `/`, mais le workflow calcule `/<repo>/`                                                                         | Adapter `deploy-pages.yml` (forcer `VITE_BASE_PATH=/` et `VITE_SITE_URL=https://votre-domaine`), puis Settings → Pages → Custom domain + CNAME. |

### Variables et ordre de priorité (rappel)

1. environnement du workflow (`$GITHUB_ENV`) — **prioritaire** ;
2. `.env.production.local` / `.env.local` (non versionnés, absents en CI) ;
3. `.env.production` (versionné) ;
4. valeurs de repli codées dans `scripts/build-pages.mjs`.

---

## E. Rollback / redéploiement

- **Redéployer un commit antérieur** : `git revert <sha>` puis push (le workflow repart), ou onglet **Actions** → run précédent réussi → **Re-run jobs**.
- **Redéployer le dernier commit sans nouveau commit** : **Actions** → `Deploy to GitHub Pages` → **Run workflow**.
- En cas d'incident Pages : Settings → Pages affiche le dernier déploiement et permet de relancer.

---

## F. Déploiement Cloudflare Workers (optionnel)

La cible SSR remplace GitHub Pages uniquement si vous voulez du rendu serveur (route `/sitemap.xml` dynamique, en-têtes serveur, edge Cloudflare). GitHub Pages reste la cible documentée par défaut.

### F.1 Prérequis

- un compte Cloudflare avec **Workers** activé ;
- Wrangler, déjà installé localement par les dépendances (`npx wrangler --version` → 4.92.x) ;
- un token API : dashboard Cloudflare → **My Profile → API Tokens → Create Token** (permissions `Workers Scripts:Edit`, `Account Settings:Read`).

### F.2 Déploiement manuel

```bash
# Authentification (une seule fois)
npx wrangler login
# ou, sans navigateur / en CI :
#   CLOUDFLARE_API_TOKEN=<token>
#   CLOUDFLARE_ACCOUNT_ID=<account-id>

# Build SSR (plugin Cloudflare actif, BUILD_TARGET non défini)
npm run build

# Secrets runtime du Worker (jamais de secret dans le code)
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
# seulement si des server functions utilisent supabaseAdmin :
# npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Déployer
npx wrangler deploy
```

- Nom du Worker : `amo-scans-fr` (`wrangler.jsonc`) ; URL `<worker>.<sous-domaine>.workers.dev`.
- `compatibility_date: 2025-09-24`, `compatibility_flags: ["nodejs_compat"]`, observabilité activée.
- Servi à la racine (`https://<worker>.workers.dev/`) : `npm run build` utilise `base = "/"` par défaut, car `vite.config.ts` lit `process.env.VITE_BASE_PATH` (et **non** `.env.production`). N'exporter `VITE_BASE_PATH` que si vous visez un sous-chemin.
- Adapter `VITE_SITE_URL` à l'URL finale du Worker pour les canonical / Open Graph / sitemap (export d'environnement avant `npm run build`).

### F.3 Workflow GitHub Actions (optionnel)

Si vous voulez déployer le Worker depuis GitHub, ajouter un second workflow (ne pas modifier `deploy-pages.yml`) et deux **secrets** de dépôt : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (Settings → Secrets and variables → Actions).

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - name: Build (SSR)
        run: npm run build
        env:
          VITE_BASE_PATH: /
          VITE_SITE_URL: https://amo-scans-fr.<votre-sous-domaine>.workers.dev
      - name: Deploy
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

> Les valeurs Supabase publiques (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) sont lues depuis `.env.production` par Vite pendant `npm run build` : inutile de les redéclarer en CI. Si vous les surchargez malgré tout, fournissez des valeurs **non vides** (une variable d'environnement vide écraserait celle de `.env.production`).

---

## G. Checklist avant le premier push

- [ ] `git status --short` ne montre ni `.env`, ni `.env.local`, ni `.workspace/`, ni `node_modules/`, ni `dist/`.
- [ ] `.env.production` ne contient **aucune** clé `service_role` (uniquement URL + clé anon/publishable).
- [ ] `.env.example` et `.env.production` sont bien suivis par git ; `.env` ne l'est pas.
- [ ] `package-lock.json` présent (CI en `npm ci`).
- [ ] `npm run typecheck` et `npm run build:pages` passent localement (facultatif mais recommandé).
- [ ] `public/robots.txt` et `.env.production` pointent la bonne URL (`https://assia123y.github.io/amo-scans-fr`).
- [ ] Le dépôt GitHub a la bonne visibilité (**Public** pour Pages gratuit) et Pages est réglé sur **GitHub Actions**.
- [ ] Les migrations Supabase sont appliquées sur le projet utilisé par la clé anon (sinon le site s'affiche mais reste vide / en erreur).

## H. Après le déploiement

- [ ] La page d'accueil se charge et liste les séries publiées.
- [ ] Un deep link (`/series/<slug>`) fonctionne après rechargement (sert `404.html`).
- [ ] `/robots.txt` et `/sitemap.xml` répondent correctement.
- [ ] Une image de planche s'affiche (bucket `manhwa` public, policies storage OK).
- [ ] Le premier compte créé peut accéder à `/admin` (rôle `admin` + `author`).
- [ ] Ajouter le site à **Google Search Console** et soumettre le sitemap.
- [ ] Activer **Dependabot alerts** et **Secret scanning / Push protection** (Settings → Code security and analysis).
