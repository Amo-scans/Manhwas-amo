# AUDIT â€” AMO-SCANS-FR

Audit du code initial (archive `amo-scans-fr-code.zip`) et journal des corrections apportÃ©es.
Date : 2026-11-03. PÃ©rimÃ¨tre : application TanStack Start + Supabase (site de lecture de manhwa).

## 1. RÃ©sumÃ© exÃ©cutif

| SÃ©vÃ©ritÃ© | Constat initial | Ã‰tat |
| --- | --- | --- |
| ðŸ”´ Critique | Projet Supabase `yvjmuaofgxjibflbzybz` **supprimÃ©/suspendu** : le sous-domaine ne rÃ©sout plus en DNS | âš ï¸ Non rÃ©parable cÃ´tÃ© code (Ã  recrÃ©er, voir `DEPLOY.md` Â§A.0) |
| ðŸ”´ Critique | `.workspace/.git` contenait un **jeton Lovable** (JWT) dans l'URL du remote ; `.git` pointait vers `/nix/store` | âœ… SupprimÃ©s avant publication |
| ðŸ”´ Critique | `.env` (clÃ©s) non ignorÃ© par git | âœ… `.gitignore` rÃ©Ã©crit, `.env.example` + `.env.production` publics crÃ©Ã©s |
| ðŸŸ  Majeur | Section commentaires **cassÃ©e** : `comments.select("profile:profiles(...)")` sans relation PostgREST â†’ erreur PGRST200, aucun commentaire affichÃ© | âœ… CorrigÃ© (deux requÃªtes, profils chargÃ©s sÃ©parÃ©ment) |
| ðŸŸ  Majeur | `user!.id` non sÃ»rs dans l'admin (crash possible) ; `confirm()` brut | âœ… Gardes explicites + `AlertDialog` |
| ðŸŸ  Majeur | Liens Schedule/About inaccessibles sur mobile (nav masquÃ©e, aucun menu) | âœ… Menu mobile accessible (Radix Sheet) |
| ðŸŸ¡ Moyen | Sitemap : `BASE_URL = ""` â†’ `<loc>` invalides | âœ… URLs absolues via `VITE_SITE_URL` (SSR) + gÃ©nÃ©ration statique |
| ðŸŸ¡ Moyen | Aucun SEO social (og:image), titres de pages basÃ©s sur le slug | âœ… `buildPageMeta` par page, JSON-LD, og-image 1200Ã—630 |
| ðŸŸ¡ Moyen | Pas de build statique ni de CI, dÃ©ploiement non reproductible | âœ… `build:pages` + workflow GitHub Pages + CI |
| ðŸŸ¡ Moyen | Client Supabase : accÃ¨s `process.env` en navigateur, message d'erreur Lovable | âœ… Lecture d'env robuste, message explicite |
| ðŸŸ¢ Faible | Pas de `typecheck`/`format:check`, pas de README/licence, docs absentes | âœ… Scripts, README/DEPLOY/SECURITY, CI |

## 2. Bugs fonctionnels corrigÃ©s

1. **Commentaires** (`src/components/comments-section.tsx` + `src/lib/queries.ts`) : l'embed
   `profiles` n'a pas de FK (`comments.user_id` et `profiles.id` pointent tous deux vers
   `auth.users`). Chargement en deux requÃªtes + jointure mÃ©moire ; mutation optimiste avec rollback.
2. **Lecture/na** (`src/routes/read.$slug.$ep.tsx`) : Â« PrÃ©cÃ©dent Â» pointait vers le chapitre 1
   mÃªme au premier chapitre, Â« Suivant Â» crÃ©ait un lien vers un chapitre inexistant. RemplacÃ© par
   un calcul rÃ©el des voisins (`chapterNeighborsQueryOptions`).
3. **Chapitres non publiÃ©s** : la page sÃ©rie listait uniquement les publiÃ©s (RLS) mais aucun Ã©tat
   vide n'aidait l'auteur ; ajout d'Ã©tats vides/erreurs explicites cÃ´tÃ© admin et public.
4. **Uploads de planches** : aucune limite de taille/type, aucun retour de progression, ordre
   `position` repris du plus grand existant. ValidÃ© (20 Mo, formats image), progression par fichier,
   normalisation des positions.
