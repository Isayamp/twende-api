import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creerAppTest, jetonPour, prisma, viderBase } from '../helpers/bd.js';

const app = creerAppTest();
const URL = '/api/v1/lignes';

let jetonAdmin: string;
let jetonPassager: string;
let stations: number[];

const avec = (jeton: string) => ({ Authorization: `Bearer ${jeton}` });

beforeEach(async () => {
  await viderBase();
  jetonAdmin = await jetonPour(app, 'admin');
  jetonPassager = await jetonPour(app, 'passager');
  const creees = await Promise.all(
    ['Bujumbura', 'Muramvya', 'Gitega'].map((ville) =>
      prisma.station.create({ data: { nom: `Gare de ${ville}`, ville, pays: 'Burundi' } }),
    ),
  );
  stations = creees.map((s) => s.id_station);
});

afterAll(async () => {
  await viderBase();
  await prisma.$disconnect();
});

describe('CRUD /lignes', () => {
  it('crée une ligne (admin) → 201, refuse un passager (403)', async () => {
    const donnees = { code: 'BJM-GTG', nom: 'Bujumbura - Gitega' };

    const ok = await request(app).post(URL).set(avec(jetonAdmin)).send(donnees);
    const interdit = await request(app).post(URL).set(avec(jetonPassager)).send(donnees);

    expect(ok.status).toBe(201);
    expect(ok.body.donnees).toMatchObject({ ...donnees, active: true });
    expect(interdit.status).toBe(403);
  });

  it('refuse un code invalide (422) ou déjà pris (409)', async () => {
    await prisma.ligne.create({ data: { code: 'BJM-GTG', nom: 'x' } });

    const invalide = await request(app)
      .post(URL)
      .set(avec(jetonAdmin))
      .send({ code: 'avec espace', nom: 'x' });
    const doublon = await request(app)
      .post(URL)
      .set(avec(jetonAdmin))
      .send({ code: 'BJM-GTG', nom: 'y' });

    expect(invalide.status).toBe(422);
    expect(doublon.status).toBe(409);
    expect(doublon.body.erreur.code).toBe('LIGNE_EXISTANTE');
  });

  it('liste publique avec recherche, filtre et pagination', async () => {
    await prisma.ligne.createMany({
      data: [
        { code: 'BJM-GTG', nom: 'Bujumbura - Gitega' },
        { code: 'BJM-NGZ', nom: 'Bujumbura - Ngozi', active: false },
        { code: 'BJM-MKB', nom: 'Bujumbura - Makamba' },
      ],
    });

    const tout = await request(app).get(`${URL}?limite=2`);
    const actives = await request(app).get(`${URL}?active=true`);
    const texte = await request(app).get(`${URL}?q=ngozi`);

    expect(tout.body.donnees).toHaveLength(2);
    expect(tout.body.meta.total).toBe(3);
    expect(actives.body.meta.total).toBe(2);
    expect(texte.body.donnees[0].code).toBe('BJM-NGZ');
  });

  it('modifie et supprime une ligne', async () => {
    const ligne = await prisma.ligne.create({ data: { code: 'L1', nom: 'Ligne 1' } });

    const modif = await request(app)
      .patch(`${URL}/${ligne.id_ligne}`)
      .set(avec(jetonAdmin))
      .send({ active: false });
    const suppr = await request(app).delete(`${URL}/${ligne.id_ligne}`).set(avec(jetonAdmin));
    const absente = await request(app).get(`${URL}/${ligne.id_ligne}`);

    expect(modif.body.donnees.active).toBe(false);
    expect(suppr.status).toBe(204);
    expect(absente.status).toBe(404);
  });

  it('refuse de supprimer une ligne qui a des trajets (409)', async () => {
    const ligne = await prisma.ligne.create({ data: { code: 'L1', nom: 'Ligne 1' } });
    const bus = await prisma.vehicule.create({
      data: { immatriculation: 'X-1', modele: 'M', nombre_places: 10 },
    });
    await prisma.trajet.create({
      data: {
        ligne_id: ligne.id_ligne,
        vehicule_id: bus.id_vehicule,
        depart_prevu: new Date('2030-01-01T05:00:00Z'),
        arrivee_prevue: new Date('2030-01-01T08:00:00Z'),
      },
    });

    const reponse = await request(app).delete(`${URL}/${ligne.id_ligne}`).set(avec(jetonAdmin));

    expect(reponse.status).toBe(409);
    expect(reponse.body.erreur.code).toBe('LIGNE_UTILISEE');
  });
});

