import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  clearRateLimit,
  createSession,
  destroySession,
  rateLimit,
  requireAuth,
  resolveUser,
  verifyPassword,
  type AuthedRequest,
} from '../lib/auth.js';
import { logAudit } from '../lib/audit.js';

export const authRouter = Router();

const loginSchema = z.object({
  mode: z.enum(['admin', 'voter', 'auditor']),
  identifier: z.string().min(3).max(160),
  secondary: z.string().max(120).optional().nullable(),
  password: z.string().min(1).max(200),
  remember: z.boolean().optional(),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter your credentials to continue.' });
    return;
  }
  const { mode, identifier, secondary, password, remember } = parsed.data;
  const key = `${mode}:${identifier.toLowerCase()}:${req.ip}`;
  const limit = rateLimit(key);
  if (limit.blocked) {
    res.status(429).json({ error: `Too many attempts. Try again in ${limit.retryAfterSeconds}s.` });
    return;
  }

  const role = mode === 'admin' ? 'ADMIN' : mode === 'voter' ? 'VOTER' : 'AUDITOR';
  const cleaned = identifier.trim();

  try {
    let user = null as Awaited<ReturnType<typeof prisma.user.findFirst>>;

    if (mode === 'voter') {
      user = await prisma.user.findFirst({
        where: {
          role: 'VOTER',
          OR: [{ voterId: cleaned }, { email: cleaned.toLowerCase() }],
        },
      });
    } else {
      user = await prisma.user.findFirst({ where: { email: cleaned.toLowerCase(), role } });
    }

    const valid = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !valid) {
      await logAudit({
        req,
        actorId: user?.id ?? null,
        actorRole: role,
        action: 'LOGIN_FAILED',
        target: cleaned,
        detail: `${mode} authentication rejected`,
      });
      res.status(401).json({ error: 'Invalid credentials. Please check your details and try again.' });
      return;
    }

    if (mode === 'auditor') {
      const auditor = await prisma.auditor.findUnique({ where: { userId: user.id } });
      if (!auditor) {
        res.status(403).json({ error: 'This account is not accredited for audit access.' });
        return;
      }
      if (secondary && secondary.trim() && secondary.trim().toUpperCase() !== auditor.auditorNumber.toUpperCase()) {
        clearRateLimit(key);
        res.status(401).json({ error: 'Auditor ID does not match this account.' });
        return;
      }
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(req, res, user.id, Boolean(remember));
    clearRateLimit(key);

    const voter = await prisma.voter.findUnique({ where: { userId: user.id } });
    const auditor = await prisma.auditor.findUnique({ where: { userId: user.id } });

    await logAudit({
      req,
      actorId: user.id,
      actorRole: user.role,
      action: 'LOGIN_SUCCESS',
      target: cleaned,
      detail: `${mode} session established`,
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        voterId: user.voterId,
        auditorId: user.auditorId,
        voterNumber: voter?.voterNumber ?? null,
        auditorNumber: auditor?.auditorNumber ?? null,
      },
      redirect: mode === 'admin' ? '/admin/dashboard' : mode === 'voter' ? '/voter/dashboard' : '/auditor/dashboard',
    });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'Authentication service temporarily unavailable.' });
  }
});

authRouter.get('/me', async (req, res) => {
  const user = await resolveUser(req as AuthedRequest);
  if (!user) {
    res.status(401).json({ user: null });
    return;
  }
  const voter = await prisma.voter.findUnique({ where: { userId: user.id } });
  const auditor = await prisma.auditor.findUnique({ where: { userId: user.id } });
  res.json({
    user: {
      ...user,
      voterNumber: voter?.voterNumber ?? null,
      auditorNumber: auditor?.auditorNumber ?? null,
    },
  });
});

authRouter.post('/logout', async (req, res) => {
  const user = await resolveUser(req as AuthedRequest);
  if (user) {
    await logAudit({ req, actorId: user.id, actorRole: user.role, action: 'LOGOUT', detail: 'session terminated' });
  }
  await destroySession(req, res);
  res.json({ ok: true });
});

authRouter.get('/session-check', requireAuth(), (req, res) => {
  res.json({ ok: true, user: (req as AuthedRequest).user });
});
