import { describe, expect, it } from 'vitest';
import { chargerConfig } from '../../src/config/env.js';

// Une configuration valide, qu'on modifie dans chaque test.
const base = {
  DATABASE_URL: 'postgresql://postgres:x@localhost:5432/twende',
  JWT_SECRET: 'une-phrase-secrete-de-plus-de-trente-deux-caracteres',
};

describe('chargerConfig', () => {
  it('applique les valeurs par défaut', () => {
    const config = chargerConfig(base);

    expect(config.port).toBe(3000);
    expect(config.environnement).toBe('development');
    expect(config.jwtAccesDuree).toBe('15m');
    expect(config.jwtRafraichissementJours).toBe(7);
    expect(config.emailMode).toBe('log');
  });

  it('découpe la liste des origines CORS', () => {
    const config = chargerConfig({ ...base, CORS_ORIGINES: 'http://a.test, http://b.test' });

    expect(config.corsOrigines).toEqual(['http://a.test', 'http://b.test']);
  });

  it('refuse une configuration sans DATABASE_URL', () => {
    expect(() => chargerConfig({ JWT_SECRET: base.JWT_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('refuse un secret JWT trop court', () => {
    expect(() => chargerConfig({ ...base, JWT_SECRET: 'court' })).toThrow(/JWT_SECRET/);
  });

  it("refuse un port qui n'est pas un nombre", () => {
    expect(() => chargerConfig({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });
});
