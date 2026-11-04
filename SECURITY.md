# SECURITY â€” AMO-SCANS-FR

Politique de sÃ©curitÃ© du dÃ©pÃ´t `Assia123y/Manhwas-amo` : gestion des secrets, modÃ¨le d'autorisation (RLS), signalement de vulnÃ©rabilitÃ©s.

---

## 1. PortÃ©e et versions

| Ã‰lÃ©ment             | DÃ©tail                                                                     |
| ------------------- | -------------------------------------------------------------------------- |
| Composant           | application web AMO-SCANS-FR (TanStack Start + Supabase)                   |
| Branches maintenues | `main` / `master` (branche de dÃ©ploiement)                                 |
| Surface exposÃ©e     | site public GitHub Pages ; API Supabase (PostgREST, Auth, Storage)         |
| Hors pÃ©rimÃ¨tre      | projet Supabase lui-mÃªme (infogÃ©rance Supabase), GitHub, navigateurs tiers |

---

## 2. Signalement d'une vulnÃ©rabilitÃ©

**Ne pas ouvrir d'issue publique** pour une faille exploitable.

1. **RecommandÃ©** : GitHub â†’ onglet **Security** du dÃ©pÃ´t â†’ **Report a vulnerability** (GitHub Security Advisory privÃ©). C'est le canal privÃ© suivi par le mainteneur.
2. Sinon, contacter le mainteneur du dÃ©pÃ´t en privÃ© via son profil GitHub (`Assia123y`).

Merci d'inclure : description, Ã©tapes de reproduction, impact estimÃ©, version/commit concernÃ©, et â€” si possible â€” une preuve de concept minimale.

Objectifs de traitement (indicatifs, sans engagement contractuel) :

| Ã‰tape                               | DÃ©lai visÃ©                           |
| ----------------------------------- | ------------------------------------ |
| AccusÃ© de rÃ©ception                 | 3 jours ouvrÃ©s                       |
| PremiÃ¨re Ã©valuation (gravitÃ©, plan) | 10 jours ouvrÃ©s                      |
| Correctif                           | selon gravitÃ© (critique en prioritÃ©) |

Une divulgation coordonnÃ©e est apprÃ©ciÃ©e : laisser un dÃ©lai raisonnable avant toute publication.

---

## 3. Gestion des secrets

### 3.1 Ce qui est public par conception

| Ã‰lÃ©ment                                         | Statut     | Explication                                                                                                                                                                                            |
| ----------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| URL du projet Supabase                          | **Public** | Visible dans le bundle client.                                                                                                                                                                         |
| ClÃ© `anon` / **publishable** Supabase           | **Public** | EmbarquÃ©e dans le JavaScript livrÃ© au navigateur. Elle n'accorde que les droits autorisÃ©s par les **politiques RLS**. Sa prÃ©sence dans `.env.production` et `.github/workflows/ci.yml` est volontaire. |
| Contenu du catalogue, sÃ©ries, planches publiÃ©es | Public     | DonnÃ©es destinÃ©es Ã  la lecture.                                                                                                                                                                        |

> Corollaire : **la sÃ©curitÃ© des donnÃ©es ne repose jamais sur le secret de la clÃ© anon**, uniquement sur les RLS. Toute nouvelle table doit Ãªtre crÃ©Ã©e avec `ENABLE ROW LEVEL SECURITY` + politiques explicites.

### 3.2 Ce qui doit rester secret

