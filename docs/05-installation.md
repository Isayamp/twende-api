# 05 - Installation (prévue)

> Le code n'existe pas encore. Ce guide sera complété à la semaine 2.

## Prérequis

- Node.js 24 (LTS) et npm
- PostgreSQL 18 (utilisateur `postgres`, port 5432)
- Git

## Étapes prévues

1. Cloner le dépôt.
2. `npm install`
3. Copier `.env.example` en `.env` et remplir les valeurs (voir ci-dessous).
4. Créer la base `twende` dans PostgreSQL.
5. `npx prisma migrate dev` puis `npm run seed`.
6. `npm run dev` pour lancer l'API, `npm test` pour les tests.

## Variables d'environnement (`.env`)

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Adresse de la base. Le mot de passe est saisi par vous. |
| `JWT_SECRET` | Secret de signature des jetons (long, aléatoire) |
| `JWT_ACCES_DUREE` | Durée du jeton d'accès (ex. `15m`) |
| `JWT_RAFRAICHISSEMENT_DUREE` | Durée du jeton de rafraîchissement (ex. `7d`) |
| `CORS_ORIGINES` | Adresses autorisées pour le front |
| `EMAIL_MODE` | `log` (développement) ou `smtp` |
| `SMTP_UTILISATEUR`, `SMTP_MOT_DE_PASSE` | Compte Gmail et mot de passe d'application, saisis par Isaya |

**Règle** : le fichier `.env` n'est jamais dans Git. Aucun mot de passe dans le code ni dans les seeders.

## Pièges connus sur Windows

- L'antivirus Avast remplace les certificats HTTPS : `npm` ou Composer peuvent échouer (« unable to get local issuer certificate »).
  Dans PowerShell, avant `npm install` :
  `$env:NODE_EXTRA_CA_CERTS="C:\Users\isaya\.certs\cacert-combined.pem"`
- Pas de Docker : PostgreSQL est installé en local.
