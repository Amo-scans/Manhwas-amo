# AUDIT — AMO-SCANS-FR

Audit du code initial (archive `amo-scans-fr-code.zip`) et journal des corrections apportées.
Date : 2026-11-03. Périmètre : application TanStack Start + Supabase (site de lecture de manhwa).

## 1. Résumé exécutif

| Sévérité | Constat initial | État |
| --- | --- | --- |
| 🔴 Critique | Projet Supabase `yvjmuaofgxjibflbzybz` **supprimé/suspendu** : le sous-domaine ne résout plus en DNS | ⚠️ Non réparable côté code (à recréer, voir `DEPLOY.md` §A.0) |
| 🔴 Critique | `.workspace/.git` contenait un **jeton Lovable** (JWT) dans l'URL du remote ; `.git` pointait vers `/nix/store` | ✅ Supprimés avant publication |
| 🔴 Critique | `.env` (clés) non ignoré par git | ✅ `.gitignore` réécrit, `.env.example` + `.env.production` publics créés |
| 🟠 Majeur | Section commentaires **cassée** : `comments.select("profile:profiles(...)")` sans relation PostgREST → erreur PGRST200, aucun commentaire affiché | ✅ Corrigé (deux requêtes, profils chargés séparément) |
| 🟠 Majeur | `user!.id` non sûrs dans l'admin (crash possible) ; `confirm()` brut | ✅ Gardes explicites + `AlertDialog` |
| 🟠 Majeur | Liens Schedule/About inaccessibles sur mobile (nav masquée, aucun menu) | ✅ Menu mobile accessible (Radix Sheet) |
| 🟡 Moyen | Sitemap : `BASE_URL = ""` → `<loc>` invalides | ✅ URLs absolues via `VITE_SITE_URL` (SSR) + génération statique |
| 🟡 Moyen | Aucun SEO social (og:image), titres de pages basés sur le slug | ✅ `buildPageMeta` par page, JSON-LD, og-image 1200×630 |
| 🟡 Moyen | Pas de build statique ni de CI, déploiement non reproductible | ✅ `build:pages` + workflow GitHub Pages + CI |
| 🟡 Moyen | Client Supabase : accès `process.env` en navigateur, message d'erreur Lovable | ✅ Lecture d'env robuste, message explicite |
| 🟢 Faible | Pas de `typecheck`/`format:check`, pas de README/licence, docs absentes | ✅ Scripts, README/DEPLOY/SECURITY, CI |

## 2. Bugs fonctionnels corrigés

1. **Commentaires** (`src/components/comments-section.tsx` + `src/lib/queries.ts`) : l'embed
   `profiles` n'a pas de FK (`comments.user_id` et `profiles.id` pointent tous deux vers
   `auth.users`). Chargement en deux requêtes + jointure mémoire ; mutation optimiste avec rollback.
2. **Lecture/na** (`src/routes/read.$slug.$ep.tsx`) : « Précédent » pointait vers le chapitre 1
   même au premier chapitre, « Suivant » créait un lien vers un chapitre inexistant. Remplacé par
   un calcul réel des voisins (`chapterNeighborsQueryOptions`).
3. **Chapitres non publiés** : la page série listait uniquement les publiés (RLS) mais aucun état
   vide n'aidait l'auteur ; ajout d'états vides/erreurs explicites côté admin et public.
4. **Uploads de planches** : aucune limite de taille/type, aucun retour de progression, ordre
   `position` repris du plus grand existant. Validé (20 Mo, formats image), progression par fichier,
   normalisation des positions.
5. **Slug de série** : `slugify` acceptait des accents (`é` → `-`), créait des slugs vides ou
   incohérents ; validé par regex + contrôle d'unicité avant insertion.

## 3. Sécurité

- RLS conservées et **durcies** par une nouvelle migration (`20260601120000_hardening.sql`) :
  contraintes `slug`/`status`/`number > 0`/`content` non vide, index de performance, trigger
  `chapters_touch_series` (mise à jour de `series.updated_at`), limites du bucket `manhwa`
  (20 Mo, types MIME image uniquement).
- `service_role` **jamais** dans le client ni dans les fichiers commités ; `.env*` documentés.
- En-têtes HTTP de sécurité côté SSR (`X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`, HSTS si HTTPS).
- Authentification : redirections post-login limitées aux chemins internes, messages d'erreur
  neutres, `resetPasswordForEmail` sur l'origine + base path.
- **Limitations connues** : pas de CSP stricte (script d'hydratation inline), pas de rate limiting
  sur les commentaires, pas de modération dédiée, pas de suppression des images orphelines dans
  Storage (voir `SECURITY.md`).

## 4. Performance et qualité

- React Query : `QueryClient` centralisé (`src/lib/query-client.ts`), `staleTime` 60 s, retry
  conditionnel (pas de retry sur erreurs RLS/JWT), `refetchOnWindowFocus` désactivé.
- Bundle : imports ciblés (`lucide-react` icône par icône), `chunkSizeWarningLimit` ajusté ;
  le build statique complet pèse **1,26 Mo** (images de démo comprises).
- Images : `width`/`height` (anti-CLS), `loading="lazy"` hors premier écran, `decoding="async"`,
  `fetchPriority` sur le hero, fallback en cas de 404.
- UI : skeletons, empty states, error states + retry sur toutes les pages ; `pendingComponent` sur
  la fiche série ; accessibilité (aria, focus visible, skip link, navigation clavier du lecteur).
- Code : 0 erreur TypeScript, 0 erreur ESLint (7 warnings `react-refresh` sur les composants
  shadcn, pattern standard), Prettier appliqué à tout le dépôt.

## 5. Vérifications effectuées

| Contrôle | Résultat |
| --- | --- |
| `npm run typecheck` | ✅ 0 erreur |
| `npx eslint .` | ✅ 0 erreur, 7 warnings (composants UI shadcn) |
| `npx prettier --check .` | ✅ conforme |
| `npm run build` (Cloudflare Workers SSR) | ✅ OK |
| `npm run build:pages` (statique GitHub Pages) | ✅ `dist/client` complet (index/404/.nojekyll/sitemap/robots) |
| Smoke test SSR (`vite dev`, 9 routes) | ✅ 200 + HTML rendu, aucune page d'erreur |
| Smoke test statique (`serve-pages.mjs`) | ✅ `/amo-scans-fr/` 200, deep links → `404.html` (comportement GitHub Pages), assets 200 |
| Secrets dans le dépôt | ✅ aucun (`.env`, `.workspace`, `node_modules`, `dist` ignorés) |

## 6. Reste à faire (hors périmètre / dépendances externes)

1. **Recréer le projet Supabase** et appliquer les migrations (blocage n°1 pour un site fonctionnel).
2. Configurer l'URL d'authentification Supabase (`…/auth`) pour les e-mails de confirmation/reset.
3. Créer le dépôt GitHub, pousser, activer Pages (voir `DEPLOY.md`).
4. OAuth Google : le flux dépend du broker Lovable (`/~oauth/initiate`), indisponible sur un
   hébergement statique → à remplacer par un provider Supabase natif si souhaité.
5. Tests automatisés (Vitest/Playwright) et `lint` bloquant en CI.
6. Nettoyage des images Storage à la suppression d'un chapitre/série.
