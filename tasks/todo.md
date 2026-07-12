# Predix — Todo

## Sprint en cours : F0 — Fondations

- [x] Scaffold Next.js (App Router, TS strict, Tailwind 4) + shadcn/ui
- [x] Dépendances : zod, @supabase/supabase-js, @supabase/ssr, vitest, playwright, supabase CLI
- [x] `lib/env.ts` — validation Zod + garde prod↛dev
- [x] Clients Supabase (`lib/supabase/client.ts`, `server.ts`)
- [x] Coquille UI (page d'accueil Predix)
- [x] Première migration écrite (`profiles` : RLS + policies + GRANTs explicites) — PAS encore appliquée, preuve au premier `db:push` sur dev
- [x] Squelette `supabase/seed.sql`
- [x] Vitest (4 tests env) + Playwright (1 smoke, port dédié 3100)
- [x] CI GitHub Actions (lint, typecheck, unit, e2e + upload du rapport Playwright en échec)
- [x] README (workflow migrations sans Docker, environnements), CLAUDE.md, docs/decisions.md
- [x] `instrumentation.ts` — la garde env prod↛dev s'exécute réellement au boot serveur
- [x] Revue adversariale du scaffold (2 agents) — blocker GRANTs corrigé + 9 findings traités
- [x] Projets Supabase créés : `predix-dev` (ryvrxzyztwtjcanlntbj) + `predix-prod` (poticedueaaosqvkjrug) ; `.env.local` rempli — 2026-07-12
- [x] Repo GitHub (MickaelPARIENTI26/predix) poussé ; projet Vercel `predix` lié au repo ; 6 env vars posées (production→prod, preview→dev) — 2026-07-12
- [ ] Appliquer la migration sur dev (`supabase db push --db-url ...` — besoin du mot de passe DB dev) puis `npm run db:types`
- [ ] Vérifier `SHOW server_version;` = Postgres 17 sur les deux projets (sinon ajuster `major_version` dans config.toml)
- [ ] Vérifier le déploiement production Vercel (déclenché par ce push)

## Sprints suivants (plan validé le 2026-07-12, détail dans docs/decisions.md)

- F1 Auth & profils (SMTP custom — service email intégré limité)
- F2 Compétitions & données de jeu (CRUD, import CSV, seed réaliste, bracket placeholders)
- F3 CŒUR PRONOSTICS — event log + RPC unique (le sprint critique)
- F4 Résultats & moteur de points (machine d'état résultat, barème versionné, recalcul idempotent)
- F5 Classements de groupes & phase finale
- F6 Bonus & ajustements manuels
- F7 Classement live & finitions mobile
- F8 Notifications (canal à décider — pas de WhatsApp en v1)
- F9 Audit & contestations (vues admin, exports)
- F10 Durcissement & lancement

## Terminé
- [x] Conception complète + revue adversariale multi-agents — 2026-07-12
