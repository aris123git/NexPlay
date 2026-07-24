import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  role?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(40).optional(),
  countryCode: z.string().length(2).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signAccess(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role ?? 'player',
    },
    config.jwtSecret,
    { expiresIn: config.accessTokenTtlSec },
  );
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function registerHandler(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION', details: parsed.error.flatten() });
  }
  const { email, password, username, displayName, countryCode } = parsed.data;
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { profile: { username } }] },
  });
  if (existing) {
    return res.status(409).json({ error: 'EMAIL_OR_USERNAME_TAKEN' });
  }

  const country = (countryCode ?? 'BF').toUpperCase();
  const { resolveContinent } = await import('../i18n/catalog.js');
  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      profile: {
        create: {
          username,
          displayName: displayName ?? username,
          countryCode: country,
          continentCode: resolveContinent(country),
          locale: 'fr',
          currency: 'XOF',
          timezone: 'Africa/Ouagadougou',
          avatarUrl: 'preset://lion',
        },
      },
      wallet: { create: { nexCoins: 100 } },
    },
    include: { profile: true },
  });

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    username: user.profile!.username,
    role: user.role,
  };
  const accessToken = signAccess(authUser);
  const refresh = await issueRefresh(user.id);

  try {
    const { track } = await import('../analytics/service.js');
    await track('session_start', user.id, { source: 'register' });
  } catch {
    /* ignore */
  }

  return res.status(201).json({
    user: publicUser(user),
    accessToken,
    refreshToken: refresh,
  });
}

export async function loginHandler(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION' });
  }
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { profile: true },
  });
  if (!user || user.status === 'deleted') {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  }
  if (user.status === 'banned') {
    return res.status(403).json({ error: 'BANNED', reason: user.banReason });
  }
  const ok = await argon2.verify(user.passwordHash, parsed.data.password);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    username: user.profile!.username,
    role: user.role,
  };
  const accessToken = signAccess(authUser);
  const refreshToken = await issueRefresh(user.id);

  try {
    const { track } = await import('../analytics/service.js');
    await track('login', user.id, {});
    await track('session_start', user.id, { source: 'login' });
  } catch {
    /* ignore */
  }

  return res.json({
    user: { ...publicUser(user), role: user.role },
    accessToken,
    refreshToken,
  });
}

async function issueRefresh(userId: string): Promise<string> {
  const raw = randomBytes(48).toString('hex');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + config.refreshTokenTtlSec * 1000);
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  return raw;
}

function publicUser(user: {
  id: string;
  email: string;
  role?: string;
  profile: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    countryCode: string;
    locale: string;
    currency: string;
    level: number;
    xp: number;
    bio: string | null;
  } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role ?? 'player',
    ...user.profile!,
  };
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as jwt.JwtPayload;
    req.user = {
      id: String(payload.sub),
      email: String(payload.email),
      username: String(payload.username),
      role: String(payload.role ?? 'player'),
    };
    next();
  } catch {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret) as jwt.JwtPayload;
      req.user = {
        id: String(payload.sub),
        email: String(payload.email),
        username: String(payload.username),
        role: String(payload.role ?? 'player'),
      };
    } catch {
      /* ignore */
    }
  }
  next();
}

export function verifySocketToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    return {
      id: String(payload.sub),
      email: String(payload.email),
      username: String(payload.username),
      role: String(payload.role ?? 'player'),
    };
  } catch {
    return null;
  }
}

export async function meHandler(req: Request, res: Response) {
  const { getFullProfile } = await import('../profile/service.js');
  const profile = await getFullProfile(req.user!.id);
  return res.json(profile);
}
