import jwt from 'jsonwebtoken';
import { store } from './db.js';
import {
  finishSession,
  getSessionByCode,
  getSessionState,
  joinSession,
  showQuestion,
  submitAnswer,
} from './quizRepositoryStore.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function userFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return store.users.find((user) => user.id === payload.id) || null;
  } catch {
    return null;
  }
}

export function setupSockets(io) {
  io.use((socket, next) => {
    socket.user = userFromToken(socket.handshake.auth?.token);
    next();
  });

  io.on('connection', (socket) => {
    socket.on('room:watch', ({ roomCode }, ack) => {
      const session = getSessionByCode(roomCode);
      if (!session) {
        ack?.({ ok: false, message: 'Комната не найдена' });
        return;
      }
      socket.join(session.room_code);
      ack?.({ ok: true, state: getSessionState(session.id) });
    });

    socket.on('room:join', ({ roomCode, displayName }, ack) => {
      const result = joinSession(roomCode, displayName || socket.user?.name || 'Участник', socket.user?.id);
      if (!result) {
        ack?.({ ok: false, message: 'Комната не найдена' });
        return;
      }
      const room = result.session.room_code;
      socket.join(room);
      socket.data.playerId = result.player.id;
      const state = getSessionState(result.session.id);
      io.to(room).emit('room:state', state);
      ack?.({ ok: true, player: result.player, state });
    });

    socket.on('quiz:show-question', ({ roomCode, index }, ack) => {
      const session = getSessionByCode(roomCode);
      if (!session || session.organizer_id !== socket.user?.id) {
        ack?.({ ok: false, message: 'Недостаточно прав' });
        return;
      }
      const state = showQuestion(session.id, Number(index));
      io.to(session.room_code).emit('room:state', state);
      ack?.({ ok: true, state });
    });

    socket.on('quiz:finish', ({ roomCode }, ack) => {
      const session = getSessionByCode(roomCode);
      if (!session || session.organizer_id !== socket.user?.id) {
        ack?.({ ok: false, message: 'Недостаточно прав' });
        return;
      }
      const state = finishSession(session.id);
      io.to(session.room_code).emit('room:state', state);
      ack?.({ ok: true, state });
    });

    socket.on('answer:submit', ({ roomCode, questionId, selectedOptionIds, playerId }, ack) => {
      const session = getSessionByCode(roomCode);
      if (!session) {
        ack?.({ ok: false, message: 'Комната не найдена' });
        return;
      }

      const state = submitAnswer({
        sessionId: session.id,
        questionId: Number(questionId),
        playerId: Number(playerId || socket.data.playerId),
        selectedOptionIds: selectedOptionIds || [],
      });

      if (!state) {
        ack?.({ ok: false, message: 'Ответ не принят' });
        return;
      }

      io.to(session.room_code).emit('room:state', state);
      ack?.({ ok: true, state });
    });
  });
}
