# Predix — Décisions d'architecture

Conception validée le 2026-07-12 (document complet produit avec revue adversariale multi-agents). Ce fichier est la référence : toute session de travail future doit pouvoir repartir d'ici.

## Produit

App privée (~100 amis). Une **compétition** est créée librement (nom au choix), les amis rejoignent par code d'invitation, et chaque compétition contient ses propres équipes/groupes/matchs (un import CSV évite la re-saisie). Cible réelle : Euro 2028 ; des compétitions de test avant. **Pas de WhatsApp en v1** (décision 2026-07-12) — pas de collecte de téléphone, canal de notification à décider plus tard. Bonus « meilleur passeur » : à confirmer (risque de litige sur la source officielle des passes décisives).

## Architecture

Une app Next.js sur Vercel (UI + Server Actions) ; Supabase est le seul backend (Postgres + RLS, Auth, Realtime, Edge Functions, Cron). Pas de Redis, queue, ni service annexe : Postgres fait tout (verrous, horloge, journal, cron, calcul des points).

**Principe central : une seule porte d'écriture pour les pronostics** — la fonction Postgres `save_prediction` (RPC), transactionnelle. Zéro grant direct sur les tables de pronostics. Tout le reste de l'app est du CRUD banal sous RLS.

## Cœur critique (à construire en F3)

Deux tables génériques (un type de cible + payload jsonb — PAS une table par type de prono ; verdict unanime de la revue : 4 tables = 4 fois plus d'endroits où la garantie d'audit dérive) :

- **`prediction_events`** — append-only, LA source de vérité. 1 ligne par tentative arrivée au serveur, acceptée OU rejetée : `id bigint identity` (ordre total), `event_uuid` (clé d'idempotence client, unique par `(user_id, event_uuid)`), `user_id` (estampillé `auth.uid()`, jamais un paramètre), `target_kind` ('match_score'|'group_ranking'|'qualified_teams'|'bonus'), `target_id`, `payload jsonb`, `outcome` ('accepted'|'rejected_locked'|'rejected_conflict'|'rejected_invalid'), `base_version`, `resulting_version`, `previous_payload` (preuve de conflit auto-suffisante), `lock_at` (deadline snapshotée = preuve), `server_received_at` (le MÊME `now()` que la comparaison de verrou), `client_sent_at` + `device_id` (déclaratifs, jamais décisionnels). Trigger BEFORE UPDATE/DELETE qui RAISE — inaltérable, y compris pour l'organisateur.
- **`predictions_current`** — projection (dernier accepté par user×cible, `version`), mise à jour dans la même transaction, reconstructible depuis le log (test d'invariant permanent : rebuild + diff vide ; `version` = count(accepted)).

Ordre des contrôles dans `save_prediction` (exigence de correction, pas un détail) :
1. identité `auth.uid()` + adhésion à la compétition ;
2. **rejeu idempotent AVANT le verrou** — `(user_id, event_uuid)` existant ⇒ vérifier la cible, renvoyer le résultat original sans écrire (un prono committé à 19:59:59 dont la réponse s'est perdue, retenté à 20:00:05, doit répondre « enregistré à 19:59:59 », pas « trop tard ») ;
3. **`pg_advisory_xact_lock(user, cible)`** — `FOR UPDATE` ne verrouille pas une ligne absente : sans advisory lock, deux premières sauvegardes simultanées s'écrasent sans trace de conflit ;
4. validation sémantique du payload (équipes/joueurs de la compétition) ⇒ sinon `rejected_invalid` ;
5. verrou temporel : `v_now := now()` capturé UNE fois ; deadline via le helper STABLE `prediction_lock_at(kind, target_id)` ⇒ sinon `rejected_locked` ;
6. `FOR UPDATE` + contrôle de version optimiste ⇒ sinon `rejected_conflict` (avec les deux payloads et les deux device_id) ;
7. upsert projection `RETURNING version` (jamais `base_version + 1` recalculé) ⇒ événement `accepted` ;
8. **retour de statut typé, jamais RAISE pour un rejet métier** (sinon l'événement de preuve est rollbacké) ; catch `unique_violation` pour deux retries strictement concurrents.

Les deadlines vivent sur leur porteur naturel : `matches.kickoff_at`, `groups.ranking_lock_at`, `knockout_stages.lock_at`, `bonus_questions.lock_at` — un report les déplace automatiquement. RLS de lecture : ses propres lignes toujours ; celles des autres **après le verrou résolu en live** par le même helper (jamais le `lock_at` snapshoté : sinon un match reporté expose des pronos encore modifiables ; le snapshot est une preuve, pas une règle d'accès).

Les points dérivés ne vivent JAMAIS sur les lignes de pronostics (sinon le job de scoring « modifie » des pronos après verrou) : table `scores` séparée (cache par joueur, détail jsonb estampillé `rules_version`, recalcul idempotent). `scoring_rules` = paramètres numériques en lignes versionnées, pas un moteur de règles. `manual_adjustments` et `admin_events` (reports, résultats, corrections, versions de barème) sont append-only.

Limite assumée : une tentative qui n'atteint jamais Postgres ne laisse pas de trace serveur ; le client la matérialise par un état « NON ENREGISTRÉ » persistant + retry idempotent.

## Environnements & workflow (pas de Docker en v1)

Deux projets Supabase cloud : `predix-dev` (local + previews Vercel) et `predix-prod` (production). Pas de `supabase start` ni `db diff` : migrations SQL manuscrites, `supabase db push`, `gen types` committé. `lib/env.ts` refuse un build production branché sur dev (`SUPABASE_ENV`). Conventions : RLS deny-all dans la même migration que la table ; `timestamptz` UTC partout ; comparaison de verrou uniquement côté Postgres ; jamais de paramètre d'horloge de test dans une fonction de prod (les tests pilotent les fixtures `kickoff_at`).

## Plan de sprints

F0 Fondations ✅ → F1 Auth & profils (SMTP custom obligatoire) → F2 Compétitions & données de jeu (CRUD, import CSV, seed réaliste, bracket à emplacements) → **F3 Cœur pronostics** (tout le bloc ci-dessus + tests lourds : frontière de verrou, conflit, rejeu, invariant de reconstruction, e2e deux navigateurs) → F4 Résultats & points (machine d'état provisoire/final/corrigé, barème versionné) → F5 Groupes & phase finale → F6 Bonus & ajustements → F7 Classement live (Realtime ou refetch — trancher là) → F8 Notifications (canal à décider) → F9 Audit & contestations → F10 Durcissement & lancement (revue RLS, tie-breakers, backups/PITR avant les vrais pronos, suppression-de-mes-données, bêta).

Périmètre volontairement exclu de la v1 : WhatsApp, points provisoires pendant les matchs, moteur de règles générique, gestion multi-organisateurs.
