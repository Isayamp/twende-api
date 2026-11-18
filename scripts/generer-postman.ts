// Génère la collection Postman et la spécification OpenAPI dans docs/api/.
// Lancer : npm run docs:generer
import { mkdirSync, writeFileSync } from 'node:fs';
import { construireOpenApi } from '../src/docs/openapi.js';
import { construireCollectionPostman } from '../src/docs/postman.js';

const dossier = new URL('../docs/api/', import.meta.url);
mkdirSync(dossier, { recursive: true });

const ecrire = (nom: string, contenu: object) =>
  writeFileSync(new URL(nom, dossier), JSON.stringify(contenu, null, 2) + '\n', 'utf8');

ecrire('twende-api.postman_collection.json', construireCollectionPostman());
ecrire('openapi.json', construireOpenApi());

console.log('Fichiers écrits dans docs/api/ : twende-api.postman_collection.json, openapi.json');
