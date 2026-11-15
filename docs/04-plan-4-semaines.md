# 04 - Plan sur 4 semaines

Basé sur le planning indicatif de l'énoncé. Chaque tâche de règle métier commence par un test (TDD).
Les dates réelles sont dans le journal de bord (`08-journal-de-bord.md`).

## Semaine 1 : choix et conception (en cours)

- [x] Lecture de l'énoncé, questions-réponses, décisions de périmètre
- [x] Choix du nom : Twende
- [x] Analyse des besoins et règles métier
- [x] MCD, MLD, cas d'utilisation (images), script SQL
- [x] Routes proposées
- [ ] Validation de la conception par le groupe
- [ ] Création du dépôt GitHub privé, ajout des collaborateurs
- [ ] Palette et maquettes du petit front (questions-réponses)

## Semaine 2 : projet, base, authentification, rôles

- [ ] Initialisation Node + TypeScript + Express, structure des dossiers, ESLint et Prettier
- [ ] Configuration `.env` (validée par Zod), journalisation Pino, Helmet, CORS, limitation de débit
- [ ] Prisma : schéma, première migration, seeders (stations, lignes, tarifs, véhicules, trajets, comptes de test)
- [ ] Gestionnaire d'erreurs central et format de réponse
- [ ] Inscription, connexion, rafraîchissement, déconnexion (bcrypt, JWT)
- [ ] Middleware de rôles (admin, agent, passager)
- [ ] Tests : auth et droits d'accès

## Semaine 3 : fonctionnalités principales

- [ ] CRUD stations, lignes et arrêts, tarifs, véhicules
- [ ] CRUD trajets, règle de chevauchement de véhicule
- [ ] Recherche de trajets avec filtres et pagination
- [ ] Plan des places
- [ ] Réservation : transaction, verrou de ligne, calcul du prix, billets à numéro unique
- [ ] **Test de concurrence** (20 réservations en parallèle pour la même place)
- [ ] Annulation et règles de délai
- [ ] Passagers et paiement simple
- [ ] Revue de sécurité avant fusion

## Semaine 4 : tests, sécurité, documentation, rapport, soutenance

- [ ] Statistiques de remplissage
- [ ] Bonus : QR code du billet
- [ ] Bonus : distance dans les statistiques ou tarif calculé (si le temps le permet)
- [ ] Couverture d'au moins 80 % sur la logique métier
- [ ] Swagger généré depuis les schémas, collection Postman
- [ ] Petit front de démonstration (recherche, plan des places, billet)
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
