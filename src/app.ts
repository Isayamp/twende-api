import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import type { Config } from './config/env.js';
import { construireOpenApi } from './docs/openapi.js';
import { creerLogger } from './lib/logger.js';
import { prisma as prismaParDefaut, type Prisma } from './lib/prisma.js';
import { gestionnaireErreurs, routeInconnue } from './middleware/gestionnaireErreurs.js';
import { creerRoutes } from './routes/index.js';

/** Assemble l'application Express. Séparée de server.ts pour pouvoir la tester. */
export function creerApp(config: Config, prisma: Prisma = prismaParDefaut) {
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

  // Documentation : page Swagger et spécification OpenAPI (générée depuis les schémas de validation).
  const specification = construireOpenApi();
  app.get('/api-docs.json', (_req, res) => {
    res.json(specification);
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(specification as swaggerUi.JsonObject, { customSiteTitle: 'Twende API' }),
  );

  app.use('/api/v1', creerRoutes({ config, prisma }));
  app.use(routeInconnue);
  app.use(gestionnaireErreurs((erreur) => logger.error({ err: erreur }, 'Erreur inattendue')));

  return app;
}
