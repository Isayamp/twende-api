-- =====================================================================
-- Twende : script SQL de la base de données (PostgreSQL 18)
-- Version de CONCEPTION, à valider. Les vraies migrations seront
-- générées par Prisma à partir du même modèle.
-- Règles : montants en NUMERIC (jamais en flottant), clés étrangères
-- partout, aucune place vendue deux fois (index unique partiel).
-- =====================================================================

-- ---------- Types énumérés (listes de valeurs fixes) ----------
CREATE TYPE role_utilisateur  AS ENUM ('admin', 'agent', 'passager');
CREATE TYPE statut_trajet      AS ENUM ('planifie', 'en_cours', 'termine', 'annule');
CREATE TYPE statut_reservation AS ENUM ('confirmee', 'annulee');
CREATE TYPE statut_paiement    AS ENUM ('en_attente', 'paye');
CREATE TYPE statut_billet      AS ENUM ('valide', 'annule', 'utilise');

-- ---------- Comptes et sécurité ----------
CREATE TABLE utilisateur (
    id_utilisateur    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nom_complet       VARCHAR(120) NOT NULL,
    email             VARCHAR(160) NOT NULL,
    telephone         VARCHAR(30),
    mot_de_passe_hash VARCHAR(100) NOT NULL,          -- bcrypt, jamais en clair
    role              role_utilisateur NOT NULL DEFAULT 'passager',
    actif             BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le           TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un e-mail ne peut exister qu'une fois (sans tenir compte des majuscules).
CREATE UNIQUE INDEX uq_utilisateur_email ON utilisateur (lower(email));

CREATE TABLE jeton_rafraichissement (
    id_jeton       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateur (id_utilisateur) ON DELETE CASCADE,
    hash_jeton     VARCHAR(100) NOT NULL UNIQUE,      -- on garde l'empreinte, pas le jeton
    expire_le      TIMESTAMPTZ NOT NULL,
    revoque        BOOLEAN NOT NULL DEFAULT FALSE     -- vrai après déconnexion
);
CREATE INDEX ix_jeton_utilisateur ON jeton_rafraichissement (utilisateur_id);

-- ---------- Réseau de transport ----------
CREATE TABLE station (
    id_station INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nom        VARCHAR(100) NOT NULL,
    ville      VARCHAR(100) NOT NULL,
    pays       VARCHAR(60)  NOT NULL,
    UNIQUE (nom, ville)
);
CREATE INDEX ix_station_ville ON station (ville);

CREATE TABLE ligne (
    id_ligne INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code     VARCHAR(20)  NOT NULL UNIQUE,
    nom      VARCHAR(120) NOT NULL,
    active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- Arrêts d'une ligne, dans l'ordre. Sert à vérifier « départ avant arrivée ».
CREATE TABLE ligne_station (
    ligne_id               INTEGER NOT NULL REFERENCES ligne (id_ligne) ON DELETE CASCADE,
    station_id             INTEGER NOT NULL REFERENCES station (id_station),
    ordre                  INTEGER NOT NULL CHECK (ordre >= 1),
    distance_km            NUMERIC(7,1) NOT NULL DEFAULT 0 CHECK (distance_km >= 0), -- depuis le départ
    minutes_depuis_origine INTEGER NOT NULL DEFAULT 0 CHECK (minutes_depuis_origine >= 0),
    PRIMARY KEY (ligne_id, station_id),
    UNIQUE (ligne_id, ordre)
);

-- Prix par tronçon : un prix pour chaque couple (départ, arrivée) d'une ligne.
CREATE TABLE tarif (
    id_tarif           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ligne_id           INTEGER NOT NULL REFERENCES ligne (id_ligne) ON DELETE CASCADE,
    station_depart_id  INTEGER NOT NULL REFERENCES station (id_station),
    station_arrivee_id INTEGER NOT NULL REFERENCES station (id_station),
    prix               NUMERIC(12,2) NOT NULL CHECK (prix >= 0),
    devise             CHAR(3) NOT NULL DEFAULT 'USD',
    CHECK (station_depart_id <> station_arrivee_id),
    UNIQUE (ligne_id, station_depart_id, station_arrivee_id)
);

CREATE TABLE vehicule (
    id_vehicule     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    immatriculation VARCHAR(20) NOT NULL UNIQUE,
    modele          VARCHAR(80) NOT NULL,
    nombre_places   INTEGER NOT NULL CHECK (nombre_places BETWEEN 1 AND 100),
    active          BOOLEAN NOT NULL DEFAULT TRUE
);

-- Un trajet = un départ planifié d'une ligne avec un véhicule.
CREATE TABLE trajet (
    id_trajet      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ligne_id       INTEGER NOT NULL REFERENCES ligne (id_ligne),
    vehicule_id    INTEGER NOT NULL REFERENCES vehicule (id_vehicule),
    depart_prevu   TIMESTAMPTZ NOT NULL,
    arrivee_prevue TIMESTAMPTZ NOT NULL,
    statut         statut_trajet NOT NULL DEFAULT 'planifie',
    CHECK (arrivee_prevue > depart_prevu)
);
CREATE INDEX ix_trajet_depart ON trajet (depart_prevu);
CREATE INDEX ix_trajet_ligne  ON trajet (ligne_id);

-- ---------- Réservations et billets ----------
-- Une personne qui voyage. Peut être liée à un compte, ou saisie au guichet.
CREATE TABLE passager (
    id_passager    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    utilisateur_id INTEGER REFERENCES utilisateur (id_utilisateur) ON DELETE SET NULL,
    nom_complet    VARCHAR(120) NOT NULL,
    telephone      VARCHAR(30)  NOT NULL,
    email          VARCHAR(160)
);

CREATE TABLE reservation (
    id_reservation     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code               VARCHAR(20) NOT NULL UNIQUE,
    utilisateur_id     INTEGER NOT NULL REFERENCES utilisateur (id_utilisateur), -- qui a fait la réservation
    trajet_id          INTEGER NOT NULL REFERENCES trajet (id_trajet),
    station_depart_id  INTEGER NOT NULL REFERENCES station (id_station),
    station_arrivee_id INTEGER NOT NULL REFERENCES station (id_station),
    statut             statut_reservation NOT NULL DEFAULT 'confirmee',
    statut_paiement    statut_paiement NOT NULL DEFAULT 'en_attente',
    montant_total      NUMERIC(12,2) NOT NULL CHECK (montant_total >= 0),
    devise             CHAR(3) NOT NULL DEFAULT 'USD',
    cree_le            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (station_depart_id <> station_arrivee_id)
);
CREATE INDEX ix_reservation_utilisateur ON reservation (utilisateur_id);
CREATE INDEX ix_reservation_trajet      ON reservation (trajet_id);

-- Un billet = une place pour une personne. numero = numéro unique du billet.
CREATE TABLE billet (
    id_billet      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero         VARCHAR(20) NOT NULL UNIQUE,
    reservation_id INTEGER NOT NULL REFERENCES reservation (id_reservation) ON DELETE CASCADE,
    trajet_id      INTEGER NOT NULL REFERENCES trajet (id_trajet),   -- copie du trajet de la réservation
    passager_id    INTEGER NOT NULL REFERENCES passager (id_passager),
    numero_place   INTEGER NOT NULL CHECK (numero_place >= 1),
    prix           NUMERIC(12,2) NOT NULL CHECK (prix >= 0),
    statut         statut_billet NOT NULL DEFAULT 'valide',
    cree_le        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_billet_reservation ON billet (reservation_id);

-- RÈGLE CLÉ : une même place ne peut pas être vendue deux fois sur un trajet.
-- Un billet annulé libère la place, donc il est exclu de l'index.
CREATE UNIQUE INDEX uq_billet_place_par_trajet
    ON billet (trajet_id, numero_place)
    WHERE statut <> 'annule';
