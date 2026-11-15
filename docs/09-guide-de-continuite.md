# 09 - Guide de continuité

Ce guide permet à une autre personne de reprendre le projet sans rien demander.

## État actuel (2026-11-15)

- **Phase** : semaine 1, conception terminée, **en attente de validation du groupe**.
- **Code** : aucun. Dossier `docs/` complet, trois schémas, script SQL de conception.
- **Dépôt GitHub** : https://github.com/Isayamp/twende-api (public). Branches : `main`, `develop` et les branches de travail (aucune n'est supprimée).

## Prochaines étapes

1. Le groupe valide ou corrige la conception.
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

Les mots de passe de test seront définis au moment du seeder et notés ici et dans le README. Rôles prévus :

| Rôle | E-mail prévu |
|---|---|
| Administrateur | `admin@twende.test` |
| Agent de guichet | `agent@twende.test` |
| Passager | `passager@twende.test` |

## Idées futures

Voir la fin de `04-plan-4-semaines.md`.

## Contacts

- ISAYA M'LELA Pombo, ASUKULU MUSATO Théophile (groupe 11)
- Enseignant : Dr Thierry Mugenzi
