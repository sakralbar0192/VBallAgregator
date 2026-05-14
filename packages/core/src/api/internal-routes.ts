import crypto from 'crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

export interface InternalRoutesOptions {
  prisma: PrismaClient;
  /** When unset, internal routes return 503 (not open by accident). */
  internalApiToken: string | undefined;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) {
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

function extractBearer(authorization: string | undefined): string | null {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice('Bearer '.length).trim();
}

export async function internalRoutes(fastify: FastifyInstance, opts: InternalRoutesOptions) {
  const { prisma, internalApiToken } = opts;

  fastify.register(
    async scoped => {
      scoped.addHook('preHandler', async (request, reply) => {
        if (!internalApiToken) {
          await reply.code(503).send({ error: 'internal_api_not_configured' });
          return;
        }
        const bearer = extractBearer(request.headers.authorization);
        if (!bearer) {
          await reply.code(401).send({ error: 'missing_bearer_token' });
          return;
        }
        if (!timingSafeEqualString(bearer, internalApiToken)) {
          await reply.code(403).send({ error: 'invalid_token' });
          return;
        }
      });

      scoped.get<{
        Params: { telegramId: string };
      }>('/users/by-telegram/:telegramId', async (request, reply) => {
        const raw = request.params.telegramId;
        let telegramId: bigint;
        try {
          telegramId = BigInt(raw);
        } catch {
          await reply.code(400).send({ error: 'invalid_telegram_id' });
          return;
        }

        const user = await prisma.user.findUnique({
          where: { telegramId },
          select: {
            id: true,
            telegramId: true,
            name: true,
            levelTag: true,
            activeSport: true,
          },
        });

        if (!user) {
          await reply.code(404).send({ error: 'not_found' });
          return;
        }

        await reply.send({
          userId: user.id,
          telegramId: user.telegramId.toString(),
          name: user.name,
          levelTag: user.levelTag,
          activeSport: user.activeSport,
        });
      });

      scoped.get<{
        Params: { userId: string };
      }>('/users/by-id/:userId', async (request, reply) => {
        const { userId } = request.params;
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            telegramId: true,
            name: true,
            levelTag: true,
            activeSport: true,
          },
        });

        if (!user) {
          await reply.code(404).send({ error: 'not_found' });
          return;
        }

        await reply.send({
          userId: user.id,
          telegramId: user.telegramId.toString(),
          name: user.name,
          levelTag: user.levelTag,
          activeSport: user.activeSport,
        });
      });
    },
    { prefix: '/internal' }
  );
}
