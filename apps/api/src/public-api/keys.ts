import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';

function hashKey(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

export async function createApiKey(userId: string, name: string, scopes: string[] = ['read:public']) {
  const raw = `nxp_${randomBytes(24).toString('hex')}`;
  const keyHash = hashKey(raw);
  const keyPrefix = raw.slice(0, 12);
  const row = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyHash,
      keyPrefix,
      scopesJson: JSON.stringify(scopes),
    },
  });
  return {
    id: row.id,
    name: row.name,
    keyPrefix,
    /** Montré une seule fois */
    apiKey: raw,
    scopes,
    createdAt: row.createdAt,
  };
}

export async function listApiKeys(userId: string) {
  const rows = await prisma.apiKey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    keyPrefix: r.keyPrefix,
    scopes: JSON.parse(r.scopesJson),
    lastUsedAt: r.lastUsedAt,
    createdAt: r.createdAt,
  }));
}

export async function revokeApiKey(userId: string, id: string) {
  await prisma.apiKey.updateMany({
    where: { id, userId },
    data: { revokedAt: new Date() },
  });
  return { ok: true };
}

export type PublicAuth = {
  userId: string;
  scopes: string[];
  keyId: string;
};

declare global {
  namespace Express {
    interface Request {
      apiAuth?: PublicAuth;
    }
  }
}

export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers['x-api-key'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!header || typeof header !== 'string') {
    return res.status(401).json({ error: 'API_KEY_REQUIRED' });
  }
  const keyHash = hashKey(header);
  const row = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!row || row.revokedAt) {
    return res.status(401).json({ error: 'INVALID_API_KEY' });
  }
  await prisma.apiKey.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });
  req.apiAuth = {
    userId: row.userId,
    scopes: JSON.parse(row.scopesJson) as string[],
    keyId: row.id,
  };
  next();
}

export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiAuth?.scopes.includes(scope) && !req.apiAuth?.scopes.includes('*')) {
      return res.status(403).json({ error: 'SCOPE_DENIED', scope });
    }
    next();
  };
}
