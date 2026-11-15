import type { Prisma as PrismaTypes } from '@prisma/client';
import { Conflit, NonTrouve, ValidationEchouee } from '../../erreurs/ErreurApp.js';
import { traduireErreurPrisma } from '../../lib/erreursPrisma.js';
import { decalage } from '../../lib/pagination.js';
import type { Prisma } from '../../lib/prisma.js';
import type {
  DonneesCreationTrajet,
  DonneesModificationTrajet,
  ListeTrajets,
} from './trajets.schemas.js';

const MS_PAR_MINUTE = 60 * 1000;
const MS_PAR_JOUR = 24 * 60 * MS_PAR_MINUTE;
// Les dates « du » et « au » sont comprises à l'heure du Burundi (UTC+2).
const DECALAGE_BURUNDI = '+02:00';

const MESSAGES = {
  utilise: { code: 'TRAJET_UTILISE', message: 'Ce trajet a des réservations ou des billets.' },
  absent: 'Trajet introuvable.',
};

// Erreurs possibles à l'écriture : la base refuse un chevauchement (même si deux demandes
// arrivent en même temps) ou une ligne/un véhicule supprimé entre-temps.
const MESSAGES_ECRITURE = {
  chevauche: { code: 'VEHICULE_OCCUPE', message: 'Ce véhicule a déjà un trajet à ce moment.' },
  utilise: { code: 'REFERENCE_INVALIDE', message: 'La ligne ou le véhicule n’existe plus.' },
  absent: MESSAGES.absent,
};

const DUREE_MAXIMALE_MINUTES = 7 * 24 * 60;

const debutDeJour = (date: string) => new Date(`${date}T00:00:00${DECALAGE_BURUNDI}`);

