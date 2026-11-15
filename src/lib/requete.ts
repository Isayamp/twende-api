import { z } from 'zod';

/** Booléen dans une query string : ?active=true ou ?active=false (z.coerce.boolean() lirait « false » comme vrai). */
export const booleenRequete = z.enum(['true', 'false']).transform((valeur) => valeur === 'true');
