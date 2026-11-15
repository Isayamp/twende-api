import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creerAppTest, creerUtilisateur, jetonPour, prisma, viderBase } from '../helpers/bd.js';
import { creerReseau, creerTrajet, vendrePlaces } from '../helpers/reseau.js';

const app = creerAppTest();
const URL = '/api/v1/trajets';

type Reseau = Awaited<ReturnType<typeof creerReseau>>;
let r: Reseau;
let jetonAdmin: string;
let jetonAgent: string;
let jetonPassager: string;

const avec = (jeton: string) => ({ Authorization: `Bearer ${jeton}` });

beforeEach(async () => {
  await viderBase();
  r = await creerReseau();
  jetonAdmin = await jetonPour(app, 'admin');
  jetonAgent = await jetonPour(app, 'agent');
  jetonPassager = await jetonPour(app, 'passager');
});

afterAll(async () => {
  await viderBase();
  await prisma.$disconnect();
});

const corps = (extra: Record<string, unknown> = {}) => ({
  ligne_id: r.ligne.id_ligne,
  vehicule_id: r.bus.id_vehicule,
  depart_prevu: '2030-06-10T05:00:00Z',
  ...extra,
});

describe('POST /trajets', () => {
  it("crée un trajet et calcule l'arrivée avec le dernier arrêt de la ligne → 201", async () => {
    const reponse = await request(app).post(URL).set(avec(jetonAdmin)).send(corps());

    expect(reponse.status).toBe(201);
    expect(reponse.body.donnees.statut).toBe('planifie');
    expect(reponse.body.donnees.arrivee_prevue).toBe('2030-06-10T07:00:00.000Z');
  });

  it('accepte une arrivée donnée et un fuseau (+02:00)', async () => {
    const reponse = await request(app)
      .post(URL)
      .set(avec(jetonAdmin))
      .send(
        corps({
          depart_prevu: '2030-06-10T07:00:00+02:00',
          arrivee_prevue: '2030-06-10T10:00:00+02:00',
        }),
      );

    expect(reponse.status).toBe(201);
    expect(reponse.body.donnees.depart_prevu).toBe('2030-06-10T05:00:00.000Z');
    expect(reponse.body.donnees.arrivee_prevue).toBe('2030-06-10T08:00:00.000Z');
  });

  it('réservé à l’administrateur (401, 403)', async () => {
    expect((await request(app).post(URL).send(corps())).status).toBe(401);
    expect((await request(app).post(URL).set(avec(jetonAgent)).send(corps())).status).toBe(403);
    expect((await request(app).post(URL).set(avec(jetonPassager)).send(corps())).status).toBe(403);
  });

  it('refuse les données invalides (422)', async () => {
    const envoyer = (extra: Record<string, unknown>) =>
      request(app).post(URL).set(avec(jetonAdmin)).send(corps(extra));

    const sansFuseau = await envoyer({ depart_prevu: '2030-06-10T05:00:00' });
    const texte = await envoyer({ depart_prevu: 'demain matin' });
    const arriveeAvant = await envoyer({ arrivee_prevue: '2030-06-10T04:00:00Z' });
    const ligneInconnue = await envoyer({ ligne_id: 9999 });
    const busInconnu = await envoyer({ vehicule_id: 9999 });

    for (const reponse of [sansFuseau, texte, arriveeAvant, ligneInconnue, busInconnu]) {
      expect(reponse.status).toBe(422);
    }
    expect(ligneInconnue.body.erreur.details[0].champ).toBe('ligne_id');
    expect(busInconnu.body.erreur.details[0].champ).toBe('vehicule_id');
  });

  it('refuse un véhicule désactivé ou une ligne désactivée (422)', async () => {
    await prisma.vehicule.update({
      where: { id_vehicule: r.bus.id_vehicule },
      data: { active: false },
    });
    const vehicule = await request(app).post(URL).set(avec(jetonAdmin)).send(corps());
    await prisma.vehicule.update({
      where: { id_vehicule: r.bus.id_vehicule },
      data: { active: true },
    });
    await prisma.ligne.update({ where: { id_ligne: r.ligne.id_ligne }, data: { active: false } });
    const ligne = await request(app).post(URL).set(avec(jetonAdmin)).send(corps());

    expect(vehicule.status).toBe(422);
    expect(ligne.status).toBe(422);
  });

  it('refuse un trajet qui chevauche un autre trajet du même véhicule (409)', async () => {
    await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-10T05:00:00Z'); // 05:00 → 07:00

    const chevauche = await request(app)
      .post(URL)
      .set(avec(jetonAdmin))
      .send(corps({ depart_prevu: '2030-06-10T06:00:00Z' }));
    const colle = await request(app)
      .post(URL)
      .set(avec(jetonAdmin))
      .send(corps({ depart_prevu: '2030-06-10T07:00:00Z' })); // part quand l'autre arrive : permis

    expect(chevauche.status).toBe(409);
    expect(chevauche.body.erreur.code).toBe('VEHICULE_OCCUPE');
    expect(colle.status).toBe(201);
  });

  it('deux créations simultanées pour le même véhicule : une seule réussit (409 pour l’autre)', async () => {
    const envoyer = () => request(app).post(URL).set(avec(jetonAdmin)).send(corps());

    const reponses = await Promise.all([envoyer(), envoyer(), envoyer(), envoyer()]);
    const statuts = reponses.map((x) => x.status).sort();

    expect(statuts).toEqual([201, 409, 409, 409]);
    expect(await prisma.trajet.count()).toBe(1);
  });

  it('refuse un trajet de plus de 7 jours (422) et une page absurde (422)', async () => {
    const long = await request(app)
      .post(URL)
      .set(avec(jetonAdmin))
      .send(corps({ arrivee_prevue: '2030-06-20T05:00:00Z' }));
    const page = await request(app).get(`${URL}?page=9000000000000000`).set(avec(jetonAdmin));

    expect(long.status).toBe(422);
    expect(page.status).toBe(422);
  });

  it('un trajet annulé ne bloque pas le véhicule', async () => {
    await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-10T05:00:00Z', 'annule');

    const reponse = await request(app).post(URL).set(avec(jetonAdmin)).send(corps());

    expect(reponse.status).toBe(201);
  });
});

