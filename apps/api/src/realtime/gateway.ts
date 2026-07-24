import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { verifySocketToken } from '../auth/auth.js';
import { config } from '../config.js';
import { orchestrator } from '../games/orchestrator.js';
import * as presence from '../presence/service.js';
import * as chat from '../chat/service.js';

export function createRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigin, credentials: true },
  });

  presence.bindPresenceIo(io);
  chat.bindChatIo(io);

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
    void presence.connectSocket(user.id, user.username, socket.id);

    socket.on('presence:set', async (payload: { status: string; matchId?: string }, ack?) => {
      const allowed = ['online', 'in_queue', 'in_match', 'offline'] as const;
      if (!allowed.includes(payload?.status as (typeof allowed)[number])) {
        ack?.({ ok: false });
        return;
      }
      await presence.setStatus(
        user.id,
        payload.status as presence.PresenceStatus,
        payload.matchId,
      );
      ack?.({ ok: true });
    });

    socket.on('chat:join', (payload: { channelKey: string }, ack?) => {
      if (!payload?.channelKey) return ack?.({ ok: false });
      socket.join(`chat:${payload.channelKey}`);
      ack?.({ ok: true });
    });

    socket.on(
      'chat:send',
      async (payload: { channelId: string; body: string }, ack?) => {
        try {
          const msg = await chat.postMessage({
            channelId: payload.channelId,
            senderId: user.id,
            body: payload.body,
          });
          ack?.({ ok: true, message: msg });
        } catch (e) {
          ack?.({ ok: false, error: (e as Error).message });
        }
      },
    );

    socket.on('match:join', async (payload: { matchId: string }, ack?) => {
      try {
        const match = await orchestrator.getPublicMatch(payload.matchId);
        const isPlayer = match.players.some((p) => p.userId === user.id);
        if (!isPlayer) {
          ack?.({ ok: false, error: 'NOT_A_PLAYER' });
          return;
        }
        socket.join(`match:${payload.matchId}`);
        const channel = await chat.getOrCreateMatchChannel(payload.matchId);
        socket.join(`chat:${channel.key}`);
        await presence.setStatus(user.id, 'in_match', payload.matchId);
        ack?.({ ok: true, match, chatChannelId: channel.id, chatKey: channel.key });
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

    // Legacy match chat → persisted channel
    socket.on('chat:match', async (payload: { matchId: string; text: string }) => {
      if (!payload?.text || payload.text.length > 300) return;
      try {
        const channel = await chat.getOrCreateMatchChannel(payload.matchId);
        await chat.postMessage({
          channelId: channel.id,
          senderId: user.id,
          body: payload.text,
        });
      } catch {
        io.to(`match:${payload.matchId}`).emit('chat:match', {
          userId: user.id,
          username: user.username,
          text: payload.text,
          at: Date.now(),
        });
      }
    });

    socket.on('disconnect', () => {
      void presence.disconnectSocket(user.id, socket.id);
    });
  });

  return io;
}
