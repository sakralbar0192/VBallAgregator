/**
 * Opaque DB transaction handle (e.g. Prisma interactive `TransactionClient`).
 * Call sites in `packages/core` cast to the concrete client type.
 */
export type DbTransaction = object;

export type QueryContext = {
  tx?: DbTransaction;
};
