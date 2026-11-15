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

Conception terminée. Le socle (base, authentification) est la prochaine étape.
Voir le dossier [`docs/`](docs/README.md) : analyse, MCD, MLD, cas d'utilisation, routes, plan.

## Stack prévue

Node.js, Express, TypeScript, PostgreSQL, Prisma, Zod, JWT, bcrypt, Vitest.

Les sections installation, configuration et comptes de test seront complétées avec le code.
