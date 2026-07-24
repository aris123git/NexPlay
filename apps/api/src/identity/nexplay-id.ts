import { createHash, randomBytes } from 'node:crypto';

/**
 * Identifiant officiel NexPlay — unique sur toute la plateforme.
 * Format : NXP-4F8A-29C1
 */
export function generateNexplayId(): string {
  const hex = randomBytes(4).toString('hex').toUpperCase();
  return `NXP-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/** Tag affiché type Aristide#4827 (dérivé du NexPlay ID). */
export function nexplayTag(username: string, nexplayId: string): string {
  const digits = nexplayId.replace(/[^0-9A-Fa-f]/g, '').slice(-4).toUpperCase();
  return `${username}#${digits || '0000'}`;
}

/** Hash stable pour recherches / anti-collisions futures. */
export function nexplayIdHash(nexplayId: string): string {
  return createHash('sha256').update(nexplayId).digest('hex').slice(0, 16);
}
