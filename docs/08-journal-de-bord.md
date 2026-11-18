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
- Seeder : 4 comptes de test, 8 stations (Burundi), 4 lignes, tarifs par tronçon en BIF, 8 véhicules, trajets des 7 prochains jours.
- Migration et seeder exécutés ensuite sur la base `twende_api_db` (nom choisi pour contenir « api » et « db »). Le test SQL confirme que l'index refuse deux billets sur la même place d'un trajet.
- Bibliothèques : `bcryptjs` choisi plutôt que `bcrypt` (pur JavaScript, pas de compilation native, donc plus fiable sous Windows avec l'antivirus). Prisma 6 gardé pour sa stabilité.

**Ensuite (même jour)**
- Projet renommé `twende-api` pour que le but soit clair dès le premier regard.
- Diagrammes ajoutés en Markdown Mermaid (`docs/conception/diagrammes.md`).
- Plan resserré et réordonné : la recherche de trajets passe en premier objectif de démonstration.
- Les commits gardent leurs dates réelles (l'historique Git est noté).

**Données de simulation : Burundi**
- Le seeder simule un réseau de bus au départ de Bujumbura : 8 stations (Bujumbura, Muramvya, Gitega, Kayanza, Ngozi, Rumonge, Makamba, Cibitoke), 4 lignes, 8 véhicules, 56 trajets sur 7 jours, départs à 07h00 et 14h00 heure du Burundi.
- Prix en francs burundais (BIF), environ 90 BIF par km, arrondis à 500 BIF. Calcul en entiers, sans flottant. Distances et prix fictifs.
- La devise par défaut de la base devient BIF (migration `20261115070000_devise_bif_par_defaut`).

**Dépôt**
- Dépôt public créé : https://github.com/Isayamp/twende-api. Branches `main` et `develop` (Git Flow simplifié), aucune branche supprimée.

**À faire ensuite**
- Validation de la conception par le groupe.
- Création du dépôt GitHub privé (nom à choisir).
- Questions-réponses sur le design du front.

**Limite connue**
- Le script `schema.sql` n'a pas encore été exécuté : le mot de passe PostgreSQL doit être saisi par le groupe. On le testera à la semaine 2 avec Prisma.

**Authentification (15/11)**
- Routes `/auth/register`, `/login`, `/refresh`, `/logout`, `/me`. Le rôle est toujours `passager` à l'inscription (un rôle envoyé par le client est ignoré).
- Jeton d'accès JWT court (HS256 seulement). Jeton de rafraîchissement aléatoire, stocké haché (SHA-256), changé à chaque usage. Si un ancien jeton revient, toute la session est révoquée.
- Connexion : même réponse 401 pour un mauvais mot de passe et un e-mail inconnu, avec un temps de calcul comparable. Compte désactivé : 403.
- Limite stricte sur `/auth` : 20 essais par 15 minutes (429).
- Tests : base séparée `twende_api_db_test`, créée par le test lui-même. 47 tests verts.

## Référentiels, trajets et recherche (2026-11-15)

- Branche `feat/referentiels-trajets`. Tests écrits avant le code (110 tests verts, couverture environ 96 %).
- **Stations, véhicules, lignes** : CRUD complet. Lecture publique pour stations et lignes, réservée au personnel pour les véhicules. Écriture réservée à l'administrateur. Suppression d'un élément encore utilisé : 409 (`STATION_UTILISEE`, `LIGNE_UTILISEE`, `VEHICULE_UTILISE`).
- **Arrêts et tarifs** d'une ligne : `PUT` qui remplace toute la liste dans une transaction. Un tarif doit aller vers l'avant sur la ligne.
- **Trajets** : l'arrivée est calculée avec la durée du dernier arrêt. Un véhicule ne peut pas avoir deux trajets qui se chevauchent (409 `VEHICULE_OCCUPE`) ; partir à l'heure exacte d'arrivée de l'autre est permis ; un trajet annulé ne bloque plus.
- **Recherche** `GET /trajets/recherche` : départ et arrivée obligatoires, filtres `date`, `heure_min`, `heure_max`, `prix_max`, `places_min`, tri par heure ou par prix, pagination. Seuls les trajets à venir, planifiés, qui passent par le départ puis par l'arrivée (dans cet ordre) et qui ont un tarif sont renvoyés. Les heures sont calculées à chaque arrêt. Dates et heures comprises à l'heure du Burundi.
- SQL brut seulement pour la recherche, avec des paramètres (`Prisma.sql`) : un test vérifie qu'une tentative d'injection est refusée.
- Piège : PostgreSQL renvoie une erreur « RESTRICT » que Prisma ne code pas (erreur inconnue). `traduireErreurPrisma` la reconnaît et renvoie un 409.
- Piège : après un changement de valeur par défaut dans le schéma, relancer `npx prisma generate` (arrêter le serveur avant, sous Windows).
- **Revue de sécurité** : aucun problème critique. Point grave corrigé : deux créations simultanées pouvaient double-réserver un véhicule. Une contrainte d'exclusion PostgreSQL (migration `20261115080000`, extension `btree_gist`) l'interdit maintenant dans la base ; l'erreur devient un 409. Un test lance 4 créations en parallèle : 1 succès, 3 refus.
- Aussi corrigés : page limitée à 10 000, durée d'un trajet limitée à 7 jours, `heure_min` avant `heure_max`, prix à 2 décimales, identifiants bornés.
- Reste à faire plus tard (non bloquant) : limiteur dédié sur la recherche publique, masquer les lignes inactives et trajets annulés côté public, table des transitions de statut, refus de modifier un trajet qui a déjà des billets.

## Places et réservations (2026-11-18)

- Branche `feat/reservations`. Tests écrits avant le code (144 tests verts, couverture environ 96 %).
- **Plan des places** `GET /trajets/:id/places` (public) : chaque place est `libre` ou `occupee`. Aucune information sur les voyageurs n'est donnée. Un billet annulé libère la place.
- **Réservation** `POST /reservations` : tout se fait dans une transaction. On verrouille la ligne du trajet (`SELECT ... FOR UPDATE`), on vérifie le trajet (planifié, pas encore parti), le tronçon et son tarif, les numéros de place, puis les places déjà prises. Si une seule place est prise : 409 `PLACE_DEJA_PRISE` et rien n'est créé (tout ou rien). Le montant est calculé avec le tarif du tronçon (Decimal). Codes aléatoires `RES-XXXXXXXX` et `TWD-XXXXXXXX`.
- Sans passager indiqué, le billet prend le profil du compte (téléphone obligatoire, sinon 422).
- **Filet de sécurité** : si le verrou était contourné, l'index unique partiel `uq_billet_place_par_trajet` refuse le doublon (erreur P2002 transformée en 409).
- **Annulation** : le passager seulement à plus de 2 h du départ (409 `ANNULATION_TARDIVE`), le personnel à tout moment. Les billets passent à `annule`, les places sont libres tout de suite. Double annulation : 409 `DEJA_ANNULEE`.
- **Paiement** : `PATCH /reservations/:id/paiement`, personnel seulement. Mise à jour conditionnelle : deux paiements simultanés, un seul passe (409 `DEJA_PAYEE`). Réservation annulée : 409.
- Un passager qui demande la réservation d'un autre reçoit 404.
- **Test de concurrence** : 20 demandes simultanées pour la même place = 1×201 et 19×409. 30 demandes pour 10 places = exactement 10 ventes. 3 réservations multi-places qui se croisent = une seule passe, aucun billet à moitié.

**Revue de sécurité des réservations (18/11) et corrections**
- Aucun problème critique : le verrou `FOR UPDATE` + l'index unique tiennent. Trois points graves corrigés, avec tests (151 tests verts) :
  - Paiement et annulation en même temps pouvaient donner « annulée » ET « payée » : les deux sont maintenant des mises à jour conditionnelles (`statut = confirmee` et `statut_paiement = en_attente`). Une seule gagne. Une réservation payée ne s'annule plus par l'API (409 `RESERVATION_PAYEE`) : le remboursement se fait hors de l'API.
  - Deux annulations simultanées répondaient 200 toutes les deux : maintenant 1×200 et le reste 409 `DEJA_ANNULEE`.
  - Un passager pouvait bloquer un bus avec des réservations jamais payées : plafond de 5 réservations en attente par passager (409 `TROP_DE_RESERVATIONS_EN_ATTENTE`, verrou sur le compte), limite de 30 créations par minute par utilisateur (429), délais de transaction réduits (5 s / 10 s). Le personnel n'a pas ce plafond.
- Aussi corrigé : changer le véhicule d'un trajet est refusé si une place vendue dépasse sa capacité (409 `VEHICULE_TROP_PETIT`) ; annuler un trajet annule ses réservations et billets ; téléphone et nom du passager mieux validés.
- **Trouvé en route** : le test « deux créations de trajet pour le même véhicule » échouait environ 1 fois sur 3 avec une erreur 500 : PostgreSQL détectait une impasse (`deadlock detected`, code 40P01) entre insertions simultanées sous la contrainte d'exclusion. Correction : un verrou léger par véhicule (`pg_advisory_xact_lock`) dans la création et la modification de trajet. 10 essais de suite sans échec.
- Reste à faire plus tard : expiration automatique des réservations non payées (tâche planifiée), état « à rembourser », limiteur dédié sur la recherche publique, journal des annulations et paiements faits par le personnel.
