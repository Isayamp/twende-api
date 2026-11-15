# Twende API

API de gestion des transports et réservations pour une compagnie de bus interurbains.
« Twende » veut dire « allons-y » en swahili.

Projet du cours **Programmation côté serveur** (Master Génie Logiciel, Dr Thierry Mugenzi), groupe 11 :
ISAYA M'LELA Pombo et ASUKULU MUSATO Théophile.

## Ce que fait l'API

- Gère les stations, lignes, tarifs par tronçon, véhicules et trajets planifiés.
- Recherche des trajets (départ, arrivée, date).
- Réserve une ou plusieurs places numérotées, sans jamais vendre deux fois la même place.
- Annule, et génère un billet à numéro unique par place.
- Donne les statistiques de remplissage par trajet.

## État du projet

Conception terminée, socle du projet écrit. Authentification, CRUD et recherche de trajets suivent.
Voir le dossier [`docs/`](docs/README.md) : analyse, MCD, MLD, cas d'utilisation, routes, plan.

## Stack prévue

Node.js, Express, TypeScript, PostgreSQL, Prisma, Zod, JWT, bcrypt, Vitest.

## Démarrage rapide

```bash
npm install
cp .env.example .env     # puis remplir JWT_SECRET et le mot de passe PostgreSQL
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Détails : [docs/05-installation.md](docs/05-installation.md). Tests : `npm test`.

## Comptes de test (après `npm run db:seed`)

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Administrateur | `admin@twende.test` | `Twende#2026` |
| Agent de guichet | `agent@twende.test` | `Twende#2026` |
| Passager | `passager@twende.test` | `Twende#2026` |

Ce sont des valeurs de démonstration, valables seulement en développement.
