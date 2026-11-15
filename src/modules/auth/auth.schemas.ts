import { z } from 'zod';

export const schemaInscription = z.object({
  nom_complet: z
    .string({ error: 'Le nom est obligatoire.' })
    .trim()
    .min(2, 'Le nom doit avoir au moins 2 caractères.')
    .max(120, 'Le nom est trop long (120 caractères au maximum).'),
  email: z
    .string({ error: "L'e-mail est obligatoire." })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Adresse e-mail invalide.' }).max(160, "L'e-mail est trop long.")),
  telephone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{8,20}$/, 'Numéro de téléphone invalide (chiffres, avec + facultatif).')
    .optional(),
  // 72 caractères : limite de bcrypt.
  mot_de_passe: z
    .string({ error: 'Le mot de passe est obligatoire.' })
    .min(8, 'Le mot de passe doit avoir au moins 8 caractères.')
    .refine(
      (m) => Buffer.byteLength(m, 'utf8') <= 72,
      'Le mot de passe est trop long (72 octets au maximum).',
    )
    .regex(/[A-Za-z]/, 'Le mot de passe doit contenir au moins une lettre.')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.'),
});

export const schemaConnexion = z.object({
  email: z.string({ error: "L'e-mail est obligatoire." }).trim().toLowerCase().min(1).max(160),
  mot_de_passe: z.string({ error: 'Le mot de passe est obligatoire.' }).min(1).max(200),
});

export const schemaJetonRafraichissement = z.object({
  jeton_rafraichissement: z
    .string({ error: 'Le jeton de rafraîchissement est obligatoire.' })
    .min(20, 'Jeton invalide.')
    .max(200, 'Jeton invalide.'),
});

export type DonneesInscription = z.infer<typeof schemaInscription>;
