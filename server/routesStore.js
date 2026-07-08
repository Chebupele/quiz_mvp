import { z } from 'zod';
import { requireAuth, requireRole } from './authStore.js';
import { store } from './db.js';
import {
  createQuiz,
  createSession,
  getQuizFull,
  getSessionByCode,
  getSessionState,
  joinSession,
  listQuizzesForUser,
  replaceQuestions,
  updateQuiz,
} from './quizRepositoryStore.js';

const quizSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  category: z.string().min(2).optional(),
  timeLimit: z.coerce.number().min(5).max(300).optional(),
  pointsPerQuestion: z.coerce.number().min(1).max(1000).optional(),
  status: z.enum(['draft', 'ready', 'archived']).optional(),
});

const questionsSchema = z.array(
  z.object({
    prompt: z.string().min(3),
    imageUrl: z.string().optional().default(''),
    type: z.enum(['single', 'multiple']),
    options: z
      .array(
        z.object({
          label: z.string().min(1),
          isCorrect: z.boolean(),
        }),
      )
      .min(2),
  }),
);

export function apiRoutes(app) {
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/dashboard', requireAuth, (req, res) => {
    const items = listQuizzesForUser(req.user.id, req.user.role);
    const stats =
      req.user.role === 'organizer'
        ? {
            quizzes: store.quizzes.filter((quiz) => quiz.organizer_id === req.user.id).length,
            sessions: store.sessions.filter((session) => session.organizer_id === req.user.id).length,
            totalScore: store.sessions
              .filter((session) => session.organizer_id === req.user.id)
              .flatMap((session) => store.sessionPlayers.filter((player) => player.session_id === session.id))
              .reduce((sum, player) => sum + player.score, 0),
          }
        : {
            sessions: store.sessionPlayers.filter((player) => player.user_id === req.user.id).length,
            bestScore: Math.max(0, ...store.sessionPlayers.filter((player) => player.user_id === req.user.id).map((player) => player.score)),
          };

    res.json({ items, stats });
  });

  app.get('/api/quizzes', requireAuth, requireRole('organizer'), (req, res) => {
    res.json({ quizzes: listQuizzesForUser(req.user.id, req.user.role) });
  });

  app.post('/api/quizzes', requireAuth, requireRole('organizer'), (req, res) => {
    const quiz = createQuiz(req.user.id, quizSchema.parse(req.body));
    res.status(201).json({ quiz });
  });

  app.get('/api/quizzes/:id', requireAuth, requireRole('organizer'), (req, res) => {
    const quiz = getQuizFull(req.params.id);
    if (!quiz || quiz.organizer_id !== req.user.id) {
      res.status(404).json({ message: 'Квиз не найден' });
      return;
    }
    res.json({ quiz });
  });

  app.put('/api/quizzes/:id', requireAuth, requireRole('organizer'), (req, res) => {
    const quiz = updateQuiz(req.params.id, req.user.id, quizSchema.partial().parse(req.body));
    if (!quiz) {
      res.status(404).json({ message: 'Квиз не найден' });
      return;
    }
    res.json({ quiz });
  });

  app.put('/api/quizzes/:id/questions', requireAuth, requireRole('organizer'), (req, res) => {
    const quiz = replaceQuestions(req.params.id, req.user.id, questionsSchema.parse(req.body.questions));
    if (!quiz) {
      res.status(404).json({ message: 'Квиз не найден' });
      return;
    }
    res.json({ quiz });
  });

  app.post('/api/quizzes/:id/sessions', requireAuth, requireRole('organizer'), (req, res) => {
    try {
      const state = createSession(Number(req.params.id), req.user.id);
      if (!state) {
        res.status(404).json({ message: 'Квиз не найден' });
        return;
      }
      res.status(201).json({ state });
    } catch (error) {
      if (error.message === 'QUIZ_HAS_NO_QUESTIONS') {
        res.status(422).json({ message: 'Добавьте хотя бы один вопрос перед запуском' });
        return;
      }
      throw error;
    }
  });

  app.get('/api/sessions/:roomCode', (req, res) => {
    const session = getSessionByCode(req.params.roomCode);
    if (!session) {
      res.status(404).json({ message: 'Комната не найдена' });
      return;
    }
    res.json({ state: getSessionState(session.id) });
  });

  app.post('/api/sessions/:roomCode/join', requireAuth, (req, res) => {
    const displayName = String(req.body.displayName || req.user.name).trim();
    const result = joinSession(req.params.roomCode, displayName, req.user.id);
    if (!result) {
      res.status(404).json({ message: 'Комната не найдена' });
      return;
    }
    res.status(201).json({
      player: result.player,
      state: getSessionState(result.session.id),
    });
  });
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof z.ZodError) {
    res.status(400).json({ message: 'Проверьте поля формы', issues: error.issues });
    return;
  }
  console.error(error);
  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
}
