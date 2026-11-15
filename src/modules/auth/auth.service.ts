import { Prisma as PrismaErreurs, type RoleUtilisateur } from '@prisma/client';
import type { Config } from '../../config/env.js';
import { Conflit, ErreurApp, Interdit, NonAuthentifie } from '../../erreurs/ErreurApp.js';
import { creerJetonRafraichissement, hacherJeton, signerJetonAcces } from '../../lib/jetons.js';
import { hacherMotDePasse, verifierMotDePasse } from '../../lib/motDePasse.js';
import type { Prisma } from '../../lib/prisma.js';
import type { DonneesInscription } from './auth.schemas.js';

// Seuls ces champs sortent de l'API. Le mot de passe haché n'en fait jamais partie.
const CHAMPS_PUBLICS = {
  id_utilisateur: true,
  nom_complet: true,
  email: true,
  telephone: true,
  role: true,
  actif: true,
  cree_le: true,
} as const;

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

export interface UtilisateurPublic {
  id_utilisateur: number;
  nom_complet: string;
  email: string;
  telephone: string | null;
  role: RoleUtilisateur;
  actif: boolean;
  cree_le: Date;
}

export interface Session {
  utilisateur: UtilisateurPublic;
  jeton_acces: string;
  jeton_rafraichissement: string;
}

export function creerServiceAuth(deps: { prisma: Prisma; config: Config }) {
  const { prisma, config } = deps;

  // Empreinte factice : si l'e-mail est inconnu, on compare quand même un mot de passe,
  // pour que la réponse prenne le même temps (on ne révèle pas quels e-mails existent).
  const empreinteFactice = hacherMotDePasse('mot-de-passe-factice', config.bcryptCout);

  /** Crée les deux jetons et enregistre l'empreinte du jeton de rafraîchissement. */
  async function ouvrirSession(
    utilisateur: UtilisateurPublic,
    client: Pick<Prisma, 'jetonRafraichissement'> = prisma,
  ): Promise<Session> {
    const jetonRafraichissement = creerJetonRafraichissement();
    await client.jetonRafraichissement.create({
      data: {
        utilisateur_id: utilisateur.id_utilisateur,
        hash_jeton: hacherJeton(jetonRafraichissement),
        expire_le: new Date(Date.now() + config.jwtRafraichissementJours * MS_PAR_JOUR),
      },
    });
    return {
      utilisateur,
      jeton_acces: signerJetonAcces(config, utilisateur),
      jeton_rafraichissement: jetonRafraichissement,
    };
  }

  async function inscrire(donnees: DonneesInscription): Promise<UtilisateurPublic> {
    try {
      return await prisma.utilisateur.create({
        data: {
          nom_complet: donnees.nom_complet,
          email: donnees.email,
          telephone: donnees.telephone,
          mot_de_passe_hash: await hacherMotDePasse(donnees.mot_de_passe, config.bcryptCout),
          // Le rôle est toujours « passager » : le client ne choisit jamais son rôle.
          role: 'passager',
        },
        select: CHAMPS_PUBLICS,
      });
    } catch (erreur) {
      if (
        erreur instanceof PrismaErreurs.PrismaClientKnownRequestError &&
        erreur.code === 'P2002'
      ) {
        throw new Conflit('EMAIL_DEJA_UTILISE', 'Cette adresse e-mail est déjà utilisée.');
      }
      throw erreur;
    }
  }

  async function connecter(email: string, motDePasse: string): Promise<Session> {
    const compte = await prisma.utilisateur.findUnique({ where: { email } });
    const motDePasseValide = await verifierMotDePasse(
      motDePasse,
      compte?.mot_de_passe_hash ?? (await empreinteFactice),
    );
    if (!compte || !motDePasseValide) {
      throw new ErreurApp(401, 'IDENTIFIANTS_INVALIDES', 'E-mail ou mot de passe incorrect.');
    }
    if (!compte.actif) {
      throw new ErreurApp(403, 'COMPTE_DESACTIVE', 'Ce compte est désactivé.');
    }
    // On relit seulement les champs publics : une future colonne sensible ne sortira jamais.
    const utilisateur = await profil(compte.id_utilisateur);
    return ouvrirSession(utilisateur!);
  }

  async function revoquerTous(utilisateurId: number): Promise<void> {
    await prisma.jetonRafraichissement.updateMany({
      where: { utilisateur_id: utilisateurId, revoque: false },
      data: { revoque: true },
    });
  }

  /** Échange un jeton de rafraîchissement contre une nouvelle session (rotation). */
  async function rafraichir(jeton: string): Promise<Session> {
    const enregistre = await prisma.jetonRafraichissement.findUnique({
      where: { hash_jeton: hacherJeton(jeton) },
      include: { utilisateur: { select: CHAMPS_PUBLICS } },
    });
    if (!enregistre) throw new NonAuthentifie('Jeton de rafraîchissement invalide.');

    // Un jeton déjà utilisé qui revient peut avoir été volé : on ferme toute la session.
    if (enregistre.revoque) {
      await revoquerTous(enregistre.utilisateur_id);
      throw new ErreurApp(401, 'JETON_REUTILISE', 'Jeton déjà utilisé. Reconnectez-vous.');
    }
    if (enregistre.expire_le.getTime() <= Date.now()) {
      throw new ErreurApp(401, 'JETON_EXPIRE', 'Jeton expiré. Reconnectez-vous.');
    }
    if (!enregistre.utilisateur.actif) throw new Interdit('Ce compte est désactivé.');

    // Ancien jeton révoqué et nouveau jeton créé dans la même transaction :
    // si la création échoue, l'utilisateur ne perd pas sa session.
    // « revoque: false » dans le filtre : si deux demandes arrivent ensemble, une seule gagne.
    const session = await prisma.$transaction(async (tx) => {
      const { count } = await tx.jetonRafraichissement.updateMany({
        where: { id_jeton: enregistre.id_jeton, revoque: false },
        data: { revoque: true },
      });
      return count === 0 ? null : ouvrirSession(enregistre.utilisateur, tx);
    });
    if (!session) {
      await revoquerTous(enregistre.utilisateur_id);
      throw new ErreurApp(401, 'JETON_REUTILISE', 'Jeton déjà utilisé. Reconnectez-vous.');
    }
    return session;
  }

  /** Révoque le jeton donné, seulement s'il appartient à l'utilisateur connecté. */
  async function deconnecter(utilisateurId: number, jeton: string): Promise<void> {
    await prisma.jetonRafraichissement.updateMany({
      where: { hash_jeton: hacherJeton(jeton), utilisateur_id: utilisateurId },
      data: { revoque: true },
    });
  }

  async function profil(utilisateurId: number): Promise<UtilisateurPublic | null> {
    return prisma.utilisateur.findUnique({
      where: { id_utilisateur: utilisateurId },
      select: CHAMPS_PUBLICS,
    });
  }

  return { inscrire, connecter, rafraichir, deconnecter, profil };
}

export type ServiceAuth = ReturnType<typeof creerServiceAuth>;
