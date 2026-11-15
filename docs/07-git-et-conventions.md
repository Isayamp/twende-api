# 07 - Git et conventions

## Branches (inspirées de Git Flow)

- `main` : versions stables, prêtes à présenter.
- `develop` : branche d'intégration. Tout le travail s'y rassemble avant de passer dans `main`.
- `feat/<sujet>` : une branche par fonctionnalité, créée depuis `develop`, fusionnée dans `develop` avec `--no-ff`.
- `fix/`, `docs/`, `chore/` : même principe que `feat/`.
- Quand `develop` est stable, on la fusionne dans `main` (`--no-ff`).

**Aucune branche n'est jamais supprimée**, même après fusion. Elles servent de trace du travail.

## Commits

Format : `type: résumé court en français`. Un commit = un sujet.

| Type | Usage |
|---|---|
| `feat` | nouvelle fonctionnalité |
| `fix` | correction de bug |
| `refactor` | réécriture sans changer le comportement |
| `docs` | documentation |
| `test` | ajout ou changement de tests |
| `chore` | outils, configuration, dépendances |
| `perf` | performance |
| `ci` | intégration continue |

Exemples : `feat: ajouter la recherche de trajets`, `test: prouver la concurrence sur une même place`.

## Règles du groupe

- Les dates des commits sont les dates réelles. Aucun changement de date : l'historique est noté.
- Commits petits et fréquents.
- On ne pousse jamais de secrets (`.env`, mots de passe, clés).
- Les fichiers d'outils personnels sont listés dans `.git/info/exclude`, pas dans `.gitignore`.
- L'auteur est l'identité Git configurée sur la machine de chacun.

## Avant chaque fusion dans `main`

1. Les tests passent.
2. Revue de code faite (et revue de sécurité pour l'authentification, les accès concurrents, la validation).
3. La documentation est à jour (journal de bord et guide de continuité).
