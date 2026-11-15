import bcrypt from 'bcryptjs';
import { PrismaClient, type RoleUtilisateur } from '@prisma/client';
import { creerApp } from '../../src/app.js';
import { chargerConfig } from '../../src/config/env.js';

export const prisma = new PrismaClient();

// Mot de passe utilisé par tous les comptes créés dans les tests.
export const MOT_DE_PASSE_TEST = 'MotDePasse123';

export const configTest = chargerConfig({
  NODE_ENV: 'test',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: 'secret-de-test-secret-de-test-secret-de-test-0123',
  CORS_ORIGINES: 'http://front.test',
});

export function creerAppTest() {
  return creerApp(configTest, prisma);
}

/** Vide toutes les tables (la structure reste). */
export async function viderBase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE billet, reservation, passager, trajet, tarif, ligne_station, ligne, station, vehicule, jeton_rafraichissement, utilisateur RESTART IDENTITY CASCADE',
  );
}

interface OptionsUtilisateur {
  email?: string;
  role?: RoleUtilisateur;
  actif?: boolean;
  nom_complet?: string;
}

/** Crée un utilisateur directement en base (sans passer par l'API). */
export async function creerUtilisateur(options: OptionsUtilisateur = {}) {
  return prisma.utilisateur.create({
    data: {
      nom_complet: options.nom_complet ?? 'Utilisateur Test',
      email: options.email ?? 'test@twende.test',
      role: options.role ?? 'passager',
      actif: options.actif ?? true,
      mot_de_passe_hash: await bcrypt.hash(MOT_DE_PASSE_TEST, 4),
    },
  });
}

/** Crée un utilisateur du rôle donné, le connecte par l'API et renvoie son jeton d'accès. */
export async function jetonPour(
  app: ReturnType<typeof creerAppTest>,
  role: RoleUtilisateur,
): Promise<string> {
  const { default: request } = await import('supertest');
  const email = `${role}@twende.test`;
  await creerUtilisateur({ email, role });
  const reponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, mot_de_passe: MOT_DE_PASSE_TEST });
  return reponse.body.donnees.jeton_acces as string;
}
