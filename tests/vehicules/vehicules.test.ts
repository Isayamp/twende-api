import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creerAppTest, jetonPour, prisma, viderBase } from '../helpers/bd.js';

const app = creerAppTest();
const URL = '/api/v1/vehicules';
const bus = { immatriculation: 'BJ-1234-A', modele: 'Yutong ZK6122', nombre_places: 49 };

let jetonAdmin: string;
let jetonAgent: string;
let jetonPassager: string;

beforeEach(async () => {
  await viderBase();
  jetonAdmin = await jetonPour(app, 'admin');
  jetonAgent = await jetonPour(app, 'agent');
  jetonPassager = await jetonPour(app, 'passager');
});

afterAll(async () => {
  await viderBase();
  await prisma.$disconnect();
});

const avec = (jeton: string) => ({ Authorization: `Bearer ${jeton}` });

describe('/vehicules', () => {
  it('crée un véhicule (admin) → 201', async () => {
    const reponse = await request(app).post(URL).set(avec(jetonAdmin)).send(bus);

    expect(reponse.status).toBe(201);
    expect(reponse.body.donnees).toMatchObject({ ...bus, active: true });
  });

  it("refuse la création à l'agent (403) et sans connexion (401)", async () => {
    expect((await request(app).post(URL).set(avec(jetonAgent)).send(bus)).status).toBe(403);
    expect((await request(app).post(URL).send(bus)).status).toBe(401);
  });

  it('refuse un nombre de places invalide (422)', async () => {
    const reponse = await request(app)
      .post(URL)
      .set(avec(jetonAdmin))
      .send({ ...bus, nombre_places: 0 });

    expect(reponse.status).toBe(422);
  });

  it('refuse une immatriculation déjà utilisée (409)', async () => {
    await prisma.vehicule.create({ data: bus });
    const reponse = await request(app).post(URL).set(avec(jetonAdmin)).send(bus);

    expect(reponse.status).toBe(409);
    expect(reponse.body.erreur.code).toBe('VEHICULE_EXISTANT');
  });

  it('la liste est réservée au personnel (admin, agent)', async () => {
    await prisma.vehicule.create({ data: bus });

    expect((await request(app).get(URL).set(avec(jetonPassager))).status).toBe(403);
    const reponse = await request(app).get(URL).set(avec(jetonAgent));
    expect(reponse.status).toBe(200);
    expect(reponse.body.meta.total).toBe(1);
  });

  it('filtre par état et par texte, avec pagination', async () => {
    await prisma.vehicule.createMany({
      data: [
        bus,
        { immatriculation: 'BJ-2000-B', modele: 'Scania', nombre_places: 60, active: false },
        { immatriculation: 'BJ-3000-C', modele: 'Toyota Coaster', nombre_places: 25 },
      ],
    });

    const actifs = await request(app).get(`${URL}?active=true`).set(avec(jetonAdmin));
    const texte = await request(app).get(`${URL}?q=scania`).set(avec(jetonAdmin));
    const page = await request(app).get(`${URL}?limite=1&page=3`).set(avec(jetonAdmin));

    expect(actifs.body.meta.total).toBe(2);
    expect(texte.body.donnees).toHaveLength(1);
    expect(page.body.donnees).toHaveLength(1);
    expect(page.body.meta).toEqual({ page: 3, limite: 1, total: 3 });
  });

  it('modifie, lit et supprime un véhicule', async () => {
    const v = await prisma.vehicule.create({ data: bus });
    const url = `${URL}/${v.id_vehicule}`;

    const modif = await request(app).patch(url).set(avec(jetonAdmin)).send({ active: false });
    const lecture = await request(app).get(url).set(avec(jetonAgent));
    const suppr = await request(app).delete(url).set(avec(jetonAdmin));
    const absent = await request(app).get(url).set(avec(jetonAgent));

    expect(modif.body.donnees.active).toBe(false);
    expect(lecture.status).toBe(200);
    expect(suppr.status).toBe(204);
    expect(absent.status).toBe(404);
  });

  it('refuse de supprimer un véhicule utilisé par un trajet (409)', async () => {
    const v = await prisma.vehicule.create({ data: bus });
    const ligne = await prisma.ligne.create({ data: { code: 'L1', nom: 'Ligne 1' } });
    await prisma.trajet.create({
      data: {
        ligne_id: ligne.id_ligne,
        vehicule_id: v.id_vehicule,
        depart_prevu: new Date('2030-01-01T05:00:00Z'),
        arrivee_prevue: new Date('2030-01-01T08:00:00Z'),
      },
    });

    const reponse = await request(app).delete(`${URL}/${v.id_vehicule}`).set(avec(jetonAdmin));

    expect(reponse.status).toBe(409);
    expect(reponse.body.erreur.code).toBe('VEHICULE_UTILISE');
  });
});
