import type { Request } from 'express';
import { prisma } from './prisma.js';

export async function logAudit(input: {
  req?: Request;
  actorId?: string | null;
  actorRole?: string;
  action: string;
  target?: string | null;
  detail?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? 'SYSTEM',
      action: input.action,
      target: input.target ?? null,
      detail: input.detail ?? '',
      ip: input.req?.ip ?? null,
    },
  });
}
