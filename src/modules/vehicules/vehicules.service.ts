import type { Prisma as PrismaTypes } from '@prisma/client';
import { NonTrouve } from '../../erreurs/ErreurApp.js';
import { traduireErreurPrisma } from '../../lib/erreursPrisma.js';
import { decalage } from '../../lib/pagination.js';
import type { Prisma } from '../../lib/prisma.js';
import type { DonneesVehicule, RechercheVehicules } from './vehicules.schemas.js';

const MESSAGES = {
  doublon: { code: 'VEHICULE_EXISTANT', message: 'Cette immatriculation est déjà enregistrée.' },
  utilise: { code: 'VEHICULE_UTILISE', message: 'Ce véhicule est utilisé par des trajets.' },
  absent: 'Véhicule introuvable.',
};

export function creerServiceVehicules(prisma: Prisma) {
  async function lister(recherche: RechercheVehicules) {
    const where: PrismaTypes.VehiculeWhereInput = {
      active: recherche.active,
      OR: recherche.q
        ? [
            { immatriculation: { contains: recherche.q, mode: 'insensitive' } },
            { modele: { contains: recherche.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [vehicules, total] = await Promise.all([
      prisma.vehicule.findMany({
        where,
        orderBy: { immatriculation: 'asc' },
        skip: decalage(recherche.page, recherche.limite),
        take: recherche.limite,
      }),
      prisma.vehicule.count({ where }),
    ]);
    return { vehicules, total };
  }

  async function lire(id: number) {
    const vehicule = await prisma.vehicule.findUnique({ where: { id_vehicule: id } });
    if (!vehicule) throw new NonTrouve(MESSAGES.absent);
    return vehicule;
  }

  async function creer(donnees: DonneesVehicule) {
    try {
      return await prisma.vehicule.create({ data: donnees });
    } catch (erreur) {
      return traduireErreurPrisma(erreur, MESSAGES);
    }
  }

  async function modifier(id: number, donnees: Partial<DonneesVehicule>) {
    try {
      return await prisma.vehicule.update({ where: { id_vehicule: id }, data: donnees });
    } catch (erreur) {
      return traduireErreurPrisma(erreur, MESSAGES);
    }
  }

  async function supprimer(id: number): Promise<void> {
    try {
      await prisma.vehicule.delete({ where: { id_vehicule: id } });
    } catch (erreur) {
      traduireErreurPrisma(erreur, MESSAGES);
    }
  }

  return { lister, lire, creer, modifier, supprimer };
}
