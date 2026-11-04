# DEPLOY â€” AMO-SCANS-FR

ProcÃ©dure pas Ã  pas pour publier le site sur **GitHub Pages** (cible par dÃ©faut), puis â€” en option â€” sur **Cloudflare Workers** (SSR).

| Ã‰lÃ©ment                | Valeur                                      |
| ---------------------- | ------------------------------------------- |
| Compte GitHub          | `Assia123y`                                 |
| DÃ©pÃ´t                  | `Manhwas-amo`                              |
| Branche de dÃ©ploiement | `main` (ou `master`)                        |
| URL du site            | <https://assia123y.github.io/Manhwas-amo/> |
| Base path              | `/Manhwas-amo/`                            |
| Build utilisÃ©          | `npm run build:pages` â†’ `dist/client`       |
| Workflow               | `.github/workflows/deploy-pages.yml`        |
| CI (contrÃ´le)          | `.github/workflows/ci.yml`                  |

Rappels de vocabulaire :

- **base path** : prÃ©fixe d'URL sous lequel le site est servi. Un dÃ©pÃ´t GitHub Pages Â« projet Â» (`<user>/<repo>`) est servi sous `/<repo>/` ; un dÃ©pÃ´t `<user>.github.io` ou un domaine personnalisÃ© est servi Ã  `/`.
- les variables `VITE_*` sont **inlinÃ©es au build** : changer la base ou l'URL du site impose de **rebuilder**.

---

## A.0 PrÃ©flight â€” (re)crÃ©er le projet Supabase (OBLIGATOIRE)

âš ï¸ **Le projet Supabase d'origine (`yvjmuaofgxjibflbzybz`) ne rÃ©sout plus en DNS** : le
sous-domaine `yvjmuaofgxjibflbzybz.supabase.co` n'existe pas (projet suspendu ou supprimÃ©,
vÃ©rifiÃ© le 2026-11-03). Tant qu'il n'est pas recrÃ©Ã©, le site se dÃ©ploie mais reste vide :
toutes les lectures de donnÃ©es et l'authentification Ã©chouent (`ENOTFOUND`).

1. CrÃ©er un projet sur <https://supabase.com/dashboard> (plan gratuit suffisant).
2. Relever **Project URL** et la clÃ© **anon/publishable** (Settings â†’ API).
3. Appliquer le schÃ©ma : ouvrir **SQL Editor â†’ New query**, coller tout le contenu de
   [`supabase/setup-all.sql`](supabase/setup-all.sql) et cliquer **Run**
   (Â« Success. No rows returned Â»). Alternative : `supabase link --project-ref <ref>` puis
   `supabase db push` (applique les mÃªmes migrations, une par une).
4. Mettre Ã  jour `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` (et les variantes `VITE_*`)
   dans `.env.production`, puis rebuilder.
5. CrÃ©er le premier compte via `/auth` : il reÃ§oit automatiquement les rÃ´les `admin` + `author`.
6. **Authentification â€” URL Configuration** : Site URL = `https://assia123y.github.io/Manhwas-amo`,
   Redirect URLs = `â€¦/auth` (production) et `http://localhost:8080/auth` (local).
7. **(Optionnel) Connexion Google** : Authentication â†’ Providers â†’ Google â†’ activer, renseigner
   le Client ID / Secret crÃ©Ã©s dans Google Cloud Console, et ajouter
   `https://<project-ref>.supabase.co/auth/v1/callback` aux URI de redirection autorisÃ©s cÃ´tÃ© Google.
   Sans cette Ã©tape, le bouton Â« Continue with Google Â» affiche un message explicite invitant Ã 
   utiliser e-mail + mot de passe. Le broker OAuth de Lovable (`/~oauth/initiate`) n'existe pas sur
   un hÃ©bergement statique : c'est pourquoi l'application utilise dÃ©sormais l'OAuth Supabase natif.

---

## A. CrÃ©er le dÃ©pÃ´t et pousser le code

### A.1 CrÃ©er le dÃ©pÃ´t sur GitHub

1. Aller sur <https://github.com/new>.
2. **Owner** : `Assia123y` ; **Repository name** : `Manhwas-amo`.
3. VisibilitÃ© : **Public** (GitHub Pages gratuit pour un dÃ©pÃ´t public ; un dÃ©pÃ´t privÃ© nÃ©cessite un plan payant pour publier Pages).
4. **Ne rien initialiser** (pas de README, pas de `.gitignore`, pas de licence) : le dÃ©pÃ´t contient dÃ©jÃ  ces fichiers et un dÃ©pÃ´t prÃ©-initialisÃ© provoquerait un conflit au premier push.
5. Cliquer sur **Create repository**.

