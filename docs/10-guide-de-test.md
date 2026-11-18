# 10 - Guide de test rapide

Ce guide explique comment tester Twende API **dans l'état actuel** : authentification, stations, véhicules, lignes, trajets et recherche. Les places et les réservations ne sont pas encore faites.

## 1. Tests automatiques

```bash
npm test
```

- 112 tests, base séparée `twende_api_db_test` (créée toute seule, vidée entre les tests).
- Couverture : `npm run coverage` (environ 96 %).

| Dossier | Ce qui est vérifié |
|---|---|
| `tests/auth` | Inscription, connexion, rafraîchissement avec rotation, déconnexion, rôles, limiteurs |
| `tests/stations` | CRUD, filtres `q` et `ville`, pagination, 409 si station utilisée |
| `tests/vehicules` | CRUD, droits (liste réservée au personnel), 409 si véhicule utilisé |
| `tests/lignes` | CRUD, arrêts, tarifs, 422 sur tronçon à l'envers ou station inconnue |
| `tests/trajets` | CRUD, arrivée calculée, chevauchement de véhicule (409), 4 créations simultanées : 1×201 + 3×409 |
| `tests/trajets/recherche` | Filtres date, heures, prix, places, tri, pagination, validation |

## 2. Test à la main

### Préparation

```bash
npm run db:migrer  # applique les migrations
npm run db:seed    # données de démonstration (Burundi)
npm run dev        # API sur http://localhost:3000
```

Vérifier que le serveur répond : `GET http://localhost:3000/api/v1/health` renvoie `{"succes":true,"donnees":{"statut":"ok"}}`.

### Comptes de démonstration

| Rôle | E-mail |
|---|---|
| admin | `admin@twende.test` |
| agent | `agent@twende.test` |
| passager | `passager@twende.test` |

Mot de passe par défaut : `Twende#2026` (ou la valeur de `SEED_MOT_DE_PASSE` dans `.env`). Ces comptes sont réservés au développement.

### Scénario conseillé (Postman, Insomnia ou curl)

| # | Requête | Résultat attendu |
|---|---|---|
| 1 | `POST /api/v1/auth/login` avec e-mail + mot de passe admin | 200, un jeton d'accès. Le mettre dans `Authorization: Bearer <jeton>` |
| 2 | `GET /api/v1/auth/me` | 200, profil admin |
| 3 | `GET /api/v1/auth/me` sans jeton | 401 |
| 4 | `GET /api/v1/stations?ville=Bujumbura&limite=5` | 200, liste + `meta` (page, limite, total) |
| 5 | `POST /api/v1/stations` avec le jeton passager | 403 |
| 6 | `POST /api/v1/stations` avec le jeton admin et un corps vide | 422 avec `details` |
| 7 | `GET /api/v1/lignes/1` | 200, arrêts dans l'ordre et tarifs |
| 8 | `GET /api/v1/trajets/recherche?depart=1&arrivee=2&date=AAAA-MM-JJ` | 200, trajets avec heures, prix, places libres |
| 9 | Même recherche avec `&prix_max=5000&tri=prix&page=1&limite=5` | Liste filtrée et triée |
| 10 | Même recherche avec `depart` = `arrivee` | 422 |
| 11 | `GET /api/v1/trajets/999999` | 404 |
| 12 | `POST /api/v1/trajets` deux fois avec le même véhicule et les mêmes heures | 201 puis 409 `VEHICULE_OCCUPE` |
| 13 | `DELETE /api/v1/stations/<id d'une station utilisée>` | 409 `STATION_UTILISEE` |
| 14 | `GET /api/v1/vehicules` avec le jeton passager | 403 |

Prendre une date qui a des trajets dans les données de démonstration (départs à 05h et 12h UTC, soit 07h et 14h au Burundi).

### Exemple avec PowerShell (Windows)

Une commande par ligne : PowerShell ne lit pas le `\` de fin de ligne.

```powershell
$r = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/auth/login -ContentType "application/json" -Body '{"email":"admin@twende.test","mot_de_passe":"Twende#2026"}'
```

```powershell
$h = @{ Authorization = "Bearer $($r.donnees.jeton_acces)" }; Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/me -Headers $h
```

Recherche publique (sans jeton) :

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/trajets/recherche?depart=1&arrivee=2&date=2026-11-20&tri=prix"
```

Avec Git Bash ou Linux, on peut utiliser `curl` avec `-H` et `-d`.

## 3. Codes HTTP vérifiés

