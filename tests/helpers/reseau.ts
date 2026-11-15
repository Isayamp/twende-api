import { prisma } from './bd.js';

/**
 * Petit réseau de test : 3 stations (Bujumbura, Muramvya, Gitega), une ligne,
 * un bus de 10 places et des tarifs. Les trajets sont créés par chaque test.
 *
 *   ordre 1 Bujumbura (0 min)  →  2 Muramvya (45 min)  →  3 Gitega (120 min)
 *   prix : A→B 3000, A→C 7500, B→C 4500
 */
export async function creerReseau() {
  const [a, b, c] = await Promise.all(
    ['Bujumbura', 'Muramvya', 'Gitega'].map((ville) =>
      prisma.station.create({ data: { nom: `Gare de ${ville}`, ville, pays: 'Burundi' } }),
    ),
  );
  const ligne = await prisma.ligne.create({ data: { code: 'BJM-GTG', nom: 'Bujumbura - Gitega' } });
  const arrets = [a, b, c].map((s, i) => ({
    ligne_id: ligne.id_ligne,
    station_id: s.id_station,
    ordre: i + 1,
    distance_km: [0, 30, 100][i],
    minutes_depuis_origine: [0, 45, 120][i],
  }));
  await prisma.ligneStation.createMany({ data: arrets });
  await prisma.tarif.createMany({
    data: [
      {
        ligne_id: ligne.id_ligne,
        station_depart_id: a.id_station,
        station_arrivee_id: b.id_station,
        prix: 3000,
      },
      {
        ligne_id: ligne.id_ligne,
        station_depart_id: a.id_station,
        station_arrivee_id: c.id_station,
        prix: 7500,
      },
      {
        ligne_id: ligne.id_ligne,
        station_depart_id: b.id_station,
        station_arrivee_id: c.id_station,
        prix: 4500,
      },
    ],
  });
  const bus = await prisma.vehicule.create({
    data: { immatriculation: 'BJ-1234-A', modele: 'Yutong', nombre_places: 10 },
  });
  return { a, b, c, ligne, bus };
}

/** Crée un trajet directement en base (départ à l'origine de la ligne, arrivée 2 h plus tard). */
export async function creerTrajet(
  ligneId: number,
  vehiculeId: number,
  departUtc: string,
  statut: 'planifie' | 'en_cours' | 'termine' | 'annule' = 'planifie',
) {
  const depart = new Date(departUtc);
  return prisma.trajet.create({
    data: {
      ligne_id: ligneId,
      vehicule_id: vehiculeId,
      depart_prevu: depart,
      arrivee_prevue: new Date(depart.getTime() + 120 * 60 * 1000),
      statut,
    },
  });
}

/** Vend des places directement en base (sans passer par l'API de réservation). */
export async function vendrePlaces(
  trajetId: number,
  utilisateurId: number,
  places: number[],
  statut: 'valide' | 'annule' = 'valide',
) {
  const passager = await prisma.passager.create({
    data: { nom_complet: 'Voyageur Test', telephone: '+25779111111' },
  });
  const reservation = await prisma.reservation.create({
    data: {
      code: `R-${trajetId}-${places.join('')}-${statut}`,
      utilisateur_id: utilisateurId,
      trajet_id: trajetId,
      station_depart_id: (await prisma.station.findFirstOrThrow()).id_station,
      station_arrivee_id: (
        await prisma.station.findFirstOrThrow({ orderBy: { id_station: 'desc' } })
      ).id_station,
      montant_total: 0,
    },
  });
  for (const numero_place of places) {
    await prisma.billet.create({
      data: {
        numero: `TWD-${trajetId}-${numero_place}-${statut}`,
        reservation_id: reservation.id_reservation,
        trajet_id: trajetId,
        passager_id: passager.id_passager,
        numero_place,
        prix: 0,
        statut,
      },
    });
  }
}
