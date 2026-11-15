import { describe, expect, it } from 'vitest';
import { chargerConfig } from '../../src/config/env.js';

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://x:x@localhost:5432/x',
  JWT_SECRET: 'secret-de-test-secret-de-test-secret-de-test-0123',
};

describe('JWT_ACCES_DUREE', () => {
  it('accepte une durée comme 15m', () => {
    expect(chargerConfig({ ...base, JWT_ACCES_DUREE: '30m' }).jwtAccesDuree).toBe('30m');
  });

  it('refuse une durée sans unité (15 serait 15 millisecondes)', () => {
    expect(() => chargerConfig({ ...base, JWT_ACCES_DUREE: '15' })).toThrow();
  });

  it('règle le coût bcrypt à 4 en test et 12 sinon', () => {
    expect(chargerConfig(base).bcryptCout).toBe(4);
    expect(chargerConfig({ ...base, NODE_ENV: 'development' }).bcryptCout).toBe(12);
  });
});
