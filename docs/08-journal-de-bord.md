# 08 - Journal de bord

Une entrée par séance de travail. Les plus récentes en bas.

## 2026-11-15 - Cadrage et conception

**Fait**
- Lecture de l'énoncé et résumé du sujet 11.
- Questions-réponses : bus seulement, places numérotées, rôles admin/agent/passager, prix par tronçon, paiement hors périmètre, front de démonstration oui, stack Node + Express + TypeScript + PostgreSQL + Prisma + Zod + JWT + Vitest.
- Nom choisi : Twende (« allons-y » en swahili). Vérification : aucun paquet npm `twende` ou `twende-api`.
- Analyse des besoins, règles métier, MCD, MLD, cas d'utilisation (images PNG et SVG), script SQL, routes, plan sur 4 semaines.

**Décisions**
- Une place est bloquée pour tout le trajet (pas de revente par tronçon).
- Concurrence : verrou `FOR UPDATE` sur le trajet + index unique partiel sur `billet (trajet_id, numero_place)`.
- Les dates de commits restent réelles.

**Socle du projet (branche `feat/socle-projet`)**
- Node + TypeScript + Express 5, configuration validée par Zod, journal Pino, Helmet, CORS restreint, limitation de débit.
- Gestionnaire d'erreurs central : codes 400, 404, 409, 422, 500 au même format JSON. L'erreur 500 ne montre aucun détail interne.
- Middleware `valider` (Zod) pour le corps, les paramètres et la requête.
- 16 tests (Vitest + Supertest), tous verts, tests écrits avant le code. Couverture actuelle : environ 88 %.
- Schéma Prisma identique au MLD. Migration initiale avec les contraintes à la main (CHECK, index unique des places, e-mail unique sans casse).
- Seeder : 4 comptes de test, 7 stations, 3 lignes, tarifs par tronçon, 6 véhicules, trajets des 7 prochains jours.
- **Pas encore exécuté** : la migration et le seeder (le mot de passe PostgreSQL manque dans `.env`).
- Bibliothèques : `bcryptjs` choisi plutôt que `bcrypt` (pur JavaScript, pas de compilation native, donc plus fiable sous Windows avec l'antivirus). Prisma 6 gardé pour sa stabilité.

**Ensuite (même jour)**
- Projet renommé `twende-api` pour que le but soit clair dès le premier regard.
- Diagrammes ajoutés en Markdown Mermaid (`docs/conception/diagrammes.md`).
- Plan resserré et réordonné : la recherche de trajets passe en premier objectif de démonstration.
- Les commits gardent leurs dates réelles (l'historique Git est noté).

**Dépôt**
- Dépôt public créé : https://github.com/Isayamp/twende-api. Branches `main` et `develop` (Git Flow simplifié), aucune branche supprimée.

**À faire ensuite**
- Validation de la conception par le groupe.
- Création du dépôt GitHub privé (nom à choisir).
- Questions-réponses sur le design du front.

**Limite connue**
- Le script `schema.sql` n'a pas encore été exécuté : le mot de passe PostgreSQL doit être saisi par le groupe. On le testera à la semaine 2 avec Prisma.