5. **Slug de sÃ©rie** : `slugify` acceptait des accents (`Ã©` â†’ `-`), crÃ©ait des slugs vides ou
   incohÃ©rents ; validÃ© par regex + contrÃ´le d'unicitÃ© avant insertion.

## 3. SÃ©curitÃ©

- RLS conservÃ©es et **durcies** par une nouvelle migration (`20260601120000_hardening.sql`) :
  contraintes `slug`/`status`/`number > 0`/`content` non vide, index de performance, trigger
  `chapters_touch_series` (mise Ã  jour de `series.updated_at`), limites du bucket `manhwa`
  (20 Mo, types MIME image uniquement).
- `service_role` **jamais** dans le client ni dans les fichiers commitÃ©s ; `.env*` documentÃ©s.
- En-tÃªtes HTTP de sÃ©curitÃ© cÃ´tÃ© SSR (`X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`, HSTS si HTTPS).
- Authentification : redirections post-login limitÃ©es aux chemins internes, messages d'erreur
  neutres, `resetPasswordForEmail` sur l'origine + base path.
- **Limitations connues** : pas de CSP stricte (script d'hydratation inline), pas de rate limiting
  sur les commentaires, pas de modÃ©ration dÃ©diÃ©e, pas de suppression des images orphelines dans
  Storage (voir `SECURITY.md`).

## 4. Performance et qualitÃ©

- React Query : `QueryClient` centralisÃ© (`src/lib/query-client.ts`), `staleTime` 60 s, retry
  conditionnel (pas de retry sur erreurs RLS/JWT), `refetchOnWindowFocus` dÃ©sactivÃ©.
- Bundle : imports ciblÃ©s (`lucide-react` icÃ´ne par icÃ´ne), `chunkSizeWarningLimit` ajustÃ© ;
  le build statique complet pÃ¨se **1,26 Mo** (images de dÃ©mo comprises).
- Images : `width`/`height` (anti-CLS), `loading="lazy"` hors premier Ã©cran, `decoding="async"`,
  `fetchPriority` sur le hero, fallback en cas de 404.
- UI : skeletons, empty states, error states + retry sur toutes les pages ; `pendingComponent` sur
  la fiche sÃ©rie ; accessibilitÃ© (aria, focus visible, skip link, navigation clavier du lecteur).
- Code : 0 erreur TypeScript, 0 erreur ESLint (7 warnings `react-refresh` sur les composants
  shadcn, pattern standard), Prettier appliquÃ© Ã  tout le dÃ©pÃ´t.

## 5. VÃ©rifications effectuÃ©es

| ContrÃ´le | RÃ©sultat |
| --- | --- |
| `npm run typecheck` | âœ… 0 erreur |
| `npx eslint .` | âœ… 0 erreur, 7 warnings (composants UI shadcn) |
| `npx prettier --check .` | âœ… conforme |
| `npm run build` (Cloudflare Workers SSR) | âœ… OK |
| `npm run build:pages` (statique GitHub Pages) | âœ… `dist/client` complet (index/404/.nojekyll/sitemap/robots) |
| Smoke test SSR (`vite dev`, 9 routes) | âœ… 200 + HTML rendu, aucune page d'erreur |
| Smoke test statique (`serve-pages.mjs`) | âœ… `/Manhwas-amo/` 200, deep links â†’ `404.html` (comportement GitHub Pages), assets 200 |
| Secrets dans le dÃ©pÃ´t | âœ… aucun (`.env`, `.workspace`, `node_modules`, `dist` ignorÃ©s) |

## 6. Reste Ã  faire (hors pÃ©rimÃ¨tre / dÃ©pendances externes)

1. **RecrÃ©er le projet Supabase** et appliquer les migrations (blocage nÂ°1 pour un site fonctionnel).
2. Configurer l'URL d'authentification Supabase (`â€¦/auth`) pour les e-mails de confirmation/reset.
3. CrÃ©er le dÃ©pÃ´t GitHub, pousser, activer Pages (voir `DEPLOY.md`).
4. OAuth Google : le flux dÃ©pend du broker Lovable (`/~oauth/initiate`), indisponible sur un
   hÃ©bergement statique â†’ Ã  remplacer par un provider Supabase natif si souhaitÃ©.
5. Tests automatisÃ©s (Vitest/Playwright) et `lint` bloquant en CI.
6. Nettoyage des images Storage Ã  la suppression d'un chapitre/sÃ©rie.
