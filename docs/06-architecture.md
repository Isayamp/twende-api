# 06 - Architecture (prévue)

## Stack et justification

| Choix | Pourquoi |
|---|---|
| Node.js LTS + Express | Imposé par l'énoncé, simple à expliquer |
| TypeScript | Les erreurs de type sont vues avant l'exécution, surtout pour les montants et les identifiants |
| PostgreSQL | Imposé. Transactions et verrous de ligne (`FOR UPDATE`) indispensables pour les places |
| Prisma | ORM autorisé, requêtes sûres (pas de SQL concaténé), migrations versionnées |
| Zod | Validation des entrées et génération de la documentation OpenAPI |
| JWT court + rafraîchissement | Accès sans état côté serveur, et déconnexion réelle grâce à la révocation |
| bcrypt | Hachage des mots de passe exigé |
| Helmet, CORS, limitation de débit | Protections de base contre les attaques courantes |
| Pino | Journaux structurés, utiles pour les erreurs 500 |
| Vitest + Supertest | Tests rapides de la logique et des routes |

Toute bibliothèque tierce sera justifiée dans le rapport.

## Organisation des dossiers (prévue)

```
twende/
  prisma/            schéma, migrations, seed
  src/
    config/          lecture et validation du .env
    middleware/      authentification, rôles, erreurs, validation
    modules/
      auth/          routes, contrôleur, service, schémas
      stations/ lignes/ vehicules/ trajets/
      reservations/  billets/ passagers/ statistiques/
    lib/             client Prisma, journalisation, utilitaires
    app.ts           assemblage d'Express
    server.ts        démarrage
  tests/             tests par module
  docs/              toute la documentation
```

## Couches

Chaque module suit le même chemin simple :

`route` → `middleware (auth, rôle, validation Zod)` → `contrôleur` (HTTP seulement) → `service` (règles métier) → `Prisma` (base).

Les règles métier vivent **dans les services**, donc elles se testent sans HTTP.

## Principe de code

- Petits fichiers (moins de 400 lignes en général).
- Fonctions courtes, noms français clairs, commentaires courts.
- Pas de modification d'objets en place : on crée de nouveaux objets.
- Erreurs métier = classes d'erreur dédiées, converties en code HTTP par le gestionnaire central.
