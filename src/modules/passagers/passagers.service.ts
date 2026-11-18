import type { Prisma as PrismaTypes } from '@prisma/client';
import { NonTrouve } from '../../erreurs/ErreurApp.js';
import { traduireErreurPrisma } from '../../lib/erreursPrisma.js';
import { decalage } from '../../lib/pagination.js';
import type { Prisma } from '../../lib/prisma.js';
import type { DonneesPassager, RecherchePassagers } from './passagers.schemas.js';

const MESSAGES = {
  utilise: { code: 'PASSAGER_UTILISE', message: 'Ce passager a des billets.' },
  absent: 'Passager introuvable.',
};

export function creerServicePassagers(prisma: Prisma) {
  async function lister(recherche: RecherchePassagers) {
    const where: PrismaTypes.PassagerWhereInput = recherche.q
      ? {
          OR: [
            { nom_complet: { contains: recherche.q, mode: 'insensitive' } },
            { telephone: { contains: recherche.q } },
          ],
        }
      : {};
    const [passagers, total] = await Promise.all([
      prisma.passager.findMany({
        where,
        orderBy: [{ nom_complet: 'asc' }, { id_passager: 'asc' }],
        skip: decalage(recherche.page, recherche.limite),
        take: recherche.limite,
      }),
      prisma.passager.count({ where }),
    ]);
    return { passagers, total };
  }

  async function lire(id: number) {
    const passager = await prisma.passager.findUnique({ where: { id_passager: id } });
    if (!passager) throw new NonTrouve(MESSAGES.absent);
    return passager;
  }

  const creer = (donnees: DonneesPassager) => prisma.passager.create({ data: donnees });

  async function modifier(id: number, donnees: Partial<DonneesPassager>) {
    try {
      return await prisma.passager.update({ where: { id_passager: id }, data: donnees });
    } catch (erreur) {
      return traduireErreurPrisma(erreur, MESSAGES);
    }
  }

  async function supprimer(id: number): Promise<void> {
    try {
      await prisma.passager.delete({ where: { id_passager: id } });
    } catch (erreur) {
      traduireErreurPrisma(erreur, MESSAGES);
    }
  }

  return { lister, lire, creer, modifier, supprimer };
}
