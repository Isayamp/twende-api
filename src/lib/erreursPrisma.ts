import { Prisma as PrismaErreurs } from '@prisma/client';
import { Conflit, NonTrouve } from '../erreurs/ErreurApp.js';

interface MessageConflit {
  code: string;
  message: string;
}

interface Messages {
  /** Doublon (contrainte unique). */
  doublon?: MessageConflit;
  /** Élément encore utilisé ailleurs (clé étrangère). */
  utilise?: MessageConflit;
  /** Élément absent. */
  absent?: string;
}

/**
 * Transforme une erreur Prisma connue en erreur de l'API (409 ou 404).
 * Les autres erreurs sont relancées telles quelles (elles deviendront un 500).
 */
export function traduireErreurPrisma(erreur: unknown, messages: Messages): never {
  if (erreur instanceof PrismaErreurs.PrismaClientKnownRequestError) {
    if (erreur.code === 'P2002' && messages.doublon) {
      throw new Conflit(messages.doublon.code, messages.doublon.message);
    }
    if (erreur.code === 'P2003' && messages.utilise) {
      throw new Conflit(messages.utilise.code, messages.utilise.message);
    }
    if (erreur.code === 'P2025') {
      throw new NonTrouve(messages.absent);
    }
  }
  // PostgreSQL « RESTRICT » (code 23001) : Prisma le renvoie comme erreur inconnue, sans code.
  if (
    erreur instanceof PrismaErreurs.PrismaClientUnknownRequestError &&
    messages.utilise &&
    /violates RESTRICT setting of foreign key/.test(erreur.message)
  ) {
    throw new Conflit(messages.utilise.code, messages.utilise.message);
  }
  throw erreur;
}
