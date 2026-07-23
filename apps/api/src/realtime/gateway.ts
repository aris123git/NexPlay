import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { verifySocketToken } from '../auth/auth.js';
import { config } from '../config.js';
import { orchestrator } from '../games/orchestrator.js';

export function createRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigin, credentials: true },
  });

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ||
      (socket.handshake.query?.token as string | undefined);
    if (!token) return next(new Error('UNAUTHORIZED'));
    const user = verifySocketToken(token);
    if (!user) return next(new Error('UNAUTHORIZED'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as { id: string; username: string };
    socket.join(`user:${user.id}`);

    socket.on('match:join', async (payload: { matchId: string }, ack?) => {
      try {
        const match = await orchestrator.getPublicMatch(payload.matchId);
        const isPlayer = match.players.some((p) => p.userId === user.id);
        if (!isPlayer) {
          ack?.({ ok: false, error: 'NOT_A_PLAYER' });
          return;
        }
        socket.join(`match:${payload.matchId}`);
        ack?.({ ok: true, match });
        socket.to(`match:${payload.matchId}`).emit('presence:join', {
          userId: user.id,
          username: user.username,
        });
      } catch {
        ack?.({ ok: false, error: 'NOT_FOUND' });
      }
    });

    socket.on('match:action', async (payload: { matchId: string; action: unknown }, ack?) => {
      try {
        const result = await orchestrator.applyPlayerAction(
          payload.matchId,
          user.id,
          payload.action,
        );
        io.to(`match:${payload.matchId}`).emit('match:update', {
          matchId: payload.matchId,
          state: result.state,
          events: result.events,
          outcome: result.outcome,
          finished: result.finished,
          seq: result.seq,
          by: user.id,
        });
        ack?.({ ok: true, ...result });
      } catch (e) {
        const err = e as Error & { code?: string };
        ack?.({ ok: false, error: err.code ?? 'ACTION_FAILED', message: err.message });
      }
    });

    socket.on('chat:match', (payload: { matchId: string; text: string }) => {
      if (!payload?.text || payload.text.length > 300) return;
      io.to(`match:${payload.matchId}`).emit('chat:match', {
        userId: user.id,
        username: user.username,
        text: payload.text,
        at: Date.now(),
      });
    });

    socket.on('disconnect', () => {
      /* presence cleanup futur */
    });
  });

  return io;
}