describe('GET /trajets (personnel)', () => {
  beforeEach(async () => {
    await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-10T05:00:00Z');
    await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-11T05:00:00Z', 'annule');
    await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-12T05:00:00Z');
  });

  it('liste avec pagination pour le personnel, pas pour un passager', async () => {
    const agent = await request(app).get(`${URL}?limite=2`).set(avec(jetonAgent));
    const passager = await request(app).get(URL).set(avec(jetonPassager));
    const anonyme = await request(app).get(URL);

    expect(agent.status).toBe(200);
    expect(agent.body.donnees).toHaveLength(2);
    expect(agent.body.meta).toEqual({ page: 1, limite: 2, total: 3 });
    expect(passager.status).toBe(403);
    expect(anonyme.status).toBe(401);
  });

  it('filtre par statut, ligne et période', async () => {
    const annules = await request(app).get(`${URL}?statut=annule`).set(avec(jetonAdmin));
    const periode = await request(app)
      .get(`${URL}?du=2030-06-11&au=2030-06-12`)
      .set(avec(jetonAdmin));
    const autreLigne = await request(app).get(`${URL}?ligne_id=9999`).set(avec(jetonAdmin));

    expect(annules.body.meta.total).toBe(1);
    expect(periode.body.meta.total).toBe(2);
    expect(autreLigne.body.meta.total).toBe(0);
  });
});

