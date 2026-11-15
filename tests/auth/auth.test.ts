import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  MOT_DE_PASSE_TEST,
  configTest,
  creerAppTest,
  creerUtilisateur,
  prisma,
  viderBase,
} from '../helpers/bd.js';

const app = creerAppTest();

const nouveauCompte = {
  nom_complet: 'Aimé Niyonkuru',
  email: 'aime@twende.test',
  telephone: '+25779000000',
  mot_de_passe: 'MotDePasse123',
};

async function seConnecter(email = 'test@twende.test') {
  const reponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, mot_de_passe: MOT_DE_PASSE_TEST });
  return reponse.body.donnees as {
    jeton_acces: string;
    jeton_rafraichissement: string;
  };
}

beforeEach(viderBase);
afterAll(() => prisma.$disconnect());

describe('POST /auth/register', () => {
  it('crée un compte passager sans jamais renvoyer le mot de passe', async () => {
    const reponse = await request(app).post('/api/v1/auth/register').send(nouveauCompte);

    expect(reponse.status).toBe(201);
    expect(reponse.body.donnees.email).toBe('aime@twende.test');
    expect(reponse.body.donnees.role).toBe('passager');
    expect(JSON.stringify(reponse.body)).not.toContain('mot_de_passe');
    expect(JSON.stringify(reponse.body)).not.toContain('MotDePasse123');
  });

  it('stocke le mot de passe haché avec bcrypt, jamais en clair', async () => {
    await request(app).post('/api/v1/auth/register').send(nouveauCompte);

    const utilisateur = await prisma.utilisateur.findUniqueOrThrow({
      where: { email: 'aime@twende.test' },
    });
    expect(utilisateur.mot_de_passe_hash).toMatch(/^\$2[aby]\$/);
    expect(utilisateur.mot_de_passe_hash).not.toContain('MotDePasse123');
  });

  it('ignore un rôle envoyé par le client (pas de passage admin)', async () => {
    const reponse = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...nouveauCompte, role: 'admin' });

    expect(reponse.status).toBe(201);
    expect(reponse.body.donnees.role).toBe('passager');
  });

  it('refuse un e-mail déjà utilisé, même avec des majuscules (409)', async () => {
    await request(app).post('/api/v1/auth/register').send(nouveauCompte);

    const reponse = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...nouveauCompte, email: 'AIME@Twende.test' });

    expect(reponse.status).toBe(409);
    expect(reponse.body.erreur.code).toBe('EMAIL_DEJA_UTILISE');
  });

  it('refuse des données invalides avec le détail des champs (422)', async () => {
    const reponse = await request(app)
      .post('/api/v1/auth/register')
      .send({ nom_complet: 'A', email: 'pas-un-email', mot_de_passe: 'court' });

    expect(reponse.status).toBe(422);
    const champs = reponse.body.erreur.details.map((d: { champ: string }) => d.champ);
    expect(champs).toEqual(expect.arrayContaining(['nom_complet', 'email', 'mot_de_passe']));
  });

  it('refuse un mot de passe de plus de 72 octets (accents comptés en octets) (422)', async () => {
    const reponse = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...nouveauCompte, mot_de_passe: 'é1'.repeat(30) });

    expect(reponse.status).toBe(422);
  });

  it('refuse un mot de passe sans chiffre (422)', async () => {
    const reponse = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...nouveauCompte, mot_de_passe: 'UniquementDesLettres' });

    expect(reponse.status).toBe(422);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await creerUtilisateur();
  });

  it("renvoie un jeton d'accès et un jeton de rafraîchissement", async () => {
    const reponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@twende.test', mot_de_passe: MOT_DE_PASSE_TEST });

    expect(reponse.status).toBe(200);
    expect(reponse.body.donnees.jeton_acces).toBeTypeOf('string');
    expect(reponse.body.donnees.jeton_rafraichissement).toBeTypeOf('string');
    expect(reponse.body.donnees.utilisateur.email).toBe('test@twende.test');
    expect(JSON.stringify(reponse.body)).not.toContain('mot_de_passe_hash');
  });

  it("ne garde en base que l'empreinte du jeton de rafraîchissement", async () => {
    const { jeton_rafraichissement } = await seConnecter();

    const jetons = await prisma.jetonRafraichissement.findMany();
    expect(jetons).toHaveLength(1);
    expect(jetons[0].hash_jeton).not.toBe(jeton_rafraichissement);
  });

  it('donne le même message pour un mauvais mot de passe et un e-mail inconnu (401)', async () => {
    const mauvais = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@twende.test', mot_de_passe: 'MauvaisMotDePasse1' });
    const inconnu = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inconnu@twende.test', mot_de_passe: 'MauvaisMotDePasse1' });

    expect(mauvais.status).toBe(401);
    expect(inconnu.status).toBe(401);
    expect(mauvais.body).toEqual(inconnu.body);
  });

  it('refuse un compte désactivé (403)', async () => {
    await prisma.utilisateur.update({
      where: { email: 'test@twende.test' },
      data: { actif: false },
    });

    const reponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@twende.test', mot_de_passe: MOT_DE_PASSE_TEST });

    expect(reponse.status).toBe(403);
    expect(reponse.body.erreur.code).toBe('COMPTE_DESACTIVE');
  });
});

