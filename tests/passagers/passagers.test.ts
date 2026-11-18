import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creerAppTest, jetonPour, prisma, viderBase } from '../helpers/bd.js';
import { creerReseau, creerTrajet, vendrePlaces } from '../helpers/reseau.js';

const app = creerAppTest();
const URL = '/api/v1/passagers';
const client = { nom_complet: 'Amani Kasongo', telephone: '+25779222222', email: 'amani@exemple.bi' };

let jetonAdmin: string;
let jetonAgent: string;
let jetonPassager: string;

const avec = (jeton: string) => ({ Authorization: `Bearer ${jeton}` });

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

describe('/passagers', () => {
  it('crée un client du guichet (agent) → 201', async () => {
    const reponse = await request(app).post(URL).set(avec(jetonAgent)).send(client);

    expect(reponse.status).toBe(201);
    expect(reponse.body.donnees).toMatchObject(client);
    expect(reponse.body.donnees.utilisateur_id).toBeNull();
  });

  it('refuse sans connexion (401) et au passager (403)', async () => {
    expect((await request(app).post(URL).send(client)).status).toBe(401);
    expect((await request(app).post(URL).set(avec(jetonPassager)).send(client)).status).toBe(403);
    expect((await request(app).get(URL).set(avec(jetonPassager))).status).toBe(403);
  });

  it.each([
    ['nom vide', { ...client, nom_complet: '' }],
    ['téléphone invalide', { ...client, telephone: 'abc' }],
    ['e-mail invalide', { ...client, email: 'pas-un-email' }],
    ['champ manquant', { nom_complet: 'Seul' }],
  ])('refuse : %s (422)', async (_nom, corps) => {
    const reponse = await request(app).post(URL).set(avec(jetonAgent)).send(corps);
    expect(reponse.status).toBe(422);
  });

  it('liste avec recherche (nom ou téléphone) et pagination', async () => {
    await prisma.passager.createMany({
      data: [
        { nom_complet: 'Aimé Niyonkuru', telephone: '+25779000001' },
        { nom_complet: 'Claire Ndayisaba', telephone: '+25779000002' },
        { nom_complet: 'Désiré Nkurunziza', telephone: '+25771999999' },
      ],
    });

    const parNom = await request(app).get(`${URL}?q=claire`).set(avec(jetonAgent));
    const parTel = await request(app).get(`${URL}?q=71999`).set(avec(jetonAgent));
    const page = await request(app).get(`${URL}?limite=2&page=2`).set(avec(jetonAdmin));

    expect(parNom.body.donnees).toHaveLength(1);
    expect(parNom.body.donnees[0].nom_complet).toBe('Claire Ndayisaba');
    expect(parTel.body.donnees).toHaveLength(1);
    expect(page.body.meta).toEqual({ page: 2, limite: 2, total: 3 });
    expect(page.body.donnees).toHaveLength(1);
  });

  it('lit, modifie un passager ; 404 si inconnu', async () => {
    const p = await prisma.passager.create({ data: { nom_complet: 'Ancien', telephone: '+25779000003' } });
    const url = `${URL}/${p.id_passager}`;

    const modif = await request(app).patch(url).set(avec(jetonAgent)).send({ nom_complet: 'Nouveau' });
    const lecture = await request(app).get(url).set(avec(jetonAgent));
    const vide = await request(app).patch(url).set(avec(jetonAgent)).send({});

    expect(modif.status).toBe(200);
    expect(lecture.body.donnees.nom_complet).toBe('Nouveau');
    expect(vide.status).toBe(422);
    expect((await request(app).get(`${URL}/999999`).set(avec(jetonAgent))).status).toBe(404);
  });

  it('suppression : admin seulement (204), 409 si le passager a des billets', async () => {
    const libre = await prisma.passager.create({ data: { nom_complet: 'Libre', telephone: '+25779000004' } });
    const { ligne, bus } = await creerReseau();
    const trajet = await creerTrajet(ligne.id_ligne, bus.id_vehicule, '2030-01-01T05:00:00Z');
    const utilisateur = await prisma.utilisateur.findUniqueOrThrow({ where: { email: 'agent@twende.test' } });
    await vendrePlaces(trajet.id_trajet, utilisateur.id_utilisateur, [1]);
    const avecBillet = await prisma.passager.findFirstOrThrow({ where: { nom_complet: 'Voyageur Test' } });

    expect((await request(app).delete(`${URL}/${libre.id_passager}`).set(avec(jetonAgent))).status).toBe(403);
    expect((await request(app).delete(`${URL}/${libre.id_passager}`).set(avec(jetonAdmin))).status).toBe(204);
    const utilise = await request(app).delete(`${URL}/${avecBillet.id_passager}`).set(avec(jetonAdmin));

    expect(utilise.status).toBe(409);
    expect(utilise.body.erreur.code).toBe('PASSAGER_UTILISE');
  });
});
