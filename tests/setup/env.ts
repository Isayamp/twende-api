import { urlBaseTest } from './urlTest.js';

// Chaque fichier de test utilise la base de TEST, jamais la base de développement.
process.env.DATABASE_URL = urlBaseTest().urlTest;
process.env.NODE_ENV = 'test';
