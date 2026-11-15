# 05 - Installation

## Prérequis

- Node.js 22 ou plus (testé avec Node 24) et npm
- PostgreSQL 18 (utilisateur `postgres`, port 5432)
- Git

## Étapes

1. Cloner le dépôt : `git clone https://github.com/Isayamp/twende-api.git` puis `cd twende-api`.
2. `npm install`
3. Copier `.env.example` en `.env`, puis remplir `JWT_SECRET` et le mot de passe dans `DATABASE_URL` (voir le tableau plus bas).
4. Créer la base : `psql -U postgres -c "CREATE DATABASE twende_api_db;"` (le mot de passe PostgreSQL vous est demandé, saisissez-le vous-même).
5. Créer les tables : `npx prisma migrate deploy`
6. Remplir les données de test : `npm run db:seed`
7. Lancer l'API : `npm run dev` (http://localhost:3000/api/v1/health).

## Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance l'API qui se recharge à chaque changement |
| `npm test` | Lance les tests |
| `npm run coverage` | Tests avec le taux de couverture |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run db:generer` | Régénère le client Prisma |
| `npm run db:seed` | Remplit les données de test (peut être relancé) |
| `npm run build` puis `npm start` | Version compilée |

## Variables d'environnement (`.env`)

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Adresse de la base. Le mot de passe est saisi par vous. |
| `JWT_SECRET` | Secret de signature des jetons (32 caractères au minimum, aléatoire) |
| `JWT_ACCES_DUREE` | Durée du jeton d'accès (ex. `15m`) |
| `JWT_RAFRAICHISSEMENT_JOURS` | Durée du jeton de rafraîchissement, en jours |
| `CORS_ORIGINES` | Adresses autorisées pour le front, séparées par une virgule |
| `EMAIL_MODE` | `log` (développement) ou `smtp` |
| `SMTP_UTILISATEUR`, `SMTP_MOT_DE_PASSE` | Compte Gmail et mot de passe d'application, saisis par Isaya |
| `SEED_MOT_DE_PASSE` | (facultatif) mot de passe des comptes de test du seeder |

**Règle** : le fichier `.env` n'est jamais dans Git. Aucun mot de passe dans le code ni dans les seeders.

## Pièges connus sur Windows

- L'antivirus Avast remplace les certificats HTTPS : `npm` peut échouer (« unable to get local issuer certificate »).
  Dans PowerShell, avant `npm install` :
  `$env:NODE_EXTRA_CA_CERTS="C:\Users\isaya\.certs\cacert-combined.pem"`
- Des coupures réseau (`ECONNRESET`) ou des fichiers verrouillés (`EBUSY`) peuvent interrompre `npm install`. Il suffit de le relancer, seul, sans autre installation en parallèle.
- Pas de Docker : PostgreSQL est installé en local.
