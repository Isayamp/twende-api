import { randomInt } from 'node:crypto';
import { Prisma as PrismaErreurs, type Prisma as PrismaTypes } from '@prisma/client';
import { Conflit, NonTrouve, ValidationEchouee } from '../../erreurs/ErreurApp.js';
import { decalage } from '../../lib/pagination.js';
import type { Prisma } from '../../lib/prisma.js';
import type { DonneesReservation, ListeReservations } from './reservations.schemas.js';

const HEURES_MIN_AVANT_ANNULATION = 2;
// Un passager ne peut pas bloquer des places sans payer : au plus 5 réservations en attente.
const MAX_EN_ATTENTE_PASSAGER = 5;
const MS_PAR_HEURE = 60 * 60 * 1000;
// Sans 0/O/1/I pour éviter les confusions quand on lit un code à voix haute.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface Acteur {
  id: number;
  role: 'admin' | 'agent' | 'passager';
}

const INCLURE = {
  billets: {
    orderBy: { numero_place: 'asc' },
    include: { passager: { select: { nom_complet: true, telephone: true } } },
  },
} satisfies PrismaTypes.ReservationInclude;

function codeAleatoire(prefixe: string): string {
  let suite = '';
  for (let i = 0; i < 8; i++) suite += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefixe}-${suite}`;
}

const estPersonnel = (acteur: Acteur) => acteur.role !== 'passager';

export function creerServiceReservations(prisma: Prisma) {
  /**
   * Réserve des places. Tout se passe dans une transaction :
   * 1. on verrouille la ligne du trajet (FOR UPDATE) : les autres demandes pour ce trajet attendent ;
   * 2. on regarde quelles places sont prises, on refuse si l'une d'elles l'est ;
   * 3. on crée la réservation et les billets.
   * Filet de sécurité : l'index unique partiel de la base refuse aussi un doublon.
   */
  async function creer(acteur: Acteur, donnees: DonneesReservation) {
    const [depart, arrivee] = [donnees.station_depart_id, donnees.station_arrivee_id];

    try {
      return await prisma.$transaction(
        async (tx) => {
          const verrou = await tx.$queryRaw<{ id_trajet: number }[]>`
            SELECT id_trajet FROM trajet WHERE id_trajet = ${donnees.trajet_id} FOR UPDATE`;
          if (verrou.length === 0) throw new NonTrouve('Trajet introuvable.');

          if (!estPersonnel(acteur)) {
            // Verrou sur le compte (toujours pris après celui du trajet : pas d'impasse) pour que
            // deux demandes simultanées du même passager ne dépassent pas le plafond.
            await tx.$queryRaw`SELECT id_utilisateur FROM utilisateur WHERE id_utilisateur = ${acteur.id} FOR UPDATE`;
            const enAttente = await tx.reservation.count({
              where: {
                utilisateur_id: acteur.id,
                statut: 'confirmee',
                statut_paiement: 'en_attente',
                trajet: { depart_prevu: { gt: new Date() } },
              },
            });
            if (enAttente >= MAX_EN_ATTENTE_PASSAGER) {
              throw new Conflit(
                'TROP_DE_RESERVATIONS_EN_ATTENTE',
                `Payez ou annulez vos réservations en attente (maximum ${MAX_EN_ATTENTE_PASSAGER}).`,
              );
            }
          }

          const trajet = await tx.trajet.findUniqueOrThrow({
            where: { id_trajet: donnees.trajet_id },
            include: {
              vehicule: { select: { nombre_places: true } },
              ligne: { select: { arrets: { select: { station_id: true, ordre: true } } } },
            },
          });
          if (trajet.statut !== 'planifie' || trajet.depart_prevu.getTime() <= Date.now()) {
            throw new Conflit('TRAJET_NON_RESERVABLE', 'Ce trajet n’accepte plus de réservation.');
          }

          const ordreDe = (id: number) => trajet.ligne.arrets.find((a) => a.station_id === id)?.ordre;
          const [ordreDepart, ordreArrivee] = [ordreDe(depart), ordreDe(arrivee)];
          if (ordreDepart === undefined || ordreArrivee === undefined || ordreDepart >= ordreArrivee) {
            throw new ValidationEchouee([
              { champ: 'station_arrivee_id', message: 'Tronçon invalide pour cette ligne.' },
            ]);
          }
          const tarif = await tx.tarif.findFirst({
            where: {
              ligne_id: trajet.ligne_id,
              station_depart_id: depart,
              station_arrivee_id: arrivee,
            },
          });
          if (!tarif) {
            throw new ValidationEchouee([
              { champ: 'station_arrivee_id', message: 'Aucun tarif pour ce tronçon.' },
            ]);
          }

          const horsBus = donnees.places.filter((p) => p.numero_place > trajet.vehicule.nombre_places);
          if (horsBus.length > 0) {
            throw new ValidationEchouee(
              horsBus.map((p) => ({
                champ: 'places',
                message: `La place ${p.numero_place} n’existe pas (bus de ${trajet.vehicule.nombre_places} places).`,
              })),
            );
          }

          const profil = await tx.utilisateur.findUniqueOrThrow({
            where: { id_utilisateur: acteur.id },
            select: { nom_complet: true, telephone: true },
          });
          if (donnees.places.some((p) => !p.passager) && !profil.telephone) {
            throw new ValidationEchouee([
              {
                champ: 'places',
                message: 'Indiquez le passager : votre compte n’a pas de téléphone.',
              },
            ]);
          }

          const prises = await tx.billet.findMany({
            where: {
              trajet_id: donnees.trajet_id,
              statut: { not: 'annule' },
              numero_place: { in: donnees.places.map((p) => p.numero_place) },
            },
            select: { numero_place: true },
          });
          if (prises.length > 0) {
            const liste = prises.map((b) => b.numero_place).sort((a, b) => a - b);
            throw new Conflit('PLACE_DEJA_PRISE', `Place déjà prise : ${liste.join(', ')}.`);
          }

          const reservation = await tx.reservation.create({
            data: {
              code: codeAleatoire('RES'),
              utilisateur_id: acteur.id,
              trajet_id: donnees.trajet_id,
              station_depart_id: depart,
              station_arrivee_id: arrivee,
              montant_total: tarif.prix.mul(donnees.places.length),
              devise: tarif.devise,
            },
          });
          for (const place of donnees.places) {
            const infos = place.passager ?? {
              nom_complet: profil.nom_complet,
              telephone: profil.telephone as string,
            };
            const passager = await tx.passager.create({
              data: {
                ...infos,
                utilisateur_id: place.passager ? null : acteur.id,
              },
            });
            await tx.billet.create({
              data: {
                numero: codeAleatoire('TWD'),
                reservation_id: reservation.id_reservation,
                trajet_id: donnees.trajet_id,
                passager_id: passager.id_passager,
                numero_place: place.numero_place,
                prix: tarif.prix,
              },
            });
          }
          return tx.reservation.findUniqueOrThrow({
            where: { id_reservation: reservation.id_reservation },
            include: INCLURE,
          });
        },
        { maxWait: 5000, timeout: 10000 },
      );
    } catch (erreur) {
      // Filet de sécurité : l'index unique de la base a refusé un doublon de place.
      if (erreur instanceof PrismaErreurs.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        // Un code de réservation ou un numéro de billet en double est une autre erreur (rarissime).
        const cible = JSON.stringify(erreur.meta?.target ?? '');
        if (!/reservation_code|billet_numero|"code"|"numero"/.test(cible)) {
          throw new Conflit('PLACE_DEJA_PRISE', 'Une des places vient d’être prise.');
        }
      }
      throw erreur;
    }
  }

  async function lister(acteur: Acteur, filtres: ListeReservations) {
    const where: PrismaTypes.ReservationWhereInput = {
      utilisateur_id: estPersonnel(acteur) ? undefined : acteur.id,
      statut: filtres.statut,
      statut_paiement: filtres.statut_paiement,
      trajet_id: filtres.trajet_id,
    };
    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        include: INCLURE,
        orderBy: [{ cree_le: 'desc' }, { id_reservation: 'desc' }],
        skip: decalage(filtres.page, filtres.limite),
        take: filtres.limite,
      }),
      prisma.reservation.count({ where }),
    ]);
    return { reservations, total };
  }

  /** Un passager qui demande la réservation d'un autre reçoit 404 (on ne révèle pas son existence). */
  async function lire(acteur: Acteur, id: number) {
    const reservation = await prisma.reservation.findUnique({
      where: { id_reservation: id },
      include: INCLURE,
    });
    if (!reservation || (!estPersonnel(acteur) && reservation.utilisateur_id !== acteur.id)) {
      throw new NonTrouve('Réservation introuvable.');
    }
    return reservation;
  }

  /**
   * Annule une réservation. Les changements d'état sont des mises à jour conditionnelles :
   * si deux demandes arrivent en même temps (annulation, annulation, paiement), une seule gagne.
   * Une réservation payée ne s'annule pas ici : le remboursement se fait hors de l'API.
   */
  async function annuler(acteur: Acteur, id: number) {
    const reservation = await lire(acteur, id);
    if (!estPersonnel(acteur)) {
      const trajet = await prisma.trajet.findUniqueOrThrow({
        where: { id_trajet: reservation.trajet_id },
        select: { depart_prevu: true },
      });
      const limite = trajet.depart_prevu.getTime() - HEURES_MIN_AVANT_ANNULATION * MS_PAR_HEURE;
      if (reservation.statut === 'confirmee' && Date.now() > limite) {
        throw new Conflit(
          'ANNULATION_TARDIVE',
          `Annulation impossible à moins de ${HEURES_MIN_AVANT_ANNULATION} h du départ.`,
        );
      }
    }
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.reservation.updateMany({
        where: { id_reservation: id, statut: 'confirmee', statut_paiement: 'en_attente' },
        data: { statut: 'annulee' },
      });
      if (count === 0) {
        const actuelle = await tx.reservation.findUniqueOrThrow({ where: { id_reservation: id } });
        if (actuelle.statut === 'annulee') {
          throw new Conflit('DEJA_ANNULEE', 'Cette réservation est déjà annulée.');
        }
        throw new Conflit('RESERVATION_PAYEE', 'Une réservation payée ne peut plus être annulée ici.');
      }
      await tx.billet.updateMany({
        where: { reservation_id: id, statut: 'valide' },
        data: { statut: 'annule' },
      });
    });
    return lire(acteur, id);
  }

  async function marquerPayee(acteur: Acteur, id: number) {
    await lire(acteur, id);
    // Mise à jour conditionnelle : ni deux paiements, ni paiement d'une réservation annulée en même temps.
    const { count } = await prisma.reservation.updateMany({
      where: { id_reservation: id, statut: 'confirmee', statut_paiement: 'en_attente' },
      data: { statut_paiement: 'paye' },
    });
    if (count === 0) {
      const actuelle = await lire(acteur, id);
      if (actuelle.statut === 'annulee') {
        throw new Conflit('RESERVATION_ANNULEE', 'Cette réservation est annulée.');
      }
      throw new Conflit('DEJA_PAYEE', 'Cette réservation est déjà payée.');
    }
    return lire(acteur, id);
  }

  return { creer, lister, lire, annuler, marquerPayee };
}
