import { Prisma as PrismaSql } from '@prisma/client';
import type { Prisma } from '../../lib/prisma.js';
import { decalage } from '../../lib/pagination.js';
import type { RechercheTrajets } from './trajets.schemas.js';

/** Fuseau du Burundi : les dates et heures du client sont comprises dans ce fuseau. */
const FUSEAU = 'Africa/Bujumbura';

interface LigneResultat {
  id_trajet: number;
  statut: string;
  id_ligne: number;
  ligne_code: string;
  ligne_nom: string;
  depart_id: number;
  depart_nom: string;
  depart_ville: string;
  arrivee_id: number;
  arrivee_nom: string;
  arrivee_ville: string;
  heure_depart: Date;
  heure_arrivee: Date;
  prix: { toString(): string };
  devise: string;
  modele: string;
  nombre_places: number;
  places_libres: bigint | number;
}

/**
 * Recherche de trajets : tous les départs à venir qui passent par la station de départ
 * PUIS par la station d'arrivée (dans cet ordre sur la ligne) et qui ont un tarif pour ce tronçon.
 *
 * Toutes les valeurs du client passent par des paramètres (Prisma.sql) : jamais de texte collé
 * dans la requête, donc pas d'injection SQL.
 */
export function creerServiceRecherche(prisma: Prisma) {
  async function rechercher(recherche: RechercheTrajets) {
    const base = PrismaSql.sql`
      SELECT t.id_trajet, t.statut,
             l.id_ligne, l.code AS ligne_code, l.nom AS ligne_nom,
             sd.id_station AS depart_id, sd.nom AS depart_nom, sd.ville AS depart_ville,
             sa.id_station AS arrivee_id, sa.nom AS arrivee_nom, sa.ville AS arrivee_ville,
             t.depart_prevu + ld.minutes_depuis_origine * interval '1 minute' AS heure_depart,
             t.depart_prevu + la.minutes_depuis_origine * interval '1 minute' AS heure_arrivee,
             tf.prix, tf.devise, v.modele, v.nombre_places,
             v.nombre_places - (
               SELECT COUNT(*) FROM billet b
               WHERE b.trajet_id = t.id_trajet AND b.statut <> 'annule'
             ) AS places_libres
      FROM trajet t
      JOIN ligne l ON l.id_ligne = t.ligne_id AND l.active
      JOIN vehicule v ON v.id_vehicule = t.vehicule_id
      JOIN ligne_station ld ON ld.ligne_id = t.ligne_id AND ld.station_id = ${recherche.depart}
      JOIN ligne_station la ON la.ligne_id = t.ligne_id AND la.station_id = ${recherche.arrivee}
                           AND la.ordre > ld.ordre
      JOIN tarif tf ON tf.ligne_id = t.ligne_id
                   AND tf.station_depart_id = ${recherche.depart}
                   AND tf.station_arrivee_id = ${recherche.arrivee}
      JOIN station sd ON sd.id_station = ${recherche.depart}
      JOIN station sa ON sa.id_station = ${recherche.arrivee}
      WHERE t.statut = 'planifie'`;

    const filtres = [PrismaSql.sql`r.heure_depart > now()`];
    const heureLocale = PrismaSql.sql`(r.heure_depart AT TIME ZONE ${FUSEAU})`;
    if (recherche.date) filtres.push(PrismaSql.sql`${heureLocale}::date = ${recherche.date}::date`);
    if (recherche.heure_min)
      filtres.push(PrismaSql.sql`${heureLocale}::time >= ${recherche.heure_min}::time`);
    if (recherche.heure_max)
      filtres.push(PrismaSql.sql`${heureLocale}::time <= ${recherche.heure_max}::time`);
    if (recherche.prix_max !== undefined)
      filtres.push(PrismaSql.sql`r.prix <= ${recherche.prix_max}`);
    if (recherche.places_min)
      filtres.push(PrismaSql.sql`r.places_libres >= ${recherche.places_min}`);
    const conditions = PrismaSql.join(filtres, ' AND ');

    const ordre =
      recherche.tri === 'prix'
        ? PrismaSql.sql`r.prix ASC, r.heure_depart ASC, r.id_trajet ASC`
        : PrismaSql.sql`r.heure_depart ASC, r.id_trajet ASC`;

    const [lignes, comptes] = await Promise.all([
      prisma.$queryRaw<LigneResultat[]>`
        SELECT * FROM (${base}) r WHERE ${conditions}
        ORDER BY ${ordre}
        LIMIT ${recherche.limite} OFFSET ${decalage(recherche.page, recherche.limite)}`,
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total FROM (${base}) r WHERE ${conditions}`,
    ]);

    return { trajets: lignes.map(formater), total: comptes[0]?.total ?? 0 };
  }

  return { rechercher };
}

function formater(l: LigneResultat) {
  return {
    id_trajet: l.id_trajet,
    statut: l.statut,
    ligne: { id_ligne: l.id_ligne, code: l.ligne_code, nom: l.ligne_nom },
    depart: {
      station: { id_station: l.depart_id, nom: l.depart_nom, ville: l.depart_ville },
      heure: l.heure_depart,
    },
    arrivee: {
      station: { id_station: l.arrivee_id, nom: l.arrivee_nom, ville: l.arrivee_ville },
      heure: l.heure_arrivee,
    },
    duree_minutes: Math.round((l.heure_arrivee.getTime() - l.heure_depart.getTime()) / 60000),
    prix: l.prix.toString(),
    devise: l.devise,
    places_libres: Number(l.places_libres),
    vehicule: { modele: l.modele, nombre_places: l.nombre_places },
  };
}
