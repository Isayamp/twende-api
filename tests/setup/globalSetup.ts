import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { urlBaseTest } from './urlTest.js';

/**
 * Avant tous les tests : crée la base de test si elle n'existe pas,
 * puis applique les migrations dessus.
 */
export default async function preparerBaseDeTest(): Promise<void> {
  const { urlTest, urlAdmin, nomTest } = urlBaseTest();

  const admin = new PrismaClient({ datasourceUrl: urlAdmin });
  try {
    const existe = await admin.$queryRaw<{ n: number }[]>`
      SELECT 1 AS n FROM pg_database WHERE datname = ${nomTest}`;
    if (existe.length === 0) {
      // Le nom a été validé (lettres, chiffres, _) dans urlBaseTest.
      await admin.$executeRawUnsafe(`CREATE DATABASE "${nomTest}"`);
    }
  } finally {
    await admin.$disconnect();
  }

  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: urlTest },
    stdio: 'pipe',
  });
}
