import { existsSync } from 'node:fs';

/**
 * Adresse de la base de TEST : la même que la base de développement,
 * avec le suffixe _test sur le nom. Aucun mot de passe supplémentaire à saisir.
 */
export function urlBaseTest(): { urlTest: string; urlAdmin: string; nomTest: string } {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const dev = process.env.DATABASE_URL;
  if (!dev) throw new Error('DATABASE_URL est absent du fichier .env');

  const url = new URL(dev);
  const nomDev = url.pathname.slice(1);
  const nomTest = nomDev.endsWith('_test') ? nomDev : `${nomDev}_test`;
  if (!/^[a-z0-9_]+$/.test(nomTest)) throw new Error('Nom de base de test invalide');

  const urlTest = new URL(dev);
  urlTest.pathname = `/${nomTest}`;
  return { urlTest: urlTest.toString(), urlAdmin: dev, nomTest };
}
