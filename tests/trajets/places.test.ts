import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creerAppTest, creerUtilisateur, prisma, viderBase } from '../helpers/bd.js';
import { creerReseau, creerTrajet, vendrePlaces } from '../helpers/reseau.js';

const app = creerAppTest();

beforeEach(async () => {
  await viderBase();
});

afterAll(async () => {
  await viderBase();
  await prisma.$disconnect();
});

describe('GET /trajets/:id/places', () => {
  it('montre toutes les places libres sur un trajet sans billet', async () => {
    const { ligne, bus } = await creerReseau();
    const trajet = await creerTrajet(ligne.id_ligne, bus.id_vehicule, '2030-01-01T05:00:00Z');

    const reponse = await request(app).get(`/api/v1/trajets/${trajet.id_trajet}/places`);

    expect(reponse.status).toBe(200);
    expect(reponse.body.donnees.trajet_id).toBe(trajet.id_trajet);
    expect(reponse.body.donnees.nombre_places).toBe(10);
    expect(reponse.body.donnees.places_libres).toBe(10);
    expect(reponse.body.donnees.places).toHaveLength(10);
    expect(reponse.body.donnees.places[0]).toEqual({ numero: 1, statut: 'libre' });
    expect(reponse.body.donnees.places[9]).toEqual({ numero: 10, statut: 'libre' });
  });

  it('marque occupées les places vendues et libère les billets annulés', async () => {
    const { ligne, bus } = await creerReseau();
    const trajet = await creerTrajet(ligne.id_ligne, bus.id_vehicule, '2030-01-01T05:00:00Z');
    const utilisateur = await creerUtilisateur();
    await vendrePlaces(trajet.id_trajet, utilisateur.id_utilisateur, [2, 5]);
    await vendrePlaces(trajet.id_trajet, utilisateur.id_utilisateur, [3], 'annule');

    const reponse = await request(app).get(`/api/v1/trajets/${trajet.id_trajet}/places`);

    const parNumero = Object.fromEntries(
      reponse.body.donnees.places.map((p: { numero: number; statut: string }) => [p.numero, p.statut]),
    );
    expect(parNumero[2]).toBe('occupee');
    expect(parNumero[5]).toBe('occupee');
    expect(parNumero[3]).toBe('libre');
    expect(reponse.body.donnees.places_libres).toBe(8);
  });

  it("ne révèle jamais l'identité des voyageurs", async () => {
    const { ligne, bus } = await creerReseau();
    const trajet = await creerTrajet(ligne.id_ligne, bus.id_vehicule, '2030-01-01T05:00:00Z');
    const utilisateur = await creerUtilisateur();
    await vendrePlaces(trajet.id_trajet, utilisateur.id_utilisateur, [1]);

    const reponse = await request(app).get(`/api/v1/trajets/${trajet.id_trajet}/places`);

    expect(JSON.stringify(reponse.body)).not.toContain('Voyageur Test');
    expect(JSON.stringify(reponse.body)).not.toContain('+25779111111');
  });

  it('répond 404 pour un trajet inconnu et 422 pour un identifiant invalide', async () => {
    expect((await request(app).get('/api/v1/trajets/999999/places')).status).toBe(404);
    expect((await request(app).get('/api/v1/trajets/abc/places')).status).toBe(422);
  });
});