| Code | Exemple dans les tests |
|---|---|
| 200 / 201 / 204 | Lecture, création, suppression |
| 400 | JSON invalide |
| 401 | Pas de jeton ou jeton expiré |
| 403 | Passager sur une route admin |
| 404 | Identifiant inconnu |
| 409 | Doublon, élément utilisé, véhicule occupé |
| 422 | Données invalides |
| 429 | Trop de tentatives de connexion |

## 4. Places et réservations (ajouté le 18/11)

Tests automatiques : `tests/trajets/places.test.ts`, `tests/reservations/reservations.test.ts`, `tests/reservations/concurrence.test.ts`. Total : 144 tests.

Scénario à la main (jeton du passager, `$h` comme plus haut). Prendre un trajet à venir : `GET /trajets/recherche?...` donne son `id_trajet`.

| # | Requête | Résultat attendu |
|---|---|---|
| 15 | `GET /trajets/<id>/places` | 200, chaque place `libre` ou `occupee` |
| 16 | `POST /reservations` avec `trajet_id`, `station_depart_id`, `station_arrivee_id`, `places: [{"numero_place": 3, "passager": {"nom_complet": "...", "telephone": "+257..."}}]` | 201, code `RES-...`, billets `TWD-...`, montant = tarif du tronçon × nombre de places |
| 17 | Même requête une deuxième fois | 409 `PLACE_DEJA_PRISE` |
| 18 | `GET /trajets/<id>/places` | La place 3 est `occupee` |
| 19 | Une place 0 ou plus grande que le bus | 422 |
| 20 | `GET /reservations` | Seulement les siennes (le personnel voit tout) |
| 21 | `POST /reservations/<id>/annuler` | 200 ; la place redevient libre. Passager à moins de 2 h du départ : 409 `ANNULATION_TARDIVE` |
| 22 | `PATCH /reservations/<id>/paiement` avec le jeton agent | 200, `paye`. Avec le jeton passager : 403 |

Exemple PowerShell :

```powershell
$corps = '{"trajet_id":1,"station_depart_id":1,"station_arrivee_id":2,"places":[{"numero_place":3,"passager":{"nom_complet":"Aimé Niyonkuru","telephone":"+25779000000"}}]}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/reservations -Headers $h -ContentType "application/json" -Body $corps
```

Preuve de la règle « aucune place vendue deux fois » : `npx vitest run tests/reservations/concurrence.test.ts` (20 demandes en même temps pour la même place : 1 succès, 19 conflits).

## 5. Passagers et statistiques (ajouté le 18/11)

Tests automatiques : `tests/passagers/passagers.test.ts`, `tests/statistiques/remplissage.test.ts`. Total : 166 tests.

| # | Requête (jeton agent ou admin) | Résultat attendu |
|---|---|---|
| 23 | `POST /passagers` avec `nom_complet`, `telephone`, `email` (facultatif) | 201 |
| 24 | `GET /passagers?q=claire&limite=5` | 200, recherche par nom ou téléphone, pagination |
| 25 | `DELETE /passagers/<id>` avec le jeton agent | 403 (admin seulement) |
| 26 | `DELETE /passagers/<id>` d'un passager qui a des billets (admin) | 409 `PASSAGER_UTILISE` |
| 27 | `GET /statistiques/remplissage?du=2026-11-01&au=2026-11-30&ligne_id=1` | 200, `resume` (taux global) et `trajets` (taux par trajet), pagination |
| 28 | `GET /trajets/<id>/remplissage` | 200, capacité, places vendues, places libres, taux |
| 29 | Les mêmes routes avec le jeton passager | 403 |

Le taux est un pourcentage avec une décimale. Les billets annulés et les trajets annulés ne comptent pas.

## 6. Swagger et Postman (ajouté le 18/11)

- **Swagger** : lancer `npm run dev`, ouvrir `http://localhost:3000/api-docs`. Faire `POST /auth/login`, copier `jeton_acces`, cliquer sur « Authorize », coller le jeton. Puis « Try it out » sur n'importe quelle route. Les routes avec un cadenas demandent un jeton.
- **Postman** : importer `docs/api/twende-api.postman_collection.json`. Lancer d'abord `POST /auth/login` : le jeton est enregistré tout seul et utilisé par toutes les autres requêtes. La variable `base_url` vaut `http://localhost:3000`.
- Régénérer les deux fichiers après un changement de routes : `npm run docs:generer`.
- Test automatique : `tests/docs/documentation.test.ts` (la page répond, la sécurité est décrite, chaque route documentée existe vraiment).

## 7. Pas encore testable

QR code du billet (bonus).
