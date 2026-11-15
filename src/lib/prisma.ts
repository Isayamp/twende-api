import { PrismaClient } from '@prisma/client';

/** Client unique de base de données, partagé par toute l'application. */
export const prisma = new PrismaClient();

export type Prisma = PrismaClient;
