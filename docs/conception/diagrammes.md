# Diagrammes de Twende API (version Markdown)

Ces diagrammes sont écrits en **Mermaid**. Ils s'affichent directement dans GitHub, VS Code (avec l'extension Markdown Preview Mermaid) et la plupart des outils Markdown.
Les images PNG et SVG de ce dossier (`mcd`, `mld`, `cas-utilisation`) restent la **version officielle** pour le rapport, car elles suivent la notation Merise exacte.

## 1. MCD (modèle conceptuel, cardinalités Merise dans les libellés)

Mermaid ne connaît pas la notation Merise. Les cardinalités (min,max) sont donc écrites dans le texte de chaque association, dans l'ordre « première entité, seconde entité ».

```mermaid
erDiagram
    UTILISATEUR ||--o{ JETON_RAFRAICHISSEMENT : "POSSEDE (0,N)-(1,1)"
    UTILISATEUR |o--o{ PASSAGER : "CORRESPOND_A (0,1)-(0,1)"
    UTILISATEUR ||--o{ RESERVATION : "EFFECTUE (0,N)-(1,1)"
    LIGNE ||--o{ TRAJET : "SUIT (0,N)-(1,1)"
    VEHICULE ||--o{ TRAJET : "UTILISE (0,N)-(1,1)"
    TRAJET ||--o{ RESERVATION : "CONCERNE (0,N)-(1,1)"
    STATION ||--o{ RESERVATION : "PART_DE (0,N)-(1,1)"
    STATION ||--o{ RESERVATION : "ARRIVE_A (0,N)-(1,1)"
    RESERVATION ||--|{ BILLET : "CONTIENT (1,N)-(1,1)"
    PASSAGER ||--o{ BILLET : "EST_TITULAIRE (0,N)-(1,1)"
    LIGNE }|--o{ STATION : "DESSERT (1,N)-(0,N) : ordre, distance_km, minutes_depuis_origine"
    LIGNE }o--o{ STATION : "TARIFIER (0,N)-(0,N)-(0,N) : prix, devise (ternaire)"

    UTILISATEUR {
        int id_utilisateur
        string nom_complet
        string email
        string telephone
        string mot_de_passe_hash
        string role
        boolean actif
    }
    STATION {
        int id_station
        string nom
        string ville
        string pays
    }
    LIGNE {
        int id_ligne
        string code
        string nom
        boolean active
    }
    VEHICULE {
        int id_vehicule
        string immatriculation
        string modele
        int nombre_places
    }
    TRAJET {
        int id_trajet
        datetime depart_prevu
        datetime arrivee_prevue
        string statut
    }
    PASSAGER {
        int id_passager
        string nom_complet
        string telephone
        string email
    }
    RESERVATION {
        int id_reservation
        string code
        string statut
        string statut_paiement
        decimal montant_total
    }
    BILLET {
        int id_billet
        string numero
        int numero_place
        decimal prix
        string statut
    }
    JETON_RAFRAICHISSEMENT {
        int id_jeton
        string hash_jeton
        datetime expire_le
        boolean revoque
    }
```

## 2. MLD (modèle logique : tables, clés primaires et étrangères)

```mermaid
erDiagram
    utilisateur ||--o{ jeton_rafraichissement : "utilisateur_id"
    utilisateur |o--o{ passager : "utilisateur_id (nul)"
    utilisateur ||--o{ reservation : "utilisateur_id"
    ligne ||--o{ ligne_station : "ligne_id"
    station ||--o{ ligne_station : "station_id"
    ligne ||--o{ tarif : "ligne_id"
    station ||--o{ tarif : "station_depart_id"
    station ||--o{ tarif : "station_arrivee_id"
    ligne ||--o{ trajet : "ligne_id"
    vehicule ||--o{ trajet : "vehicule_id"
    trajet ||--o{ reservation : "trajet_id"
    station ||--o{ reservation : "station_depart_id"
    station ||--o{ reservation : "station_arrivee_id"
    reservation ||--|{ billet : "reservation_id"
    trajet ||--o{ billet : "trajet_id"
    passager ||--o{ billet : "passager_id"

    utilisateur {
        int id_utilisateur PK
        varchar nom_complet
        varchar email UK
        varchar telephone
        varchar mot_de_passe_hash
        enum role
        boolean actif
        timestamptz cree_le
    }
    jeton_rafraichissement {
        int id_jeton PK
        int utilisateur_id FK
        varchar hash_jeton UK
        timestamptz expire_le
        boolean revoque
    }
    passager {
        int id_passager PK
        int utilisateur_id FK
        varchar nom_complet
        varchar telephone
        varchar email
    }
    station {
        int id_station PK
        varchar nom
        varchar ville
        varchar pays
    }
    ligne {
        int id_ligne PK
        varchar code UK
        varchar nom
        boolean active
    }
    ligne_station {
        int ligne_id PK, FK
        int station_id PK, FK
        int ordre
        decimal distance_km
        int minutes_depuis_origine
    }
    tarif {
        int id_tarif PK
        int ligne_id FK
        int station_depart_id FK
        int station_arrivee_id FK
        decimal prix
        char devise
    }
    vehicule {
        int id_vehicule PK
        varchar immatriculation UK
        varchar modele
        int nombre_places
        boolean active
    }
    trajet {
        int id_trajet PK
        int ligne_id FK
        int vehicule_id FK
        timestamptz depart_prevu
        timestamptz arrivee_prevue
        enum statut
    }
    reservation {
        int id_reservation PK
        varchar code UK
        int utilisateur_id FK
        int trajet_id FK
        int station_depart_id FK
        int station_arrivee_id FK
        enum statut
        enum statut_paiement
        decimal montant_total
        char devise
        timestamptz cree_le
    }
    billet {
        int id_billet PK
        varchar numero UK
        int reservation_id FK
        int trajet_id FK
        int passager_id FK
        int numero_place
        decimal prix
        enum statut
        timestamptz cree_le
    }
```

