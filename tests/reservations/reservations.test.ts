import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creerAppTest, jetonPour, prisma, viderBase } from '../helpers/bd.js';
import { creerReseau, creerTrajet, vendrePlaces } from '../helpers/reseau.js';

const app = creerAppTest();
const URL = '/api/v1/reservations';
const HEURE = 60 * 60 * 1000;

const dansHeures = (heures: number) => new Date(Date.now() + heures * HEURE).toISOString();
const avec = (jeton: string) => ({ Authorization: `Bearer ${jeton}` });
const voyageur = { nom_complet: 'Amani Kasongo', telephone: '+25779222222' };

let reseau: Awaited<ReturnType<typeof creerReseau>>;
let jetonPassager: string;
let jetonAgent: string;
let idPassager: number;

/** Corps de réservation pour un trajet : Bujumbura → Gitega par défaut. */
function corps(trajetId: number, places: number[], extra: Record<string, unknown> = {}) {
  return {
    trajet_id: trajetId,
    station_depart_id: reseau.a.id_station,
    station_arrivee_id: reseau.c.id_station,
    places: places.map((numero_place) => ({ numero_place, passager: voyageur })),
    ...extra,
  };
}

async function trajetDans(heures: number, statut: 'planifie' | 'annule' = 'planifie') {
  return creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, dansHeures(heures), statut);
}

beforeEach(async () => {
  await viderBase();
  reseau = await creerReseau();
  jetonPassager = await jetonPour(app, 'passager');
  jetonAgent = await jetonPour(app, 'agent');
  idPassager = (await prisma.utilisateur.findUniqueOrThrow({ where: { email: 'passager@twende.test' } }))
    .id_utilisateur;
});

afterAll(async () => {
  await viderBase();
  await prisma.$disconnect();
});

describe('POST /reservations', () => {
  it('crée la réservation et un billet par place, avec le prix du tronçon', async () => {
    const trajet = await trajetDans(48);

    const reponse = await request(app)
      .post(URL)
      .set(avec(jetonPassager))
      .send(corps(trajet.id_trajet, [3, 4]));

    expect(reponse.status).toBe(201);
    const r = reponse.body.donnees;
    expect(r.statut).toBe('confirmee');
    expect(r.statut_paiement).toBe('en_attente');
    expect(r.devise).toBe('BIF');
    expect(Number(r.montant_total)).toBe(15000); // 2 × 7500 (Bujumbura → Gitega)
    expect(r.code).toMatch(/^RES-[A-Z0-9]{8}$/);
    expect(r.billets).toHaveLength(2);
    expect(r.billets.map((b: { numero_place: number }) => b.numero_place).sort()).toEqual([3, 4]);
    expect(r.billets[0].numero).toMatch(/^TWD-[A-Z0-9]{8}$/);
    expect(Number(r.billets[0].prix)).toBe(7500);
    expect(r.billets[0].passager).toMatchObject(voyageur);
  });

  it('applique le tarif du tronçon choisi (Bujumbura → Muramvya)', async () => {
    const trajet = await trajetDans(48);

    const reponse = await request(app)
      .post(URL)
      .set(avec(jetonPassager))
      .send(corps(trajet.id_trajet, [1], { station_arrivee_id: reseau.b.id_station }));

    expect(reponse.status).toBe(201);
    expect(Number(reponse.body.donnees.montant_total)).toBe(3000);
  });

  it('refuse sans connexion (401)', async () => {
    const trajet = await trajetDans(48);
    expect((await request(app).post(URL).send(corps(trajet.id_trajet, [1]))).status).toBe(401);
  });

  it('refuse un trajet inconnu (404)', async () => {
    const reponse = await request(app).post(URL).set(avec(jetonPassager)).send(corps(999999, [1]));
    expect(reponse.status).toBe(404);
  });

  it.each([
    ['place 0', [0]],
    ['place au-delà du bus', [11]],
    ['place en double', [2, 2]],
    ['aucune place', []],
  ])('refuse %s (422)', async (_nom, places) => {
    const trajet = await trajetDans(48);

    const reponse = await request(app)
      .post(URL)
      .set(avec(jetonPassager))
      .send(corps(trajet.id_trajet, places));

    expect(reponse.status).toBe(422);
    expect(await prisma.billet.count()).toBe(0);
  });

  it('refuse un tronçon à l’envers ou sans tarif (422)', async () => {
    const trajet = await trajetDans(48);

    const reponse = await request(app)
      .post(URL)
      .set(avec(jetonPassager))
      .send(
        corps(trajet.id_trajet, [1], {
          station_depart_id: reseau.c.id_station,
          station_arrivee_id: reseau.a.id_station,
        }),
      );

    expect(reponse.status).toBe(422);
    expect(reponse.body.erreur.code).toBe('VALIDATION');
  });

  it('refuse une place déjà prise (409) et ne réserve rien (tout ou rien)', async () => {
    const trajet = await trajetDans(48);
    await vendrePlaces(trajet.id_trajet, idPassager, [5]);

    const reponse = await request(app)
      .post(URL)
      .set(avec(jetonPassager))
      .send(corps(trajet.id_trajet, [4, 5]));

    expect(reponse.status).toBe(409);
    expect(reponse.body.erreur.code).toBe('PLACE_DEJA_PRISE');
    expect(await prisma.billet.count({ where: { numero_place: 4 } })).toBe(0);
    expect(await prisma.reservation.count({ where: { montant_total: { gt: 0 } } })).toBe(0);
  });

  it('permet de réserver à nouveau une place dont le billet est annulé', async () => {
    const trajet = await trajetDans(48);
    await vendrePlaces(trajet.id_trajet, idPassager, [6], 'annule');

    const reponse = await request(app)
      .post(URL)
      .set(avec(jetonPassager))
      .send(corps(trajet.id_trajet, [6]));

    expect(reponse.status).toBe(201);
  });

  it('refuse un trajet annulé ou déjà parti (409)', async () => {
    const annule = await trajetDans(48, 'annule');
    const passe = await creerTrajet(
      reseau.ligne.id_ligne,
      reseau.bus.id_vehicule,
      dansHeures(-72),
      'planifie',
    );

    for (const trajet of [annule, passe]) {
      const reponse = await request(app)
        .post(URL)
        .set(avec(jetonPassager))
        .send(corps(trajet.id_trajet, [1]));
      expect(reponse.status).toBe(409);
      expect(reponse.body.erreur.code).toBe('TRAJET_NON_RESERVABLE');
    }
  });

  it('utilise le profil du compte quand le passager n’est pas indiqué', async () => {
    const trajet = await trajetDans(48);
    await prisma.utilisateur.update({
      where: { id_utilisateur: idPassager },
      data: { telephone: '+25779333333' },
    });

    const reponse = await request(app)
      .post(URL)
      .set(avec(jetonPassager))
      .send({ ...corps(trajet.id_trajet, []), places: [{ numero_place: 2 }] });

    expect(reponse.status).toBe(201);
    expect(reponse.body.donnees.billets[0].passager.telephone).toBe('+25779333333');
  });

  it('refuse (422) sans passager indiqué quand le compte n’a pas de téléphone', async () => {
    const trajet = await trajetDans(48);

    const reponse = await request(app)
      .post(URL)
      .set(avec(jetonPassager))
      .send({ ...corps(trajet.id_trajet, []), places: [{ numero_place: 2 }] });

    expect(reponse.status).toBe(422);
  });

  it('refuse un champ inconnu ou mal typé (422)', async () => {
    const trajet = await trajetDans(48);
    const reponse = await request(app)
      .post(URL)
      .set(avec(jetonPassager))
      .send({ ...corps(trajet.id_trajet, [1]), trajet_id: 'abc' });
    expect(reponse.status).toBe(422);
  });
});

