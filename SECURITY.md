# SECURITY — AMO-SCANS-FR

Politique de sécurité du dépôt `Assia123y/amo-scans-fr` : gestion des secrets, modèle d'autorisation (RLS), signalement de vulnérabilités.

---

## 1. Portée et versions

| Élément             | Détail                                                                     |
| ------------------- | -------------------------------------------------------------------------- |
| Composant           | application web AMO-SCANS-FR (TanStack Start + Supabase)                   |
| Branches maintenues | `main` / `master` (branche de déploiement)                                 |
| Surface exposée     | site public GitHub Pages ; API Supabase (PostgREST, Auth, Storage)         |
| Hors périmètre      | projet Supabase lui-même (infogérance Supabase), GitHub, navigateurs tiers |

---

## 2. Signalement d'une vulnérabilité

**Ne pas ouvrir d'issue publique** pour une faille exploitable.

1. **Recommandé** : GitHub → onglet **Security** du dépôt → **Report a vulnerability** (GitHub Security Advisory privé). C'est le canal privé suivi par le mainteneur.
2. Sinon, contacter le mainteneur du dépôt en privé via son profil GitHub (`Assia123y`).

Merci d'inclure : description, étapes de reproduction, impact estimé, version/commit concerné, et — si possible — une preuve de concept minimale.

Objectifs de traitement (indicatifs, sans engagement contractuel) :

| Étape                               | Délai visé                           |
| ----------------------------------- | ------------------------------------ |
| Accusé de réception                 | 3 jours ouvrés                       |
| Première évaluation (gravité, plan) | 10 jours ouvrés                      |
| Correctif                           | selon gravité (critique en priorité) |

Une divulgation coordonnée est appréciée : laisser un délai raisonnable avant toute publication.

---

## 3. Gestion des secrets

### 3.1 Ce qui est public par conception

| Élément                                         | Statut     | Explication                                                                                                                                                                                            |
| ----------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| URL du projet Supabase                          | **Public** | Visible dans le bundle client.                                                                                                                                                                         |
| Clé `anon` / **publishable** Supabase           | **Public** | Embarquée dans le JavaScript livré au navigateur. Elle n'accorde que les droits autorisés par les **politiques RLS**. Sa présence dans `.env.production` et `.github/workflows/ci.yml` est volontaire. |
| Contenu du catalogue, séries, planches publiées | Public     | Données destinées à la lecture.                                                                                                                                                                        |

> Corollaire : **la sécurité des données ne repose jamais sur le secret de la clé anon**, uniquement sur les RLS. Toute nouvelle table doit être créée avec `ENABLE ROW LEVEL SECURITY` + politiques explicites.

### 3.2 Ce qui doit rester secret