describe('PUT /lignes/:id/arrets', () => {
  it("remplace les arrêts, dans l'ordre du tableau", async () => {
    const ligne = await prisma.ligne.create({ data: { code: 'L1', nom: 'Ligne 1' } });
    const [a, b, c] = stations;

    const reponse = await request(app)
      .put(`${URL}/${ligne.id_ligne}/arrets`)
      .set(avec(jetonAdmin))
      .send({
        arrets: [
          { station_id: a, distance_km: 0, minutes_depuis_origine: 0 },
          { station_id: b, distance_km: 30, minutes_depuis_origine: 45 },
          { station_id: c, distance_km: 100, minutes_depuis_origine: 120 },
        ],
      });
    const detail = await request(app).get(`${URL}/${ligne.id_ligne}`);

    expect(reponse.status).toBe(200);
    expect(detail.body.donnees.arrets.map((x: { ordre: number }) => x.ordre)).toEqual([1, 2, 3]);
    expect(detail.body.donnees.arrets[1].station.ville).toBe('Muramvya');
    expect(detail.body.donnees.arrets[2].minutes_depuis_origine).toBe(120);
  });

  it('refuse une station en double, une station inconnue, moins de 2 arrêts', async () => {
    const ligne = await prisma.ligne.create({ data: { code: 'L1', nom: 'Ligne 1' } });
    const url = `${URL}/${ligne.id_ligne}/arrets`;
    const arret = (station_id: number) => ({
      station_id,
      distance_km: 0,
      minutes_depuis_origine: 0,
    });

    const double = await request(app)
      .put(url)
      .set(avec(jetonAdmin))
      .send({ arrets: [arret(stations[0]), arret(stations[0])] });
    const inconnue = await request(app)
      .put(url)
      .set(avec(jetonAdmin))
      .send({ arrets: [arret(stations[0]), arret(9999)] });
    const un = await request(app)
      .put(url)
      .set(avec(jetonAdmin))
      .send({ arrets: [arret(stations[0])] });

    expect(double.status).toBe(422);
    expect(inconnue.status).toBe(422);
    expect(inconnue.body.erreur.code).toBe('VALIDATION');
    expect(un.status).toBe(422);
  });

  it('404 si la ligne est inconnue', async () => {
    const reponse = await request(app)
      .put(`${URL}/9999/arrets`)
      .set(avec(jetonAdmin))
      .send({
        arrets: stations
          .slice(0, 2)
          .map((s) => ({ station_id: s, distance_km: 0, minutes_depuis_origine: 0 })),
      });

    expect(reponse.status).toBe(404);
  });
});

describe('PUT /lignes/:id/tarifs', () => {
  async function ligneAvecArrets() {
    const ligne = await prisma.ligne.create({ data: { code: 'L1', nom: 'Ligne 1' } });
    await prisma.ligneStation.createMany({
      data: stations.map((station_id, i) => ({
        ligne_id: ligne.id_ligne,
        station_id,
        ordre: i + 1,
      })),
    });
    return ligne;
  }

  it('remplace les tarifs de la ligne', async () => {
    const ligne = await ligneAvecArrets();
    const [a, b, c] = stations;

    const reponse = await request(app)
      .put(`${URL}/${ligne.id_ligne}/tarifs`)
      .set(avec(jetonAdmin))
      .send({
        tarifs: [
          { station_depart_id: a, station_arrivee_id: b, prix: 3000 },
          { station_depart_id: a, station_arrivee_id: c, prix: '7500.50' },
        ],
      });
    const detail = await request(app).get(`${URL}/${ligne.id_ligne}`);

    expect(reponse.status).toBe(200);
    expect(detail.body.donnees.tarifs).toHaveLength(2);
    expect(detail.body.donnees.tarifs[1].prix).toBe('7500.5');
    expect(detail.body.donnees.tarifs[0].devise).toBe('BIF');
  });

  it("refuse un tronçon à l'envers, hors ligne, double ou à prix négatif (422)", async () => {
    const ligne = await ligneAvecArrets();
    const [a, b] = stations;
    const url = `${URL}/${ligne.id_ligne}/tarifs`;
    const envoyer = (tarifs: unknown[]) =>
      request(app).put(url).set(avec(jetonAdmin)).send({ tarifs });

    const envers = await envoyer([{ station_depart_id: b, station_arrivee_id: a, prix: 100 }]);
    const horsLigne = await envoyer([
      { station_depart_id: a, station_arrivee_id: 9999, prix: 100 },
    ]);
    const double = await envoyer([
      { station_depart_id: a, station_arrivee_id: b, prix: 100 },
      { station_depart_id: a, station_arrivee_id: b, prix: 200 },
    ]);
    const negatif = await envoyer([{ station_depart_id: a, station_arrivee_id: b, prix: -5 }]);

    for (const r of [envers, horsLigne, double, negatif]) expect(r.status).toBe(422);
  });
});