describe('GET /reservations', () => {
  async function reserver(jeton: string, trajetId: number, place: number) {
    const reponse = await request(app)
      .post(URL)
      .set(avec(jeton))
      .send(corps(trajetId, [place]));
    return reponse.body.donnees as { id_reservation: number };
  }

  it('un passager ne voit que les siennes, le personnel voit tout', async () => {
    const trajet = await trajetDans(48);
    await reserver(jetonPassager, trajet.id_trajet, 1);
    await reserver(jetonAgent, trajet.id_trajet, 2);

    const siennes = await request(app).get(URL).set(avec(jetonPassager));
    const toutes = await request(app).get(URL).set(avec(jetonAgent));

    expect(siennes.body.meta.total).toBe(1);
    expect(toutes.body.meta.total).toBe(2);
  });

  it('filtre par statut de paiement et pagine', async () => {
    const trajet = await trajetDans(48);
    const premiere = await reserver(jetonPassager, trajet.id_trajet, 1);
    await reserver(jetonPassager, trajet.id_trajet, 2);
    await request(app)
      .patch(`${URL}/${premiere.id_reservation}/paiement`)
      .set(avec(jetonAgent));

    const payees = await request(app).get(`${URL}?statut_paiement=paye`).set(avec(jetonPassager));
    const page = await request(app).get(`${URL}?limite=1&page=2`).set(avec(jetonPassager));

    expect(payees.body.meta.total).toBe(1);
    expect(page.body.donnees).toHaveLength(1);
    expect(page.body.meta).toEqual({ page: 2, limite: 1, total: 2 });
  });

  it('refuse sans connexion (401) et un filtre invalide (422)', async () => {
    expect((await request(app).get(URL)).status).toBe(401);
    expect((await request(app).get(`${URL}?statut=nimporte`).set(avec(jetonPassager))).status).toBe(
      422,
    );
  });

  it('lit une réservation : la sienne oui, celle d’un autre non (404)', async () => {
    const trajet = await trajetDans(48);
    const celleDeLAgent = await reserver(jetonAgent, trajet.id_trajet, 1);
    const laSienne = await reserver(jetonPassager, trajet.id_trajet, 2);

    const ok = await request(app).get(`${URL}/${laSienne.id_reservation}`).set(avec(jetonPassager));
    const autre = await request(app)
      .get(`${URL}/${celleDeLAgent.id_reservation}`)
      .set(avec(jetonPassager));
    const staff = await request(app)
      .get(`${URL}/${laSienne.id_reservation}`)
      .set(avec(jetonAgent));

    expect(ok.status).toBe(200);
    expect(ok.body.donnees.billets).toHaveLength(1);
    expect(autre.status).toBe(404);
    expect(staff.status).toBe(200);
  });
});

