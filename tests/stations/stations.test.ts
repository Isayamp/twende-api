import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creerAppTest, jetonPour, prisma, viderBase } from '../helpers/bd.js';

const app = creerAppTest();
const URL = '/api/v1/stations';

const bujumbura = { nom: 'Gare routière de Bujumbura', ville: 'Bujumbura', pays: 'Burundi' };

let jetonAdmin: string;
let jetonPassager: string;

beforeEach(async () => {
  await viderBase();
  jetonAdmin = await jetonPour(app, 'admin');
  jetonPassager = await jetonPour(app, 'passager');
});

afterAll(async () => {
  await viderBase();
  await prisma.$disconnect();
});

describe('POST /stations', () => {
  it('crée une station (admin) → 201', async () => {
    const reponse = await request(app)
      .post(URL)
      .set('Authorization', `Bearer ${jetonAdmin}`)
      .send(bujumbura);

    expect(reponse.status).toBe(201);
    expect(reponse.body.donnees).toMatchObject(bujumbura);
    expect(reponse.body.donnees.id_station).toBeTypeOf('number');
  });

  it('refuse sans connexion (401) et pour un passager (403)', async () => {
    expect((await request(app).post(URL).send(bujumbura)).status).toBe(401);
    const reponse = await request(app)
      .post(URL)
      .set('Authorization', `Bearer ${jetonPassager}`)
      .send(bujumbura);
    expect(reponse.status).toBe(403);
  });

  it('refuse des données invalides (422)', async () => {
    const reponse = await request(app)
      .post(URL)
      .set('Authorization', `Bearer ${jetonAdmin}`)
      .send({ nom: '', ville: 'Bujumbura' });

    expect(reponse.status).toBe(422);
    expect(reponse.body.erreur.details.map((d: { champ: string }) => d.champ)).toEqual(
      expect.arrayContaining(['nom', 'pays']),
    );
  });

  it('refuse un doublon nom + ville (409)', async () => {
    await prisma.station.create({ data: bujumbura });
    const reponse = await request(app)
      .post(URL)
      .set('Authorization', `Bearer ${jetonAdmin}`)
      .send(bujumbura);

    expect(reponse.status).toBe(409);
    expect(reponse.body.erreur.code).toBe('STATION_EXISTANTE');
  });
});

describe('GET /stations', () => {
  beforeEach(async () => {
    await prisma.station.createMany({
      data: [
        bujumbura,
        { nom: 'Gare de Gitega', ville: 'Gitega', pays: 'Burundi' },
        { nom: 'Gare de Ngozi', ville: 'Ngozi', pays: 'Burundi' },
      ],
    });
  });

  it('liste publique avec pagination', async () => {
    const reponse = await request(app).get(`${URL}?limite=2&page=2`);

    expect(reponse.status).toBe(200);
    expect(reponse.body.donnees).toHaveLength(1);
    expect(reponse.body.meta).toEqual({ page: 2, limite: 2, total: 3 });
  });

  it('cherche par texte (nom ou ville)', async () => {
    const reponse = await request(app).get(`${URL}?q=gitega`);

    expect(reponse.body.donnees).toHaveLength(1);
    expect(reponse.body.donnees[0].ville).toBe('Gitega');
  });

  it('filtre par ville', async () => {
    const reponse = await request(app).get(`${URL}?ville=Ngozi`);

    expect(reponse.body.meta.total).toBe(1);
  });

  it('refuse une limite trop grande (422)', async () => {
    const reponse = await request(app).get(`${URL}?limite=1000`);

    expect(reponse.status).toBe(422);
  });
});

describe('GET/PATCH/DELETE /stations/:id', () => {
  it('lit une station, ou 404', async () => {
    const station = await prisma.station.create({ data: bujumbura });

    const trouvee = await request(app).get(`${URL}/${station.id_station}`);
    const absente = await request(app).get(`${URL}/9999`);

    expect(trouvee.status).toBe(200);
    expect(absente.status).toBe(404);
  });

  it("refuse un identifiant qui n'est pas un nombre (422)", async () => {
    const reponse = await request(app).get(`${URL}/abc`);

    expect(reponse.status).toBe(422);
  });

  it('modifie une station (admin)', async () => {
    const station = await prisma.station.create({ data: bujumbura });
    const reponse = await request(app)
      .patch(`${URL}/${station.id_station}`)
      .set('Authorization', `Bearer ${jetonAdmin}`)
      .send({ nom: 'Nouvelle gare' });

    expect(reponse.status).toBe(200);
    expect(reponse.body.donnees.nom).toBe('Nouvelle gare');
    expect(reponse.body.donnees.ville).toBe('Bujumbura');
  });

  it('supprime une station (204), puis 404', async () => {
    const station = await prisma.station.create({ data: bujumbura });
    const suppression = await request(app)
      .delete(`${URL}/${station.id_station}`)
      .set('Authorization', `Bearer ${jetonAdmin}`);
    const encore = await request(app)
      .delete(`${URL}/${station.id_station}`)
      .set('Authorization', `Bearer ${jetonAdmin}`);

    expect(suppression.status).toBe(204);
    expect(encore.status).toBe(404);
  });

  it('refuse de supprimer une station utilisée par une ligne (409)', async () => {
    const station = await prisma.station.create({ data: bujumbura });
    const ligne = await prisma.ligne.create({ data: { code: 'L1', nom: 'Ligne 1' } });
    await prisma.ligneStation.create({
      data: { ligne_id: ligne.id_ligne, station_id: station.id_station, ordre: 1 },
    });
    const reponse = await request(app)
      .delete(`${URL}/${station.id_station}`)
      .set('Authorization', `Bearer ${jetonAdmin}`);

    expect(reponse.status).toBe(409);
    expect(reponse.body.erreur.code).toBe('STATION_UTILISEE');
  });
});