describe('GET /auth/me', () => {
  beforeEach(async () => {
    await creerUtilisateur();
  });

  it('renvoie le profil quand le jeton est valide', async () => {
    const { jeton_acces } = await seConnecter();

    const reponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${jeton_acces}`);

    expect(reponse.status).toBe(200);
    expect(reponse.body.donnees.email).toBe('test@twende.test');
  });

  it('refuse sans jeton (401)', async () => {
    const reponse = await request(app).get('/api/v1/auth/me');

    expect(reponse.status).toBe(401);
    expect(reponse.body.erreur.code).toBe('NON_AUTHENTIFIE');
  });

  it('refuse un jeton falsifié ou signé avec un autre secret (401)', async () => {
    const faux = jwt.sign({ role: 'admin' }, 'un-autre-secret-un-autre-secret-123456', {
      subject: '1',
    });

    const reponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${faux}`);

    expect(reponse.status).toBe(401);
  });

  it('refuse un jeton expiré (401)', async () => {
    const utilisateur = await prisma.utilisateur.findFirstOrThrow();
    const expire = jwt.sign({ role: 'passager' }, configTest.jwtSecret, {
      subject: String(utilisateur.id_utilisateur),
      expiresIn: -10,
    });

    const reponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expire}`);

    expect(reponse.status).toBe(401);
  });

  it('refuse un jeton sans signature (algorithme none) (401)', async () => {
    const entete = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url');
    const charge = Buffer.from('{"sub":"1","role":"admin"}').toString('base64url');

    const reponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${entete}.${charge}.`);

    expect(reponse.status).toBe(401);
  });

  it("refuse le jeton d'un compte désactivé après coup (403)", async () => {
    const { jeton_acces } = await seConnecter();
    await prisma.utilisateur.update({
      where: { email: 'test@twende.test' },
      data: { actif: false },
    });

    const reponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${jeton_acces}`);

    expect(reponse.status).toBe(403);
  });
});

describe('POST /auth/refresh', () => {
  beforeEach(async () => {
    await creerUtilisateur();
  });

  it("donne de nouveaux jetons et invalide l'ancien jeton de rafraîchissement", async () => {
    const { jeton_rafraichissement } = await seConnecter();

    const premiere = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ jeton_rafraichissement });
    const rejeu = await request(app).post('/api/v1/auth/refresh').send({ jeton_rafraichissement });

    expect(premiere.status).toBe(200);
    expect(premiere.body.donnees.jeton_rafraichissement).not.toBe(jeton_rafraichissement);
    expect(rejeu.status).toBe(401);
  });

  it('révoque toute la session si un ancien jeton est rejoué (vol possible)', async () => {
    const { jeton_rafraichissement } = await seConnecter();
    const premiere = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ jeton_rafraichissement });
    const nouveau = premiere.body.donnees.jeton_rafraichissement;

    await request(app).post('/api/v1/auth/refresh').send({ jeton_rafraichissement }); // rejeu
    const suite = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ jeton_rafraichissement: nouveau });

    expect(suite.status).toBe(401);
  });

  it('refuse un jeton inconnu (401)', async () => {
    const reponse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ jeton_rafraichissement: 'x'.repeat(64) });

    expect(reponse.status).toBe(401);
  });

  it('refuse un jeton expiré (401)', async () => {
    const { jeton_rafraichissement } = await seConnecter();
    await prisma.jetonRafraichissement.updateMany({
      data: { expire_le: new Date(Date.now() - 1000) },
    });

    const reponse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ jeton_rafraichissement });

    expect(reponse.status).toBe(401);
    expect(reponse.body.erreur.code).toBe('JETON_EXPIRE');
  });

  it('accepte une seule des deux demandes simultanées avec le même jeton', async () => {
    const { jeton_rafraichissement } = await seConnecter();

    const [a, b] = await Promise.all([
      request(app).post('/api/v1/auth/refresh').send({ jeton_rafraichissement }),
      request(app).post('/api/v1/auth/refresh').send({ jeton_rafraichissement }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 401]);
  });
});

describe('POST /auth/logout', () => {
  beforeEach(async () => {
    await creerUtilisateur();
  });

  it('révoque le jeton de rafraîchissement', async () => {
    const { jeton_acces, jeton_rafraichissement } = await seConnecter();

    const deconnexion = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${jeton_acces}`)
      .send({ jeton_rafraichissement });
    const apres = await request(app).post('/api/v1/auth/refresh').send({ jeton_rafraichissement });

    expect(deconnexion.status).toBe(200);
    expect(apres.status).toBe(401);
  });

  it("exige d'être connecté (401)", async () => {
    const reponse = await request(app)
      .post('/api/v1/auth/logout')
      .send({ jeton_rafraichissement: 'x'.repeat(64) });

    expect(reponse.status).toBe(401);
  });

  it("ne révoque pas le jeton d'un autre utilisateur", async () => {
    await creerUtilisateur({ email: 'autre@twende.test' });
    const victime = await seConnecter('autre@twende.test');
    const pirate = await seConnecter();

    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${pirate.jeton_acces}`)
      .send({ jeton_rafraichissement: victime.jeton_rafraichissement });
    const reponse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ jeton_rafraichissement: victime.jeton_rafraichissement });

    expect(reponse.status).toBe(200);
  });
});