Contrainte clé (hors schéma) : index unique partiel sur `billet (trajet_id, numero_place)` pour les billets dont le statut n'est pas `annule`.

## 3. Cas d'utilisation

```mermaid
flowchart LR
    V([Visiteur])
    P([Passager])
    A([Agent de guichet])
    AD([Administrateur])

    subgraph SYS[Système Twende API]
        direction TB
        U1(S'inscrire)
        U2(Se connecter et se déconnecter)
        U3(Rechercher des trajets)
        U4(Voir les places libres)
        U5(Réserver une ou plusieurs places)
        U6(Annuler une réservation)
        U7(Consulter ses billets)
        U8(Vendre des billets au guichet)
        U9(Marquer une réservation payée)
        U10(Voir le remplissage des trajets)
        U11(Gérer stations, lignes et tarifs)
        U12(Gérer véhicules et trajets)
        U13(Gérer utilisateurs et rôles)
    end

    V --- U1 & U2 & U3 & U4
    P --- U2 & U3 & U5 & U6 & U7
    A --- U3 & U6 & U8 & U9 & U10
    AD --- U10 & U11 & U12 & U13
```

## 4. Réservation de places (séquence, avec la protection contre les doublons)

```mermaid
sequenceDiagram
    autonumber
    actor C as Client
    participant API as API Twende
    participant BD as PostgreSQL

    C->>API: POST /reservations (trajet, départ, arrivée, places)
    API->>API: Vérifier le jeton, le rôle et les données (Zod)
    API->>BD: BEGIN
    API->>BD: SELECT ... FROM trajet WHERE id = ? FOR UPDATE
    Note over BD: Les autres réservations du même trajet attendent ici
    API->>BD: Lire les places déjà vendues et le tarif du tronçon
    alt une place demandée est déjà prise
        API->>BD: ROLLBACK
        API-->>C: 409 PLACE_DEJA_PRISE
    else toutes les places sont libres
        API->>BD: INSERT reservation et billets (numéros uniques)
        Note over BD: L'index unique (trajet, place) refuse tout doublon
        API->>BD: COMMIT
        API-->>C: 201 réservation et billets
    end
```

## 5. États d'une réservation, d'un billet et d'un trajet

```mermaid
stateDiagram-v2
    direction LR
    state "Réservation" as R {
        [*] --> confirmee
        confirmee --> annulee: annulation (RG9)
    }
    state "Paiement" as PA {
        [*] --> en_attente
        en_attente --> paye: agent ou admin
    }
    state "Billet" as B {
        [*] --> valide
        valide --> annule: annulation de la réservation
        valide --> utilise: embarquement (idée future)
    }
    state "Trajet" as T {
        [*] --> planifie
        planifie --> en_cours
        en_cours --> termine
        planifie --> annule
    }
```

## 6. Architecture en couches

```mermaid
flowchart LR
    Client[Client : front ou Postman] --> R[Routes Express]
    R --> M[Middleware : auth, rôle, validation Zod]
    M --> C[Contrôleur : HTTP seulement]
    C --> S[Service : règles métier]
    S --> O[Prisma ORM]
    O --> DB[(PostgreSQL)]
    M -. erreur .-> E[Gestionnaire d'erreurs central]
    S -. erreur métier .-> E
    E --> Client
```