export function creerServiceTrajets(prisma: Prisma) {
  async function lister(filtres: ListeTrajets) {
    const where: PrismaTypes.TrajetWhereInput = {
      ligne_id: filtres.ligne_id,
      vehicule_id: filtres.vehicule_id,
      statut: filtres.statut,
      depart_prevu: {
        gte: filtres.du ? debutDeJour(filtres.du) : undefined,
        // « au » est inclus : on va jusqu'au début du jour suivant.
        lt: filtres.au ? new Date(debutDeJour(filtres.au).getTime() + MS_PAR_JOUR) : undefined,
      },
    };
    const [trajets, total] = await Promise.all([
      prisma.trajet.findMany({
        where,
        orderBy: [{ depart_prevu: 'asc' }, { id_trajet: 'asc' }],
        skip: decalage(filtres.page, filtres.limite),
        take: filtres.limite,
      }),
      prisma.trajet.count({ where }),
    ]);
    return { trajets, total };
  }

  /** Un trajet avec sa ligne (arrêts dans l'ordre), son véhicule et le nombre de places libres. */
  async function lire(id: number) {
    const trajet = await prisma.trajet.findUnique({
      where: { id_trajet: id },
      include: {
        ligne: {
          select: {
            id_ligne: true,
            code: true,
            nom: true,
            arrets: { orderBy: { ordre: 'asc' }, include: { station: true } },
          },
        },
        vehicule: { select: { id_vehicule: true, modele: true, nombre_places: true } },
      },
    });
    if (!trajet) throw new NonTrouve(MESSAGES.absent);
    const vendues = await prisma.billet.count({
      where: { trajet_id: id, statut: { not: 'annule' } },
    });
    return { ...trajet, places_libres: trajet.vehicule.nombre_places - vendues };
  }

  /** Règles communes : le véhicule existe et est actif, et il n'a pas déjà un trajet à ce moment. */
  async function verifierVehicule(
    vehiculeId: number,
    depart: Date,
    arrivee: Date,
    ignorerTrajetId?: number,
    controlerEtat = true,
  ) {
    if (controlerEtat) {
      const vehicule = await prisma.vehicule.findUnique({ where: { id_vehicule: vehiculeId } });
      if (!vehicule || !vehicule.active) {
        throw new ValidationEchouee([
          { champ: 'vehicule_id', message: 'Véhicule inconnu ou désactivé.' },
        ]);
      }
    }
    // Deux trajets se chevauchent si chacun commence avant que l'autre finisse.
    // Partir à l'heure exacte d'arrivée de l'autre est permis.
    const occupe = await prisma.trajet.findFirst({
      where: {
        vehicule_id: vehiculeId,
        statut: { not: 'annule' },
        id_trajet: ignorerTrajetId ? { not: ignorerTrajetId } : undefined,
        depart_prevu: { lt: arrivee },
        arrivee_prevue: { gt: depart },
      },
    });
    if (occupe) {
      throw new Conflit('VEHICULE_OCCUPE', 'Ce véhicule a déjà un trajet à ce moment.');
    }
  }

  function verifierOrdreDesHeures(depart: Date, arrivee: Date) {
    if (arrivee.getTime() <= depart.getTime()) {
      throw new ValidationEchouee([
        { champ: 'arrivee_prevue', message: 'L’arrivée doit être après le départ.' },
      ]);
    }
    if (arrivee.getTime() - depart.getTime() > DUREE_MAXIMALE_MINUTES * MS_PAR_MINUTE) {
      throw new ValidationEchouee([
        { champ: 'arrivee_prevue', message: 'Un trajet dure 7 jours au maximum.' },
      ]);
    }
  }

  async function creer(donnees: DonneesCreationTrajet) {
    const ligne = await prisma.ligne.findUnique({
      where: { id_ligne: donnees.ligne_id },
      include: { arrets: true },
    });
    if (!ligne || !ligne.active) {
      throw new ValidationEchouee([
        { champ: 'ligne_id', message: 'Ligne inconnue ou désactivée.' },
      ]);
    }

    const dureeLigne = Math.max(0, ...ligne.arrets.map((a) => a.minutes_depuis_origine));
    if (!donnees.arrivee_prevue && dureeLigne === 0) {
      throw new ValidationEchouee([
        { champ: 'arrivee_prevue', message: 'La ligne n’a pas de durée : indiquez l’arrivée.' },
      ]);
    }
    const arrivee =
      donnees.arrivee_prevue ??
      new Date(donnees.depart_prevu.getTime() + dureeLigne * MS_PAR_MINUTE);

    verifierOrdreDesHeures(donnees.depart_prevu, arrivee);
    await verifierVehicule(donnees.vehicule_id, donnees.depart_prevu, arrivee);

    try {
      return await prisma.trajet.create({
        data: {
          ligne_id: donnees.ligne_id,
          vehicule_id: donnees.vehicule_id,
          depart_prevu: donnees.depart_prevu,
          arrivee_prevue: arrivee,
        },
      });
    } catch (erreur) {
      return traduireErreurPrisma(erreur, MESSAGES_ECRITURE);
    }
  }

  async function modifier(id: number, donnees: DonneesModificationTrajet) {
    const actuel = await prisma.trajet.findUnique({ where: { id_trajet: id } });
    if (!actuel) throw new NonTrouve(MESSAGES.absent);

    const depart = donnees.depart_prevu ?? actuel.depart_prevu;
    const arrivee = donnees.arrivee_prevue ?? actuel.arrivee_prevue;
    const vehiculeId = donnees.vehicule_id ?? actuel.vehicule_id;
    const statut = donnees.statut ?? actuel.statut;

    verifierOrdreDesHeures(depart, arrivee);
    // Un trajet annulé ne bloque plus le véhicule : pas besoin de vérifier.
    if (statut !== 'annule') {
      await verifierVehicule(
        vehiculeId,
        depart,
        arrivee,
        id,
        donnees.vehicule_id !== undefined && donnees.vehicule_id !== actuel.vehicule_id,
      );
    }
    try {
      return await prisma.trajet.update({
        where: { id_trajet: id },
        data: {
          vehicule_id: donnees.vehicule_id,
          depart_prevu: donnees.depart_prevu,
          arrivee_prevue: donnees.arrivee_prevue,
          statut: donnees.statut,
        },
      });
    } catch (erreur) {
      return traduireErreurPrisma(erreur, MESSAGES_ECRITURE);
    }
  }

  async function supprimer(id: number): Promise<void> {
    try {
      await prisma.trajet.delete({ where: { id_trajet: id } });
    } catch (erreur) {
      traduireErreurPrisma(erreur, MESSAGES);
    }
  }

  return { lister, lire, creer, modifier, supprimer };
}
