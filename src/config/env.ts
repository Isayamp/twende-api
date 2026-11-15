import { existsSync } from 'node:fs';
import { z } from 'zod';

// Schéma de toutes les variables d'environnement lues au démarrage.
const schemaEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit avoir 32 caractères au minimum'),
  JWT_ACCES_DUREE: z.string().default('15m'),
  JWT_RAFRAICHISSEMENT_JOURS: z.coerce.number().int().min(1).default(7),
  CORS_ORIGINES: z.string().default('http://localhost:5173'),
  EMAIL_MODE: z.enum(['log', 'smtp']).default('log'),
});

export interface Config {
  environnement: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtAccesDuree: string;
  jwtRafraichissementJours: number;
  corsOrigines: string[];
  emailMode: 'log' | 'smtp';
}

/**
 * Vérifie les variables d'environnement et renvoie une configuration propre.
 * Lance une erreur claire si une variable manque ou est invalide.
 */
export function chargerConfig(source: Record<string, string | undefined>): Config {
  const resultat = schemaEnv.safeParse(source);
  if (!resultat.success) {
    const problemes = resultat.error.issues
      .map((p) => `${p.path.join('.')} : ${p.message}`)
      .join('\n');
    throw new Error(`Configuration invalide :\n${problemes}`);
  }
  const env = resultat.data;
  return {
    environnement: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    jwtAccesDuree: env.JWT_ACCES_DUREE,
    jwtRafraichissementJours: env.JWT_RAFRAICHISSEMENT_JOURS,
    corsOrigines: env.CORS_ORIGINES.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    emailMode: env.EMAIL_MODE,
  };
}

/** Lit le fichier .env (s'il existe) puis charge la configuration. */
export function chargerConfigDepuisEnv(): Config {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  return chargerConfig(process.env);
}
