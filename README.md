# AMO-SCANS-FR

Plateforme de lecture de manhwa originaux, en **lecture verticale** : catalogue de sÃ©ries, lecteur plein Ã©cran, commentaires par Ã©pisode et back-office d'Ã©dition (sÃ©ries, chapitres, planches hÃ©bergÃ©es sur Supabase Storage).

|                         |                                                                            |
| ----------------------- | -------------------------------------------------------------------------- |
| **Site (GitHub Pages)** | <https://assia123y.github.io/Manhwas-amo/>                                |
| **DÃ©pÃ´t**               | `Assia123y/Manhwas-amo`                                                   |
| **Nature**              | application web SSR/SPA â€” donnÃ©es et authentification Supabase             |
| **Interface**           | anglais, thÃ¨me sombre (contenus FR/EN libres)                              |
| **Licence**             | aucune licence dÃ©clarÃ©e Ã  ce jour (voir [Licence](#18-licence-et-crÃ©dits)) |

[![CI](https://github.com/Assia123y/Manhwas-amo/actions/workflows/ci.yml/badge.svg)](https://github.com/Assia123y/Manhwas-amo/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/Assia123y/Manhwas-amo/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/Assia123y/Manhwas-amo/actions/workflows/deploy-pages.yml)

> ðŸ“‹ **Audit du code initial et journal des corrections** : [AUDIT.md](AUDIT.md)
> âš ï¸ **Backend** : le projet Supabase d'origine ne rÃ©sout plus en DNS â€” voir [DEPLOY.md Â§A.0](DEPLOY.md#a0-prÃ©flight-recrÃ©er-le-projet-supabase-obligatoire) avant le premier dÃ©ploiement.

---

## Sommaire

- [1. PrÃ©sentation](#1-prÃ©sentation)
- [2. Stack technique](#2-stack-technique)
- [3. FonctionnalitÃ©s](#3-fonctionnalitÃ©s)
- [4. Arborescence du dÃ©pÃ´t](#4-arborescence-du-dÃ©pÃ´t)
- [5. PrÃ©requis](#5-prÃ©requis)
- [6. Installation locale](#6-installation-locale)
- [7. Variables d'environnement](#7-variables-denvironnement)
- [8. Scripts npm](#8-scripts-npm)
- [9. Base de donnÃ©es Supabase](#9-base-de-donnÃ©es-supabase)
- [10. Authentification et rÃ´les](#10-authentification-et-rÃ´les)
- [11. Les deux cibles de build](#11-les-deux-cibles-de-build)
- [12. DÃ©ploiement GitHub Pages](#12-dÃ©ploiement-github-pages)
- [13. DÃ©ploiement Cloudflare Workers (optionnel)](#13-dÃ©ploiement-cloudflare-workers-optionnel)
- [14. SEO et assets publics](#14-seo-et-assets-publics)
- [15. SÃ©curitÃ©](#15-sÃ©curitÃ©)
- [16. DÃ©pannage](#16-dÃ©pannage)
- [17. Roadmap](#17-roadmap)
- [18. Licence et crÃ©dits](#18-licence-et-crÃ©dits)

---

## 1. PrÃ©sentation

**AMO-SCANS-FR** publie et diffuse ses propres manhwa (webcomics corÃ©ens) en dark fantasy cinÃ©matographique. L'application est le lecteur officiel du studio :

- une **bibliothÃ¨que** de sÃ©ries publiÃ©es, avec une sÃ©rie Â« Ã  la une Â» et les derniÃ¨res sorties ;
- une **fiche sÃ©rie** (synopsis, statut, tags, liste des chapitres) ;
- un **lecteur vertical** oÃ¹ les planches dÃ©filent en pleine largeur ;
- des **commentaires** par Ã©pisode, rÃ©servÃ©s aux comptes connectÃ©s ;
- un **espace d'administration** pour publier sÃ©ries, chapitres et planches (upload direct dans Supabase Storage).

Le dÃ©pÃ´t contient **deux cibles de build** Ã  partir du mÃªme code :

1. `npm run build` â†’ application **SSR** dÃ©ployable sur **Cloudflare Workers** (`src/server.ts`, `wrangler.jsonc`) ;
2. `npm run build:pages` â†’ build **statique (SPA)** pour **GitHub Pages**, produisant `dist/client` (cible du dÃ©pÃ´t actuel).

---

## 2. Stack technique

| Domaine                  | Technologie                                                            | Version (package.json)    |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------- |
| Framework                | [TanStack Start](https://tanstack.com/start) (SSR + routing fichiers)  | `^1.167.50`               |
| Routage                  | [TanStack Router](https://tanstack.com/router)                         | `^1.168.25`               |
| UI                       | React / React DOM                                                      | `^19.2.0`                 |
| Langage                  | TypeScript (strict, `tsc --noEmit`)                                    | `^5.8.3`                  |
| Build                    | Vite                                                                   | `^7.3.1`                  |
| Styles                   | Tailwind CSS v4 (`@tailwindcss/vite`) + `tw-animate-css`               | `^4.2.1`                  |
| Composants               | shadcn/ui (style `new-york`) sur Radix UI, icÃ´nes Lucide               | â€”                         |
| DonnÃ©es client           | TanStack Query                                                         | `^5.83.0`                 |
| Backend                  | Supabase : PostgreSQL, Auth, Storage (`@supabase/supabase-js`)         | `^2.105.4`                |
| DÃ©ploiement edge         | `@cloudflare/vite-plugin` + Wrangler                                   | `^1.25.5` (Wrangler 4.92) |
| QualitÃ©                  | ESLint 9 (flat config) + Prettier 3                                    | `^9.32.0` / `^3.7.3`      |
| Formulaires / validation | react-hook-form + zod                                                  | `^7.71.2` / `^3.24.2`     |
| Divers                   | sonner (toasts), date-fns, embla (carrousel), recharts, vaul (drawers) | â€”                         |

Contraintes de config remarquables :

- **alias `@/*` â†’ `src/*`** (`tsconfig.json` + `vite-tsconfig-paths`) ;
- `vite.config.ts` s'appuie sur `@lovable.dev/vite-tanstack-config`, qui ajoute Tailwind, le plugin React, TanStack Start, et â€” **uniquement au build** â€” le plugin Cloudflare ;
- le **mode SPA** de TanStack Start n'est activÃ© que si `BUILD_TARGET=pages` (posÃ© par `scripts/build-pages.mjs`).

---

## 3. FonctionnalitÃ©s

### CÃ´tÃ© lecteur

- **BibliothÃ¨que** : sÃ©ries publiÃ©es uniquement (les brouillons ne fuient jamais), Ã  la une, derniÃ¨res sorties inter-sÃ©ries.
- **Recherche instantanÃ©e** dans le catalogue (titre, genre, tags) avec Ã©tat vide et compteur.
- **Fiche sÃ©rie** : synopsis, statut (`ongoing` / `completed` / `hiatus`), tags, nombre de chapitres, tri des chapitres, lien Â« continuer la lecture Â» mÃ©morisÃ© dans `localStorage`.
- **Lecteur vertical** : planches empilÃ©es pleine largeur, chapitre prÃ©cÃ©dent / suivant, sÃ©lecteur de chapitre, progression de lecture, raccourcis clavier `â†` / `â†’`, retour en haut, mÃ©morisation du dernier chapitre lu.
- **Commentaires** par Ã©pisode (clÃ© : slug de sÃ©rie + numÃ©ro de chapitre), rÃ©servÃ©s aux utilisateurs connectÃ©s, profils affichÃ©s depuis `public.profiles`.
- **Planning des sorties** dÃ©rivÃ© des vraies publications, page **Ã€ propos**, pied de page complet.
- ThÃ¨me sombre, responsive mobile-first, accessibilitÃ© (labels, focus visibles, `aria-*`).

### CÃ´tÃ© administration (rÃ´les `author` / `admin`)

- Tableau de bord des sÃ©ries avec recherche, compteurs et filtres publiÃ© / brouillon.
- CrÃ©ation et Ã©dition de sÃ©rie : slug, titre, genre, synopsis, tags, statut, `published`, `featured`, visuel de couverture et banniÃ¨re.
- Gestion des chapitres : crÃ©ation numÃ©rotÃ©e, publication, renommage, suppression sÃ©curisÃ©e (`AlertDialog`).
- Upload **multiple** de planches dans le bucket `manhwa` (progression, ordre, dimensions enregistrÃ©es) et rÃ©ordonnancement.
- Gardes d'accÃ¨s explicites : rÃ´le vÃ©rifiÃ© cÃ´tÃ© UI **et** politiques RLS cÃ´tÃ© base.

### Technique / SEO

- MÃ©tadonnÃ©es par page (`buildPageMeta` : canonical, Open Graph, Twitter Card), `noindex` sur `/admin` et `/auth`, JSON-LD.
- `robots.txt`, `sitemap.xml` gÃ©nÃ©rÃ© au build (Pages) ou route serveur `/sitemap.xml` (SSR).
- `favicon.svg`, icÃ´nes PNG, `site.webmanifest`, image de partage `og-image.jpg` (1200Ã—630, 143 Ko).

---

## 4. Arborescence du dÃ©pÃ´t

```text
Manhwas-amo/
â”œâ”€â”€ .github/workflows/
â”‚   â”œâ”€â”€ ci.yml                     # typecheck + build:pages (push / PR)
â”‚   â””â”€â”€ deploy-pages.yml           # build + publication GitHub Pages
â”œâ”€â”€ public/                        # servi tel quel Ã  la racine du site
â”‚   â”œâ”€â”€ favicon.svg                # monogramme "A" (sombre + accent)
â”‚   â”œâ”€â”€ icon-192.png
â”‚   â”œâ”€â”€ icon-512.png
â”‚   â”œâ”€â”€ apple-touch-icon.png
â”‚   â”œâ”€â”€ site.webmanifest
â”‚   â”œâ”€â”€ og-image.jpg               # 1200Ã—630 (image de partage)
â”‚   â””â”€â”€ robots.txt
â”œâ”€â”€ scripts/
â”‚   â”œâ”€â”€ build-pages.mjs            # build statique SPA + post-traitement dist/client
â”‚   â””â”€â”€ serve-pages.mjs            # prÃ©visualisation fidÃ¨le de GitHub Pages
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ assets/                    # couvertures, visuel hero, planches de dÃ©mo
â”‚   â”œâ”€â”€ components/                # navigation, footer, commentaires, lecteur, cartesâ€¦
â”‚   â”‚   â””â”€â”€ ui/                    # composants shadcn/ui
â”‚   â”œâ”€â”€ hooks/use-auth.tsx         # contexte d'authentification + rÃ´les
â”‚   â”œâ”€â”€ integrations/
â”‚   â”‚   â”œâ”€â”€ supabase/              # client navigateur (RLS), client admin serveur, types gÃ©nÃ©rÃ©s
â”‚   â”‚   â””â”€â”€ lovable/               # OAuth Google via Lovable Cloud
â”‚   â”œâ”€â”€ lib/                       # queries.ts (accÃ¨s donnÃ©es), seo.ts, utils, pages d'erreur
â”‚   â”œâ”€â”€ routes/                    # routes TanStack Router (fichiers)
â”‚   â”‚   â”œâ”€â”€ __root.tsx             # shell HTML, providers, mÃ©tadonnÃ©es globales
â”‚   â”‚   â”œâ”€â”€ index.tsx              # accueil / bibliothÃ¨que
â”‚   â”‚   â”œâ”€â”€ series.$slug.tsx       # fiche sÃ©rie
â”‚   â”‚   â”œâ”€â”€ read.$slug.$ep.tsx     # lecteur
â”‚   â”‚   â”œâ”€â”€ schedule.tsx, about.tsx
â”‚   â”‚   â”œâ”€â”€ auth.tsx               # connexion / inscription
â”‚   â”‚   â”œâ”€â”€ admin*.tsx             # back-office (layout + 3 Ã©crans)
â”‚   â”‚   â”œâ”€â”€ sitemap[.]xml.ts       # sitemap dynamique (cible SSR)
â”‚   â”‚   â””â”€â”€ routeTree.gen.ts       # gÃ©nÃ©rÃ© par le router plugin
â”‚   â”œâ”€â”€ router.tsx                 # crÃ©ation du routeur (base path via import.meta.env.BASE_URL)
â”‚   â”œâ”€â”€ server.ts                  # entrÃ©e Worker Cloudflare (wrapper d'erreurs SSR)
â”‚   â”œâ”€â”€ start.ts                   # instance TanStack Start + middleware d'erreur
â”‚   â””â”€â”€ styles.css                 # thÃ¨me Tailwind v4 (tokens sombres)
â”œâ”€â”€ supabase/
â”‚   â”œâ”€â”€ config.toml                # project_id
â”‚   â””â”€â”€ migrations/                # 7 migrations SQL (schÃ©ma, RLS, storage, triggers)
â”œâ”€â”€ .env.example                   # modÃ¨le d'environnement (committÃ©)
â”œâ”€â”€ .env.production                # valeurs publiques + SEO Pages (committÃ©)
â”œâ”€â”€ DEPLOY.md                      # procÃ©dure de dÃ©ploiement pas Ã  pas
â”œâ”€â”€ SECURITY.md                    # secrets, rotation, RLS, signalement
â”œâ”€â”€ components.json                # config shadcn/ui
â”œâ”€â”€ eslint.config.js, .prettierrc
â”œâ”€â”€ package.json / package-lock.json
â”œâ”€â”€ tsconfig.json
â”œâ”€â”€ vite.config.ts
â””â”€â”€ wrangler.jsonc                 # Worker Cloudflare (nom, date de compatibilitÃ©)
```

> `src/lib/manhwa-data.ts` contient des donnÃ©es de dÃ©monstration historiques (couvertures/planches d'exemple) ; les routes s'appuient sur Supabase via `src/lib/queries.ts`.

---

## 5. PrÃ©requis

| Outil                               | Version      | Remarque                                           |
| ----------------------------------- | ------------ | -------------------------------------------------- |
| **Node.js**                         | **22 LTS**   | version utilisÃ©e par la CI et le workflow Pages    |
| **npm**                             | 10+          | le dÃ©pÃ´t fournit `package-lock.json` (lockfile v3) |
| Compte **Supabase**                 | projet actif | base PostgreSQL + Auth + Storage                   |
| Compte **GitHub**                   | â€”            | Pages activÃ© via GitHub Actions                    |
| _(optionnel)_ Compte **Cloudflare** | â€”            | uniquement pour la cible Workers SSR               |

Un `bun.lock` historique est Ã©galement prÃ©sent (Ã©chafaudage initial) ; **la rÃ©fÃ©rence est `package-lock.json`** et toutes les commandes de ce dÃ©pÃ´t utilisent **npm**.

---

## 6. Installation locale

```bash
# 1. Cloner
git clone https://github.com/Assia123y/Manhwas-amo.git
cd Manhwas-amo

# 2. Installer les dÃ©pendances exactes du lockfile
npm ci

# 3. CrÃ©er la configuration locale
#    Windows (PowerShell) :
copy .env.example .env
#    Linux / macOS :
# cp .env.example .env
```

Renseigner `.env` :

- soit les **valeurs publiques du projet officiel** (reprises de `.env.production`) ;
- soit **votre propre projet Supabase** (URL + clÃ© anon/publishable, puis appliquer les migrations â€” voir [Â§9](#9-base-de-donnÃ©es-supabase)).

```bash
# 4. DÃ©marrer le serveur de dÃ©veloppement
npm run dev
```

Le serveur de dÃ©veloppement Ã©coute sur **<http://localhost:8080>** (port par dÃ©faut de `@lovable.dev/vite-tanstack-config`, appliquÃ© aussi en sandbox).

VÃ©rifications utiles :

```bash
npm run typecheck     # TypeScript strict, aucune Ã©mission
npm run lint          # ESLint
npm run format:check  # Prettier
```

---

## 7. Variables d'environnement

Deux familles de variables, Ã  ne pas confondre :

- prÃ©fixe **`VITE_`** â†’ **inlinÃ©es dans le bundle client** au build (`import.meta.env.*`). **Aucun secret ici.**
- sans prÃ©fixe â†’ lues Ã  l'exÃ©cution **cÃ´tÃ© serveur** (`process.env.*`, SSR Cloudflare / scripts Node). Peuvent contenir des secrets.

### 7.1 Variables client (build-time)

| Variable                        | Requis | RÃ´le                                                                                                                                                                                                   |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`             | âœ…     | URL du projet Supabase (ex. `https://<ref>.supabase.co`).                                                                                                                                              |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | âœ…     | ClÃ© **anon / publishable**. Publique par conception ; c'est elle qui est embarquÃ©e dans le JS livrÃ© au navigateur, les droits rÃ©els Ã©tant fixÃ©s par les politiques RLS.                                |
| `VITE_SUPABASE_PROJECT_ID`      | âšª     | Identifiant du projet (informatif, issu de l'Ã©chafaudage Lovable).                                                                                                                                     |
| `VITE_SITE_URL`                 | âšª\*   | Origine publique absolue, **sans slash final** (ex. `https://assia123y.github.io/Manhwas-amo`). UtilisÃ©e par `src/lib/seo.ts` pour canonical / Open Graph / sitemap. Sans elle, fallback codÃ© en dur. |
| `VITE_BASE_PATH`                | âšª\*   | Sous-chemin servi, **avec slash de tÃªte et de queue** (ex. `/Manhwas-amo/`, ou `/`). ConsommÃ© par `vite.config.ts` (`base`) et le routeur (`import.meta.env.BASE_URL`).                               |

\* obligatoires en pratique pour un dÃ©ploiement GitHub Pages de projet : sans elles, assets et liens internes seraient servis Ã  la racine du domaine.

### 7.2 Variables serveur (runtime SSR / scripts)

| Variable                                        | Requis                    | RÃ´le                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                                  | âœ… (SSR)                  | MÃªme URL, lue par `src/integrations/supabase/client.server.ts`, `auth-middleware.ts` et la route sitemap dynamique.                                                                                                                                                                                                                                               |
| `SUPABASE_PUBLISHABLE_KEY`                      | âœ… (SSR)                  | MÃªme clÃ© anon, cÃ´tÃ© serveur.                                                                                                                                                                                                                                                                                                                                      |
| `SUPABASE_SERVICE_ROLE_KEY`                     | âš ï¸ **serveur uniquement** | Bypasse **toutes** les RLS. UtilisÃ©e exclusivement par `src/integrations/supabase/client.server.ts` (`supabaseAdmin`). **Ne jamais** la prÃ©fixer `VITE_`, ni la committer, ni l'exposer. Les Ã©crans actuels n'en ont pas besoin (l'admin passe par le client RLS + le JWT de session) : ne la provisionner que si des server functions utilisent `supabaseAdmin`. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | âšª                        | Uniquement pour `wrangler deploy` (voir Â§13). Jamais dans le code.                                                                                                                                                                                                                                                                                                |

### 7.3 Fichiers d'environnement du dÃ©pÃ´t

| Fichier                              | CommittÃ© | Contenu                                                                                                                                 |
| ------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.example`                       | âœ…       | ModÃ¨le documentÃ©, sans valeur rÃ©elle.                                                                                                   |
| `.env.production`                    | âœ…       | **Uniquement des valeurs publiques** : URL Supabase, clÃ© anon, `VITE_SITE_URL`, `VITE_BASE_PATH`. ChargÃ© par `scripts/build-pages.mjs`. |
| `.env`, `.env.local`, `.env.*.local` | âŒ       | Secrets locaux, ignorÃ©s par git.                                                                                                        |
| `.workspace/`                        | âŒ       | Environnement Lovable (contient un jeton d'accÃ¨s) â€” ignorÃ© par git.                                                                     |

PrioritÃ© de lecture dans `scripts/build-pages.mjs` : `.env.production.local` > `.env.production` > `.env.local` > `.env`, et **les variables dÃ©jÃ  prÃ©sentes dans l'environnement du shell / de la CI restent prioritaires** (c'est ainsi que le workflow Pages impose son `VITE_BASE_PATH`).

### 7.4 Configuration actuelle du site

```dotenv
VITE_SITE_URL="https://assia123y.github.io/Manhwas-amo"
VITE_BASE_PATH="/Manhwas-amo/"
```

> Changer de nom de dÃ©pÃ´t, passer sur un domaine personnalisÃ© ou dÃ©ployer Ã  la racine impose de mettre Ã  jour ces deux valeurs (et, pour un domaine custom, d'adapter `deploy-pages.yml` qui calcule la base Ã  partir du nom du dÃ©pÃ´t).

---

## 8. Scripts npm

| Script                  | Commande rÃ©elle                 | Description                                                                                                                                                                                                     |
| ----------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | `vite dev`                      | Serveur de dÃ©veloppement SSR (port **8080**).                                                                                                                                                                   |
| `npm run build`         | `vite build`                    | Build **SSR / Cloudflare Workers** (mode production, plugin Cloudflare actif).                                                                                                                                  |
| `npm run build:dev`     | `vite build --mode development` | Build SSR en mode dÃ©veloppement (debug).                                                                                                                                                                        |
| `npm run build:pages`   | `node scripts/build-pages.mjs`  | Build **statique SPA** pour GitHub Pages â†’ `dist/client` (voir Â§11.2).                                                                                                                                          |
| `npm run preview`       | `vite preview`                  | PrÃ©visualisation du dernier build Vite.                                                                                                                                                                         |
| `npm run preview:pages` | `node scripts/serve-pages.mjs`  | Sert `dist/client` en reproduisant GitHub Pages (404.html, base path). **Serveur sur <http://localhost:4173/>** ; exporter `VITE_BASE_PATH=/Manhwas-amo/` avant de lancer pour reproduire le sous-chemin rÃ©el. |
| `npm run typecheck`     | `tsc --noEmit`                  | VÃ©rification TypeScript stricte.                                                                                                                                                                                |
| `npm run lint`          | `eslint .`                      | Lint (TS, TSX, hooks React, rÃ¨gles Prettier).                                                                                                                                                                   |
| `npm run lint:fix`      | `eslint . --fix`                | Lint avec correction automatique.                                                                                                                                                                               |
| `npm run format`        | `prettier --write .`            | Formatage Prettier (sauf `dist`, lockfiles, `routeTree.gen.ts`).                                                                                                                                                |
| `npm run format:check`  | `prettier --check .`            | VÃ©rification de formatage sans Ã©criture.                                                                                                                                                                        |

---

## 9. Base de donnÃ©es Supabase

### 9.1 Appliquer les migrations

Les migrations sont dans `supabase/migrations/`, **Ã  appliquer dans l'ordre du nom de fichier**. Deux mÃ©thodes :

**A. Ã‰diteur SQL du dashboard (sans CLI)** â€” coller et exÃ©cuter chaque fichier `.sql` dans l'ordre :

| #   | Migration          | Contenu                                                                                                                  |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | `20260516184635_â€¦` | enum `app_role`, tables `profiles`, `user_roles`, `comments`, index, **RLS** et trigger de crÃ©ation de profil            |
| 2   | `20260516184647_â€¦` | `REVOKE EXECUTE` des fonctions internes (`has_role`, `handle_new_user`)                                                  |
| 3   | `20260516185222_â€¦` | tables `series`, `chapters`, `panels`, RLS complÃ¨tes, bucket Storage `manhwa` + politiques storage, trigger `updated_at` |
| 4   | `20260516185239_â€¦` | bucket passÃ© en privÃ© (empÃªche le listing public des objets)                                                             |
| 5   | `20260516185249_â€¦` | bucket repassÃ© **public** (les URL publiques `getPublicUrl` continuent de fonctionner)                                   |
| 6   | `20260516185320_â€¦` | `handle_new_user()` v2 : **le premier compte inscrit devient `admin` + `author`**, les suivants `reader`                 |
| 7   | `20260522185257_â€¦` | `GRANT EXECUTE` de `has_role(uuid, app_role)` Ã  `anon` et `authenticated` (nÃ©cessaire aux politiques RLS publiques)      |

**B. Supabase CLI** :

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push        # applique supabase/migrations dans l'ordre
```

### 9.2 SchÃ©ma des tables

| Table               | Colonnes principales                                                                                                                                                                                                                     | Notes                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.profiles`   | `id` (PK â†’ `auth.users`), `username` (unique), `display_name`, `avatar_url`, `created_at`                                                                                                                                                | 1 ligne par utilisateur, crÃ©Ã©e par trigger.                                                                                                              |
| `public.user_roles` | `id`, `user_id` (â†’ `auth.users`), `role` (`app_role`), `created_at`, `UNIQUE(user_id, role)`                                                                                                                                             | Source de vÃ©ritÃ© des droits.                                                                                                                             |
| `public.comments`   | `id`, `series_slug` (text), `episode` (int), `user_id` (â†’ `auth.users`), `content` (1â€“2000 car.), `created_at`                                                                                                                           | Index `(series_slug, episode, created_at DESC)`. Pas de relation PostgREST vers `profiles` : les profils sont chargÃ©s en second appel (`fetchComments`). |
| `public.series`     | `id`, `slug` (unique), `title`, `genre`, `synopsis`, `cover_url`, `hero_url`, `tags` (text[]), `status` (`ongoing` par dÃ©faut), `published` (bool, `false`), `featured` (bool), `author_id` (â†’ `auth.users`), `created_at`, `updated_at` | Index `(published, created_at DESC)`. `updated_at` maintenu par trigger.                                                                                 |
| `public.chapters`   | `id`, `series_id` (â†’ `series`, cascade), `number` (int), `title`, `published` (bool), `created_at`, `UNIQUE(series_id, number)`                                                                                                          | Index `(series_id, number)`.                                                                                                                             |
| `public.panels`     | `id`, `chapter_id` (â†’ `chapters`, cascade), `position` (int), `image_url` (not null), `width`, `height`, `created_at`                                                                                                                    | Index `(chapter_id, position)`.                                                                                                                          |

Types TypeScript gÃ©nÃ©rÃ©s : `src/integrations/supabase/types.ts`.

### 9.3 RLS â€” rÃ©sumÃ©

Toutes les tables publiques ont **RLS activÃ©e**. La fonction `public.has_role(_user_id, _role)` (`SECURITY DEFINER`) Ã©vite toute rÃ©cursion dans `user_roles`.

| Table                               | `SELECT`                                                             | `INSERT`                                                     | `UPDATE`                 | `DELETE`                  |
| ----------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------ | ------------------------- |
| `profiles`                          | tout le monde                                                        | propriÃ©taire (`auth.uid() = id`)                             | propriÃ©taire             | â€” (aucune politique)      |
| `user_roles`                        | propriÃ©taire **ou** admin                                            | admin                                                        | admin (`FOR ALL`)        | admin (`FOR ALL`)         |
| `comments`                          | tout le monde                                                        | utilisateur authentifiÃ©, `user_id = auth.uid()`              | propriÃ©taire             | propriÃ©taire **ou** admin |
| `series`                            | publiÃ©e **ou** auteur **ou** admin                                   | auteur (`author_id = auth.uid()`) avec rÃ´le `author`/`admin` | auteur **ou** admin      | auteur **ou** admin       |
| `chapters`                          | chapitre publiÃ© d'une sÃ©rie publiÃ©e **ou** auteur/admin de la sÃ©rie  | auteur/admin de la sÃ©rie (`FOR ALL`)                         | auteur/admin de la sÃ©rie | auteur/admin de la sÃ©rie  |
| `panels`                            | planches d'un chapitre+sÃ©rie publiÃ©s **ou** auteur/admin de la sÃ©rie | auteur/admin de la sÃ©rie (`FOR ALL`)                         | auteur/admin de la sÃ©rie | auteur/admin de la sÃ©rie  |
| `storage.objects` (bucket `manhwa`) | lecture publique                                                     | rÃ´le `author`/`admin` authentifiÃ©                            | propriÃ©taire de l'objet  | propriÃ©taire **ou** admin |

ConsÃ©quence : un brouillon (`published = false`) n'est jamais lisible par un visiteur anonyme ; la sÃ©curitÃ© ne dÃ©pend **pas** de l'UI.

### 9.4 Storage

- Bucket : **`manhwa`**, public en lecture (`getPublicUrl`), Ã©criture rÃ©servÃ©e aux rÃ´les `author`/`admin`.
- Arborescence des uploads (gÃ©rÃ©e par le back-office) : `<user_id>/<series_id>/covers/...`, `<user_id>/<series_id>/<chapter_id>/...`, avec `cache-control: 31536000` et `upsert: false`.
- `publicImageUrl()` (`src/lib/queries.ts`) accepte une URL absolue ou un chemin relatif au bucket.

### 9.5 AmorÃ§age administrateur

1. CrÃ©er le projet Supabase, appliquer les migrations.
2. S'inscrire **une premiÃ¨re fois** sur `/auth` : ce premier compte reÃ§oit automatiquement `reader` + `admin` + `author` (migration 6).
3. Les inscriptions suivantes sont `reader`. Pour promouvoir un utilisateur, ajouter une ligne dans `public.user_roles` (`admin`/`author`) depuis le dashboard ou un admin existant.

---

## 10. Authentification et rÃ´les

| Ã‰lÃ©ment          | ImplÃ©mentation                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fournisseur      | Supabase Auth (e-mail + mot de passe, mot de passe â‰¥ 8 caractÃ¨res)                                                                                                                                                                                                              |
| OAuth            | Google via `@lovable.dev/cloud-auth-js` (`src/integrations/lovable/index.ts`) â€” dÃ©pend de l'intÃ©gration Lovable Cloud ; sans elle, seule l'authentification e-mail fonctionne (ou adapter vers `supabase.auth.signInWithOAuth` avec le provider Google configurÃ© dans Supabase) |
| Contexte client  | `src/hooks/use-auth.tsx` : `user`, `session`, `roles`, `isAdmin`, `isAuthor`, `loading`, `rolesLoading`, `signOut`, `refreshRoles`                                                                                                                                              |
| RÃ´les            | `reader` (commente), `author` (gÃ¨re ses sÃ©ries/chapitres/planches), `admin` (gÃ¨re tout, y compris les rÃ´les)                                                                                                                                                                    |
| Protection       | gardes UI (`/admin` redirige vers `/auth`) **et** RLS en base ; `noindex` sur `/admin` et `/auth`                                                                                                                                                                               |
| Stockage session | `localStorage` (client navigateur), rafraÃ®chissement automatique du token                                                                                                                                                                                                       |

---

## 11. Les deux cibles de build

### 11.1 `npm run build` â€” SSR Cloudflare Workers

- `vite build` en mode production ; `@cloudflare/vite-plugin` construit le Worker dont l'entrÃ©e est `src/server.ts` (wrapper qui normalise les erreurs SSR catastrophiques et renvoie une page d'erreur de marque).
- IdentitÃ© du Worker : `wrangler.jsonc` (`name: "Manhwas-amo"`, `compatibility_date: 2025-09-24`, `nodejs_compat`, observabilitÃ© activÃ©e).
- Sortie : `dist/client` (assets) et `dist/server` (bundle serveur).
- DÃ©ploiement : voir Â§13.

### 11.2 `npm run build:pages` â€” statique GitHub Pages

`scripts/build-pages.mjs` :

1. charge les fichiers `.env*` (voir Â§7.3) et normalise `VITE_BASE_PATH` / `VITE_SITE_URL` ;
2. vide `dist/`, puis lance `vite build` avec `BUILD_TARGET=pages` â†’ plugin Cloudflare dÃ©sactivÃ©, **mode SPA** de TanStack Start, `base = VITE_BASE_PATH` ;
3. post-traite `dist/client` :
   - copie le shell SPA (`_shell.html`) en **`index.html`** et **`404.html`** (GitHub Pages n'a pas de rewrite SPA : les deep links retombent sur `404.html`, qui est l'application) ;
   - Ã©crit **`.nojekyll`** (Ã©vite que Jekyll n'ignore certains fichiers) ;
   - gÃ©nÃ¨re **`sitemap.xml`** (routes statiques + sÃ©ries/chapitres publiÃ©s rÃ©cupÃ©rÃ©s via l'API REST Supabase, avec repli sur les seules routes statiques si Supabase est injoignable) ;
   - rÃ©Ã©crit **`robots.txt`** avec la ligne `Sitemap:` absolue.

RÃ©sultat dans `dist/client/` : `index.html`, `404.html`, `.nojekyll`, `sitemap.xml`, `robots.txt`, `favicon.svg`, `site.webmanifest`, `og-image.*`, `assets/*.js|css`.

```bash
npm run build:pages   # build (base /Manhwas-amo/ lue dans .env.production)

# prÃ©visualisation : aligner le base path du serveur sur celui du build
# Windows PowerShell :
$env:VITE_BASE_PATH="/Manhwas-amo/"; npm run preview:pages
# Linux / macOS :
# VITE_BASE_PATH=/Manhwas-amo/ npm run preview:pages
# â†’ http://localhost:4173/Manhwas-amo/
```

> `preview:pages` sert les fichiers sous le base path actif et renvoie `404.html` (status 404) pour les chemins sans extension, exactement comme GitHub Pages. Sans `VITE_BASE_PATH`, il sert Ã  la racine (`http://localhost:4173/`) et les assets du build sous-chemin renvoient 404.

---

## 12. DÃ©ploiement GitHub Pages

ProcÃ©dure dÃ©taillÃ©e, checklist et dÃ©pannage : **[DEPLOY.md](DEPLOY.md)**.

En rÃ©sumÃ© :

1. le dÃ©pÃ´t GitHub `Assia123y/Manhwas-amo` hÃ©berge le code ;
2. `.github/workflows/deploy-pages.yml` construit l'artefact Ã  chaque push sur `main`/`master` ;
3. le workflow **calcule automatiquement** le base path Ã  partir du nom du dÃ©pÃ´t :
   - dÃ©pÃ´t `Manhwas-amo` â†’ `VITE_BASE_PATH=/Manhwas-amo/`, `VITE_SITE_URL=https://<owner>.github.io/Manhwas-amo` ;
   - dÃ©pÃ´t `<owner>.github.io` â†’ `/` ;
4. dans **Settings â†’ Pages â†’ Build and deployment â†’ Source**, choisir **GitHub Actions** ;
5. site publiÃ© sur <https://assia123y.github.io/Manhwas-amo/>.

Aucun secret GitHub n'est nÃ©cessaire : la clÃ© Supabase utilisÃ©e est la clÃ© **anon/publishable** (publique).

Le workflow **CI** (`.github/workflows/ci.yml`) vÃ©rifie Ã  chaque push et pull request : `npm run typecheck`, puis `npm run build:pages` (base `/`, prÃ©sence des artefacts de build contrÃ´lÃ©e, aucun secret requis).

---

## 13. DÃ©ploiement Cloudflare Workers (optionnel)

La cible SSR n'est pas nÃ©cessaire pour GitHub Pages, mais permet le rendu serveur, la route `/sitemap.xml` dynamique et l'edge Cloudflare.

```bash
# 1. Authentifier Wrangler
npx wrangler login
# ou, en CI : CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID dans l'environnement

# 2. Construire le bundle SSR
npm run build

# 3. Provisionner les variables serveur (secrets du Worker)
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
# uniquement si des server functions utilisent supabaseAdmin :
# npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# 4. DÃ©ployer
npx wrangler deploy
```

Notes :

- Le nom du Worker vient de `wrangler.jsonc` (`Manhwas-amo`). Pour dÃ©ployer Ã  la racine d'un domaine, `VITE_BASE_PATH` doit valoir `/` **au moment du build** (les variables `VITE_*` sont inlinÃ©es : tout changement impose un rebuild).
- `SUPABASE_SERVICE_ROLE_KEY` ne doit **jamais** Ãªtre mise dans `wrangler.jsonc` ni dans une variable `VITE_*` : uniquement un secret Wrangler.
- Un workflow GitHub Actions de dÃ©ploiement Cloudflare (avec `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` en secrets) est dÃ©crit dans [DEPLOY.md](DEPLOY.md#f-dÃ©ploiement-cloudflare-workers-optionnel).

---

## 14. SEO et assets publics

| Ã‰lÃ©ment              | Fichier / mÃ©canisme                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MÃ©tadonnÃ©es par page | `src/lib/seo.ts` â€” `buildPageMeta()` (title, description, canonical, Open Graph, Twitter, `noindex`), `absoluteUrl()`.                                                                                   |
| Origine canonique    | `VITE_SITE_URL` (sinon fallback codÃ© en dur dans `seo.ts`).                                                                                                                                              |
| Image de partage     | `public/og-image.jpg` (1200Ã—630, ~143 Ko) â€” image par dÃ©faut de `buildPageMeta()` dans `seo.ts`.                                                                                                         |
| `robots.txt`         | Autorise `/`, interdit `/admin` et `/auth`, pointe le sitemap absolu ; rÃ©Ã©crit dans `dist/client` au build Pages.                                                                                        |
| `sitemap.xml`        | GÃ©nÃ©rÃ© par `scripts/build-pages.mjs` (Pages) ; route serveur `src/routes/sitemap[.]xml.ts` pour le SSR (URLs absolues via `SITE_URL`).                                                                   |
| Favicon / PWA        | `public/favicon.svg` (monogramme Â« A Â» sombre/accent), `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `public/site.webmanifest` (`start_url: "./"` â†’ compatible avec n'importe quel base path). |
| ThÃ¨me                | `#0b0b0f` (`theme-color`, manifest, fond du site).                                                                                                                                                       |

---

## 15. SÃ©curitÃ©

Voir **[SECURITY.md](SECURITY.md)** pour le dÃ©tail. Points essentiels :

- **la clÃ© anon/publishable est publique** (elle est dans le bundle client) : la sÃ©curitÃ© repose sur les **politiques RLS**, jamais sur le secret de cette clÃ© ;
- la clÃ© **`service_role` n'est jamais committÃ©e ni exposÃ©e au client** ; elle ne doit vivre que dans un secret serveur (`wrangler secret` / dashboard Supabase) ;
- `.env`, `.env.local` et `.workspace/` (jeton Lovable) sont **ignorÃ©s par git** (`.gitignore`) ;
- `dist/`, `node_modules/`, `.wrangler/`, `.tanstack/` ne sont pas versionnÃ©s ;
- l'Ã©criture Storage est restreinte aux rÃ´les `author`/`admin`, la suppression au propriÃ©taire ou Ã  un admin ;
- signaler une vulnÃ©rabilitÃ© via un **GitHub Security Advisory privÃ©** (voir SECURITY.md), pas en issue publique.

---

## 16. DÃ©pannage

| SymptÃ´me                                       | Cause probable                                                                                  | Correctif                                                                                                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page blanche / assets en 404 sur GitHub Pages  | `VITE_BASE_PATH` incohÃ©rent avec le sous-chemin servi                                           | VÃ©rifier que le build vaut `/<nom-du-dÃ©pÃ´t>/` ; ne pas rÃ©utiliser un build local fait avec `VITE_BASE_PATH=/`.                                                                        |
| 404 en rechargeant `/series/...`               | Attendu sur GitHub Pages : `404.html` = shell SPA                                               | VÃ©rifier que `dist/client/404.html` existe ; la navigation interne (client-side) fonctionne normalement.                                                                              |
| `Missing Supabase environment variable(s)`     | `.env` absent/incomplet, ou build sans `.env.production`                                        | Renseigner `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`, rebuilder.                                                                                                          |
| Les planches / couvertures ne s'affichent pas  | Bucket `manhwa` non public ou politiques storage absentes                                       | VÃ©rifier `storage.buckets.public = true` et les politiques de `storage.objects` (migrations 3 Ã  5).                                                                                   |
| Utilisateur sans accÃ¨s admin                   | Son compte n'a pas le rÃ´le                                                                      | Ajouter `admin`/`author` dans `public.user_roles`. Le tout premier compte reÃ§oit ces rÃ´les automatiquement.                                                                           |
| `npm run build:pages` : Â« vite not installed Â» | `node_modules` absent                                                                           | `npm ci`.                                                                                                                                                                             |
| CI rouge sur `typecheck`                       | erreur TypeScript locale                                                                        | Reproduire avec `npm run typecheck` avant de pousser.                                                                                                                                 |
| Sitemap incomplet                              | Supabase injoignable au build (warning `[pages] sitemap: â€¦`)                                    | VÃ©rifier les variables Supabase et l'accÃ¨s rÃ©seau ; le build produit tout de mÃªme les routes statiques.                                                                               |
| **Aucune donnÃ©e + erreurs rÃ©seau `ENOTFOUND`** | Le projet Supabase d'origine (`yvjmuaofgxjibflbzybz`) ne rÃ©sout plus en DNS (suspendu/supprimÃ©) | RecrÃ©er un projet Supabase, appliquer `supabase/migrations/*.sql`, mettre Ã  jour `.env.production` (voir [DEPLOY.md](DEPLOY.md#a0-prÃ©flight-recrÃ©er-le-projet-supabase-obligatoire)). |

---

## 17. Roadmap

- [ ] Tests automatisÃ©s (unitaires `Vitest`, E2E `Playwright`) et ajout au workflow CI.
- [ ] `npm run lint` + `format:check` bloquants en CI.
- [ ] Flux RSS / Atom des sorties et notifications de chapitre.
- [ ] ModÃ©ration des commentaires (rÃ´le dÃ©diÃ©, signalement) et rate limiting.
- [ ] Favoris / bibliothÃ¨que personnelle synchronisÃ©e entre appareils.
- [ ] PWA hors-ligne (le manifest et les icÃ´nes sont dÃ©jÃ  en place) et service worker.
- [x] `sitemap.xml` dynamique : route serveur SSR (URLs absolues via `VITE_SITE_URL`) + gÃ©nÃ©ration statique au build Pages.
- [ ] Internationalisation FR/EN de l'interface.
- [ ] Domaine personnalisÃ© + HTTPS (adaptation de `VITE_BASE_PATH` et du workflow).
- [ ] Ajouter un fichier `LICENSE` et une politique de confidentialitÃ©.

---

## 18. Licence et crÃ©dits

**Licence** : aucun fichier `LICENSE` n'est prÃ©sent Ã  ce jour. Sans licence explicite, le code reste Â« tous droits rÃ©servÃ©s Â» au studio AMO-SCANS-FR â€” Ã  clarifier avant toute contribution externe ou rÃ©utilisation (MIT / propriÃ©taire au choix du titulaire). Les visuels de `src/assets/` et les contenus du catalogue appartiennent Ã  AMO-SCANS-FR.

**CrÃ©dits / briques open source** : TanStack Start & Router, React, Vite, Tailwind CSS, shadcn/ui, Radix UI, Lucide, TanStack Query, Supabase, Cloudflare Workers, `sonner`, `embla-carousel`, `recharts`, `date-fns`. Polices **Inter** et **Outfit** via Google Fonts.

L'Ã©chafaudage initial provient de l'intÃ©gration **Lovable Cloud** (`@lovable.dev/*`, `src/integrations/lovable`). Les fichiers `src/integrations/supabase/{auth-middleware,auth-attacher,types}.ts` sont gÃ©nÃ©rÃ©s et ne doivent pas Ãªtre Ã©ditÃ©s Ã  la main ; `src/integrations/supabase/client.ts` a en revanche Ã©tÃ© **maintenu manuellement** (gestion d'erreur explicite des variables d'environnement, compatible build statique).
