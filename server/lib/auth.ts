import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from './prisma.js';
import { sha256 } from './hash.js';

const COOKIE = 'cryptora_session';
const SESSION_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 12);

export type Role = 'ADMIN' | 'VOTER' | 'AUDITOR';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  voterId?: string | null;
  auditorId?: string | null;
}

export interface AuthedRequest extends Request {
  user?: SessionUser;
  sessionToken?: string;
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 11);
}

const LOCKED_HASH = '!locked-account';

export async function verifyPassword(plain: string, hash: string) {
  if (!hash || hash === LOCKED_HASH) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export const lockedPasswordHash = LOCKED_HASH;

export function tokenHash(token: string) {
  return sha256(token);
}

export async function createSession(req: Request, res: Response, userId: string, remember: boolean) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + (remember ? 7 * 24 : SESSION_HOURS) * 3600 * 1000);
  await prisma.session.create({
    data: {
      tokenHash: tokenHash(token),
      userId,
      expiresAt,
      ip: req.ip ?? null,
      userAgent: (req.headers['user-agent'] ?? '').slice(0, 200),
    },
  });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: (remember ? 7 * 24 : SESSION_HOURS) * 3600 * 1000,
    path: '/',
  });
  return token;
}

export async function destroySession(req: Request, res: Response) {
  const raw = req.cookies?.[COOKIE];
  if (raw) {
    await prisma.session.deleteMany({ where: { tokenHash: tokenHash(raw) } });
  }
  res.clearCookie(COOKIE, { path: '/' });
}

export async function resolveUser(req: AuthedRequest): Promise<SessionUser | undefined> {
  const raw = req.cookies?.[COOKIE];
  if (!raw) return undefined;
  const session = await prisma.session.findUnique({
    where: { tokenHash: tokenHash(raw) },
    include: { user: true },
  });
  if (!session) return undefined;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return undefined;
  }
  req.sessionToken = raw;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role as Role,
    voterId: session.user.voterId,
    auditorId: session.user.auditorId,
  };
}

export function requireAuth(...roles: Role[]) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const user = await resolveUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (roles.length > 0 && !roles.includes(user.role)) {
      res.status(403).json({ error: 'You do not have permission to perform this action' });
      return;
    }
    req.user = user;
    next();
  };
}

/** Very small in-memory rate limiter for authentication endpoints. */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function rateLimit(key: string): { blocked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return { blocked: false, retryAfterSeconds: 0 };
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return { blocked: true, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - entry.first)) / 1000) };
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

export function clearRateLimit(key: string) {
  attempts.delete(key);
}

export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin) {
    try {
      const host = new URL(origin).host;
      if (host !== req.headers.host) {
        res.status(403).json({ error: 'Cross-origin request rejected' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Invalid origin' });
      return;
    }
  }
  next();
}
