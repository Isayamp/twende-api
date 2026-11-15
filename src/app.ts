import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import type { Config } from './config/env.js';
import { creerLogger } from './lib/logger.js';
import { gestionnaireErreurs, routeInconnue } from './middleware/gestionnaireErreurs.js';
import { creerRoutes } from './routes/index.js';

/** Assemble l'application Express. Séparée de server.ts pour pouvoir la tester. */
export function creerApp(config: Config) {
  const logger = creerLogger(config);
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigines }));
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '100kb' }));

  // Limite générale : 300 requêtes par 15 minutes et par adresse IP.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: config.environnement === 'test' ? 100000 : 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use('/api/v1', creerRoutes());
  app.use(routeInconnue);
  app.use(gestionnaireErreurs((erreur) => logger.error({ err: erreur }, 'Erreur inattendue')));

  return app;
}
