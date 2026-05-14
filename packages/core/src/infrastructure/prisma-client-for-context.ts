import type { PrismaClient, Prisma } from '@prisma/client';
import type { QueryContext } from '../../../contracts/src/query-context.js';
import { prisma } from './prisma.js';

export type PrismaExecutable = PrismaClient | Prisma.TransactionClient;

export function prismaForContext(ctx?: QueryContext): PrismaExecutable {
  const tx = ctx?.tx as Prisma.TransactionClient | undefined;
  return tx ?? prisma;
}
