import { Prisma as Sql } from '@prisma/client';
import { NonTrouve } from '../../erreurs/ErreurApp.js';
import { decalage } from '../../lib/pagination.js';
import type { Prisma } from '../../lib/prisma.js';
import type { FiltresRemplissage } from './statistiques.schemas.js';

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
// Les dates « du » et « au » sont comprises à l'heure du Burundi (UTC+2), comme dans la recherche.
const DECALAGE_BURUNDI = '+02:00';
const debutDeJour = (date: string) => new Date(`${date}T00:00:00${DECALAGE_BURUNDI}`);

/** Pourcentage avec une décimale. Une capacité nulle donne 0 (pas de division par zéro). */
const taux = (vendues: number, capacite: number) =>
  capacite === 0 ? 0 : Math.round((vendues / capacite) * 1000) / 10;

interface LigneRemplissage {
  id_trajet: number;
  code_ligne: string;
  depart_prevu: Date;
  capacite: number;
  places_vendues: number;
}

export function creerServiceStatistiques(prisma: Prisma) {
  /** Taux de remplissage des trajets non annulés, avec un résumé sur toute la période. */
  async function remplissage(filtres: FiltresRemplissage) {
    const debut = filtres.du ? debutDeJour(filtres.du) : undefined;
    const fin = filtres.au ? new Date(debutDeJour(filtres.au).getTime() + MS_PAR_JOUR) : undefined;

    // Tous les paramètres sont liés (Prisma.sql) : aucune valeur n'est collée dans le texte SQL.
    const conditions = [Sql.sql`t.statut <> 'annule'`];
    if (filtres.ligne_id) conditions.push(Sql.sql`t.ligne_id = ${filtres.ligne_id}`);
    if (debut) conditions.push(Sql.sql`t.depart_prevu >= ${debut}`);
    if (fin) conditions.push(Sql.sql`t.depart_prevu < ${fin}`);
    const ou = Sql.join(conditions, ' AND ');

    const [lignes, resume] = await Promise.all([
      prisma.$queryRaw<LigneRemplissage[]>`
        SELECT t.id_trajet, l.code AS code_ligne, t.depart_prevu,
               v.nombre_places AS capacite, COUNT(b.id_billet)::int AS places_vendues
        FROM trajet t
        JOIN ligne l ON l.id_ligne = t.ligne_id
        JOIN vehicule v ON v.id_vehicule = t.vehicule_id
        LEFT JOIN billet b ON b.trajet_id = t.id_trajet AND b.statut <> 'annule'
        WHERE ${ou}
        GROUP BY t.id_trajet, l.code, v.nombre_places
        ORDER BY t.depart_prevu, t.id_trajet
        LIMIT ${filtres.limite} OFFSET ${decalage(filtres.page, filtres.limite)}`,
      prisma.$queryRaw<{ nombre_trajets: number; capacite: number; vendues: number }[]>`
        SELECT COUNT(*)::int AS nombre_trajets,
               COALESCE(SUM(v.nombre_places), 0)::int AS capacite,
               COALESCE(SUM(s.vendues), 0)::int AS vendues
        FROM trajet t
        JOIN vehicule v ON v.id_vehicule = t.vehicule_id
        LEFT JOIN (
          SELECT trajet_id, COUNT(*) AS vendues FROM billet WHERE statut <> 'annule' GROUP BY trajet_id
        ) s ON s.trajet_id = t.id_trajet
        WHERE ${ou}`,
    ]);

    const total = resume[0]?.nombre_trajets ?? 0;
    const capacite = resume[0]?.capacite ?? 0;
    const vendues = resume[0]?.vendues ?? 0;
    return {
      total,
      donnees: {
        resume: {
          nombre_trajets: total,
          capacite_totale: capacite,
          places_vendues: vendues,
          taux_remplissage: taux(vendues, capacite),
        },
        trajets: lignes.map((l) => ({
          id_trajet: l.id_trajet,
          ligne: l.code_ligne,
          depart_prevu: l.depart_prevu,
          capacite: l.capacite,
          places_vendues: l.places_vendues,
          taux_remplissage: taux(l.places_vendues, l.capacite),
        })),
      },
    };
  }

  async function remplissageTrajet(id: number) {
    const trajet = await prisma.trajet.findUnique({
      where: { id_trajet: id },
      select: {
        id_trajet: true,
        depart_prevu: true,
        statut: true,
        vehicule: { select: { nombre_places: true } },
        ligne: { select: { code: true } },
      },
    });
    if (!trajet) throw new NonTrouve('Trajet introuvable.');
    const vendues = await prisma.billet.count({
      where: { trajet_id: id, statut: { not: 'annule' } },
    });
    const capacite = trajet.vehicule.nombre_places;
    return {
      id_trajet: trajet.id_trajet,
      ligne: trajet.ligne.code,
      depart_prevu: trajet.depart_prevu,
      statut: trajet.statut,
      capacite,
      places_vendues: vendues,
      places_libres: capacite - vendues,
      taux_remplissage: taux(vendues, capacite),
    };
  }

  return { remplissage, remplissageTrajet };
}
