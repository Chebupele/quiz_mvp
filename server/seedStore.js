import bcrypt from 'bcryptjs';
import { migrate, nextId, now, save, store } from './db.js';
import { createQuiz, replaceQuestions } from './quizRepositoryStore.js';

migrate();

function upsertUser({ name, email, role }) {
  const existing = store.users.find((user) => user.email === email);
  if (existing) return existing;

  const user = {
    id: nextId('users'),
    name,
    email,
    password_hash: bcrypt.hashSync('password123', 10),
    role,
    created_at: now(),
  };
  store.users.push(user);
  save();
  return user;
}

const organizer = upsertUser({ name: 'Мария Орлова', email: 'org@quiz.local', role: 'organizer' });
upsertUser({ name: 'Илья Смирнов', email: 'player@quiz.local', role: 'participant' });

const existingQuiz = store.quizzes.find((quiz) => quiz.organizer_id === organizer.id);
const quiz =
  existingQuiz ||
  createQuiz(organizer.id, {
    title: 'Технологии и веб',
    description: 'Короткий квиз для проверки MVP: типы вопросов, таймер и подсчет баллов.',
    category: 'Веб-разработка',
    timeLimit: 30,
    pointsPerQuestion: 100,
  });

replaceQuestions(quiz.id, organizer.id, [
  {
    prompt: 'Какой протокол чаще всего используют для live-обновлений в квизах?',
    type: 'single',
    imageUrl: '',
    options: [
      { label: 'WebSocket', isCorrect: true },
      { label: 'FTP', isCorrect: false },
      { label: 'SMTP', isCorrect: false },
      { label: 'DNS', isCorrect: false },
    ],
  },
  {
    prompt: 'Какие варианты относятся к JavaScript-фреймворкам или библиотекам?',
    type: 'multiple',
    imageUrl: '',
    options: [
      { label: 'React', isCorrect: true },
      { label: 'Vue', isCorrect: true },
      { label: 'PostgreSQL', isCorrect: false },
      { label: 'Angular', isCorrect: true },
    ],
  },
  {
    prompt: 'Что должно быть у вопроса с изображением?',
    type: 'single',
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop',
    options: [
      { label: 'Понятный текст и варианты ответа', isCorrect: true },
      { label: 'Только декоративный фон', isCorrect: false },
      { label: 'Скрытые варианты', isCorrect: false },
      { label: 'Нулевая длительность', isCorrect: false },
    ],
  },
]);

replaceQuestions(quiz.id, organizer.id, [
  {
    prompt: 'Какой протокол чаще всего используют для live-обновлений в квизах?',
    type: 'single',
    imageUrl: '',
    options: [
      { label: 'WebSocket', isCorrect: true },
      { label: 'FTP', isCorrect: false },
      { label: 'SMTP', isCorrect: false },
      { label: 'DNS', isCorrect: false },
    ],
  },
  {
    prompt: 'Какие варианты относятся к JavaScript-фреймворкам или библиотекам?',
    type: 'multiple',
    imageUrl: '',
    options: [
      { label: 'React', isCorrect: true },
      { label: 'Vue', isCorrect: true },
      { label: 'PostgreSQL', isCorrect: false },
      { label: 'Angular', isCorrect: true },
    ],
  },
  {
    prompt: 'Что произойдет с интерфейсом, если сервер отправит новое состояние комнаты через WebSocket?',
    type: 'single',
    imageUrl: '',
    options: [
      { label: 'Экран участников обновится без перезагрузки страницы', isCorrect: true },
      { label: 'Пользователям придется заново войти в аккаунт', isCorrect: false },
      { label: 'Браузер скачает новый HTML-файл вручную', isCorrect: false },
      { label: 'Ответы участников будут удалены до подсчета', isCorrect: false },
    ],
  },
]);

const seededQuiz = store.quizzes.find((item) => item.id === quiz.id);
seededQuiz.status = 'ready';
seededQuiz.updated_at = now();

let demoSession = store.sessions.find((session) => session.room_code === '4821');
if (!demoSession) {
  demoSession = {
    id: nextId('sessions'),
    quiz_id: quiz.id,
    organizer_id: organizer.id,
    room_code: '4821',
    status: 'question',
    current_question_index: 0,
    started_at: now(),
    finished_at: null,
  };
  store.sessions.push(demoSession);
} else {
  demoSession.quiz_id = quiz.id;
  demoSession.organizer_id = organizer.id;
  demoSession.status = 'question';
  demoSession.current_question_index = 0;
  demoSession.finished_at = null;
}
store.answers = store.answers.filter((answer) => answer.session_id !== demoSession.id);
store.sessionPlayers = store.sessionPlayers.filter((player) => player.session_id !== demoSession.id);
save();

console.log('Seed complete.');
console.log('Organizer: org@quiz.local / password123');
console.log('Participant: player@quiz.local / password123');
