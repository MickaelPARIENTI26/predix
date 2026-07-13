# Predix — Claude Code Instructions

## Projet
App privée de pronostics sportifs entre amis (~100 utilisateurs, cible Euro 2028, compétitions de test avant). Un organisateur crée une compétition (code d'invitation), saisit équipes/groupes/matchs, configure le barème et saisit les résultats. Les participants pronostiquent : scores, classements de groupes, équipes qualifiées, bonus (buteur, vainqueur — passeur à confirmer). Classement général + ajustements manuels motivés. Pas de WhatsApp en v1 (canal de notification à décider plus tard).

**PRIORITÉ ABSOLUE : fiabilité et auditabilité de l'enregistrement des pronostics.** Les 7 questions d'audit (quoi, quand exactement, combien de modifications, dernier valide avant verrou, tentatives tardives, échecs, conflits deux-appareils) doivent toujours avoir une réponse prouvable en base.

## Documentation
LIRE AVANT TOUT TRAVAIL :
- `docs/decisions.md` — décisions d'architecture, conception du cœur critique (event log + RPC unique), plan de sprints F0–F10
- `tasks/todo.md` — état actuel
- `tasks/lessons.md` — leçons à appliquer

## Stack
Next.js App Router · TypeScript strict · Tailwind CSS 4 · shadcn/ui · Supabase (Postgres, Auth, Realtime, Edge Functions, Cron) · Vercel · Zod · Vitest · Playwright.
INTERDIT : backend séparé, Express/NestJS, MongoDB, Firebase, Docker (v1), Redis, microservices.

## Règles critiques
1. **Une seule porte d'écriture pour les pronostics** : la fonction Postgres `save_prediction` (RPC). Jamais d'INSERT/UPDATE direct sur `prediction_events` / `predictions_current` — ni dans le code, ni dans un script, ni via service_role.
2. **`prediction_events` est append-only** — jamais d'UPDATE/DELETE, même pour corriger. Une correction = un nouvel événement.
3. **Une seule horloge : le `now()` de Postgres.** Jamais l'heure du client dans une décision. Jamais de paramètre d'horloge de test dans une fonction de prod (les tests contrôlent les fixtures `kickoff_at`).
4. **RLS deny-all dans la même migration** que toute création de table.
5. **TypeScript strict** — pas de `any`, pas de `@ts-ignore`.
6. **Zod des deux côtés** — toute entrée validée client ET serveur.
7. **timestamptz UTC partout**, affichage dans le fuseau du navigateur.
8. **Mobile-first** — les copains pronostiquent depuis leur téléphone.
9. **Rejets métier = retour de statut, jamais RAISE** dans `save_prediction` (sinon l'événement de preuve est rollbacké).
10. **Pas de sur-architecture** — simplicité d'abord, Postgres fait tout (verrous, cron, audit).

## Environnements
**Un seul environnement pour l'instant** (décidé 2026-07-13) : une seule base Supabase (`predix-dev`, ref ryvrxzyztwtjcanlntbj) sert TOUT — local, previews Vercel ET l'URL de prod (predix-taupe.vercel.app). Le projet `predix-prod` (poticedueaaosqvkjrug) reste vide, en réserve pour le vrai lancement Euro 2028 (là on recréera une base propre + on remettra la séparation dev/prod). Migrations SQL manuscrites via `npm run db:push`. Pas de Docker ; jamais `supabase config push`.

## Règle SQL supplémentaire
Les policies RLS ne confèrent aucun privilège : chaque migration pose ses **GRANTs explicites** (column-level quand pertinent) dans le même fichier. Écrire `(select auth.uid())`, jamais `auth.uid()` nu, dans les policies.

## Commandes
```bash
npm run dev / build / lint / typecheck
npm run test / test:watch / test:e2e
npm run db:push / db:types
```

## Phase actuelle
F3 — Cœur pronostics : TERMINÉ (2026-07-13). Porte d'écriture unique `save_prediction` (RPC), `prediction_events` append-only + `predictions_current`, verrouillage au coup d'envoi, idempotence, conflit deux-appareils, RLS reveal-after-lock. Migration 0007. UI `/competitions/[id]/predict`. Vérifié en SQL + navigateur (save/update/conflit). Prochain : **F4 — Résultats & moteur de points** (saisie de résultats, barème versionné, recalcul idempotent, classement). Historique :

F2 — Compétitions & données de jeu : TERMINÉ (2026-07-13). Schéma générique (migration 0004), RPCs create/join, RLS membre/organisateur, page Gérer + génération d'un tournoi de test en 1 clic. Users test dev : demo@predix.app/predixdemo123 (orga), ami@predix.app/amipredix123 (joueur). CSV import reporté à la montée sur l'Euro complet. Prochain : **F3 — Cœur pronostics** (event log + RPC unique `save_prediction`). Historique :

F1 — Auth & profils : TERMINÉ (2026-07-12). Auth email+mot de passe, trigger de création de profil, middleware `proxy.ts`, pages login/signup/profile, flux prouvé en navigateur. Décision en attente côté Mickael : confirmation email (dev a `mailer_autoconfirm: false` + email rate-limité) → désactiver la confirmation au Dashboard OU SMTP custom. Utilisateur démo dev : `demo@predix.app` / `predixdemo123`. Prod : https://predix-taupe.vercel.app · repo github.com/MickaelPARIENTI26/predix · Supabase dev ryvrxzyztwtjcanlntbj / prod poticedueaaosqvkjrug. Prochain sprint : F2 — Compétitions & données de jeu.

## Auth (F1) — points clés
- Une seule convention de session : `proxy.ts` (ex-middleware) appelle `updateSession` (`lib/supabase/middleware.ts`). Ne pas recréer un `middleware.ts`.
- `getUser()` (vérifie le JWT), jamais `getSession()`. Pages protégées : `requireUser()` en tête.
- Profil créé par trigger DB, jamais par le code applicatif.
- Tester l'inscription avec un VRAI domaine email (GoTrue rejette les domaines sans MX).
Plan complet des sprints : voir `docs/decisions.md`.

## DÉMARRAGE DE SESSION
1. Lire `tasks/lessons.md` — appliquer toutes les leçons avant de toucher quoi que ce soit
2. Lire `tasks/todo.md` — comprendre l'état actuel

## WORKFLOW
- Planifier d'abord (plan dans `tasks/todo.md`), avancer sprint par sprint, validation utilisateur entre les sprints
- Ne jamais marquer terminé sans preuve (tests verts, comportement vérifié)
- Après toute correction : ajouter une ligne à `tasks/lessons.md` (format : date | problème | règle)
- Sous-agents pour les tâches lourdes, contexte principal propre
