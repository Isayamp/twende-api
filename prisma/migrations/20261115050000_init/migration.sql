-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "role_utilisateur" AS ENUM ('admin', 'agent', 'passager');

-- CreateEnum
CREATE TYPE "statut_trajet" AS ENUM ('planifie', 'en_cours', 'termine', 'annule');

-- CreateEnum
CREATE TYPE "statut_reservation" AS ENUM ('confirmee', 'annulee');

-- CreateEnum
CREATE TYPE "statut_paiement" AS ENUM ('en_attente', 'paye');

-- CreateEnum
CREATE TYPE "statut_billet" AS ENUM ('valide', 'annule', 'utilise');

-- CreateTable
CREATE TABLE "utilisateur" (
    "id_utilisateur" SERIAL NOT NULL,
    "nom_complet" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "telephone" VARCHAR(30),
    "mot_de_passe_hash" VARCHAR(100) NOT NULL,
    "role" "role_utilisateur" NOT NULL DEFAULT 'passager',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id_utilisateur")
);

-- CreateTable
CREATE TABLE "jeton_rafraichissement" (
    "id_jeton" SERIAL NOT NULL,
    "utilisateur_id" INTEGER NOT NULL,
    "hash_jeton" VARCHAR(100) NOT NULL,
    "expire_le" TIMESTAMPTZ(6) NOT NULL,
    "revoque" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "jeton_rafraichissement_pkey" PRIMARY KEY ("id_jeton")
);

-- CreateTable
CREATE TABLE "station" (
    "id_station" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "ville" VARCHAR(100) NOT NULL,
    "pays" VARCHAR(60) NOT NULL,

    CONSTRAINT "station_pkey" PRIMARY KEY ("id_station")
);

-- CreateTable
CREATE TABLE "ligne" (
    "id_ligne" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "nom" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ligne_pkey" PRIMARY KEY ("id_ligne")
);

-- CreateTable
CREATE TABLE "ligne_station" (
    "ligne_id" INTEGER NOT NULL,
    "station_id" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL,
    "distance_km" DECIMAL(7,1) NOT NULL DEFAULT 0,
    "minutes_depuis_origine" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ligne_station_pkey" PRIMARY KEY ("ligne_id","station_id")
);

-- CreateTable
CREATE TABLE "tarif" (
    "id_tarif" SERIAL NOT NULL,
    "ligne_id" INTEGER NOT NULL,
    "station_depart_id" INTEGER NOT NULL,
    "station_arrivee_id" INTEGER NOT NULL,
    "prix" DECIMAL(12,2) NOT NULL,
    "devise" CHAR(3) NOT NULL DEFAULT 'USD',

    CONSTRAINT "tarif_pkey" PRIMARY KEY ("id_tarif")
);

-- CreateTable
CREATE TABLE "vehicule" (
    "id_vehicule" SERIAL NOT NULL,
    "immatriculation" VARCHAR(20) NOT NULL,
    "modele" VARCHAR(80) NOT NULL,
    "nombre_places" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vehicule_pkey" PRIMARY KEY ("id_vehicule")
);

-- CreateTable
CREATE TABLE "trajet" (
    "id_trajet" SERIAL NOT NULL,
    "ligne_id" INTEGER NOT NULL,
    "vehicule_id" INTEGER NOT NULL,
    "depart_prevu" TIMESTAMPTZ(6) NOT NULL,
    "arrivee_prevue" TIMESTAMPTZ(6) NOT NULL,
    "statut" "statut_trajet" NOT NULL DEFAULT 'planifie',

    CONSTRAINT "trajet_pkey" PRIMARY KEY ("id_trajet")
);

-- CreateTable
CREATE TABLE "passager" (
    "id_passager" SERIAL NOT NULL,
    "utilisateur_id" INTEGER,
    "nom_complet" VARCHAR(120) NOT NULL,
    "telephone" VARCHAR(30) NOT NULL,
    "email" VARCHAR(160),

    CONSTRAINT "passager_pkey" PRIMARY KEY ("id_passager")
);

-- CreateTable
CREATE TABLE "reservation" (
    "id_reservation" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "utilisateur_id" INTEGER NOT NULL,
    "trajet_id" INTEGER NOT NULL,
    "station_depart_id" INTEGER NOT NULL,
    "station_arrivee_id" INTEGER NOT NULL,
    "statut" "statut_reservation" NOT NULL DEFAULT 'confirmee',
    "statut_paiement" "statut_paiement" NOT NULL DEFAULT 'en_attente',
    "montant_total" DECIMAL(12,2) NOT NULL,
    "devise" CHAR(3) NOT NULL DEFAULT 'USD',
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_pkey" PRIMARY KEY ("id_reservation")
);

