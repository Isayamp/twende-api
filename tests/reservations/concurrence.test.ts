import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creerAppTest, jetonPour, prisma, viderBase } from '../helpers/bd.js';
import { creerReseau, creerTrajet } from '../helpers/reseau.js';

// Test central du projet : aucune place ne doit être vendue deux fois,
// même quand beaucoup de demandes arrivent exactement en même temps.

const app = creerAppTest();
const URL = '/api/v1/reservations';
const voyageur = { nom_complet: 'Voyageur Concurrent', telephone: '+25779444444' };

let reseau: Awaited<ReturnType<typeof creerReseau>>;
let jeton: string;
let trajetId: number;

function reserverPlace(numero_place: number) {
  return request(app)
    .post(URL)
    .set({ Authorization: `Bearer ${jeton}` })
    .send({
      trajet_id: trajetId,
      station_depart_id: reseau.a.id_station,
      station_arrivee_id: reseau.c.id_station,
      places: [{ numero_place, passager: voyageur }],
    });
}

beforeEach(async () => {
  await viderBase();
  reseau = await creerReseau();
  // Le personnel : le plafond de réservations en attente vise les passagers, pas ce test.
  jeton = await jetonPour(app, 'agent');
  trajetId = (
    await creerTrajet(
      reseau.ligne.id_ligne,
      reseau.bus.id_vehicule,
      new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    )
  ).id_trajet;
});

afterAll(async () => {
  await viderBase();
  await prisma.$disconnect();
});

describe('concurrence sur les places', () => {
  it('20 demandes simultanées pour la même place : 1 succès (201) et 19 conflits (409)', async () => {
    const reponses = await Promise.all(Array.from({ length: 20 }, () => reserverPlace(7)));

    const statuts = reponses.map((r) => r.status);
    expect(statuts.filter((s) => s === 201)).toHaveLength(1);
    expect(statuts.filter((s) => s === 409)).toHaveLength(19);
    for (const r of reponses.filter((r) => r.status === 409)) {
      expect(r.body.erreur.code).toBe('PLACE_DEJA_PRISE');
    }
    expect(await prisma.billet.count({ where: { trajet_id: trajetId, numero_place: 7 } })).toBe(1);
    expect(await prisma.reservation.count()).toBe(1);
  });

  it('30 demandes pour 10 places : exactement 10 ventes, jamais plus', async () => {
    const reponses = await Promise.all(
      Array.from({ length: 30 }, (_, i) => reserverPlace((i % 10) + 1)),
    );

    expect(reponses.filter((r) => r.status === 201)).toHaveLength(10);
    expect(reponses.filter((r) => r.status === 409)).toHaveLength(20);
    const billets = await prisma.billet.findMany({ where: { trajet_id: trajetId } });
    expect(billets).toHaveLength(10);
    expect(new Set(billets.map((b) => b.numero_place)).size).toBe(10);
  });

  it('deux réservations multi-places qui se croisent : une seule passe, sans billet à moitié', async () => {
    const envoyer = (places: number[]) =>
      request(app)
        .post(URL)
        .set({ Authorization: `Bearer ${jeton}` })
        .send({
          trajet_id: trajetId,
          station_depart_id: reseau.a.id_station,
          station_arrivee_id: reseau.c.id_station,
          places: places.map((numero_place) => ({ numero_place, passager: voyageur })),
        });

    const reponses = await Promise.all([envoyer([1, 2, 3]), envoyer([3, 2, 1]), envoyer([2, 3, 4])]);

    expect(reponses.filter((r) => r.status === 201)).toHaveLength(1);
    const billets = await prisma.billet.findMany({ where: { trajet_id: trajetId } });
    expect(billets).toHaveLength(3);
    expect(new Set(billets.map((b) => b.reservation_id)).size).toBe(1);
  });
});
