import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creerAppTest, creerUtilisateur, prisma, viderBase } from '../helpers/bd.js';
import { creerReseau, creerTrajet, vendrePlaces } from '../helpers/reseau.js';

const app = creerAppTest();
const URL = '/api/v1/trajets/recherche';

type Reseau = Awaited<ReturnType<typeof creerReseau>>;
let r: Reseau;
let t1: { id_trajet: number };

// Les heures locales sont celles du Burundi (UTC+2, sans heure d'été).
beforeEach(async () => {
  await viderBase();
  r = await creerReseau();
  t1 = await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-10T05:00:00Z'); // 07:00 local
  await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-10T12:00:00Z'); // 14:00 local
  await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-11T05:00:00Z');
  await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-12T05:00:00Z', 'annule');
  await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2020-01-01T05:00:00Z'); // dans le passé
});

afterAll(async () => {
  await viderBase();
  await prisma.$disconnect();
});

const chercher = (requete: Record<string, string | number>) =>
  request(app)
    .get(URL)
    .query({ depart: r.a.id_station, arrivee: r.c.id_station, ...requete });

describe('GET /trajets/recherche', () => {
  it('trouve les trajets à venir qui vont du départ à l’arrivée', async () => {
    const reponse = await chercher({});

    expect(reponse.status).toBe(200);
    expect(reponse.body.meta).toEqual({ page: 1, limite: 20, total: 3 });
    expect(reponse.body.donnees[0]).toMatchObject({
      id_trajet: t1.id_trajet,
      ligne: { code: 'BJM-GTG' },
      depart: { station: { ville: 'Bujumbura' }, heure: '2030-06-10T05:00:00.000Z' },
      arrivee: { station: { ville: 'Gitega' }, heure: '2030-06-10T07:00:00.000Z' },
      duree_minutes: 120,
      prix: '7500',
      devise: 'BIF',
      places_libres: 10,
      vehicule: { modele: 'Yutong', nombre_places: 10 },
    });
  });

  it('calcule les heures au passage de chaque arrêt (Muramvya → Gitega)', async () => {
    const reponse = await chercher({ depart: r.b.id_station });

    expect(reponse.body.meta.total).toBe(3);
    expect(reponse.body.donnees[0].depart.heure).toBe('2030-06-10T05:45:00.000Z');
    expect(reponse.body.donnees[0].duree_minutes).toBe(75);
    expect(reponse.body.donnees[0].prix).toBe('4500');
  });

  it('ne propose rien dans le mauvais sens (Gitega → Bujumbura)', async () => {
    const reponse = await chercher({ depart: r.c.id_station, arrivee: r.a.id_station });

    expect(reponse.status).toBe(200);
    expect(reponse.body.donnees).toEqual([]);
    expect(reponse.body.meta.total).toBe(0);
  });

  it('filtre par date locale', async () => {
    const reponse = await chercher({ date: '2030-06-10' });

    expect(reponse.body.meta.total).toBe(2);
  });

  it("filtre par plage d'heures locales", async () => {
    const matin = await chercher({ date: '2030-06-10', heure_max: '10:00' });
    const apresMidi = await chercher({ date: '2030-06-10', heure_min: '10:00' });

    expect(matin.body.donnees.map((t: { id_trajet: number }) => t.id_trajet)).toEqual([
      t1.id_trajet,
    ]);
    expect(apresMidi.body.meta.total).toBe(1);
    expect(apresMidi.body.donnees[0].depart.heure).toBe('2030-06-10T12:00:00.000Z');
  });

  it('filtre par prix maximum', async () => {
    const trop = await chercher({ prix_max: 5000 });
    const assez = await chercher({ prix_max: 7500 });

    expect(trop.body.meta.total).toBe(0);
    expect(assez.body.meta.total).toBe(3);
  });

  it('compte les places libres sans les billets annulés, et filtre par places minimum', async () => {
    const client = await creerUtilisateur();
    await vendrePlaces(t1.id_trajet, client.id_utilisateur, [1, 2]);
    await vendrePlaces(t1.id_trajet, client.id_utilisateur, [3], 'annule');

    const reponse = await chercher({});
    const complet = await chercher({ places_min: 9 });

    expect(reponse.body.donnees[0].places_libres).toBe(8);
    expect(complet.body.meta.total).toBe(2);
    expect(
      complet.body.donnees.every((t: { id_trajet: number }) => t.id_trajet !== t1.id_trajet),
    ).toBe(true);
  });

  it('trie par heure (défaut) ou par prix', async () => {
    const autre = await prisma.ligne.create({ data: { code: 'BJM-GTG2', nom: 'Express' } });
    await prisma.ligneStation.createMany({
      data: [r.a, r.c].map((s, i) => ({
        ligne_id: autre.id_ligne,
        station_id: s.id_station,
        ordre: i + 1,
        minutes_depuis_origine: i * 100,
      })),
    });
    await prisma.tarif.create({
      data: {
        ligne_id: autre.id_ligne,
        station_depart_id: r.a.id_station,
        station_arrivee_id: r.c.id_station,
        prix: 6000,
      },
    });
    const express = await prisma.vehicule.create({
      data: { immatriculation: 'BJ-9999-Z', modele: 'Express', nombre_places: 20 },
    });
    await creerTrajet(autre.id_ligne, express.id_vehicule, '2030-06-10T09:00:00Z');

    const parHeure = await chercher({});
    const parPrix = await chercher({ tri: 'prix' });

    const heures = parHeure.body.donnees.map((t: { depart: { heure: string } }) => t.depart.heure);
    expect(heures).toEqual([...heures].sort());
    expect(parPrix.body.donnees[0].prix).toBe('6000');
    expect(parPrix.body.meta.total).toBe(4);
  });

  it('pagine les résultats', async () => {
    const page2 = await chercher({ limite: 2, page: 2 });

    expect(page2.body.donnees).toHaveLength(1);
    expect(page2.body.meta).toEqual({ page: 2, limite: 2, total: 3 });
  });

  it('refuse les paramètres invalides (422)', async () => {
    const sansArrivee = await request(app).get(URL).query({ depart: r.a.id_station });
    const memeStation = await chercher({ arrivee: r.a.id_station });
    const mauvaiseDate = await chercher({ date: '10/06/2030' });
    const mauvaiseHeure = await chercher({ heure_min: '25:99' });
    const tri = await chercher({ tri: 'au-hasard' });
    const limite = await chercher({ limite: 1000 });

    for (const reponse of [sansArrivee, memeStation, mauvaiseDate, mauvaiseHeure, tri, limite]) {
      expect(reponse.status).toBe(422);
      expect(reponse.body.erreur.code).toBe('VALIDATION');
    }
  });

  it("ne se laisse pas piéger par une tentative d'injection SQL dans un filtre", async () => {
    const reponse = await chercher({ date: "2030-06-10'; DROP TABLE trajet;--" });

    expect(reponse.status).toBe(422);
    expect(await prisma.trajet.count()).toBe(5);
  });
});
