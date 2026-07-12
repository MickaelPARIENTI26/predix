# Predix — Todo

## Sprint en cours : F0 — Fondations

- [x] Scaffold Next.js (App Router, TS strict, Tailwind 4) + shadcn/ui
- [x] Dépendances : zod, @supabase/supabase-js, @supabase/ssr, vitest, playwright, supabase CLI
- [x] `lib/env.ts` — validation Zod + garde prod↛dev
- [x] Clients Supabase (`lib/supabase/client.ts`, `server.ts`)
- [x] Coquille UI (page d'accueil Predix)
- [x] Première migration (`profiles`, RLS deny-all + policies) — pipeline prouvé sur dev à la création du projet
- [x] Squelette `supabase/seed.sql`
- [x] Vitest (4 tests env) + Playwright (1 smoke)
- [x] CI GitHub Actions (lint, typecheck, unit, e2e)
- [x] README (workflow migrations sans Docker, environnements), CLAUDE.md, docs/decisions.md
- [ ] **Côté Mickael** : créer les 2 projets Supabase (`predix-dev`, `predix-prod`), remplir `.env.local`
- [ ] **Côté Mickael** : créer le repo GitHub + push, connecter Vercel (preview→dev, prod→prod)
- [ ] Appliquer la migration sur dev (`supabase link` + `npm run db:push:dev`) puis `npm run db:types`

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