describe('GET /trajets/:id (public)', () => {
  it('renvoie le trajet avec la ligne, ses arrêts et les places libres', async () => {
    const trajet = await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-10T05:00:00Z');
    const client = await creerUtilisateur();
    await vendrePlaces(trajet.id_trajet, client.id_utilisateur, [4, 5]);

    const reponse = await request(app).get(`${URL}/${trajet.id_trajet}`);

    expect(reponse.status).toBe(200);
    expect(reponse.body.donnees.places_libres).toBe(8);
    expect(reponse.body.donnees.ligne.code).toBe('BJM-GTG');
    expect(reponse.body.donnees.ligne.arrets).toHaveLength(3);
    expect(reponse.body.donnees.ligne.arrets[1].station.ville).toBe('Muramvya');
    expect(reponse.body.donnees.vehicule.nombre_places).toBe(10);
  });

  it('404 si le trajet n’existe pas, 422 si l’id est invalide', async () => {
    expect((await request(app).get(`${URL}/9999`)).status).toBe(404);
    expect((await request(app).get(`${URL}/abc`)).status).toBe(422);
  });
});

describe('PATCH et DELETE /trajets/:id', () => {
  it('annule un trajet', async () => {
    const trajet = await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-10T05:00:00Z');

    const reponse = await request(app)
      .patch(`${URL}/${trajet.id_trajet}`)
      .set(avec(jetonAdmin))
      .send({ statut: 'annule' });

    expect(reponse.status).toBe(200);
    expect(reponse.body.donnees.statut).toBe('annule');
  });

  it('refuse de déplacer un trajet sur un créneau déjà pris par le véhicule (409)', async () => {
    await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-10T05:00:00Z');
    const autre = await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-10T09:00:00Z');

    const reponse = await request(app)
      .patch(`${URL}/${autre.id_trajet}`)
      .set(avec(jetonAdmin))
      .send({ depart_prevu: '2030-06-10T06:00:00Z', arrivee_prevue: '2030-06-10T08:00:00Z' });

    expect(reponse.status).toBe(409);
  });

  it('autorise de modifier un trajet sans se bloquer lui-même', async () => {
    const trajet = await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-10T05:00:00Z');

    const reponse = await request(app)
      .patch(`${URL}/${trajet.id_trajet}`)
      .set(avec(jetonAdmin))
      .send({ depart_prevu: '2030-06-10T05:30:00Z', arrivee_prevue: '2030-06-10T07:30:00Z' });

    expect(reponse.status).toBe(200);
  });

  it('refuse une modification vide (422), un passager (403), un id inconnu (404)', async () => {
    const trajet = await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-10T05:00:00Z');

    const vide = await request(app)
      .patch(`${URL}/${trajet.id_trajet}`)
      .set(avec(jetonAdmin))
      .send({});
    const interdit = await request(app)
      .patch(`${URL}/${trajet.id_trajet}`)
      .set(avec(jetonPassager))
      .send({ statut: 'annule' });
    const inconnu = await request(app)
      .patch(`${URL}/9999`)
      .set(avec(jetonAdmin))
      .send({ statut: 'annule' });

    expect(vide.status).toBe(422);
    expect(interdit.status).toBe(403);
    expect(inconnu.status).toBe(404);
  });

  it('supprime un trajet sans billet (204)', async () => {
    const trajet = await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-10T05:00:00Z');

    const reponse = await request(app).delete(`${URL}/${trajet.id_trajet}`).set(avec(jetonAdmin));

    expect(reponse.status).toBe(204);
    expect(await prisma.trajet.count()).toBe(0);
  });

  it('refuse de supprimer un trajet qui a des billets (409)', async () => {
    const trajet = await creerTrajet(r.ligne.id_ligne, r.bus.id_vehicule, '2030-06-10T05:00:00Z');
    const client = await creerUtilisateur();
    await vendrePlaces(trajet.id_trajet, client.id_utilisateur, [1]);

    const reponse = await request(app).delete(`${URL}/${trajet.id_trajet}`).set(avec(jetonAdmin));

    expect(reponse.status).toBe(409);
    expect(reponse.body.erreur.code).toBe('TRAJET_UTILISE');
  });
});
