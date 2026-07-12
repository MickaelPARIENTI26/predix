# Predix

Application privée de pronostics sportifs entre amis (~100 utilisateurs). Cible : Euro 2028, avec des compétitions de test avant.

**Priorité absolue : la fiabilité et l'auditabilité de l'enregistrement des pronostics.** Chaque tentative (acceptée, refusée après verrou, en conflit entre deux appareils, invalide) laisse une trace horodatée à l'heure serveur dans un journal append-only. Voir `docs/decisions.md`.

## Stack

Next.js (App Router) · TypeScript strict · Tailwind CSS 4 · shadcn/ui · Supabase (Postgres, Auth, Realtime, Edge Functions, Cron) · Vercel · Zod · Vitest · Playwright.

## Commandes

```bash
npm run dev          # serveur de dev (port 3000)
npm run build        # build production
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # tests unitaires (Vitest)
npm run test:e2e     # tests e2e (Playwright)
npm run db:push      # applique les migrations au projet Supabase LIÉ (le ref cible est affiché avant le push)
npm run db:types     # régénère lib/supabase/types.gen.ts
```

## Environnements

Deux projets Supabase **cloud** (pas de stack locale — Docker est exclu de la v1, donc pas de `supabase start` ni `supabase db diff`) :

| Environnement | Projet Supabase | `SUPABASE_ENV` |
|---|---|---|
| Local + Vercel preview | `predix-dev` | `dev` |
| Vercel production | `predix-prod` | `prod` |

`lib/env.ts` (Zod) **refuse au démarrage du serveur** un déploiement production branché sur le projet dev — le contrôle est déclenché par `instrumentation.ts` (hook Next.js exécuté au boot, y compris sur Vercel).

Setup local : copier `.env.example` vers `.env.local` et remplir depuis le dashboard Supabase du projet dev.

## Migrations (workflow sans Docker)

1. Écrire le SQL à la main dans `supabase/migrations/<timestamp UTC>_<nom>.sql`.
2. Appliquer sur dev : `npx supabase link --project-ref <ref-dev>` puis `npm run db:push` — **vérifier le ref affiché avant de confirmer** : le push cible toujours le projet actuellement lié.
3. Régénérer les types : `npm run db:types` (committé).
4. À la release : `supabase link` vers prod puis `npm run db:push` (jamais de seed sur prod), puis re-`link` vers dev immédiatement.
5. Ne **jamais** lancer `supabase config push` (voir l'avertissement en tête de `supabase/config.toml`).

Conventions (détail dans `docs/decisions.md`) :
- Toute migration qui crée une table **active RLS deny-all dans le même fichier**, et pose ses **GRANTs explicites** au même endroit (les policies RLS filtrent les lignes mais ne confèrent aucun privilège — les nouvelles tables ne sont plus auto-exposées aux rôles API).
- Tout horodatage est `timestamptz` (UTC) ; les comparaisons de verrou se font uniquement avec le `now()` de Postgres ; l'affichage se fait dans le fuseau du navigateur.
- Les tables de pronostics n'acceptent **aucune écriture directe** : une seule porte, la fonction RPC `save_prediction` (à partir du sprint F3).

Note : les projets Supabase gratuits inactifs ~1 semaine sont mis en pause — réveiller le projet dev depuis le dashboard si besoin.

## Tests

- Unitaires : `tests/unit/` (Vitest, alias `@/` disponible).
- E2E : `tests/e2e/` (Playwright, Chromium). En local le serveur dev est lancé automatiquement ; en CI c'est le build de production.

## Suivi

- `tasks/todo.md` — état d'avancement sprint par sprint (F0 → F10).
- `tasks/lessons.md` — leçons apprises après chaque correction.
- `docs/decisions.md` — décisions d'architecture et leurs raisons.
