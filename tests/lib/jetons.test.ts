import { describe, expect, it } from 'vitest';
import { chargerConfig } from '../../src/config/env.js';
import {
  creerJetonRafraichissement,
  hacherJeton,
  signerJetonAcces,
  verifierJetonAcces,
} from '../../src/lib/jetons.js';

const config = chargerConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://x:x@localhost:5432/x',
  JWT_SECRET: 'secret-de-test-secret-de-test-secret-de-test-0123',
});

describe('jetons', () => {
  it("relit l'identifiant et le rôle d'un jeton d'accès signé", () => {
    const jeton = signerJetonAcces(config, { id_utilisateur: 7, role: 'agent' });

    expect(verifierJetonAcces(config, jeton)).toEqual({ id: 7, role: 'agent' });
  });

  it('refuse un jeton modifié', () => {
    const jeton = signerJetonAcces(config, { id_utilisateur: 7, role: 'agent' });

    expect(() => verifierJetonAcces(config, `${jeton}x`)).toThrow();
  });

  it('crée des jetons de rafraîchissement différents à chaque appel', () => {
    expect(creerJetonRafraichissement()).not.toBe(creerJetonRafraichissement());
  });

  it('calcule toujours la même empreinte pour le même jeton', () => {
    expect(hacherJeton('abc')).toBe(hacherJeton('abc'));
    expect(hacherJeton('abc')).not.toBe(hacherJeton('abd'));
    expect(hacherJeton('abc')).toHaveLength(64);
  });
});