### A.2 VÃ©rifier ce qui va Ãªtre poussÃ© (sÃ©curitÃ©)

Avant le premier commit, s'assurer que les secrets ne partent pas :

```bash
git status --short
git ls-files | grep -E '(^|/)\.env$|\.env\.local$|^\.workspace/'   # doit Ãªtre vide
```

Fichiers **Ã  ne jamais committer** : `.env`, `.env.local`, `.env.*.local`, `.workspace/` (jeton Lovable). Ils sont dÃ©jÃ  couverts par `.gitignore`.

Fichiers **volontairement committÃ©s** : `.env.example` (modÃ¨le) et `.env.production` (**valeurs publiques uniquement** : URL Supabase + clÃ© anon/publishable + configuration SEO).

### A.3 Initialiser git et pousser

```bash
# Ã  la racine du projet (lÃ  oÃ¹ se trouve package.json)
git init -b main
git add -A
git commit -m "chore: initial commit â€” AMO-SCANS-FR (TanStack Start + Supabase)"
git remote add origin https://github.com/Assia123y/Manhwas-amo.git
git push -u origin main
```

Variantes / piÃ¨ges :

- **authentification** : GitHub n'accepte plus les mots de passe. Utiliser un **Personal Access Token** (`repo` scope, Ã  saisir comme mot de passe) ou le **GitHub CLI** (`gh auth login`) / une clÃ© SSH (`git@github.com:Assia123y/Manhwas-amo.git`).
- **branche** : si votre branche locale s'appelle `master`, soit pousser `master` (`git push -u origin master`), soit la renommer (`git branch -M main`). Les workflows acceptent `main` **et** `master`.
- **Windows** : git peut normaliser les fins de ligne. Si un diff massif apparaÃ®t sur les fichiers texte, ajouter un `.gitattributes` (`* text=auto eol=lf`) â€” non fourni actuellement.
- **`node_modules`, `dist`, `.wrangler`, `.tanstack`** ne doivent pas apparaÃ®tre dans l'index (vÃ©rifier avec `git status`).

---

## B. Activer GitHub Pages (source = GitHub Actions)

1. Ouvrir le dÃ©pÃ´t â†’ **Settings** (onglet du dÃ©pÃ´t).
2. Menu de gauche â†’ **Pages**.
3. Section **Build and deployment** â†’ **Source** : choisir **GitHub Actions**.
   - âš ï¸ Ne **pas** choisir Â« Deploy from a branch Â» : le site est un artefact de build (`dist/client`), pas un dossier versionnÃ©.
   - Aucun dossier `/docs` n'est utilisÃ©.
4. La section Â« GitHub Actions Â» affiche les workflows disponibles ; celui du dÃ©pÃ´t est `Deploy to GitHub Pages`.

Le workflow `.github/workflows/deploy-pages.yml` fait :

1. `actions/checkout` puis **Node 22** avec cache npm ;
2. calcul du **base path** et de l'URL du site Ã  partir du nom du dÃ©pÃ´t :
   - `Manhwas-amo` â†’ `VITE_BASE_PATH=/Manhwas-amo/`, `VITE_SITE_URL=https://<owner>.github.io/Manhwas-amo` ;
   - `<owner>.github.io` â†’ `/` ;
3. `npm ci` ;
4. `npm run typecheck` (bloquant) ;
5. `npm run build:pages` â†’ `dist/client` ;
6. `actions/upload-pages-artifact` (dossier `dist/client`) ;
7. dÃ©ploiement avec `actions/deploy-pages` (environnement `github-pages`).

**Aucun secret GitHub n'est nÃ©cessaire.** Les seules valeurs Supabase utilisÃ©es sont publiques (clÃ© anon/publishable).

---

## C. Premier dÃ©ploiement : vÃ©rifier

1. Onglet **Actions** â†’ workflow **Deploy to GitHub Pages** â†’ le run se dÃ©clenche au push (sinon **Run workflow**).
2. Attendre la fin des deux jobs : `Build static site` puis `Deploy`.
3. Ouvrir <https://assia123y.github.io/Manhwas-amo/>.
   - Un premier dÃ©ploiement peut prendre **1 Ã  5 minutes** (propagation Pages).
   - Page blanche au premier essai : vider le cache / forcer le rafraÃ®chissement (`Ctrl+F5`), puis rÃ©essayer.
