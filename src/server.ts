import { creerApp } from './app.js';
import { chargerConfigDepuisEnv } from './config/env.js';

const config = chargerConfigDepuisEnv();
const app = creerApp(config);

app.listen(config.port, () => {
  // Message de démarrage pour le développeur.
  console.info(`Twende API écoute sur http://localhost:${config.port}/api/v1`);
});
