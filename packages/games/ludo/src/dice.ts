import { randomInt, createHmac, randomBytes } from 'node:crypto';

/**
 * Dés sécurisés côté serveur.
 * - Valeur via crypto.randomInt (CSPRNG)
 * - Chaque lancer est signé HMAC pour audit / anti-triche
 */
export type DiceRoll = {
  value: number;
  nonce: string;
  signature: string;
  at: number;
};

export function createDiceSecret(): string {
  return randomBytes(32).toString('hex');
}

export function rollSecureDie(secret: string, matchId: string, seq: number): DiceRoll {
  const value = randomInt(1, 7); // [1, 6]
  const nonce = randomBytes(8).toString('hex');
  const at = Date.now();
  const payload = `${matchId}:${seq}:${value}:${nonce}:${at}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return { value, nonce, signature, at };
}

export function verifyDiceRoll(
  secret: string,
  matchId: string,
  seq: number,
  roll: DiceRoll,
): boolean {
  const payload = `${matchId}:${seq}:${roll.value}:${roll.nonce}:${roll.at}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  return expected === roll.signature && roll.value >= 1 && roll.value <= 6;
}

/** Pour tests déterministes uniquement */
export function rollFixed(value: number, secret = 'test', matchId = 'm', seq = 0): DiceRoll {
  const nonce = 'fixed';
  const at = 0;
  const payload = `${matchId}:${seq}:${value}:${nonce}:${at}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return { value, nonce, signature, at };
}
