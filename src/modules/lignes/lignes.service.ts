import type { Prisma as PrismaTypes } from '@prisma/client';
import { NonTrouve, ValidationEchouee } from '../../erreurs/ErreurApp.js';
import { traduireErreurPrisma } from '../../lib/erreursPrisma.js';
import { decalage } from '../../lib/pagination.js';
import type { Prisma } from '../../lib/prisma.js';
import type {
  DonneesArrets,
  DonneesLigne,
  DonneesTarifs,
  RechercheLignes,
} from './lignes.schemas.js';

const MESSAGES = {
  doublon: { code: 'LIGNE_EXISTANTE', message: 'Ce code de ligne existe déjà.' },
  utilise: { code: 'LIGNE_UTILISEE', message: 'Cette ligne a des trajets.' },
  absent: 'Ligne introuvable.',
};

export function creerServiceLignes(prisma: Prisma) {
  async function lister(recherche: RechercheLignes) {
    const where: PrismaTypes.LigneWhereInput = {
      active: recherche.active,
      OR: recherche.q
        ? [
            { code: { contains: recherche.q, mode: 'insensitive' } },
            { nom: { contains: recherche.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [lignes, total] = await Promise.all([
      prisma.ligne.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: decalage(recherche.page, recherche.limite),
        take: recherche.limite,
      }),
      prisma.ligne.count({ where }),
    ]);
    return { lignes, total };
  }

  /** Une ligne avec ses arrêts (dans l'ordre) et ses tarifs. */
  async function lire(id: number) {
    const ligne = await prisma.ligne.findUnique({
      where: { id_ligne: id },
      include: {
        arrets: { orderBy: { ordre: 'asc' }, include: { station: true } },
        tarifs: { orderBy: { id_tarif: 'asc' } },
      },
    });
    if (!ligne) throw new NonTrouve(MESSAGES.absent);
    return ligne;
  }

  async function creer(donnees: DonneesLigne) {
    try {
      return await prisma.ligne.create({ data: donnees });
    } catch (erreur) {
      return traduireErreurPrisma(erreur, MESSAGES);
    }
  }

  async function modifier(id: number, donnees: Partial<DonneesLigne>) {
    try {
      return await prisma.ligne.update({ where: { id_ligne: id }, data: donnees });
    } catch (erreur) {
      return traduireErreurPrisma(erreur, MESSAGES);
    }
  }

  async function supprimer(id: number): Promise<void> {
    try {
      await prisma.ligne.delete({ where: { id_ligne: id } });
    } catch (erreur) {
      traduireErreurPrisma(erreur, MESSAGES);
    }
  }

  /** Remplace tous les arrêts. L'ordre du tableau devient l'ordre sur la ligne (1, 2, 3...). */
  async function remplacerArrets(id: number, arrets: DonneesArrets) {
    await lire(id);
    const trouvees = await prisma.station.findMany({
      where: { id_station: { in: arrets.map((a) => a.station_id) } },
      select: { id_station: true },
    });
    const connues = new Set(trouvees.map((s) => s.id_station));
    const details = arrets
      .map((a, i) => ({ champ: `arrets.${i}.station_id`, ok: connues.has(a.station_id) }))
      .filter((d) => !d.ok)
      .map((d) => ({ champ: d.champ, message: 'Station inconnue.' }));
    if (details.length > 0) throw new ValidationEchouee(details);

    await prisma.$transaction([
      prisma.ligneStation.deleteMany({ where: { ligne_id: id } }),
      prisma.ligneStation.createMany({
        data: arrets.map((a, i) => ({
          ligne_id: id,
          station_id: a.station_id,
          ordre: i + 1,
          distance_km: a.distance_km,
          minutes_depuis_origine: a.minutes_depuis_origine,
        })),
      }),
    ]);
    return lire(id);
  }

  /** Remplace tous les tarifs. Chaque tronçon doit aller vers l'avant sur la ligne. */
  async function remplacerTarifs(id: number, tarifs: DonneesTarifs) {
    const ligne = await lire(id);
    const ordre = new Map(ligne.arrets.map((a) => [a.station_id, a.ordre]));
    const details = tarifs.flatMap((t, i) => {
      const depart = ordre.get(t.station_depart_id);
      const arrivee = ordre.get(t.station_arrivee_id);
      if (depart === undefined || arrivee === undefined) {
        return [
          {
            champ: `tarifs.${i}`,
            message: 'Les deux stations doivent être des arrêts de la ligne.',
          },
        ];
      }
      return depart < arrivee
        ? []
        : [{ champ: `tarifs.${i}`, message: 'Le départ doit être avant l’arrivée sur la ligne.' }];
    });
    if (details.length > 0) throw new ValidationEchouee(details);

    await prisma.$transaction([
      prisma.tarif.deleteMany({ where: { ligne_id: id } }),
      prisma.tarif.createMany({ data: tarifs.map((t) => ({ ligne_id: id, ...t })) }),
    ]);
    return lire(id);
  }

  return { lister, lire, creer, modifier, supprimer, remplacerArrets, remplacerTarifs };
}
