# Predix — Todo

## F3 — Cœur pronostics ✅ (clôturé le 2026-07-13) — LE sprint critique

- [x] Migration 0007 : `prediction_events` (append-only) + `predictions_current` (projection) + `save_prediction` RPC (porte unique) + helpers lock/competition + trigger immuabilité (BEFORE UPDATE) + RLS (events own-only, projection reveal-after-lock)
- [x] Revue adversariale approfondie (18 findings, dont 1 BLOCKER overflow) — tout corrigé avant push
- [x] Tests SQL lourds VERTS : accepté v1→v2, conflit (preuve auto-suffisante), rejeu idempotent, frontière de verrou, invalid/overflow → rejected_invalid, invariant `version == count(accepted)`, immuabilité, confidentialité RLS (ami voit après verrou seulement)
- [x] Types régénérés ; schéma Zod score + 5 tests unitaires (35 total)
- [x] UI : `/competitions/[id]/predict` — scores par match, « Enregistrer » explicite, état « Enregistré • vN », verrou au coup d'envoi (lecture seule)
- [x] Vérification navigateur bout en bout : save v1 → update v2 → **conflit deux-appareils** (UI recharge la valeur gagnante) ; trace d'audit vérifiée en base
- [ ] (reporté) vue « historique détaillé par match » (toutes tentatives) — l'organisateur/admin en F9 ; le joueur voit sa version actuelle

## Ajouts post-F2 (2026-07-13)

## Ajouts post-F2 (2026-07-13)
- [x] Téléphone à l'inscription (migration 0005 : colonne `phone` E.164 + trigger + grant), champ signup + profil, normalisation FR (06/07 → +33), 6 tests ; vérifié : signup stocke `+33788990011`, profil édite/normalise
- [x] Audit mobile 375px : landing, login, signup, profil, hub, page Gérer (dense) — OK, pas de débordement
- [ ] (F8) envoi WhatsApp réel — le numéro est désormais collecté ; brancher la Cloud API au sprint notifications

## Sprint terminé : F2 — Compétitions & données de jeu

Cadrage : petit tournoi de test d'abord (schéma générique, aucun nombre en dur).

- [x] Migration 0004 : `competitions`/`competition_members`/`teams`/`groups`/`group_teams`/`knockout_stages`/`matches` + RLS (helpers definer anti-récursion) + RPCs `create_competition`/`join_competition` + trigger owner→organizer + triggers d'intégrité inter-compétitions
- [x] Revue adversariale de la migration (RLS/RPC/intégrité) — 4 findings important corrigés avant push (renommage contrat F3, intégrité inter-compétitions, unicité, RESTRICT owner documenté)
- [x] Appliquée sur dev + vérifiée (create/join/RLS/intégrité en SQL) + types régénérés
- [x] Schémas Zod (nom, code d'invitation, équipe, groupe, match) + 8 tests unitaires
- [x] Actions serveur : créer, rejoindre par code, quitter, supprimer
- [x] UI hub « mes compétitions » + création + rejoindre
- [x] UI compétition : vue d'ensemble (membres, code copiable, Gérer/Supprimer/Quitter)
- [x] UI organisateur : page Gérer (équipes/groupes/matchs) + génération d'un tournoi de test en 1 clic
- [x] Vérification navigateur bout en bout : création → code → génération (16 équipes, 4 groupes, 32 matchs) ; join + RLS joueur vérifiés en SQL
- [ ] Import CSV du calendrier — **reporté** : le bouton « tournoi de test » couvre la phase de test ; CSV utile à la montée sur l'Euro complet (51 matchs)
- [ ] (option) UI de saisie manuelle de match plus riche (sélecteurs équipe + datetime) — minimal pour l'instant

Utilisateurs de test dev : `demo@predix.app`/`predixdemo123` (organisateur), `ami@predix.app`/`amipredix123` (2e joueur pour tester à deux en F3).

## F1 — Auth & profils ✅ (clôturé le 2026-07-12)

- [x] Migration 0002 : trigger `handle_new_user` (security definer) — profil créé atomiquement à l'inscription
- [x] Middleware `@supabase/ssr` (fichier `proxy.ts` — nouvelle convention Next 16) : refresh session + protection de routes
- [x] Auth email + mot de passe : Server Actions `signIn/signUp/signOut/updateDisplayName`, Zod des 2 côtés
- [x] Pages `/login`, `/signup`, `/profile` (protégée), route `/auth/confirm`, landing mise à jour
- [x] Type `Database` généré câblé dans les clients Supabase
- [x] Tests : 12 unitaires (dont schémas auth) + 6 e2e (rendu, validation client, protection de route)
- [x] Migration 0002 appliquée sur dev + trigger vérifié (insert réel → profil auto-créé)
- [x] Flux réel prouvé dans le navigateur : login → /profile → modif nom (persistée + header rafraîchi) → logout → redirection
- [x] Revue adversariale sécurité (3 agents) — 3 findings *important* corrigés : open-redirect backslash (helper `safeNextPath` + tests), cookies session perdus sur redirect middleware, trigger bloquant sur email local vide (migration 0003) ; + durcissements (NEXT_PUBLIC_SITE_URL, on-conflict)
- [ ] **DÉCISION Mickael** : confirmation email — le projet dev a `mailer_autoconfirm: false` (confirmation ON) + service email limité. Choisir : (a) désactiver la confirmation (Dashboard → Auth → Providers → Email → décocher "Confirm email") pour les tests, ou (b) configurer un SMTP custom (Resend). Sans l'un des deux, chaque inscription réelle attend un email (rate-limité).
- [ ] (option) `supabase login` une fois pour éviter de passer le mot de passe DB à chaque migration

## F0 — Fondations ✅ (clôturé le 2026-07-12)

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
- [x] Migration appliquée sur dev, vérifiée (`migration list` : local = remote = 20260712185223 ; sonde REST : table présente, RLS actif) — 2026-07-12
- [x] `lib/supabase/types.gen.ts` généré depuis le schéma réel, lint + typecheck verts — 2026-07-12
- [x] CI GitHub verte (échec initial `npm ci` corrigé : lockfile complété via npm@10 + CI sur Node 24) — 2026-07-12
- [x] Production Vercel vérifiée : https://predix-taupe.vercel.app (HTTP 200, garde env OK au boot) — 2026-07-12
- [x] `major_version` config.toml : sans objet dans notre workflow (utilisé seulement par `db diff`, exclu sans Docker) — noté dans l'en-tête du fichier

## Sprints suivants (plan validé le 2026-07-12, détail dans docs/decisions.md)

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