describe('POST /reservations/:id/annuler', () => {
  async function reserver(jeton: string, trajetId: number, place: number) {
    const reponse = await request(app)
      .post(URL)
      .set(avec(jeton))
      .send(corps(trajetId, [place]));
    return reponse.body.donnees as { id_reservation: number };
  }

  it('annule à plus de 2 h du départ et libère la place', async () => {
    const trajet = await trajetDans(48);
    const r = await reserver(jetonPassager, trajet.id_trajet, 7);

    const reponse = await request(app)
      .post(`${URL}/${r.id_reservation}/annuler`)
      .set(avec(jetonPassager));

    expect(reponse.status).toBe(200);
    expect(reponse.body.donnees.statut).toBe('annulee');
    expect(reponse.body.donnees.billets[0].statut).toBe('annule');
    const places = await request(app).get(`/api/v1/trajets/${trajet.id_trajet}/places`);
    expect(places.body.donnees.places[6].statut).toBe('libre');
  });

  it('refuse au passager à moins de 2 h du départ (409), mais pas à l’agent', async () => {
    const trajet = await trajetDans(1);
    const r = await reserver(jetonPassager, trajet.id_trajet, 1);

    const passager = await request(app)
      .post(`${URL}/${r.id_reservation}/annuler`)
      .set(avec(jetonPassager));
    const agent = await request(app)
      .post(`${URL}/${r.id_reservation}/annuler`)
      .set(avec(jetonAgent));

    expect(passager.status).toBe(409);
    expect(passager.body.erreur.code).toBe('ANNULATION_TARDIVE');
    expect(agent.status).toBe(200);
  });

  it('refuse une double annulation (409) et la réservation d’un autre (404)', async () => {
    const trajet = await trajetDans(48);
    const r = await reserver(jetonPassager, trajet.id_trajet, 1);
    const urlAnnuler = `${URL}/${r.id_reservation}/annuler`;
    const jetonAutre = await jetonPour(app, 'admin');

    const intrus = await request(app).post(urlAnnuler).set(avec(await autrePassager()));
    await request(app).post(urlAnnuler).set(avec(jetonPassager));
    const deuxieme = await request(app).post(urlAnnuler).set(avec(jetonPassager));

    expect(jetonAutre).toBeTruthy();
    expect(intrus.status).toBe(404);
    expect(deuxieme.status).toBe(409);
    expect(deuxieme.body.erreur.code).toBe('DEJA_ANNULEE');
  });

  async function autrePassager(): Promise<string> {
    const { creerUtilisateur, MOT_DE_PASSE_TEST } = await import('../helpers/bd.js');
    await creerUtilisateur({ email: 'autre@twende.test' });
    const reponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'autre@twende.test', mot_de_passe: MOT_DE_PASSE_TEST });
    return reponse.body.donnees.jeton_acces as string;
  }
});

describe('PATCH /reservations/:id/paiement', () => {
  async function reserver(trajetId: number) {
    const reponse = await request(app)
      .post(URL)
      .set(avec(jetonPassager))
      .send(corps(trajetId, [1]));
    return reponse.body.donnees as { id_reservation: number };
  }

  it('marque payée (agent) → 200', async () => {
    const trajet = await trajetDans(48);
    const r = await reserver(trajet.id_trajet);

    const reponse = await request(app)
      .patch(`${URL}/${r.id_reservation}/paiement`)
      .set(avec(jetonAgent));

    expect(reponse.status).toBe(200);
    expect(reponse.body.donnees.statut_paiement).toBe('paye');
  });

  it('refuse au passager (403), à une réservation annulée ou déjà payée (409)', async () => {
    const trajet = await trajetDans(48);
    const r = await reserver(trajet.id_trajet);
    const url = `${URL}/${r.id_reservation}/paiement`;

    expect((await request(app).patch(url).set(avec(jetonPassager))).status).toBe(403);
    await request(app).patch(url).set(avec(jetonAgent));
    const deja = await request(app).patch(url).set(avec(jetonAgent));
    expect(deja.status).toBe(409);
    expect(deja.body.erreur.code).toBe('DEJA_PAYEE');

    const trajet2 = await trajetDans(100);
    const r2 = await reserver(trajet2.id_trajet);
    await request(app).post(`${URL}/${r2.id_reservation}/annuler`).set(avec(jetonAgent));
    const annulee = await request(app)
      .patch(`${URL}/${r2.id_reservation}/paiement`)
      .set(avec(jetonAgent));
    expect(annulee.status).toBe(409);
    expect(annulee.body.erreur.code).toBe('RESERVATION_ANNULEE');
  });

  it('répond 404 pour une réservation inconnue', async () => {
    expect((await request(app).patch(`${URL}/999999/paiement`).set(avec(jetonAgent))).status).toBe(
      404,
    );
  });
});