| Élément                                         | Où il doit vivre                                                                                       | Interdits                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`                     | secret serveur : `wrangler secret put` (Cloudflare) ou variable d'environnement serveur non versionnée | jamais dans le code, une variable `VITE_*`, `.env.production`, un fichier de config, une issue/PR |
| Jeton d'accès **Lovable** (`.workspace/`)       | local uniquement                                                                                       | ignoré par `.gitignore` (`.workspace/`), ne jamais copier dans un livrable                        |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | secrets GitHub Actions (Settings → Secrets and variables → Actions)                                    | jamais dans le YAML ni dans le code                                                               |
| Mots de passe / jetons de test                  | gestionnaire de secrets local                                                                          | jamais dans les migrations, fixtures ou doc                                                       |

Le fichier **`.env`** (clés locales, éventuelle clé de service) est **ignoré par git**. Seuls `.env.example` (modèle) et `.env.production` (valeurs publiques) sont versionnés.

### 3.3 Bonnes pratiques du dépôt

- `git status --short` / `git ls-files` avant chaque push : vérifier l'absence de `.env`, `.env.local`, `.workspace/`.
- Activer sur GitHub (Settings → **Code security** ) : **Secret scanning**, **Push protection**, **Dependabot alerts** et mises à jour de sécurité.
- Les dépendances sont verrouillées par `package-lock.json` ; la CI installe avec `npm ci` (versions exactes).
- Ne pas éditer les fichiers **auto-générés** (`src/integrations/supabase/{client,client.server,auth-middleware,types}.ts`, `src/routeTree.gen.ts`) : ils sont produits par l'outillage et peuvent être régénérés.
- Le mode développement peut afficher des traces d'erreur dans l'UI (`import.meta.env.DEV`) ; en production, `src/server.ts` renvoie une page d'erreur générique et journalise côté serveur.

---

## 4. Autorisation — résumé RLS

Toutes les tables publiques ont **RLS activée**. La fonction `public.has_role(uuid, app_role)` (SECURITY DEFINER) est le seul point de vérité pour les rôles ; son exécution est accordée à `anon` et `authenticated` (migration `20260522185257`), et refusée pour les autres fonctions internes (migration `20260516184647`).

| Table                               | Lecture                                                               | Écriture                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                          | publique                                                              | propriétaire uniquement                                                                                                          |
| `user_roles`                        | propriétaire ou admin                                                 | admin uniquement                                                                                                                 |
| `comments`                          | publique                                                              | insertion : utilisateur authentifié (`user_id = auth.uid()`) ; modification : propriétaire ; suppression : propriétaire ou admin |
| `series`                            | séries publiées ; brouillons réservés à l'auteur/admin                | auteur de la série ayant le rôle `author`/`admin`                                                                                |
| `chapters`                          | chapitres publiés de séries publiées ; sinon auteur/admin             | auteur/admin de la série parente                                                                                                 |
| `panels`                            | planches de chapitres publiés de séries publiées ; sinon auteur/admin | auteur/admin de la série parente                                                                                                 |
| `storage.objects` (bucket `manhwa`) | publique (bucket public, lecture par URL)                             | upload : `author`/`admin` ; modification/suppression : propriétaire (suppression : propriétaire ou admin)                        |

La clé **`service_role` contourne intégralement ces règles** : elle ne doit être utilisée que dans du code serveur de confiance (`src/integrations/supabase/client.server.ts`), jamais dans du code client.

---

## 5. Authentification

- **Supabase Auth** : e-mail + mot de passe (minimum 8 caractères côté UI), confirmation d'e-mail selon la configuration du projet Supabase.
- **Google OAuth** via l'intégration Lovable Cloud (`@lovable.dev/cloud-auth-js`). Cette intégration dépend du service Lovable ; pour un déploiement autonome, configurer le provider Google dans Supabase et utiliser `supabase.auth.signInWithOAuth`.
- **Rôles** : `reader` (par défaut), `author`, `admin`. Le **premier compte inscrit** reçoit automatiquement `admin` + `author` (migration `20260516185320`) — opération à effectuer immédiatement après l'initialisation de la base, avant toute ouverture publique.
- Session conservée dans `localStorage` (JWT), rafraîchissement automatique. Il n'y a **ni MFA ni politique de complexité de mot de passe** en natif dans l'application : à activer dans les réglages Auth de Supabase si nécessaire.
- Les pages `/admin` et `/auth` sont `noindex`. La garde d'accès existe **des deux côtés** : redirection UI **et** RLS.

---

## 6. Limitations / points de vigilance connus

| Sujet                       | État actuel                                        | Recommandation                                                                                           |
| --------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| CSP / en-têtes de sécurité  | non configurés (hébergement statique GitHub Pages) | ajouter une CSP compatible (Cloudflare, `<meta>` limitée) et `Referrer-Policy`                           |
| Rate limiting               | non implémenté côté application                    | s'appuyer sur les quotas Supabase / un proxy edge ; limiter les insertions de commentaires en cas d'abus |
| Modération des commentaires | suppression propriétaire/admin seulement           | prévoir signalement + modération, supprimer le contenu au besoin                                         |
| Uploads Storage             | contrôlés par rôle + type MIME côté client         | ajouter des contraintes de taille/type côté bucket (Supabase) et vérifier les dimensions serveur         |
| Sitemap dynamique SSR       | `BASE_URL` vide dans `src/routes/sitemap[.]xml.ts` | ne pas exposer la route SSR tant que l'URL n'est pas renseignée                                          |
| Dépendances                 | pas de Dependabot configuré                        | activer Dependabot + `npm audit` en CI                                                                   |
| Licences des assets         | visuels propriétaires du studio                    | ne pas réutiliser hors du projet                                                                         |

---

## 7. Rotation des clés

| Secret                            | Procédure                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clé **anon/publishable**          | dashboard Supabase → **Project Settings → API** → régénérer ; mettre à jour `.env.production`, `.github/workflows/ci.yml` puis redéployer (rebuild obligatoire : la clé est inlinée). |
| `SUPABASE_SERVICE_ROLE_KEY`       | dashboard Supabase → régénérer ; mettre à jour le secret serveur (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY`) ; redémarrer/redeployer le Worker.                                 |
| JWT secret Supabase               | dashboard → **JWT Settings** ; rotation invalide **toutes** les sessions actives (déconnexion globale attendue).                                                                      |
| `CLOUDFLARE_API_TOKEN`            | dashboard Cloudflare → révoquer/créer un token ; mettre à jour le secret GitHub.                                                                                                      |
| Jeton **Lovable** (`.workspace/`) | révoquer depuis le compte Lovable ; ne jamais le publier.                                                                                                                             |

Après toute rotation : vérifier le site public, les workflows CI/Pages, et `git log -p` sur les fichiers d'environnement pour confirmer qu'aucun secret n'a été versionné.

---

## 8. En cas de fuite de secret

1. **Révoquer** immédiatement la clé concernée (Supabase / Cloudflare / Lovable).
2. **Évaluer l'exposition** : journaux Supabase (requêtes PostgREST, Storage), journaux Cloudflare, historique git (`git log -p -- .env .env.production`).
3. **Purger l'historique** si nécessaire (`git filter-repo`, ou retirer le fichier puis invalider la clé — une clé poussée dans un dépôt public doit être considérée comme compromise même après suppression du commit).
4. **Redéployer** avec les nouvelles valeurs ; vérifier les RLS et l'intégrité des données (séries/chapitres/planches/commentaires).
5. Documenter l'incident dans le Security Advisory privé.
