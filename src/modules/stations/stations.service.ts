import type { Prisma as PrismaTypes } from '@prisma/client';
import { NonTrouve } from '../../erreurs/ErreurApp.js';
import { traduireErreurPrisma } from '../../lib/erreursPrisma.js';
import { decalage } from '../../lib/pagination.js';
import type { Prisma } from '../../lib/prisma.js';
import type { DonneesStation, RechercheStations } from './stations.schemas.js';

const MESSAGES = {
  doublon: { code: 'STATION_EXISTANTE', message: 'Cette station existe déjà dans cette ville.' },
  utilise: {
    code: 'STATION_UTILISEE',
    message: 'Cette station est utilisée (ligne, tarif ou réservation).',
  },
  absent: 'Station introuvable.',
};

export function creerServiceStations(prisma: Prisma) {
  async function lister(recherche: RechercheStations) {
    const where: PrismaTypes.StationWhereInput = {
      ville: recherche.ville ? { equals: recherche.ville, mode: 'insensitive' } : undefined,
      OR: recherche.q
        ? [
            { nom: { contains: recherche.q, mode: 'insensitive' } },
            { ville: { contains: recherche.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [stations, total] = await Promise.all([
      prisma.station.findMany({
        where,
        orderBy: [{ ville: 'asc' }, { nom: 'asc' }],
        skip: decalage(recherche.page, recherche.limite),
        take: recherche.limite,
      }),
      prisma.station.count({ where }),
    ]);
    return { stations, total };
  }

  async function lire(id: number) {
    const station = await prisma.station.findUnique({ where: { id_station: id } });
    if (!station) throw new NonTrouve(MESSAGES.absent);
    return station;
  }

  async function creer(donnees: DonneesStation) {
    try {
      return await prisma.station.create({ data: donnees });
    } catch (erreur) {
      return traduireErreurPrisma(erreur, MESSAGES);
    }
  }

  async function modifier(id: number, donnees: Partial<DonneesStation>) {
    try {
      return await prisma.station.update({ where: { id_station: id }, data: donnees });
    } catch (erreur) {
      return traduireErreurPrisma(erreur, MESSAGES);
    }
  }

  async function supprimer(id: number): Promise<void> {
    try {
      await prisma.station.delete({ where: { id_station: id } });
    } catch (erreur) {
      traduireErreurPrisma(erreur, MESSAGES);
    }
  }

  return { lister, lire, creer, modifier, supprimer };
}