4. VÃ©rifier la prÃ©sence de `index.html`, `404.html`, `.nojekyll`, `sitemap.xml` et `robots.txt` dans l'artefact dÃ©ployÃ© (l'Ã©tape `Verify build output` de la CI fait exactement ce contrÃ´le).
5. VÃ©rifier l'URL du sitemap : <https://assia123y.github.io/Manhwas-amo/sitemap.xml>.

DÃ©ploiements suivants : chaque push sur `main`/`master` redÃ©ploie automatiquement. Les pull requests ne dÃ©ploient pas (mais la CI les vÃ©rifie).

---

## D. DÃ©pannage 404 / page blanche

| SymptÃ´me                                                       | Cause                                                                                                                    | Correctif                                                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **404 Â« There isn't a GitHub Pages site here Â»** sur la racine | Pages non activÃ©, ou source encore sur Â« Deploy from a branch Â»                                                          | Settings â†’ Pages â†’ Source = **GitHub Actions**, puis relancer le workflow.                                                                      |
| Workflow vert mais **404**                                     | L'artefact dÃ©ployÃ© ne contient pas `index.html` Ã  sa racine (mauvais chemin d'upload)                                    | VÃ©rifier que `upload-pages-artifact` pointe `path: dist/client` (et non `dist`).                                                                |
| **404 sur un deep link** (`/series/xxx`) aprÃ¨s rechargement    | Comportement attendu de GitHub Pages : il n'y a pas de rewrite SPA ; le site sert `404.html` (qui **est** l'application) | VÃ©rifier la prÃ©sence de `dist/client/404.html`. La navigation interne fonctionne, seul le status HTTP est 404.                                  |
| **Page blanche, console remplie de 404 sur `/assets/...`**     | Base path incohÃ©rent : build fait pour `/` mais site servi sous `/Manhwas-amo/` (ou l'inverse)                          | Rebuilder avec `VITE_BASE_PATH` correct. Le workflow le calcule automatiquement ; en local, exporter la variable avant `npm run build:pages`.   |
| **404 sur les images / polices**                               | MÃªme cause (base path) ou fichiers absents de `public/`                                                                  | VÃ©rifier `dist/client/assets`, `dist/client/favicon.svg`, `dist/client/og-image.jpg`.                                                           |
| **Page blanche sans erreur 404**                               | Erreur JS au dÃ©marrage, souvent variables Supabase absentes                                                              | Ouvrir la console ; vÃ©rifier `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` (`.env.production` ou variables du workflow).                  |
| **Le site affiche l'ancienne version**                         | Cache navigateur / CDN Pages                                                                                             | Attendre 1â€“2 min, `Ctrl+F5`, tester en navigation privÃ©e.                                                                                       |
| **Le dÃ©ploiement Ã©choue sur `npm run typecheck`**              | Erreur TypeScript                                                                                                        | Reproduire localement `npm ci && npm run typecheck`, corriger, repousser.                                                                       |
| **DÃ©pÃ´t renommÃ©**                                              | Le base path calculÃ© change automatiquement, mais `.env.production` et cette doc rÃ©fÃ©rencent encore l'ancien nom         | Mettre Ã  jour `.env.production` (`VITE_SITE_URL`, `VITE_BASE_PATH`) et l'URL dans `public/robots.txt`.                                          |
| **Domaine personnalisÃ©**                                       | Servi Ã  `/`, mais le workflow calcule `/<repo>/`                                                                         | Adapter `deploy-pages.yml` (forcer `VITE_BASE_PATH=/` et `VITE_SITE_URL=https://votre-domaine`), puis Settings â†’ Pages â†’ Custom domain + CNAME. |

### Variables et ordre de prioritÃ© (rappel)

1. environnement du workflow (`$GITHUB_ENV`) â€” **prioritaire** ;
2. `.env.production.local` / `.env.local` (non versionnÃ©s, absents en CI) ;
3. `.env.production` (versionnÃ©) ;
4. valeurs de repli codÃ©es dans `scripts/build-pages.mjs`.

---

## E. Rollback / redÃ©ploiement

- **RedÃ©ployer un commit antÃ©rieur** : `git revert <sha>` puis push (le workflow repart), ou onglet **Actions** â†’ run prÃ©cÃ©dent rÃ©ussi â†’ **Re-run jobs**.
- **RedÃ©ployer le dernier commit sans nouveau commit** : **Actions** â†’ `Deploy to GitHub Pages` â†’ **Run workflow**.
- En cas d'incident Pages : Settings â†’ Pages affiche le dernier dÃ©ploiement et permet de relancer.

---

## F. DÃ©ploiement Cloudflare Workers (optionnel)

La cible SSR remplace GitHub Pages uniquement si vous voulez du rendu serveur (route `/sitemap.xml` dynamique, en-tÃªtes serveur, edge Cloudflare). GitHub Pages reste la cible documentÃ©e par dÃ©faut.

### F.1 PrÃ©requis

- un compte Cloudflare avec **Workers** activÃ© ;
- Wrangler, dÃ©jÃ  installÃ© localement par les dÃ©pendances (`npx wrangler --version` â†’ 4.92.x) ;
- un token API : dashboard Cloudflare â†’ **My Profile â†’ API Tokens â†’ Create Token** (permissions `Workers Scripts:Edit`, `Account Settings:Read`).

### F.2 DÃ©ploiement manuel

```bash
# Authentification (une seule fois)
npx wrangler login
# ou, sans navigateur / en CI :
#   CLOUDFLARE_API_TOKEN=<token>
#   CLOUDFLARE_ACCOUNT_ID=<account-id>

# Build SSR (plugin Cloudflare actif, BUILD_TARGET non dÃ©fini)
npm run build

# Secrets runtime du Worker (jamais de secret dans le code)
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
# seulement si des server functions utilisent supabaseAdmin :
# npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# DÃ©ployer
npx wrangler deploy
```

- Nom du Worker : `Manhwas-amo` (`wrangler.jsonc`) ; URL `<worker>.<sous-domaine>.workers.dev`.
- `compatibility_date: 2025-09-24`, `compatibility_flags: ["nodejs_compat"]`, observabilitÃ© activÃ©e.
- Servi Ã  la racine (`https://<worker>.workers.dev/`) : `npm run build` utilise `base = "/"` par dÃ©faut, car `vite.config.ts` lit `process.env.VITE_BASE_PATH` (et **non** `.env.production`). N'exporter `VITE_BASE_PATH` que si vous visez un sous-chemin.
- Adapter `VITE_SITE_URL` Ã  l'URL finale du Worker pour les canonical / Open Graph / sitemap (export d'environnement avant `npm run build`).

