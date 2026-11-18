# 04 - Plan (version resserrée)

> Le plan indicatif de l'énoncé (4 semaines) ne correspond pas à notre calendrier réel : le projet a démarré avec la conception, et une présentation est attendue très tôt. Ce plan est donc **réordonné par priorité**, en gardant les 4 phases de l'énoncé.
> Les cases cochées reflètent l'état réel. Les dates réelles sont dans `08-journal-de-bord.md`.

## Phase 1 : choix et conception (faite)

- [x] Lecture de l'énoncé, questions-réponses, décisions de périmètre
- [x] Nom : Twende API
- [x] Analyse des besoins et règles métier
- [x] MCD, MLD, cas d'utilisation (PNG, SVG et Markdown Mermaid), script SQL
- [x] Routes proposées
- [x] Dépôt GitHub créé (public) : `Isayamp/twende-api`
- [ ] Ajout des collaborateurs (sur demande du groupe)

## Phase 2 : socle, base, authentification, rôles (prochaine)


- [x] Initialisation Node + TypeScript + Express, structure des dossiers, Prettier
- [x] Configuration `.env` validée par Zod, journalisation Pino, Helmet, CORS, limitation de débit
- [x] Prisma : schéma, migration initiale et seeder écrits
- [x] Migration et seeder exécutés sur PostgreSQL (base `twende_api_db`)
- [x] Gestionnaire d'erreurs central et format de réponse
- [x] Inscription, connexion, rafraîchissement, déconnexion (bcrypt, JWT)
- [x] Middleware de rôles (admin, agent, passager)
- [x] Tests : auth et droits d'accès

## Phase 3 : fonctionnalités principales

Ordre voulu, pour pouvoir montrer la recherche le plus tôt possible :

1. [x] CRUD stations, lignes et arrêts, tarifs, véhicules
2. [x] CRUD trajets, règle de chevauchement de véhicule
3. [x] **Recherche de trajets avec filtres et pagination** (premier objectif de démonstration)
4. [x] Plan des places
5. [x] Réservation : transaction, verrou de ligne, calcul du prix, billets à numéro unique
6. [x] **Test de concurrence** (20 réservations en parallèle pour la même place)
7. [x] Annulation et règles de délai
8. [x] Paiement simple (statut) ; [ ] routes `/passagers` du guichet
9. [ ] Revue de sécurité avant fusion (en cours)

## Phase 4 : finition

- [ ] Statistiques de remplissage
- [ ] Bonus : QR code du billet
- [ ] Bonus : tarif calculé selon la distance (si le temps le permet)
- [ ] Couverture d'au moins 80 % sur la logique métier
- [ ] Swagger généré depuis les schémas, collection Postman
- [ ] Petit front de démonstration (recherche, plan des places, billet), design validé par questions-réponses
- [ ] Revue de code et audit de sécurité finaux
- [ ] README complet, guide de continuité à jour
- [ ] Rapport de 8 à 12 pages avec captures
- [ ] Répétition de la soutenance (10 à 15 minutes), chacun explique tout le code

## Idées futures (hors périmètre, à citer dans la documentation)

- Paiement par mobile money (M-Pesa, Airtel Money, Orange Money, MTN MoMo).
- Application mobile qui fonctionne hors connexion.
- Notifications par SMS.
- Contrôle des billets par scan de QR code à l'embarquement.
- Revente d'une place après la descente d'un passager (réservation par tronçon).
- Expiration automatique des réservations non payées.
- Plusieurs devises avec taux de change.
