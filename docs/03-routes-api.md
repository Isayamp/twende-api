# 03 - Routes de l'API (proposition)

Préfixe : `/api/v1`. Format : JSON. Authentification : en-tête `Authorization: Bearer <jeton>`.
Rôles : **P** = passager, **A** = agent de guichet, **AD** = administrateur, **-** = public.

## Format des réponses

Succès : `{ "succes": true, "donnees": ..., "meta": { "page", "limite", "total" } }` (meta seulement pour les listes).
Erreur : `{ "succes": false, "erreur": { "code": "PLACE_DEJA_PRISE", "message": "La place 12 est déjà prise.", "details": [...] } }`.

## Codes HTTP

| Code | Quand |
|---|---|
| 200 | Lecture ou modification réussie |
| 201 | Création réussie |
| 400 | Requête mal formée (JSON invalide, paramètre illisible) |
| 401 | Pas connecté ou jeton invalide ou expiré |
| 403 | Connecté mais droit insuffisant |
| 404 | Ressource introuvable |
| 409 | Conflit (place déjà prise, élément encore utilisé, e-mail déjà inscrit) |
| 422 | Données lisibles mais invalides (règle de validation ou règle métier) |
| 500 | Erreur du serveur (message neutre, détails dans les journaux) |

## Authentification

| Méthode | Route | Rôle | Rôle de la route |
|---|---|---|---|
| POST | `/auth/register` | - | Inscription (rôle passager) |
| POST | `/auth/login` | - | Connexion : jeton d'accès (15 min) + jeton de rafraîchissement |
| POST | `/auth/refresh` | - | Nouveau jeton d'accès |
| POST | `/auth/logout` | tous | Déconnexion : révoque le jeton de rafraîchissement |
| GET | `/auth/me` | tous | Profil connecté |

## Utilisateurs

| Méthode | Route | Rôle | Remarque |
|---|---|---|---|
| GET | `/users` | AD | Filtres : `q`, `role`, `actif`, `page`, `limite` |
| POST | `/users` | AD | Crée un agent ou un admin |
| GET | `/users/:id` | AD | |
| PATCH | `/users/:id` | AD | Rôle, activation |
| DELETE | `/users/:id` | AD | 409 s'il a des réservations (on désactive) |

## Stations, lignes, tarifs, véhicules

| Méthode | Route | Rôle | Remarque |
|---|---|---|---|
| GET | `/stations` | - | Filtres : `q`, `ville`, `pays`, pagination |
| POST, PATCH, DELETE | `/stations`, `/stations/:id` | AD | |
| GET | `/lignes`, `/lignes/:id` | - | Filtre `actif`, `q` |
| POST, PATCH, DELETE | `/lignes`, `/lignes/:id` | AD | |
| GET | `/lignes/:id/arrets` | - | Arrêts dans l'ordre |
| PUT | `/lignes/:id/arrets` | AD | Remplace la liste des arrêts |
| GET | `/lignes/:id/tarifs` | - | |
| POST | `/lignes/:id/tarifs` | AD | |
| PATCH, DELETE | `/tarifs/:id` | AD | |
| GET | `/vehicules`, `/vehicules/:id` | A, AD | Filtres : `q`, `actif`, pagination |
| POST, PATCH, DELETE | `/vehicules`, `/vehicules/:id` | AD | |

## Trajets et recherche

| Méthode | Route | Rôle | Remarque |
|---|---|---|---|
| GET | `/trajets` | - | **Recherche** : `depart` (id station), `arrivee`, `date` (AAAA-MM-JJ), `places_min`, `page`, `limite`. Renvoie prix, places libres, horaires aux stations choisies. |
| GET | `/trajets/:id` | - | Détail |
| GET | `/trajets/:id/places` | - | Plan des places : libre ou occupée |
| POST | `/trajets` | AD | Planifie. Refuse le chevauchement du véhicule (422) |
| PATCH | `/trajets/:id` | AD | Changement d'horaire ou de véhicule |
| DELETE | `/trajets/:id` | AD | Annule le trajet et ses réservations (RG11) |
| GET | `/statistiques/remplissage` | A, AD | Filtres : `ligne_id`, `date_debut`, `date_fin`. Taux par trajet |
| GET | `/trajets/:id/remplissage` | A, AD | Détail pour un trajet |

## Passagers

| Méthode | Route | Rôle | Remarque |
|---|---|---|---|
| GET | `/passagers` | A, AD | `q`, pagination |
| POST | `/passagers` | A, AD | Client du guichet sans compte |
| GET, PATCH | `/passagers/:id` | A, AD | |
| DELETE | `/passagers/:id` | AD | 409 s'il a des billets |

## Réservations et billets

| Méthode | Route | Rôle | Remarque |
|---|---|---|---|
| POST | `/reservations` | P, A, AD | Corps : `trajet_id`, `station_depart_id`, `station_arrivee_id`, `places: [{ numero_place, passager?: {nom_complet, telephone} }]`. Crée réservation et billets dans une transaction. |
| GET | `/reservations` | P (les siennes), A, AD (toutes) | Filtres : `statut`, `statut_paiement`, `trajet_id`, pagination |
| GET | `/reservations/:id` | P (la sienne), A, AD | |
| POST | `/reservations/:id/annuler` | P (la sienne), A, AD | Règle RG9 |
| PATCH | `/reservations/:id/paiement` | A, AD | Marque « paye » |
| DELETE | `/reservations/:id` | AD | Suppression définitive (rare) |
| GET | `/billets` | P (les siens), A, AD | Pagination |
| GET | `/billets/:numero` | P (le sien), A, AD | |
| GET | `/billets/:numero/qr` | P (le sien), A, AD | Bonus : image QR code |

## Outils

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/health` | - |
| GET | `/api-docs` | - (page Swagger) |

## Exemple : réserver deux places

Requête `POST /api/v1/reservations`
```json
{
  "trajet_id": 12,
  "station_depart_id": 1,
  "station_arrivee_id": 3,
  "places": [
    { "numero_place": 12 },
    { "numero_place": 13, "passager": { "nom_complet": "Amani Kasongo", "telephone": "+243990000000" } }
  ]
}
```
Réponse `201` : la réservation avec ses billets. Si la place 12 est déjà prise : `409` avec `code: "PLACE_DEJA_PRISE"` et aucune place n'est réservée (tout ou rien).

## Sécurité sur les routes

- Contrôle du rôle sur chaque route (liste ci-dessus).
- Contrôle de propriété : un passager ne lit que ce qui lui appartient (sinon 404, pour ne pas révéler l'existence).
- Limitation de débit plus stricte sur `/auth/*`.
- Validation Zod sur le corps, les paramètres et la requête.
