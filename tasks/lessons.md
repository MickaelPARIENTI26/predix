# Predix — Lessons Learned

<!-- Format : [date] | ce qui a mal tourné | règle pour l'éviter -->

| Date | Problème | Règle |
|------|----------|-------|
| 2026-07-12 | (héritée de la conception) `SELECT … FOR UPDATE` ne verrouille rien sur une ligne absente — course à la première sauvegarde | Sérialiser les créations avec `pg_advisory_xact_lock(user, cible)` en tête de `save_prediction` |
| 2026-07-12 | (héritée de la conception) contrôle d'idempotence placé après le contrôle de verrou → un retry post-coup-d'envoi d'un prono déjà committé serait faussement « rejeté » | Ordre strict dans le RPC : adhésion → rejeu idempotent → validation → verrou → version → écriture |
| 2026-07-12 | (héritée de WinUCard) findFirst + update n'est pas atomique | Garde de statut dans le WHERE, ou verrou explicite, pour toute opération de claim concurrente |
| 2026-07-12 | E2E échoué : port 3000 occupé par un autre projet, `reuseExistingServer` a testé la mauvaise app | Predix utilise le port dédié 3100 pour les e2e (playwright.config.ts) ; ne jamais supposer 3000 libre |
