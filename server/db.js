import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const dataFile = join(dataDir, 'quiz-studio.json');

const initialState = {
  users: [],
  quizzes: [],
  questions: [],
  options: [],
  sessions: [],
  sessionPlayers: [],
  answers: [],
  counters: {
    users: 1,
    quizzes: 1,
    questions: 1,
    options: 1,
    sessions: 1,
    sessionPlayers: 1,
    answers: 1,
  },
};

export let store = structuredClone(initialState);

export function migrate() {
  mkdirSync(dataDir, { recursive: true });
  if (!existsSync(dataFile)) {
    save();
    return;
  }

  const parsed = JSON.parse(readFileSync(dataFile, 'utf8'));
  store = {
    ...structuredClone(initialState),
    ...parsed,
    counters: { ...initialState.counters, ...(parsed.counters || {}) },
  };
}

export function save() {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

export function nextId(collection) {
  const id = store.counters[collection];
  store.counters[collection] += 1;
  return id;
}

export function now() {
  return new Date().toISOString();
}

export function touchQuiz(id) {
  const quiz = store.quizzes.find((item) => item.id === Number(id));
  if (quiz) {
    quiz.updated_at = now();
    save();
  }
}
