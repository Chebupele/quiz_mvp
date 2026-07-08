import { nextId, now, save, store, touchQuiz } from './db.js';

function generateRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function getQuizFull(quizId) {
  const id = Number(quizId);
  const quiz = store.quizzes.find((item) => item.id === id);
  if (!quiz) return null;

  const questions = store.questions
    .filter((question) => question.quiz_id === id)
    .sort((a, b) => a.position - b.position || a.id - b.id)
    .map((question) => ({
      ...question,
      options: store.options.filter((option) => option.question_id === question.id).sort((a, b) => a.id - b.id),
    }));

  return { ...quiz, questions };
}

export function listQuizzesForUser(userId, role) {
  if (role === 'organizer') {
    return store.quizzes
      .filter((quiz) => quiz.organizer_id === userId)
      .map((quiz) => ({
        ...quiz,
        question_count: store.questions.filter((question) => question.quiz_id === quiz.id).length,
      }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  return store.sessionPlayers
    .filter((player) => player.user_id === userId)
    .map((player) => {
      const session = store.sessions.find((item) => item.id === player.session_id);
      const quiz = store.quizzes.find((item) => item.id === session?.quiz_id);
      return {
        room_code: session?.room_code,
        status: session?.status,
        started_at: session?.started_at,
        title: quiz?.title || 'Квиз',
        score: player.score,
      };
    })
    .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
}

export function createQuiz(userId, payload) {
  const createdAt = now();
  const quiz = {
    id: nextId('quizzes'),
    organizer_id: userId,
    title: payload.title || 'Новый квиз',
    description: payload.description || '',
    category: payload.category || 'Общее',
    time_limit: Number(payload.timeLimit || 30),
    points_per_question: Number(payload.pointsPerQuestion || 100),
    status: 'draft',
    created_at: createdAt,
    updated_at: createdAt,
  };
  store.quizzes.push(quiz);
  save();
  return getQuizFull(quiz.id);
}

export function updateQuiz(quizId, userId, payload) {
  const quiz = store.quizzes.find((item) => item.id === Number(quizId) && item.organizer_id === userId);
  if (!quiz) return null;

  quiz.title = payload.title ?? quiz.title;
  quiz.description = payload.description ?? quiz.description;
  quiz.category = payload.category ?? quiz.category;
  quiz.time_limit = Number(payload.timeLimit ?? quiz.time_limit);
  quiz.points_per_question = Number(payload.pointsPerQuestion ?? quiz.points_per_question);
  quiz.status = payload.status ?? quiz.status;
  quiz.updated_at = now();
  save();

  return getQuizFull(quiz.id);
}

export function replaceQuestions(quizId, userId, questions) {
  const id = Number(quizId);
  const quiz = store.quizzes.find((item) => item.id === id && item.organizer_id === userId);
  if (!quiz) return null;

  const oldQuestionIds = store.questions.filter((question) => question.quiz_id === id).map((question) => question.id);
  store.questions = store.questions.filter((question) => question.quiz_id !== id);
  store.options = store.options.filter((option) => !oldQuestionIds.includes(option.question_id));

  questions.forEach((question, index) => {
    const questionId = nextId('questions');
    store.questions.push({
      id: questionId,
      quiz_id: id,
      prompt: question.prompt,
      image_url: question.imageUrl || '',
      type: question.type,
      position: index,
      created_at: now(),
    });

    question.options.forEach((option) => {
      store.options.push({
        id: nextId('options'),
        question_id: questionId,
        label: option.label,
        is_correct: option.isCorrect ? 1 : 0,
      });
    });
  });

  touchQuiz(id);
  save();
  return getQuizFull(id);
}

export function createSession(quizId, organizerId) {
  const quiz = getQuizFull(quizId);
  if (!quiz || quiz.organizer_id !== organizerId) return null;
  if (quiz.questions.length === 0) throw new Error('QUIZ_HAS_NO_QUESTIONS');

  let roomCode = generateRoomCode();
  while (store.sessions.some((session) => session.room_code === roomCode)) {
    roomCode = generateRoomCode();
  }

  const session = {
    id: nextId('sessions'),
    quiz_id: Number(quizId),
    organizer_id: organizerId,
    room_code: roomCode,
    status: 'lobby',
    current_question_index: -1,
    started_at: now(),
    finished_at: null,
  };
  store.sessions.push(session);
  save();
  return getSessionState(session.id);
}

export function getSessionByCode(roomCode) {
  return store.sessions.find((session) => session.room_code === String(roomCode).toUpperCase());
}

export function getSessionState(sessionId) {
  const session = store.sessions.find((item) => item.id === Number(sessionId));
  if (!session) return null;

  const quiz = getQuizFull(session.quiz_id);
  const players = store.sessionPlayers
    .filter((player) => player.session_id === session.id)
    .sort((a, b) => b.score - a.score || a.joined_at.localeCompare(b.joined_at))
    .map(({ password_hash, ...player }) => player);
  const currentQuestion = quiz.questions[session.current_question_index] || null;

  return {
    session,
    quiz: { ...quiz, questions: undefined, questionCount: quiz.questions.length },
    players,
    currentQuestion: currentQuestion
      ? {
          id: currentQuestion.id,
          prompt: currentQuestion.prompt,
          image_url: currentQuestion.image_url,
          type: currentQuestion.type,
          position: currentQuestion.position,
          options: currentQuestion.options.map((option) => ({ id: option.id, label: option.label })),
        }
      : null,
  };
}

export function joinSession(roomCode, displayName, userId) {
  const session = getSessionByCode(roomCode);
  if (!session) return null;

  const existing = store.sessionPlayers.find(
    (player) => player.session_id === session.id && player.display_name === displayName,
  );
  if (existing) return { session, player: existing };

  const player = {
    id: nextId('sessionPlayers'),
    session_id: session.id,
    user_id: userId || null,
    display_name: displayName,
    score: 0,
    joined_at: now(),
  };
  store.sessionPlayers.push(player);
  save();
  return { session, player };
}

export function showQuestion(sessionId, index) {
  const session = store.sessions.find((item) => item.id === Number(sessionId));
  if (!session) return null;

  const quiz = getQuizFull(session.quiz_id);
  const nextIndex = Math.max(0, Math.min(Number(index), quiz.questions.length - 1));
  session.status = 'question';
  session.current_question_index = nextIndex;
  save();
  return getSessionState(session.id);
}

export function finishSession(sessionId) {
  const session = store.sessions.find((item) => item.id === Number(sessionId));
  if (!session) return null;
  session.status = 'finished';
  session.finished_at = now();
  save();
  return getSessionState(session.id);
}

export function submitAnswer({ sessionId, questionId, playerId, selectedOptionIds }) {
  const session = store.sessions.find((item) => item.id === Number(sessionId));
  const question = store.questions.find((item) => item.id === Number(questionId));
  const player = store.sessionPlayers.find((item) => item.id === Number(playerId));
  if (!session || !question || !player || session.status !== 'question') return null;

  const alreadyAnswered = store.answers.some(
    (answer) => answer.session_id === session.id && answer.question_id === question.id && answer.player_id === player.id,
  );
  if (alreadyAnswered) return getSessionState(session.id);

  const selected = (selectedOptionIds || []).map(Number).sort((a, b) => a - b);
  const correct = store.options
    .filter((option) => option.question_id === question.id && option.is_correct)
    .map((option) => option.id)
    .sort((a, b) => a - b);
  const isCorrect = selected.length === correct.length && selected.every((id, index) => id === correct[index]);
  const quiz = store.quizzes.find((item) => item.id === session.quiz_id);
  const awardedPoints = isCorrect ? quiz.points_per_question : 0;

  store.answers.push({
    id: nextId('answers'),
    session_id: session.id,
    question_id: question.id,
    player_id: player.id,
    selected_option_ids: JSON.stringify(selected),
    is_correct: isCorrect ? 1 : 0,
    awarded_points: awardedPoints,
    answered_at: now(),
  });
  player.score += awardedPoints;

  const playersInSession = store.sessionPlayers.filter((item) => item.session_id === session.id);
  const answeredThisQuestion = store.answers.filter(
    (answer) => answer.session_id === session.id && answer.question_id === question.id,
  );

  if (playersInSession.length > 0 && answeredThisQuestion.length >= playersInSession.length) {
    const quiz = getQuizFull(session.quiz_id);
    const nextQuestionIndex = session.current_question_index + 1;

    if (nextQuestionIndex < quiz.questions.length) {
      session.current_question_index = nextQuestionIndex;
      session.status = 'question';
    } else {
      session.status = 'finished';
      session.finished_at = now();
    }
  }

  save();

  return getSessionState(session.id);
}
