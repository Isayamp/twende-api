# 01 - Analyse des besoins

Projet : **Twende**, API de gestion des transports et réservations (sujet 11).
Groupe 11 : ISAYA M'LELA Pombo et ASUKULU MUSATO Théophile.
Cours : Programmation côté serveur, Dr Thierry Mugenzi.

> « Twende » veut dire « allons-y » en swahili.

## 1. Le problème réel

Dans la région des Grands Lacs, beaucoup de voyages se font en bus interurbain.
Les problèmes courants sont :

- les billets en papier, faciles à copier ou à perdre ;
- les longues files d'attente à la gare routière ;
- la même place vendue à deux personnes ;
- aucune idée précise du remplissage des bus pour planifier ;
- des prix qui changent d'un guichet à l'autre.

L'API doit répondre à ces problèmes : une place ne se vend qu'une fois,
chaque billet a un numéro unique, les prix viennent d'une grille officielle,
et la direction voit le remplissage de chaque trajet.

## 2. Décisions prises avec le groupe

| Sujet | Décision |
|---|---|
| Périmètre | Bus interurbains seulement (pas de train) |
| Places | Numérotées (le passager choisit son siège) |
| Rôles | Administrateur, agent de guichet, passager |
| Prix | Par tronçon : un prix pour chaque couple (départ, arrivée) d'une ligne |
| Paiement | Hors périmètre. Simple statut « en attente » ou « payé » |
| Front de démonstration | Oui, petit et sobre, après l'API |
| Nom | Twende |
| Stack | Node.js LTS, Express, TypeScript, PostgreSQL, Prisma, Zod, JWT, Vitest |

## 3. Acteurs

- **Visiteur** : n'a pas de compte. Il peut s'inscrire, se connecter, chercher des trajets et voir les places libres.
- **Passager** : a un compte. Il réserve, annule ses réservations et consulte ses billets.
- **Agent de guichet** : vend et annule pour des clients (avec ou sans compte), marque les paiements, voit le remplissage.
- **Administrateur** : gère tout le réseau (stations, lignes, tarifs, véhicules, trajets, utilisateurs) et voit les statistiques.

Le diagramme est dans `conception/cas-utilisation.png`.

## 4. Fonctionnalités

1. Inscription, connexion, déconnexion, renouvellement du jeton.
2. CRUD des stations, lignes (avec arrêts ordonnés), tarifs, véhicules, trajets, utilisateurs, passagers.
3. Recherche de trajets par station de départ, station d'arrivée et date, avec pagination.
4. Plan des places d'un trajet (libres et occupées).
5. Réservation d'une ou plusieurs places, avec calcul du prix.
6. Annulation d'une réservation, qui libère les places.
7. Billet avec numéro unique pour chaque place.
8. Statistiques de remplissage par trajet (et par ligne ou période).
9. Bonus : QR code sur le billet, prix selon la distance (voir « idées futures »).

## 5. Règles métier

| N° | Règle |
|---|---|
| RG1 | Une place ne peut être vendue qu'une fois par trajet, même si deux demandes arrivent en même temps. |
| RG2 | On ne réserve que sur un trajet « planifié » dont le départ est dans le futur. |
| RG3 | Les stations de départ et d'arrivée doivent être des arrêts de la ligne, et le départ doit venir avant l'arrivée. |
| RG4 | Un tarif doit exister pour ce tronçon, sinon la réservation est refusée (422). |
| RG5 | Prix total = prix du tronçon × nombre de places. Les montants sont décimaux (`NUMERIC(12,2)`). |
| RG6 | Un numéro de place doit exister dans le véhicule (de 1 à `nombre_places`). |
| RG7 | Une réservation compte de 1 à 6 places. |
| RG8 | Chaque billet reçoit un numéro unique, par exemple `TWD-7K3QX9PA`. |
| RG9 | Un passager annule seulement ses réservations, jusqu'à 2 heures avant le départ. L'agent et l'admin peuvent annuler jusqu'au départ. |
| RG10 | Annuler une réservation annule tous ses billets et libère les places. |
| RG11 | Annuler un trajet annule ses réservations. |
| RG12 | Un véhicule ne peut pas avoir deux trajets qui se chevauchent. |
| RG13 | Un passager ne voit que ses réservations et ses billets. L'agent et l'admin voient tout. |
| RG14 | On ne supprime pas une station, une ligne ou un véhicule déjà utilisés (erreur 409). On les désactive. |
| RG15 | Taux de remplissage = billets non annulés ÷ nombre de places du véhicule. |

## 6. Ce qui est ambigu ou choisi par nous

- **Une place est bloquée pour tout le trajet.** Dans la vraie vie, une place peut être revendue après la descente d'un passager. On ne le gère pas (idée future).
- **Devise** : une devise par tarif (franc burundais BIF par défaut). Pas de conversion.
- **Pas de paiement en ligne** : l'agent marque « payé ».
- **Pas d'expiration automatique** d'une réservation non payée (idée future).

## 7. Exigences de l'énoncé et où elles sont couvertes

| Exigence | Couverte par |
|---|---|
| CRUD complet | `03-routes-api.md` |
| Auth et rôles | JWT court + jeton de rafraîchissement, rôles admin/agent/passager |
| Recherche, filtre, pagination (2 listes minimum) | Trajets, stations, réservations, véhicules, utilisateurs |
| Validation et codes HTTP | Zod, codes 200, 201, 400, 401, 403, 404, 422, 500 (et 409 pour les conflits) |
| BD avec MCD/MLD, 5 tables minimum | 11 tables (`02-conception-bd.md`) |
| Requêtes préparées ou ORM | Prisma ; SQL brut seulement avec paramètres |
| Mots de passe hachés | bcrypt |
| Seeders | `prisma/seed.ts` (comptes de test dans le guide de continuité) |
| Git régulier | Commits petits, format `type: résumé` |
| README et documentation des routes | README, Swagger/OpenAPI, collection Postman |
