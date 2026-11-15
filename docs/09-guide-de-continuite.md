# 09 - Guide de continuité

Ce guide permet à une autre personne de reprendre le projet sans rien demander.

## État actuel (2026-11-15)

- **Phase** : conception terminée, socle du projet écrit (branche `feat/socle-projet`).
- **Code** : configuration, application Express, erreurs, validation, schéma Prisma, migration, seeder. 16 tests verts.
- **Base** : `twende_api_db`, migration et seeder exécutés (15/11). **Pas encore fait** : authentification, CRUD, recherche.
- **Dépôt GitHub** : https://github.com/Isayamp/twende-api (public). Branches : `main`, `develop` et les branches de travail (aucune n'est supprimée).

## Prochaines étapes

1. (Fait le 15/11 sur la machine d'Isaya) Mot de passe dans `.env`, base `twende_api_db`, lancer `npx prisma migrate deploy` puis `npm run db:seed`.
2. Ajout d'ASUKULU MUSATO Théophile et de l'enseignant comme collaborateurs (sur demande du groupe).
3. Questions-réponses sur le design du front.
4. Semaine 2 : initialisation du projet (voir `04-plan-4-semaines.md`).

## Décisions figées

Voir `01-analyse-besoins.md` section 2 et `02-conception-bd.md` section 7.

## Pièges

- Antivirus Avast : voir `05-installation.md` pour npm.
- Les montants sont toujours décimaux. Jamais de `number` pour de l'argent.
- Une place = un billet non annulé par (trajet, numéro). Ne jamais contourner l'index unique.
- Les mots de passe (PostgreSQL, Gmail) sont saisis par le groupe dans `.env`. Ne jamais les deviner ni les écrire dans Git.

## Comptes de test (prévus pour le seeder)

Le seeder crée ces comptes. Mot de passe de test (valeur de démonstration, modifiable avec `SEED_MOT_DE_PASSE`) : `Twende#2026`. Rôles :

| Rôle | E-mail prévu |
|---|---|
| Administrateur | `admin@twende.test` |
| Agent de guichet | `agent@twende.test` |
| Passager | `passager@twende.test` |
| Passager (second) | `passager2@twende.test` |

## Idées futures

Voir la fin de `04-plan-4-semaines.md`.

## Contacts

- ISAYA M'LELA Pombo, ASUKULU MUSATO Théophile (groupe 11)
- Enseignant : Dr Thierry Mugenzi