### F.3 Workflow GitHub Actions (optionnel)

Si vous voulez dÃ©ployer le Worker depuis GitHub, ajouter un second workflow (ne pas modifier `deploy-pages.yml`) et deux **secrets** de dÃ©pÃ´t : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (Settings â†’ Secrets and variables â†’ Actions).

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
          VITE_SITE_URL: https://Manhwas-amo.<votre-sous-domaine>.workers.dev
      - name: Deploy
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

> Les valeurs Supabase publiques (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) sont lues depuis `.env.production` par Vite pendant `npm run build` : inutile de les redÃ©clarer en CI. Si vous les surchargez malgrÃ© tout, fournissez des valeurs **non vides** (une variable d'environnement vide Ã©craserait celle de `.env.production`).

---

## G. Checklist avant le premier push

- [ ] `git status --short` ne montre ni `.env`, ni `.env.local`, ni `.workspace/`, ni `node_modules/`, ni `dist/`.
- [ ] `.env.production` ne contient **aucune** clÃ© `service_role` (uniquement URL + clÃ© anon/publishable).
- [ ] `.env.example` et `.env.production` sont bien suivis par git ; `.env` ne l'est pas.
- [ ] `package-lock.json` prÃ©sent (CI en `npm ci`).
- [ ] `npm run typecheck` et `npm run build:pages` passent localement (facultatif mais recommandÃ©).
- [ ] `public/robots.txt` et `.env.production` pointent la bonne URL (`https://assia123y.github.io/Manhwas-amo`).
- [ ] Le dÃ©pÃ´t GitHub a la bonne visibilitÃ© (**Public** pour Pages gratuit) et Pages est rÃ©glÃ© sur **GitHub Actions**.
- [ ] Les migrations Supabase sont appliquÃ©es sur le projet utilisÃ© par la clÃ© anon (sinon le site s'affiche mais reste vide / en erreur).

## H. AprÃ¨s le dÃ©ploiement

- [ ] La page d'accueil se charge et liste les sÃ©ries publiÃ©es.
- [ ] Un deep link (`/series/<slug>`) fonctionne aprÃ¨s rechargement (sert `404.html`).
- [ ] `/robots.txt` et `/sitemap.xml` rÃ©pondent correctement.
- [ ] Une image de planche s'affiche (bucket `manhwa` public, policies storage OK).
- [ ] Le premier compte crÃ©Ã© peut accÃ©der Ã  `/admin` (rÃ´le `admin` + `author`).
- [ ] Ajouter le site Ã  **Google Search Console** et soumettre le sitemap.
- [ ] Activer **Dependabot alerts** et **Secret scanning / Push protection** (Settings â†’ Code security and analysis).
