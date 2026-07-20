# Predix — Checklist de lancement

À faire **avant d'inviter de vrais amis** (l'app est fonctionnelle ; ces points relèvent de la mise en production).

## Bloquant — à faire absolument

- [ ] **Base de production propre.** Aujourd'hui une seule base Supabase sert tout (dev + URL de prod) et contient des données de test (`demo@predix.app`, `ami@predix.app`, compétition « Coupe du Monde entre potes »). Avant le lancement :
  - créer une base prod neuve **OU** purger les données de test de la base actuelle ;
  - re-séparer dev/prod et **remettre la garde `lib/env.ts`** (prod↛dev) retirée en single-env.
- [ ] **Envoi d'emails fiable.** Le service email intégré de Supabase est limité (~quelques/heure) → configurer un **SMTP custom (Resend)** dans le dashboard Auth. Nécessaire pour la confirmation d'email (si réactivée) et le « mot de passe oublié ».
- [ ] **Sauvegardes.** Activer les backups / **PITR** (Supabase **Pro**, payant) **avant** que de vrais pronos existent. Décider free vs Pro (le free se met aussi en pause après ~1 semaine d'inactivité).
- [ ] **Appliquer les 4 migrations de durcissement F10** (`db push`) — écrites mais pas encore appliquées (CLI Supabase non liée en dev). Vérifier chacune contre la base après application :
  - `20260720101000_profile_phone_private` — **BLOCKER RGPD** : sans elle, tout inscrit peut aspirer les numéros de téléphone. Doit partir **avec** le déploiement du code (`getProfile` lit désormais via la RPC `get_my_profile`).
  - `20260720101500_matches_delete_audit` — supprimer un match terminé était non audité + laissait le classement figé.
  - `20260720102000_group_ranking_valid_notnull` — un prono de classement malformé polluait le journal d'audit.
  - `20260720100000_owner_cannot_leave` — un owner pouvait s'auto-exclure de sa compétition via l'API directe.
- [ ] **Re-lancer la revue de sécurité** (`/ultrareview` ou le workflow F10) et corriger les findings après les « beaucoup de modifications » à venir.

## Important — avant d'ouvrir largement

- [ ] **Mot de passe oublié.** Flux non implémenté (le back `/auth/confirm` gère déjà le type `recovery`). Ajouter : page « mot de passe oublié » (`resetPasswordForEmail`) + page de nouveau mot de passe. Dépend de l'email fiable ci-dessus.
- [ ] **Suivi d'erreurs (Sentry).** Aucun pour l'instant → un 500 en prod n'est visible que dans les logs Vercel. Brancher Sentry (free tier) sur les Server Actions + le middleware.
- [ ] **Suppression de compte / droit à l'effacement.** `competitions.owner_user_id` est `on delete restrict` → un propriétaire de compétition ne peut pas supprimer son compte. Ajouter un flux « transférer ou supprimer la compétition » + un RPC `transfer_competition_owner`, puis la suppression de compte.
- [ ] **Tie-breakers documentés.** Classement à égalité : points → scores exacts → écarts → nom (implémenté). Confirmer que c'est la règle voulue.

## Nice-to-have

- [ ] Domaine personnalisé (au lieu de `predix-taupe.vercel.app`).
- [ ] Consentement RGPD pour le stockage du téléphone (au moment de brancher WhatsApp / F8).
- [ ] Vérifier les quotas Realtime / le plan Supabase pour ~100 connexions simultanées.
- [ ] Générer les types Supabase proprement (le `gen types` du CLI exige Docker ; types.gen.ts est maintenu à la main).

## Sprints restants (feuille de route)

- **F8** — Notifications (reporté ; numéro déjà collecté ; canal à décider : email digest / WhatsApp Cloud API).
- **Briques dédiées** — résolution du tableau à élimination (débloque les pronos d'équipes qualifiées) ; API résultats (classement 100 % auto, football-data.org gratuit couvre Euro/CdM).