-- CreateTable
CREATE TABLE "billet" (
    "id_billet" SERIAL NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "trajet_id" INTEGER NOT NULL,
    "passager_id" INTEGER NOT NULL,
    "numero_place" INTEGER NOT NULL,
    "prix" DECIMAL(12,2) NOT NULL,
    "statut" "statut_billet" NOT NULL DEFAULT 'valide',
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billet_pkey" PRIMARY KEY ("id_billet")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "jeton_rafraichissement_hash_jeton_key" ON "jeton_rafraichissement"("hash_jeton");

-- CreateIndex
CREATE INDEX "jeton_rafraichissement_utilisateur_id_idx" ON "jeton_rafraichissement"("utilisateur_id");

-- CreateIndex
CREATE INDEX "station_ville_idx" ON "station"("ville");

-- CreateIndex
CREATE UNIQUE INDEX "station_nom_ville_key" ON "station"("nom", "ville");

-- CreateIndex
CREATE UNIQUE INDEX "ligne_code_key" ON "ligne"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ligne_station_ligne_id_ordre_key" ON "ligne_station"("ligne_id", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "tarif_ligne_id_station_depart_id_station_arrivee_id_key" ON "tarif"("ligne_id", "station_depart_id", "station_arrivee_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicule_immatriculation_key" ON "vehicule"("immatriculation");

-- CreateIndex
CREATE INDEX "trajet_depart_prevu_idx" ON "trajet"("depart_prevu");

-- CreateIndex
CREATE INDEX "trajet_ligne_id_idx" ON "trajet"("ligne_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_code_key" ON "reservation"("code");

-- CreateIndex
CREATE INDEX "reservation_utilisateur_id_idx" ON "reservation"("utilisateur_id");

-- CreateIndex
CREATE INDEX "reservation_trajet_id_idx" ON "reservation"("trajet_id");

-- CreateIndex
CREATE UNIQUE INDEX "billet_numero_key" ON "billet"("numero");

-- CreateIndex
CREATE INDEX "billet_reservation_id_idx" ON "billet"("reservation_id");

-- AddForeignKey
ALTER TABLE "jeton_rafraichissement" ADD CONSTRAINT "jeton_rafraichissement_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id_utilisateur") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ligne_station" ADD CONSTRAINT "ligne_station_ligne_id_fkey" FOREIGN KEY ("ligne_id") REFERENCES "ligne"("id_ligne") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ligne_station" ADD CONSTRAINT "ligne_station_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "station"("id_station") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarif" ADD CONSTRAINT "tarif_ligne_id_fkey" FOREIGN KEY ("ligne_id") REFERENCES "ligne"("id_ligne") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarif" ADD CONSTRAINT "tarif_station_depart_id_fkey" FOREIGN KEY ("station_depart_id") REFERENCES "station"("id_station") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarif" ADD CONSTRAINT "tarif_station_arrivee_id_fkey" FOREIGN KEY ("station_arrivee_id") REFERENCES "station"("id_station") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trajet" ADD CONSTRAINT "trajet_ligne_id_fkey" FOREIGN KEY ("ligne_id") REFERENCES "ligne"("id_ligne") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trajet" ADD CONSTRAINT "trajet_vehicule_id_fkey" FOREIGN KEY ("vehicule_id") REFERENCES "vehicule"("id_vehicule") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passager" ADD CONSTRAINT "passager_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id_utilisateur") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_trajet_id_fkey" FOREIGN KEY ("trajet_id") REFERENCES "trajet"("id_trajet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_station_depart_id_fkey" FOREIGN KEY ("station_depart_id") REFERENCES "station"("id_station") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_station_arrivee_id_fkey" FOREIGN KEY ("station_arrivee_id") REFERENCES "station"("id_station") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billet" ADD CONSTRAINT "billet_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id_reservation") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billet" ADD CONSTRAINT "billet_trajet_id_fkey" FOREIGN KEY ("trajet_id") REFERENCES "trajet"("id_trajet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billet" ADD CONSTRAINT "billet_passager_id_fkey" FOREIGN KEY ("passager_id") REFERENCES "passager"("id_passager") ON DELETE RESTRICT ON UPDATE CASCADE;


-- =====================================================================
-- Règles ajoutées à la main (Prisma ne sait pas les écrire dans le schéma)
-- =====================================================================

-- Un e-mail ne peut exister qu'une fois, sans tenir compte des majuscules.
CREATE UNIQUE INDEX "uq_utilisateur_email_minuscule" ON "utilisateur" (lower("email"));

-- Contrôles de valeurs.
ALTER TABLE "ligne_station" ADD CONSTRAINT "ck_ligne_station_ordre" CHECK ("ordre" >= 1);
ALTER TABLE "ligne_station" ADD CONSTRAINT "ck_ligne_station_distance" CHECK ("distance_km" >= 0);
ALTER TABLE "tarif" ADD CONSTRAINT "ck_tarif_prix" CHECK ("prix" >= 0);
ALTER TABLE "tarif" ADD CONSTRAINT "ck_tarif_stations" CHECK ("station_depart_id" <> "station_arrivee_id");
ALTER TABLE "vehicule" ADD CONSTRAINT "ck_vehicule_places" CHECK ("nombre_places" BETWEEN 1 AND 100);
ALTER TABLE "trajet" ADD CONSTRAINT "ck_trajet_dates" CHECK ("arrivee_prevue" > "depart_prevu");
ALTER TABLE "reservation" ADD CONSTRAINT "ck_reservation_montant" CHECK ("montant_total" >= 0);
ALTER TABLE "reservation" ADD CONSTRAINT "ck_reservation_stations" CHECK ("station_depart_id" <> "station_arrivee_id");
ALTER TABLE "billet" ADD CONSTRAINT "ck_billet_place" CHECK ("numero_place" >= 1);
ALTER TABLE "billet" ADD CONSTRAINT "ck_billet_prix" CHECK ("prix" >= 0);

-- RÈGLE CLÉ : une même place ne peut pas être vendue deux fois sur un trajet.
-- Un billet annulé libère la place, donc il est exclu de l'index.
CREATE UNIQUE INDEX "uq_billet_place_par_trajet"
    ON "billet" ("trajet_id", "numero_place")
    WHERE "statut" <> 'annule';
