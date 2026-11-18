import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creerAppTest, jetonPour, prisma, viderBase } from '../helpers/bd.js';
import { creerReseau, creerTrajet } from '../helpers/reseau.js';

// Cas relevés par la revue de sécurité : courses entre annulation et paiement,
// réservations non payées qui bloquent un bus, changement de véhicule.

const app = creerAppTest();
const URL = '/api/v1/reservations';
const HEURE = 60 * 60 * 1000;
const voyageur = { nom_complet: 'Amani Kasongo', telephone: '+25779222222' };

let reseau: Awaited<ReturnType<typeof creerReseau>>;
let jetonPassager: string;
let jetonAgent: string;
let jetonAdmin: string;

const avec = (jeton: string) => ({ Authorization: `Bearer ${jeton}` });
const dansHeures = (h: number) => new Date(Date.now() + h * HEURE).toISOString();

function reserver(jeton: string, trajetId: number, place: number) {
  return request(app)
    .post(URL)
    .set(avec(jeton))
    .send({
      trajet_id: trajetId,
      station_depart_id: reseau.a.id_station,
      station_arrivee_id: reseau.c.id_station,
      places: [{ numero_place: place, passager: voyageur }],
    });
}

beforeEach(async () => {
  await viderBase();
  reseau = await creerReseau();
  jetonPassager = await jetonPour(app, 'passager');
  jetonAgent = await jetonPour(app, 'agent');
  jetonAdmin = await jetonPour(app, 'admin');
});

afterAll(async () => {
  await viderBase();
  await prisma.$disconnect();
});

describe('annulation et paiement simultanés', () => {
  it('deux annulations en même temps : une seule réussit (200), l’autre reçoit 409', async () => {
    const trajet = await creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, dansHeures(48));
    const r = (await reserver(jetonPassager, trajet.id_trajet, 1)).body.donnees;

    const reponses = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(app).post(`${URL}/${r.id_reservation}/annuler`).set(avec(jetonAgent)),
      ),
    );

    expect(reponses.filter((x) => x.status === 200)).toHaveLength(1);
    expect(reponses.filter((x) => x.status === 409)).toHaveLength(5);
  });

  it('paiement et annulation en même temps : jamais « annulée » ET « payée »', async () => {
    for (let i = 1; i <= 8; i++) {
      const trajet = await creerTrajet(
        reseau.ligne.id_ligne,
        reseau.bus.id_vehicule,
        dansHeures(48 + i * 5),
      );
      const r = (await reserver(jetonPassager, trajet.id_trajet, 1)).body.donnees;

      await Promise.all([
        request(app).patch(`${URL}/${r.id_reservation}/paiement`).set(avec(jetonAgent)),
        request(app).post(`${URL}/${r.id_reservation}/annuler`).set(avec(jetonAgent)),
      ]);

      const apres = await prisma.reservation.findUniqueOrThrow({
        where: { id_reservation: r.id_reservation },
      });
      expect(apres.statut === 'annulee' && apres.statut_paiement === 'paye').toBe(false);
    }
  });
});

describe('réservations en attente de paiement', () => {
  it('limite un passager à 5 réservations non payées (409), pas le personnel', async () => {
    const trajet = await creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, dansHeures(48));

    for (let place = 1; place <= 5; place++) {
      expect((await reserver(jetonPassager, trajet.id_trajet, place)).status).toBe(201);
    }
    const sixieme = await reserver(jetonPassager, trajet.id_trajet, 6);
    const agent = await reserver(jetonAgent, trajet.id_trajet, 6);

    expect(sixieme.status).toBe(409);
    expect(sixieme.body.erreur.code).toBe('TROP_DE_RESERVATIONS_EN_ATTENTE');
    expect(agent.status).toBe(201);
  });

  it('une réservation annulée ou payée ne compte plus dans la limite', async () => {
    const trajet = await creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, dansHeures(48));
    const ids: number[] = [];
    for (let place = 1; place <= 5; place++) {
      ids.push((await reserver(jetonPassager, trajet.id_trajet, place)).body.donnees.id_reservation);
    }

    await request(app).post(`${URL}/${ids[0]}/annuler`).set(avec(jetonPassager));
    await request(app).patch(`${URL}/${ids[1]}/paiement`).set(avec(jetonAgent));

    expect((await reserver(jetonPassager, trajet.id_trajet, 6)).status).toBe(201);
    expect((await reserver(jetonPassager, trajet.id_trajet, 7)).status).toBe(201);
  });
});

describe('validation du passager', () => {
  it('refuse un téléphone sans forme de numéro et un nom avec caractères de contrôle (422)', async () => {
    const trajet = await creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, dansHeures(48));
    const corps = (passager: object) => ({
      trajet_id: trajet.id_trajet,
      station_depart_id: reseau.a.id_station,
      station_arrivee_id: reseau.c.id_station,
      places: [{ numero_place: 1, passager }],
    });

    const lettres = await request(app)
      .post(URL)
      .set(avec(jetonPassager))
      .send(corps({ nom_complet: 'Amani', telephone: 'abcdefgh' }));
    const controle = await request(app)
      .post(URL)
      .set(avec(jetonPassager))
      .send(corps({ nom_complet: 'Ama\u0000ni', telephone: '+25779222222' }));

    expect(lettres.status).toBe(422);
    expect(controle.status).toBe(422);
  });
});

describe('modification d’un trajet qui a des billets', () => {
  it('refuse un véhicule trop petit pour les places déjà vendues (409)', async () => {
    const trajet = await creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, dansHeures(48));
    await reserver(jetonPassager, trajet.id_trajet, 9);
    const petit = await prisma.vehicule.create({
      data: { immatriculation: 'BJ-9999-Z', modele: 'Minibus', nombre_places: 8 },
    });

    const reponse = await request(app)
      .patch(`/api/v1/trajets/${trajet.id_trajet}`)
      .set(avec(jetonAdmin))
      .send({ vehicule_id: petit.id_vehicule });

    expect(reponse.status).toBe(409);
    expect(reponse.body.erreur.code).toBe('VEHICULE_TROP_PETIT');
  });

  it('annuler le trajet annule ses réservations et libère les billets', async () => {
    const trajet = await creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, dansHeures(48));
    const r = (await reserver(jetonPassager, trajet.id_trajet, 2)).body.donnees;

    const reponse = await request(app)
      .patch(`/api/v1/trajets/${trajet.id_trajet}`)
      .set(avec(jetonAdmin))
      .send({ statut: 'annule' });

    expect(reponse.status).toBe(200);
    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id_reservation: r.id_reservation },
      include: { billets: true },
    });
    expect(reservation.statut).toBe('annulee');
    expect(reservation.billets.every((b) => b.statut === 'annule')).toBe(true);
  });
});
