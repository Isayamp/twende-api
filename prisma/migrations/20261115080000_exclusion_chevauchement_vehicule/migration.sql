-- Règle : un véhicule ne peut pas avoir deux trajets qui se chevauchent (sauf trajet annulé).
-- La base elle-même refuse le deuxième, même si deux demandes arrivent en même temps.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "trajet"
  ADD CONSTRAINT "trajet_vehicule_sans_chevauchement"
  EXCLUDE USING gist (
    "vehicule_id" WITH =,
    tstzrange("depart_prevu", "arrivee_prevue") WITH &&
  ) WHERE ("statut" <> 'annule');
