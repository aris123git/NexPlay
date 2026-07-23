/**
 * Matchmaking en mémoire (V1).
 * Production : Redis Sorted Sets par (gameId, mode, skillBracket, region).
 */

export type Ticket = {
  id: string;
  userId: string;
  gameId: string;
  mode: string;
  playerCount: number;
  elo: number;
  region: string;
  createdAt: number;
};

type QueueKey = string;

function key(gameId: string, mode: string, playerCount: number, region: string): QueueKey {
  return `${gameId}|${mode}|${playerCount}|${region}`;
}

export class MatchmakingService {
  private queues = new Map<QueueKey, Ticket[]>();
  private byUser = new Map<string, Ticket>();

  enqueue(ticket: Ticket): { ticket: Ticket; ready: Ticket[] | null } {
    this.cancel(ticket.userId);
    const k = key(ticket.gameId, ticket.mode, ticket.playerCount, ticket.region);
    const q = this.queues.get(k) ?? [];
    q.push(ticket);
    this.queues.set(k, q);
    this.byUser.set(ticket.userId, ticket);

    if (q.length >= ticket.playerCount) {
      const ready = q.splice(0, ticket.playerCount);
      for (const t of ready) this.byUser.delete(t.userId);
      return { ticket, ready };
    }
    return { ticket, ready: null };
  }

  cancel(userId: string): boolean {
    const existing = this.byUser.get(userId);
    if (!existing) return false;
    const k = key(existing.gameId, existing.mode, existing.playerCount, existing.region);
    const q = this.queues.get(k) ?? [];
    this.queues.set(
      k,
      q.filter((t) => t.userId !== userId),
    );
    this.byUser.delete(userId);
    return true;
  }

  getTicket(userId: string): Ticket | undefined {
    return this.byUser.get(userId);
  }
}

export const matchmaking = new MatchmakingService();
