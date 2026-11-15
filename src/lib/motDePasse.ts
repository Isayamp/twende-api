import bcrypt from 'bcryptjs';

/** Transforme un mot de passe en empreinte bcrypt (le mot de passe n'est jamais stocké). */
export function hacherMotDePasse(motDePasse: string, cout: number): Promise<string> {
  return bcrypt.hash(motDePasse, cout);
}

/** Compare un mot de passe saisi avec l'empreinte enregistrée. */
export function verifierMotDePasse(motDePasse: string, empreinte: string): Promise<boolean> {
  return bcrypt.compare(motDePasse, empreinte);
}
