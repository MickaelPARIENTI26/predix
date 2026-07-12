# Predix — Lessons Learned

<!-- Format : [date] | ce qui a mal tourné | règle pour l'éviter -->

| Date | Problème | Règle |
|------|----------|-------|
| 2026-07-12 | (héritée de la conception) `SELECT … FOR UPDATE` ne verrouille rien sur une ligne absente — course à la première sauvegarde | Sérialiser les créations avec `pg_advisory_xact_lock(user, cible)` en tête de `save_prediction` |
| 2026-07-12 | (héritée de la conception) contrôle d'idempotence placé après le contrôle de verrou → un retry post-coup-d'envoi d'un prono déjà committé serait faussement « rejeté » | Ordre strict dans le RPC : adhésion → rejeu idempotent → validation → verrou → version → écriture |
| 2026-07-12 | (héritée de WinUCard) findFirst + update n'est pas atomique | Garde de statut dans le WHERE, ou verrou explicite, pour toute opération de claim concurrente |
| 2026-07-12 | E2E échoué : port 3000 occupé par un autre projet, `reuseExistingServer` a testé la mauvaise app | Predix utilise le port dédié 3100 pour les e2e (playwright.config.ts) ; ne jamais supposer 3000 libre |
| 2026-07-12 | Migration avec policies RLS mais sans GRANT : les policies filtrent les lignes mais ne confèrent aucun privilège → 42501 sur chaque requête (nouveau défaut cloud : tables non auto-exposées) | Chaque migration pose ses GRANTs explicites (column-level si pertinent) dans le même fichier que la table et ses policies |
| 2026-07-12 | todo.md affirmait « pipeline prouvé sur dev » alors qu'aucun projet Supabase n'existe encore | Ne jamais écrire « prouvé/terminé » sans que la preuve ait réellement eu lieu ; nommer le pas qui apportera la preuve |
| 2026-07-12 | Police serif au lieu de Geist : `shadcn/tailwind.css` émet `--font-sans: var(--font-sans)` (cycle → valeur invalide) et attend une définition à `:root` | Après `shadcn init`, définir `--font-sans`/`--font-mono` au niveau `:root` vers les variables next/font ; vérifier visuellement la typo, pas seulement le build |
| 2026-07-12 | CI rouge au premier push : lockfile généré par npm 11 (Node 25 local) incomplet pour le npm 10 de la CI (deps optionnelles @emnapi manquantes → EUSAGE sur `npm ci`) | Aligner la version Node CI sur une LTS moderne (24) ET régénérer le lockfile via `npx npm@10 install --package-lock-only` en cas de doute ; `npm ci --dry-run` avec le npm cible = vérification rapide |
