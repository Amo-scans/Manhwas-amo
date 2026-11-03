# AMO-SCANS-FR

Plateforme de lecture de manhwa originaux, en **lecture verticale** : catalogue de séries, lecteur plein écran, commentaires par épisode et back-office d'édition (séries, chapitres, planches hébergées sur Supabase Storage).

|                         |                                                                            |
| ----------------------- | -------------------------------------------------------------------------- |
| **Site (GitHub Pages)** | <https://assia123y.github.io/amo-scans-fr/>                                |
| **Dépôt**               | `Assia123y/amo-scans-fr`                                                   |
| **Nature**              | application web SSR/SPA — données et authentification Supabase             |
| **Interface**           | anglais, thème sombre (contenus FR/EN libres)                              |
| **Licence**             | aucune licence déclarée à ce jour (voir [Licence](#18-licence-et-crédits)) |

[![CI](https://github.com/Assia123y/amo-scans-fr/actions/workflows/ci.yml/badge.svg)](https://github.com/Assia123y/amo-scans-fr/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/Assia123y/amo-scans-fr/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/Assia123y/amo-scans-fr/actions/workflows/deploy-pages.yml)

> 📋 **Audit du code initial et journal des corrections** : [AUDIT.md](AUDIT.md)
> ⚠️ **Backend** : le projet Supabase d'origine ne résout plus en DNS — voir [DEPLOY.md §A.0](DEPLOY.md#a0-préflight-recréer-le-projet-supabase-obligatoire) avant le premier déploiement.

---

## Sommaire

- [1. Présentation](#1-présentation)
- [2. Stack technique](#2-stack-technique)
- [3. Fonctionnalités](#3-fonctionnalités)
- [4. Arborescence du dépôt](#4-arborescence-du-dépôt)
- [5. Prérequis](#5-prérequis)
- [6. Installation locale](#6-installation-locale)
- [7. Variables d'environnement](#7-variables-denvironnement)
- [8. Scripts npm](#8-scripts-npm)
- [9. Base de données Supabase](#9-base-de-données-supabase)
- [10. Authentification et rôles](#10-authentification-et-rôles)
- [11. Les deux cibles de build](#11-les-deux-cibles-de-build)
- [12. Déploiement GitHub Pages](#12-déploiement-github-pages)
- [13. Déploiement Cloudflare Workers (optionnel)](#13-déploiement-cloudflare-workers-optionnel)
- [14. SEO et assets publics](#14-seo-et-assets-publics)
- [15. Sécurité](#15-sécurité)
- [16. Dépannage](#16-dépannage)
- [17. Roadmap](#17-roadmap)
- [18. Licence et crédits](#18-licence-et-crédits)

---

## 1. Présentation

**AMO-SCANS-FR** publie et diffuse ses propres manhwa (webcomics coréens) en dark fantasy cinématographique. L'application est le lecteur officiel du studio :

- une **bibliothèque** de séries publiées, avec une série « à la une » et les dernières sorties ;
- une **fiche série** (synopsis, statut, tags, liste des chapitres) ;
- un **lecteur vertical** où les planches défilent en pleine largeur ;
- des **commentaires** par épisode, réservés aux comptes connectés ;
- un **espace d'administration** pour publier séries, chapitres et planches (upload direct dans Supabase Storage).

Le dépôt contient **deux cibles de build** à partir du même code :

1. `npm run build` → application **SSR** déployable sur **Cloudflare Workers** (`src/server.ts`, `wrangler.jsonc`) ;
2. `npm run build:pages` → build **statique (SPA)** pour **GitHub Pages**, produisant `dist/client` (cible du dépôt actuel).

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
| Composants               | shadcn/ui (style `new-york`) sur Radix UI, icônes Lucide               | —                         |
| Données client           | TanStack Query                                                         | `^5.83.0`                 |
| Backend                  | Supabase : PostgreSQL, Auth, Storage (`@supabase/supabase-js`)         | `^2.105.4`                |
| Déploiement edge         | `@cloudflare/vite-plugin` + Wrangler                                   | `^1.25.5` (Wrangler 4.92) |
| Qualité                  | ESLint 9 (flat config) + Prettier 3                                    | `^9.32.0` / `^3.7.3`      |
| Formulaires / validation | react-hook-form + zod                                                  | `^7.71.2` / `^3.24.2`     |
| Divers                   | sonner (toasts), date-fns, embla (carrousel), recharts, vaul (drawers) | —                         |

Contraintes de config remarquables :

- **alias `@/*` → `src/*`** (`tsconfig.json` + `vite-tsconfig-paths`) ;
- `vite.config.ts` s'appuie sur `@lovable.dev/vite-tanstack-config`, qui ajoute Tailwind, le plugin React, TanStack Start, et — **uniquement au build** — le plugin Cloudflare ;
- le **mode SPA** de TanStack Start n'est activé que si `BUILD_TARGET=pages` (posé par `scripts/build-pages.mjs`).

---

## 3. Fonctionnalités

### Côté lecteur

- **Bibliothèque** : séries publiées uniquement (les brouillons ne fuient jamais), à la une, dernières sorties inter-séries.
- **Recherche instantanée** dans le catalogue (titre, genre, tags) avec état vide et compteur.
- **Fiche série** : synopsis, statut (`ongoing` / `completed` / `hiatus`), tags, nombre de chapitres, tri des chapitres, lien « continuer la lecture » mémorisé dans `localStorage`.
- **Lecteur vertical** : planches empilées pleine largeur, chapitre précédent / suivant, sélecteur de chapitre, progression de lecture, raccourcis clavier `←` / `→`, retour en haut, mémorisation du dernier chapitre lu.
- **Commentaires** par épisode (clé : slug de série + numéro de chapitre), réservés aux utilisateurs connectés, profils affichés depuis `public.profiles`.
- **Planning des sorties** dérivé des vraies publications, page **À propos**, pied de page complet.
- Thème sombre, responsive mobile-first, accessibilité (labels, focus visibles, `aria-*`).

### Côté administration (rôles `author` / `admin`)

- Tableau de bord des séries avec recherche, compteurs et filtres publié / brouillon.
- Création et édition de série : slug, titre, genre, synopsis, tags, statut, `published`, `featured`, visuel de couverture et bannière.
- Gestion des chapitres : création numérotée, publication, renommage, suppression sécurisée (`AlertDialog`).
- Upload **multiple** de planches dans le bucket `manhwa` (progression, ordre, dimensions enregistrées) et réordonnancement.
- Gardes d'accès explicites : rôle vérifié côté UI **et** politiques RLS côté base.

### Technique / SEO

- Métadonnées par page (`buildPageMeta` : canonical, Open Graph, Twitter Card), `noindex` sur `/admin` et `/auth`, JSON-LD.
- `robots.txt`, `sitemap.xml` généré au build (Pages) ou route serveur `/sitemap.xml` (SSR).
- `favicon.svg`, icônes PNG, `site.webmanifest`, image de partage `og-image.jpg` (1200×630, 143 Ko).

---

## 4. Arborescence du dépôt

```text
amo-scans-fr/
├── .github/workflows/
│   ├── ci.yml                     # typecheck + build:pages (push / PR)
│   └── deploy-pages.yml           # build + publication GitHub Pages
├── public/                        # servi tel quel à la racine du site
│   ├── favicon.svg                # monogramme "A" (sombre + accent)
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── apple-touch-icon.png
│   ├── site.webmanifest
│   ├── og-image.jpg               # 1200×630 (image de partage)
│   └── robots.txt
├── scripts/
│   ├── build-pages.mjs            # build statique SPA + post-traitement dist/client
│   └── serve-pages.mjs            # prévisualisation fidèle de GitHub Pages
├── src/
│   ├── assets/                    # couvertures, visuel hero, planches de démo
│   ├── components/                # navigation, footer, commentaires, lecteur, cartes…
│   │   └── ui/                    # composants shadcn/ui
│   ├── hooks/use-auth.tsx         # contexte d'authentification + rôles
│   ├── integrations/
│   │   ├── supabase/              # client navigateur (RLS), client admin serveur, types générés
│   │   └── lovable/               # OAuth Google via Lovable Cloud
│   ├── lib/                       # queries.ts (accès données), seo.ts, utils, pages d'erreur
│   ├── routes/                    # routes TanStack Router (fichiers)
│   │   ├── __root.tsx             # shell HTML, providers, métadonnées globales
│   │   ├── index.tsx              # accueil / bibliothèque
│   │   ├── series.$slug.tsx       # fiche série
│   │   ├── read.$slug.$ep.tsx     # lecteur
│   │   ├── schedule.tsx, about.tsx
│   │   ├── auth.tsx               # connexion / inscription
│   │   ├── admin*.tsx             # back-office (layout + 3 écrans)
│   │   ├── sitemap[.]xml.ts       # sitemap dynamique (cible SSR)
│   │   └── routeTree.gen.ts       # généré par le router plugin
│   ├── router.tsx                 # création du routeur (base path via import.meta.env.BASE_URL)
│   ├── server.ts                  # entrée Worker Cloudflare (wrapper d'erreurs SSR)
│   ├── start.ts                   # instance TanStack Start + middleware d'erreur
│   └── styles.css                 # thème Tailwind v4 (tokens sombres)
├── supabase/
│   ├── config.toml                # project_id
│   └── migrations/                # 7 migrations SQL (schéma, RLS, storage, triggers)
├── .env.example                   # modèle d'environnement (committé)
├── .env.production                # valeurs publiques + SEO Pages (committé)
├── DEPLOY.md                      # procédure de déploiement pas à pas
├── SECURITY.md                    # secrets, rotation, RLS, signalement
├── components.json                # config shadcn/ui
├── eslint.config.js, .prettierrc
├── package.json / package-lock.json
├── tsconfig.json
├── vite.config.ts
└── wrangler.jsonc                 # Worker Cloudflare (nom, date de compatibilité)
```

> `src/lib/manhwa-data.ts` contient des données de démonstration historiques (couvertures/planches d'exemple) ; les routes s'appuient sur Supabase via `src/lib/queries.ts`.

---

## 5. Prérequis

| Outil                               | Version      | Remarque                                           |
| ----------------------------------- | ------------ | -------------------------------------------------- |
| **Node.js**                         | **22 LTS**   | version utilisée par la CI et le workflow Pages    |
| **npm**                             | 10+          | le dépôt fournit `package-lock.json` (lockfile v3) |
| Compte **Supabase**                 | projet actif | base PostgreSQL + Auth + Storage                   |
| Compte **GitHub**                   | —            | Pages activé via GitHub Actions                    |
| _(optionnel)_ Compte **Cloudflare** | —            | uniquement pour la cible Workers SSR               |

Un `bun.lock` historique est également présent (échafaudage initial) ; **la référence est `package-lock.json`** et toutes les commandes de ce dépôt utilisent **npm**.

---

## 6. Installation locale

```bash
# 1. Cloner
git clone https://github.com/Assia123y/amo-scans-fr.git
cd amo-scans-fr

# 2. Installer les dépendances exactes du lockfile
npm ci

# 3. Créer la configuration locale
#    Windows (PowerShell) :
copy .env.example .env
#    Linux / macOS :
# cp .env.example .env
```

Renseigner `.env` :

- soit les **valeurs publiques du projet officiel** (reprises de `.env.production`) ;
- soit **votre propre projet Supabase** (URL + clé anon/publishable, puis appliquer les migrations — voir [§9](#9-base-de-données-supabase)).

```bash
# 4. Démarrer le serveur de développement
npm run dev
```

Le serveur de développement écoute sur **<http://localhost:8080>** (port par défaut de `@lovable.dev/vite-tanstack-config`, appliqué aussi en sandbox).

Vérifications utiles :

```bash
npm run typecheck     # TypeScript strict, aucune émission
npm run lint          # ESLint
npm run format:check  # Prettier
```

---

## 7. Variables d'environnement

Deux familles de variables, à ne pas confondre :

- préfixe **`VITE_`** → **inlinées dans le bundle client** au build (`import.meta.env.*`). **Aucun secret ici.**
- sans préfixe → lues à l'exécution **côté serveur** (`process.env.*`, SSR Cloudflare / scripts Node). Peuvent contenir des secrets.

### 7.1 Variables client (build-time)

| Variable                        | Requis | Rôle                                                                                                                                                                                                   |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`             | ✅     | URL du projet Supabase (ex. `https://<ref>.supabase.co`).                                                                                                                                              |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅     | Clé **anon / publishable**. Publique par conception ; c'est elle qui est embarquée dans le JS livré au navigateur, les droits réels étant fixés par les politiques RLS.                                |
| `VITE_SUPABASE_PROJECT_ID`      | ⚪     | Identifiant du projet (informatif, issu de l'échafaudage Lovable).                                                                                                                                     |
| `VITE_SITE_URL`                 | ⚪\*   | Origine publique absolue, **sans slash final** (ex. `https://assia123y.github.io/amo-scans-fr`). Utilisée par `src/lib/seo.ts` pour canonical / Open Graph / sitemap. Sans elle, fallback codé en dur. |
| `VITE_BASE_PATH`                | ⚪\*   | Sous-chemin servi, **avec slash de tête et de queue** (ex. `/amo-scans-fr/`, ou `/`). Consommé par `vite.config.ts` (`base`) et le routeur (`import.meta.env.BASE_URL`).                               |

\* obligatoires en pratique pour un déploiement GitHub Pages de projet : sans elles, assets et liens internes seraient servis à la racine du domaine.

### 7.2 Variables serveur (runtime SSR / scripts)

| Variable                                        | Requis                    | Rôle                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                                  | ✅ (SSR)                  | Même URL, lue par `src/integrations/supabase/client.server.ts`, `auth-middleware.ts` et la route sitemap dynamique.                                                                                                                                                                                                                                               |
| `SUPABASE_PUBLISHABLE_KEY`                      | ✅ (SSR)                  | Même clé anon, côté serveur.                                                                                                                                                                                                                                                                                                                                      |
| `SUPABASE_SERVICE_ROLE_KEY`                     | ⚠️ **serveur uniquement** | Bypasse **toutes** les RLS. Utilisée exclusivement par `src/integrations/supabase/client.server.ts` (`supabaseAdmin`). **Ne jamais** la préfixer `VITE_`, ni la committer, ni l'exposer. Les écrans actuels n'en ont pas besoin (l'admin passe par le client RLS + le JWT de session) : ne la provisionner que si des server functions utilisent `supabaseAdmin`. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | ⚪                        | Uniquement pour `wrangler deploy` (voir §13). Jamais dans le code.                                                                                                                                                                                                                                                                                                |

### 7.3 Fichiers d'environnement du dépôt

| Fichier                              | Committé | Contenu                                                                                                                                 |
| ------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.example`                       | ✅       | Modèle documenté, sans valeur réelle.                                                                                                   |
| `.env.production`                    | ✅       | **Uniquement des valeurs publiques** : URL Supabase, clé anon, `VITE_SITE_URL`, `VITE_BASE_PATH`. Chargé par `scripts/build-pages.mjs`. |
| `.env`, `.env.local`, `.env.*.local` | ❌       | Secrets locaux, ignorés par git.                                                                                                        |
| `.workspace/`                        | ❌       | Environnement Lovable (contient un jeton d'accès) — ignoré par git.                                                                     |

Priorité de lecture dans `scripts/build-pages.mjs` : `.env.production.local` > `.env.production` > `.env.local` > `.env`, et **les variables déjà présentes dans l'environnement du shell / de la CI restent prioritaires** (c'est ainsi que le workflow Pages impose son `VITE_BASE_PATH`).

### 7.4 Configuration actuelle du site

```dotenv
VITE_SITE_URL="https://assia123y.github.io/amo-scans-fr"
VITE_BASE_PATH="/amo-scans-fr/"
```

> Changer de nom de dépôt, passer sur un domaine personnalisé ou déployer à la racine impose de mettre à jour ces deux valeurs (et, pour un domaine custom, d'adapter `deploy-pages.yml` qui calcule la base à partir du nom du dépôt).

---

## 8. Scripts npm

| Script                  | Commande réelle                 | Description                                                                                                                                                                                                     |
| ----------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | `vite dev`                      | Serveur de développement SSR (port **8080**).                                                                                                                                                                   |
| `npm run build`         | `vite build`                    | Build **SSR / Cloudflare Workers** (mode production, plugin Cloudflare actif).                                                                                                                                  |
| `npm run build:dev`     | `vite build --mode development` | Build SSR en mode développement (debug).                                                                                                                                                                        |
| `npm run build:pages`   | `node scripts/build-pages.mjs`  | Build **statique SPA** pour GitHub Pages → `dist/client` (voir §11.2).                                                                                                                                          |
| `npm run preview`       | `vite preview`                  | Prévisualisation du dernier build Vite.                                                                                                                                                                         |
| `npm run preview:pages` | `node scripts/serve-pages.mjs`  | Sert `dist/client` en reproduisant GitHub Pages (404.html, base path). **Serveur sur <http://localhost:4173/>** ; exporter `VITE_BASE_PATH=/amo-scans-fr/` avant de lancer pour reproduire le sous-chemin réel. |
| `npm run typecheck`     | `tsc --noEmit`                  | Vérification TypeScript stricte.                                                                                                                                                                                |
| `npm run lint`          | `eslint .`                      | Lint (TS, TSX, hooks React, règles Prettier).                                                                                                                                                                   |
| `npm run lint:fix`      | `eslint . --fix`                | Lint avec correction automatique.                                                                                                                                                                               |
| `npm run format`        | `prettier --write .`            | Formatage Prettier (sauf `dist`, lockfiles, `routeTree.gen.ts`).                                                                                                                                                |
| `npm run format:check`  | `prettier --check .`            | Vérification de formatage sans écriture.                                                                                                                                                                        |

---

## 9. Base de données Supabase

### 9.1 Appliquer les migrations

Les migrations sont dans `supabase/migrations/`, **à appliquer dans l'ordre du nom de fichier**. Deux méthodes :

**A. Éditeur SQL du dashboard (sans CLI)** — coller et exécuter chaque fichier `.sql` dans l'ordre :

| #   | Migration          | Contenu                                                                                                                  |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | `20260516184635_…` | enum `app_role`, tables `profiles`, `user_roles`, `comments`, index, **RLS** et trigger de création de profil            |
| 2   | `20260516184647_…` | `REVOKE EXECUTE` des fonctions internes (`has_role`, `handle_new_user`)                                                  |
| 3   | `20260516185222_…` | tables `series`, `chapters`, `panels`, RLS complètes, bucket Storage `manhwa` + politiques storage, trigger `updated_at` |
| 4   | `20260516185239_…` | bucket passé en privé (empêche le listing public des objets)                                                             |
| 5   | `20260516185249_…` | bucket repassé **public** (les URL publiques `getPublicUrl` continuent de fonctionner)                                   |
| 6   | `20260516185320_…` | `handle_new_user()` v2 : **le premier compte inscrit devient `admin` + `author`**, les suivants `reader`                 |
| 7   | `20260522185257_…` | `GRANT EXECUTE` de `has_role(uuid, app_role)` à `anon` et `authenticated` (nécessaire aux politiques RLS publiques)      |

**B. Supabase CLI** :

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push        # applique supabase/migrations dans l'ordre
```

### 9.2 Schéma des tables

| Table               | Colonnes principales                                                                                                                                                                                                                     | Notes                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.profiles`   | `id` (PK → `auth.users`), `username` (unique), `display_name`, `avatar_url`, `created_at`                                                                                                                                                | 1 ligne par utilisateur, créée par trigger.                                                                                                              |
| `public.user_roles` | `id`, `user_id` (→ `auth.users`), `role` (`app_role`), `created_at`, `UNIQUE(user_id, role)`                                                                                                                                             | Source de vérité des droits.                                                                                                                             |
| `public.comments`   | `id`, `series_slug` (text), `episode` (int), `user_id` (→ `auth.users`), `content` (1–2000 car.), `created_at`                                                                                                                           | Index `(series_slug, episode, created_at DESC)`. Pas de relation PostgREST vers `profiles` : les profils sont chargés en second appel (`fetchComments`). |
| `public.series`     | `id`, `slug` (unique), `title`, `genre`, `synopsis`, `cover_url`, `hero_url`, `tags` (text[]), `status` (`ongoing` par défaut), `published` (bool, `false`), `featured` (bool), `author_id` (→ `auth.users`), `created_at`, `updated_at` | Index `(published, created_at DESC)`. `updated_at` maintenu par trigger.                                                                                 |
| `public.chapters`   | `id`, `series_id` (→ `series`, cascade), `number` (int), `title`, `published` (bool), `created_at`, `UNIQUE(series_id, number)`                                                                                                          | Index `(series_id, number)`.                                                                                                                             |
| `public.panels`     | `id`, `chapter_id` (→ `chapters`, cascade), `position` (int), `image_url` (not null), `width`, `height`, `created_at`                                                                                                                    | Index `(chapter_id, position)`.                                                                                                                          |

Types TypeScript générés : `src/integrations/supabase/types.ts`.

### 9.3 RLS — résumé

Toutes les tables publiques ont **RLS activée**. La fonction `public.has_role(_user_id, _role)` (`SECURITY DEFINER`) évite toute récursion dans `user_roles`.

| Table                               | `SELECT`                                                             | `INSERT`                                                     | `UPDATE`                 | `DELETE`                  |
| ----------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------ | ------------------------- |
| `profiles`                          | tout le monde                                                        | propriétaire (`auth.uid() = id`)                             | propriétaire             | — (aucune politique)      |
| `user_roles`                        | propriétaire **ou** admin                                            | admin                                                        | admin (`FOR ALL`)        | admin (`FOR ALL`)         |
| `comments`                          | tout le monde                                                        | utilisateur authentifié, `user_id = auth.uid()`              | propriétaire             | propriétaire **ou** admin |
| `series`                            | publiée **ou** auteur **ou** admin                                   | auteur (`author_id = auth.uid()`) avec rôle `author`/`admin` | auteur **ou** admin      | auteur **ou** admin       |
| `chapters`                          | chapitre publié d'une série publiée **ou** auteur/admin de la série  | auteur/admin de la série (`FOR ALL`)                         | auteur/admin de la série | auteur/admin de la série  |
| `panels`                            | planches d'un chapitre+série publiés **ou** auteur/admin de la série | auteur/admin de la série (`FOR ALL`)                         | auteur/admin de la série | auteur/admin de la série  |
| `storage.objects` (bucket `manhwa`) | lecture publique                                                     | rôle `author`/`admin` authentifié                            | propriétaire de l'objet  | propriétaire **ou** admin |

Conséquence : un brouillon (`published = false`) n'est jamais lisible par un visiteur anonyme ; la sécurité ne dépend **pas** de l'UI.

### 9.4 Storage

- Bucket : **`manhwa`**, public en lecture (`getPublicUrl`), écriture réservée aux rôles `author`/`admin`.
- Arborescence des uploads (gérée par le back-office) : `<user_id>/<series_id>/covers/...`, `<user_id>/<series_id>/<chapter_id>/...`, avec `cache-control: 31536000` et `upsert: false`.
- `publicImageUrl()` (`src/lib/queries.ts`) accepte une URL absolue ou un chemin relatif au bucket.

### 9.5 Amorçage administrateur

1. Créer le projet Supabase, appliquer les migrations.
2. S'inscrire **une première fois** sur `/auth` : ce premier compte reçoit automatiquement `reader` + `admin` + `author` (migration 6).
3. Les inscriptions suivantes sont `reader`. Pour promouvoir un utilisateur, ajouter une ligne dans `public.user_roles` (`admin`/`author`) depuis le dashboard ou un admin existant.

---

## 10. Authentification et rôles

| Élément          | Implémentation                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fournisseur      | Supabase Auth (e-mail + mot de passe, mot de passe ≥ 8 caractères)                                                                                                                                                                                                              |
| OAuth            | Google via `@lovable.dev/cloud-auth-js` (`src/integrations/lovable/index.ts`) — dépend de l'intégration Lovable Cloud ; sans elle, seule l'authentification e-mail fonctionne (ou adapter vers `supabase.auth.signInWithOAuth` avec le provider Google configuré dans Supabase) |
| Contexte client  | `src/hooks/use-auth.tsx` : `user`, `session`, `roles`, `isAdmin`, `isAuthor`, `loading`, `rolesLoading`, `signOut`, `refreshRoles`                                                                                                                                              |
| Rôles            | `reader` (commente), `author` (gère ses séries/chapitres/planches), `admin` (gère tout, y compris les rôles)                                                                                                                                                                    |
| Protection       | gardes UI (`/admin` redirige vers `/auth`) **et** RLS en base ; `noindex` sur `/admin` et `/auth`                                                                                                                                                                               |
| Stockage session | `localStorage` (client navigateur), rafraîchissement automatique du token                                                                                                                                                                                                       |

---

## 11. Les deux cibles de build

### 11.1 `npm run build` — SSR Cloudflare Workers

- `vite build` en mode production ; `@cloudflare/vite-plugin` construit le Worker dont l'entrée est `src/server.ts` (wrapper qui normalise les erreurs SSR catastrophiques et renvoie une page d'erreur de marque).
- Identité du Worker : `wrangler.jsonc` (`name: "amo-scans-fr"`, `compatibility_date: 2025-09-24`, `nodejs_compat`, observabilité activée).
- Sortie : `dist/client` (assets) et `dist/server` (bundle serveur).
- Déploiement : voir §13.

### 11.2 `npm run build:pages` — statique GitHub Pages

`scripts/build-pages.mjs` :

1. charge les fichiers `.env*` (voir §7.3) et normalise `VITE_BASE_PATH` / `VITE_SITE_URL` ;
2. vide `dist/`, puis lance `vite build` avec `BUILD_TARGET=pages` → plugin Cloudflare désactivé, **mode SPA** de TanStack Start, `base = VITE_BASE_PATH` ;
3. post-traite `dist/client` :
   - copie le shell SPA (`_shell.html`) en **`index.html`** et **`404.html`** (GitHub Pages n'a pas de rewrite SPA : les deep links retombent sur `404.html`, qui est l'application) ;
   - écrit **`.nojekyll`** (évite que Jekyll n'ignore certains fichiers) ;
   - génère **`sitemap.xml`** (routes statiques + séries/chapitres publiés récupérés via l'API REST Supabase, avec repli sur les seules routes statiques si Supabase est injoignable) ;
   - réécrit **`robots.txt`** avec la ligne `Sitemap:` absolue.

Résultat dans `dist/client/` : `index.html`, `404.html`, `.nojekyll`, `sitemap.xml`, `robots.txt`, `favicon.svg`, `site.webmanifest`, `og-image.*`, `assets/*.js|css`.

```bash
npm run build:pages   # build (base /amo-scans-fr/ lue dans .env.production)

# prévisualisation : aligner le base path du serveur sur celui du build
# Windows PowerShell :
$env:VITE_BASE_PATH="/amo-scans-fr/"; npm run preview:pages
# Linux / macOS :
# VITE_BASE_PATH=/amo-scans-fr/ npm run preview:pages
# → http://localhost:4173/amo-scans-fr/
```

> `preview:pages` sert les fichiers sous le base path actif et renvoie `404.html` (status 404) pour les chemins sans extension, exactement comme GitHub Pages. Sans `VITE_BASE_PATH`, il sert à la racine (`http://localhost:4173/`) et les assets du build sous-chemin renvoient 404.

---

## 12. Déploiement GitHub Pages

Procédure détaillée, checklist et dépannage : **[DEPLOY.md](DEPLOY.md)**.

En résumé :

1. le dépôt GitHub `Assia123y/amo-scans-fr` héberge le code ;
2. `.github/workflows/deploy-pages.yml` construit l'artefact à chaque push sur `main`/`master` ;
3. le workflow **calcule automatiquement** le base path à partir du nom du dépôt :
   - dépôt `amo-scans-fr` → `VITE_BASE_PATH=/amo-scans-fr/`, `VITE_SITE_URL=https://<owner>.github.io/amo-scans-fr` ;
   - dépôt `<owner>.github.io` → `/` ;
4. dans **Settings → Pages → Build and deployment → Source**, choisir **GitHub Actions** ;
5. site publié sur <https://assia123y.github.io/amo-scans-fr/>.

Aucun secret GitHub n'est nécessaire : la clé Supabase utilisée est la clé **anon/publishable** (publique).

Le workflow **CI** (`.github/workflows/ci.yml`) vérifie à chaque push et pull request : `npm run typecheck`, puis `npm run build:pages` (base `/`, présence des artefacts de build contrôlée, aucun secret requis).

---

## 13. Déploiement Cloudflare Workers (optionnel)

La cible SSR n'est pas nécessaire pour GitHub Pages, mais permet le rendu serveur, la route `/sitemap.xml` dynamique et l'edge Cloudflare.

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

# 4. Déployer
npx wrangler deploy
```

Notes :

- Le nom du Worker vient de `wrangler.jsonc` (`amo-scans-fr`). Pour déployer à la racine d'un domaine, `VITE_BASE_PATH` doit valoir `/` **au moment du build** (les variables `VITE_*` sont inlinées : tout changement impose un rebuild).
- `SUPABASE_SERVICE_ROLE_KEY` ne doit **jamais** être mise dans `wrangler.jsonc` ni dans une variable `VITE_*` : uniquement un secret Wrangler.
- Un workflow GitHub Actions de déploiement Cloudflare (avec `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` en secrets) est décrit dans [DEPLOY.md](DEPLOY.md#f-déploiement-cloudflare-workers-optionnel).

---

## 14. SEO et assets publics

| Élément              | Fichier / mécanisme                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Métadonnées par page | `src/lib/seo.ts` — `buildPageMeta()` (title, description, canonical, Open Graph, Twitter, `noindex`), `absoluteUrl()`.                                                                                   |
| Origine canonique    | `VITE_SITE_URL` (sinon fallback codé en dur dans `seo.ts`).                                                                                                                                              |
| Image de partage     | `public/og-image.jpg` (1200×630, ~143 Ko) — image par défaut de `buildPageMeta()` dans `seo.ts`.                                                                                                         |
| `robots.txt`         | Autorise `/`, interdit `/admin` et `/auth`, pointe le sitemap absolu ; réécrit dans `dist/client` au build Pages.                                                                                        |
| `sitemap.xml`        | Généré par `scripts/build-pages.mjs` (Pages) ; route serveur `src/routes/sitemap[.]xml.ts` pour le SSR (URLs absolues via `SITE_URL`).                                                                   |
| Favicon / PWA        | `public/favicon.svg` (monogramme « A » sombre/accent), `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `public/site.webmanifest` (`start_url: "./"` → compatible avec n'importe quel base path). |
| Thème                | `#0b0b0f` (`theme-color`, manifest, fond du site).                                                                                                                                                       |

---

## 15. Sécurité

Voir **[SECURITY.md](SECURITY.md)** pour le détail. Points essentiels :

- **la clé anon/publishable est publique** (elle est dans le bundle client) : la sécurité repose sur les **politiques RLS**, jamais sur le secret de cette clé ;
- la clé **`service_role` n'est jamais committée ni exposée au client** ; elle ne doit vivre que dans un secret serveur (`wrangler secret` / dashboard Supabase) ;
- `.env`, `.env.local` et `.workspace/` (jeton Lovable) sont **ignorés par git** (`.gitignore`) ;
- `dist/`, `node_modules/`, `.wrangler/`, `.tanstack/` ne sont pas versionnés ;
- l'écriture Storage est restreinte aux rôles `author`/`admin`, la suppression au propriétaire ou à un admin ;
- signaler une vulnérabilité via un **GitHub Security Advisory privé** (voir SECURITY.md), pas en issue publique.

---

## 16. Dépannage

| Symptôme                                       | Cause probable                                                                                  | Correctif                                                                                                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page blanche / assets en 404 sur GitHub Pages  | `VITE_BASE_PATH` incohérent avec le sous-chemin servi                                           | Vérifier que le build vaut `/<nom-du-dépôt>/` ; ne pas réutiliser un build local fait avec `VITE_BASE_PATH=/`.                                                                        |
| 404 en rechargeant `/series/...`               | Attendu sur GitHub Pages : `404.html` = shell SPA                                               | Vérifier que `dist/client/404.html` existe ; la navigation interne (client-side) fonctionne normalement.                                                                              |
| `Missing Supabase environment variable(s)`     | `.env` absent/incomplet, ou build sans `.env.production`                                        | Renseigner `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`, rebuilder.                                                                                                          |
| Les planches / couvertures ne s'affichent pas  | Bucket `manhwa` non public ou politiques storage absentes                                       | Vérifier `storage.buckets.public = true` et les politiques de `storage.objects` (migrations 3 à 5).                                                                                   |
| Utilisateur sans accès admin                   | Son compte n'a pas le rôle                                                                      | Ajouter `admin`/`author` dans `public.user_roles`. Le tout premier compte reçoit ces rôles automatiquement.                                                                           |
| `npm run build:pages` : « vite not installed » | `node_modules` absent                                                                           | `npm ci`.                                                                                                                                                                             |
| CI rouge sur `typecheck`                       | erreur TypeScript locale                                                                        | Reproduire avec `npm run typecheck` avant de pousser.                                                                                                                                 |
| Sitemap incomplet                              | Supabase injoignable au build (warning `[pages] sitemap: …`)                                    | Vérifier les variables Supabase et l'accès réseau ; le build produit tout de même les routes statiques.                                                                               |
| **Aucune donnée + erreurs réseau `ENOTFOUND`** | Le projet Supabase d'origine (`yvjmuaofgxjibflbzybz`) ne résout plus en DNS (suspendu/supprimé) | Recréer un projet Supabase, appliquer `supabase/migrations/*.sql`, mettre à jour `.env.production` (voir [DEPLOY.md](DEPLOY.md#a0-préflight-recréer-le-projet-supabase-obligatoire)). |

---

## 17. Roadmap

- [ ] Tests automatisés (unitaires `Vitest`, E2E `Playwright`) et ajout au workflow CI.
- [ ] `npm run lint` + `format:check` bloquants en CI.
- [ ] Flux RSS / Atom des sorties et notifications de chapitre.
- [ ] Modération des commentaires (rôle dédié, signalement) et rate limiting.
- [ ] Favoris / bibliothèque personnelle synchronisée entre appareils.
- [ ] PWA hors-ligne (le manifest et les icônes sont déjà en place) et service worker.
- [x] `sitemap.xml` dynamique : route serveur SSR (URLs absolues via `VITE_SITE_URL`) + génération statique au build Pages.
- [ ] Internationalisation FR/EN de l'interface.
- [ ] Domaine personnalisé + HTTPS (adaptation de `VITE_BASE_PATH` et du workflow).
- [ ] Ajouter un fichier `LICENSE` et une politique de confidentialité.

---

## 18. Licence et crédits

**Licence** : aucun fichier `LICENSE` n'est présent à ce jour. Sans licence explicite, le code reste « tous droits réservés » au studio AMO-SCANS-FR — à clarifier avant toute contribution externe ou réutilisation (MIT / propriétaire au choix du titulaire). Les visuels de `src/assets/` et les contenus du catalogue appartiennent à AMO-SCANS-FR.

**Crédits / briques open source** : TanStack Start & Router, React, Vite, Tailwind CSS, shadcn/ui, Radix UI, Lucide, TanStack Query, Supabase, Cloudflare Workers, `sonner`, `embla-carousel`, `recharts`, `date-fns`. Polices **Inter** et **Outfit** via Google Fonts.

L'échafaudage initial provient de l'intégration **Lovable Cloud** (`@lovable.dev/*`, `src/integrations/lovable`). Les fichiers `src/integrations/supabase/{auth-middleware,auth-attacher,types}.ts` sont générés et ne doivent pas être édités à la main ; `src/integrations/supabase/client.ts` a en revanche été **maintenu manuellement** (gestion d'erreur explicite des variables d'environnement, compatible build statique).
