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

type Transaction = Parameters<Parameters<Prisma['$transaction']>[0]>[0];

/** Verrou PostgreSQL léger (levé à la fin de la transaction) : un seul changement à la fois par véhicule. */
async function verrouillerVehicule(tx: Transaction, vehiculeId: number): Promise<void> {
  await tx.$queryRaw`SELECT 1 AS verrou FROM (SELECT pg_advisory_xact_lock(${vehiculeId})) AS t`;
}

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

  /** Plan des places : libre ou occupée. Aucune information sur les voyageurs n'est donnée. */
  async function places(id: number) {
    const trajet = await prisma.trajet.findUnique({
      where: { id_trajet: id },
      select: { vehicule: { select: { nombre_places: true } } },
    });
    if (!trajet) throw new NonTrouve(MESSAGES.absent);
    const billets = await prisma.billet.findMany({
      where: { trajet_id: id, statut: { not: 'annule' } },
      select: { numero_place: true },
    });
    const occupees = new Set(billets.map((b) => b.numero_place));
    const nombre = trajet.vehicule.nombre_places;
    return {
      trajet_id: id,
      nombre_places: nombre,
      places_libres: nombre - occupees.size,
      places: Array.from({ length: nombre }, (_, i) => ({
        numero: i + 1,
        statut: occupees.has(i + 1) ? ('occupee' as const) : ('libre' as const),
      })),
    };
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
      // Un verrou par véhicule : les créations pour le même bus passent une par une.
      // (Sans lui, des insertions simultanées pouvaient provoquer une impasse PostgreSQL.)
      return await prisma.$transaction(async (tx) => {
        await verrouillerVehicule(tx, donnees.vehicule_id);
        return tx.trajet.create({
          data: {
            ligne_id: donnees.ligne_id,
            vehicule_id: donnees.vehicule_id,
            depart_prevu: donnees.depart_prevu,
            arrivee_prevue: arrivee,
          },
        });
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
      // Même verrou que la réservation : pas de vente pendant qu'on change le véhicule ou le statut.
      return await prisma.$transaction(async (tx) => {
        // Toujours dans cet ordre (véhicule puis trajet) pour éviter les impasses.
        await verrouillerVehicule(tx, donnees.vehicule_id ?? actuel.vehicule_id);
        await tx.$queryRaw`SELECT id_trajet FROM trajet WHERE id_trajet = ${id} FOR UPDATE`;
        if (donnees.vehicule_id !== undefined && donnees.vehicule_id !== actuel.vehicule_id) {
          const vehicule = await tx.vehicule.findUniqueOrThrow({
            where: { id_vehicule: donnees.vehicule_id },
          });
          const vendues = await tx.billet.aggregate({
            _max: { numero_place: true },
            where: { trajet_id: id, statut: { not: 'annule' } },
          });
          if ((vendues._max.numero_place ?? 0) > vehicule.nombre_places) {
            throw new Conflit(
              'VEHICULE_TROP_PETIT',
              'Ce véhicule est trop petit pour les places déjà vendues.',
            );
          }
        }
        const modifie = await tx.trajet.update({
          where: { id_trajet: id },
          data: {
            vehicule_id: donnees.vehicule_id,
            depart_prevu: donnees.depart_prevu,
            arrivee_prevue: donnees.arrivee_prevue,
            statut: donnees.statut,
          },
        });
        // Trajet annulé : les réservations et les billets le sont aussi (les paiements sont à rembourser hors API).
        if (statut === 'annule' && actuel.statut !== 'annule') {
          await tx.reservation.updateMany({
            where: { trajet_id: id, statut: 'confirmee' },
            data: { statut: 'annulee' },
          });
          await tx.billet.updateMany({
            where: { trajet_id: id, statut: 'valide' },
            data: { statut: 'annule' },
          });
        }
        return modifie;
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

  return { lister, lire, places, creer, modifier, supprimer };
}