| Ã‰lÃ©ment                                         | OÃ¹ il doit vivre                                                                                       | Interdits                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`                     | secret serveur : `wrangler secret put` (Cloudflare) ou variable d'environnement serveur non versionnÃ©e | jamais dans le code, une variable `VITE_*`, `.env.production`, un fichier de config, une issue/PR |
| Jeton d'accÃ¨s **Lovable** (`.workspace/`)       | local uniquement                                                                                       | ignorÃ© par `.gitignore` (`.workspace/`), ne jamais copier dans un livrable                        |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | secrets GitHub Actions (Settings â†’ Secrets and variables â†’ Actions)                                    | jamais dans le YAML ni dans le code                                                               |
| Mots de passe / jetons de test                  | gestionnaire de secrets local                                                                          | jamais dans les migrations, fixtures ou doc                                                       |

Le fichier **`.env`** (clÃ©s locales, Ã©ventuelle clÃ© de service) est **ignorÃ© par git**. Seuls `.env.example` (modÃ¨le) et `.env.production` (valeurs publiques) sont versionnÃ©s.

### 3.3 Bonnes pratiques du dÃ©pÃ´t

- `git status --short` / `git ls-files` avant chaque push : vÃ©rifier l'absence de `.env`, `.env.local`, `.workspace/`.
- Activer sur GitHub (Settings â†’ **Code security** ) : **Secret scanning**, **Push protection**, **Dependabot alerts** et mises Ã  jour de sÃ©curitÃ©.
- Les dÃ©pendances sont verrouillÃ©es par `package-lock.json` ; la CI installe avec `npm ci` (versions exactes).
- Ne pas Ã©diter les fichiers **auto-gÃ©nÃ©rÃ©s** (`src/integrations/supabase/{client,client.server,auth-middleware,types}.ts`, `src/routeTree.gen.ts`) : ils sont produits par l'outillage et peuvent Ãªtre rÃ©gÃ©nÃ©rÃ©s.
- Le mode dÃ©veloppement peut afficher des traces d'erreur dans l'UI (`import.meta.env.DEV`) ; en production, `src/server.ts` renvoie une page d'erreur gÃ©nÃ©rique et journalise cÃ´tÃ© serveur.

---

## 4. Autorisation â€” rÃ©sumÃ© RLS

Toutes les tables publiques ont **RLS activÃ©e**. La fonction `public.has_role(uuid, app_role)` (SECURITY DEFINER) est le seul point de vÃ©ritÃ© pour les rÃ´les ; son exÃ©cution est accordÃ©e Ã  `anon` et `authenticated` (migration `20260522185257`), et refusÃ©e pour les autres fonctions internes (migration `20260516184647`).

| Table                               | Lecture                                                               | Ã‰criture                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                          | publique                                                              | propriÃ©taire uniquement                                                                                                          |
| `user_roles`                        | propriÃ©taire ou admin                                                 | admin uniquement                                                                                                                 |
| `comments`                          | publique                                                              | insertion : utilisateur authentifiÃ© (`user_id = auth.uid()`) ; modification : propriÃ©taire ; suppression : propriÃ©taire ou admin |
| `series`                            | sÃ©ries publiÃ©es ; brouillons rÃ©servÃ©s Ã  l'auteur/admin                | auteur de la sÃ©rie ayant le rÃ´le `author`/`admin`                                                                                |
| `chapters`                          | chapitres publiÃ©s de sÃ©ries publiÃ©es ; sinon auteur/admin             | auteur/admin de la sÃ©rie parente                                                                                                 |
| `panels`                            | planches de chapitres publiÃ©s de sÃ©ries publiÃ©es ; sinon auteur/admin | auteur/admin de la sÃ©rie parente                                                                                                 |
| `storage.objects` (bucket `manhwa`) | publique (bucket public, lecture par URL)                             | upload : `author`/`admin` ; modification/suppression : propriÃ©taire (suppression : propriÃ©taire ou admin)                        |

La clÃ© **`service_role` contourne intÃ©gralement ces rÃ¨gles** : elle ne doit Ãªtre utilisÃ©e que dans du code serveur de confiance (`src/integrations/supabase/client.server.ts`), jamais dans du code client.

---

## 5. Authentification

- **Supabase Auth** : e-mail + mot de passe (minimum 8 caractÃ¨res cÃ´tÃ© UI), confirmation d'e-mail selon la configuration du projet Supabase.
- **Google OAuth** via l'intÃ©gration Lovable Cloud (`@lovable.dev/cloud-auth-js`). Cette intÃ©gration dÃ©pend du service Lovable ; pour un dÃ©ploiement autonome, configurer le provider Google dans Supabase et utiliser `supabase.auth.signInWithOAuth`.
- **RÃ´les** : `reader` (par dÃ©faut), `author`, `admin`. Le **premier compte inscrit** reÃ§oit automatiquement `admin` + `author` (migration `20260516185320`) â€” opÃ©ration Ã  effectuer immÃ©diatement aprÃ¨s l'initialisation de la base, avant toute ouverture publique.
- Session conservÃ©e dans `localStorage` (JWT), rafraÃ®chissement automatique. Il n'y a **ni MFA ni politique de complexitÃ© de mot de passe** en natif dans l'application : Ã  activer dans les rÃ©glages Auth de Supabase si nÃ©cessaire.
- Les pages `/admin` et `/auth` sont `noindex`. La garde d'accÃ¨s existe **des deux cÃ´tÃ©s** : redirection UI **et** RLS.

---

## 6. Limitations / points de vigilance connus

| Sujet                       | Ã‰tat actuel                                        | Recommandation                                                                                           |
| --------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| CSP / en-tÃªtes de sÃ©curitÃ©  | non configurÃ©s (hÃ©bergement statique GitHub Pages) | ajouter une CSP compatible (Cloudflare, `<meta>` limitÃ©e) et `Referrer-Policy`                           |
| Rate limiting               | non implÃ©mentÃ© cÃ´tÃ© application                    | s'appuyer sur les quotas Supabase / un proxy edge ; limiter les insertions de commentaires en cas d'abus |
| ModÃ©ration des commentaires | suppression propriÃ©taire/admin seulement           | prÃ©voir signalement + modÃ©ration, supprimer le contenu au besoin                                         |
| Uploads Storage             | contrÃ´lÃ©s par rÃ´le + type MIME cÃ´tÃ© client         | ajouter des contraintes de taille/type cÃ´tÃ© bucket (Supabase) et vÃ©rifier les dimensions serveur         |
| Sitemap dynamique SSR       | `BASE_URL` vide dans `src/routes/sitemap[.]xml.ts` | ne pas exposer la route SSR tant que l'URL n'est pas renseignÃ©e                                          |
| DÃ©pendances                 | pas de Dependabot configurÃ©                        | activer Dependabot + `npm audit` en CI                                                                   |
| Licences des assets         | visuels propriÃ©taires du studio                    | ne pas rÃ©utiliser hors du projet                                                                         |

---

## 7. Rotation des clÃ©s

| Secret                            | ProcÃ©dure                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ClÃ© **anon/publishable**          | dashboard Supabase â†’ **Project Settings â†’ API** â†’ rÃ©gÃ©nÃ©rer ; mettre Ã  jour `.env.production`, `.github/workflows/ci.yml` puis redÃ©ployer (rebuild obligatoire : la clÃ© est inlinÃ©e). |
| `SUPABASE_SERVICE_ROLE_KEY`       | dashboard Supabase â†’ rÃ©gÃ©nÃ©rer ; mettre Ã  jour le secret serveur (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY`) ; redÃ©marrer/redeployer le Worker.                                 |
| JWT secret Supabase               | dashboard â†’ **JWT Settings** ; rotation invalide **toutes** les sessions actives (dÃ©connexion globale attendue).                                                                      |
| `CLOUDFLARE_API_TOKEN`            | dashboard Cloudflare â†’ rÃ©voquer/crÃ©er un token ; mettre Ã  jour le secret GitHub.                                                                                                      |
| Jeton **Lovable** (`.workspace/`) | rÃ©voquer depuis le compte Lovable ; ne jamais le publier.                                                                                                                             |

AprÃ¨s toute rotation : vÃ©rifier le site public, les workflows CI/Pages, et `git log -p` sur les fichiers d'environnement pour confirmer qu'aucun secret n'a Ã©tÃ© versionnÃ©.

---

## 8. En cas de fuite de secret

1. **RÃ©voquer** immÃ©diatement la clÃ© concernÃ©e (Supabase / Cloudflare / Lovable).
2. **Ã‰valuer l'exposition** : journaux Supabase (requÃªtes PostgREST, Storage), journaux Cloudflare, historique git (`git log -p -- .env .env.production`).
3. **Purger l'historique** si nÃ©cessaire (`git filter-repo`, ou retirer le fichier puis invalider la clÃ© â€” une clÃ© poussÃ©e dans un dÃ©pÃ´t public doit Ãªtre considÃ©rÃ©e comme compromise mÃªme aprÃ¨s suppression du commit).
4. **RedÃ©ployer** avec les nouvelles valeurs ; vÃ©rifier les RLS et l'intÃ©gritÃ© des donnÃ©es (sÃ©ries/chapitres/planches/commentaires).
5. Documenter l'incident dans le Security Advisory privÃ©.
