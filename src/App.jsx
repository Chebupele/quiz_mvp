import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  DoorOpen,
  History,
  Image as ImageIcon,
  ListChecks,
  LogOut,
  Play,
  Plus,
  Radio,
  Save,
  Settings2,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { api, getToken, setToken } from './api.js';
import { getSocket } from './socketClient.js';
import { blankQuestion, quickQuiz } from './sample.js';

const navigation = [
  { id: 'quizzes', label: 'Мои квизы', icon: ListChecks },
  { id: 'live', label: 'Комната', icon: Radio },
  { id: 'history', label: 'История', icon: History },
];

const organizerNavigation = navigation;
const participantNavigation = [
  { id: 'live', label: 'Комната', icon: Radio },
  { id: 'history', label: 'История', icon: History },
];

export function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('quizzes');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api('/api/auth/me')
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        setView(currentUser.role === 'organizer' ? 'quizzes' : 'live');
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  function handleAuth(nextUser) {
    setUser(nextUser);
    setView(nextUser.role === 'organizer' ? 'quizzes' : 'live');
  }

  if (loading) return <Splash />;

  if (!user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <Shell user={user} view={view} setView={setView} onLogout={() => { setToken(null); setUser(null); }}>
      {user.role === 'organizer' ? (
        <OrganizerDashboard user={user} view={view} setView={setView} />
      ) : (
        <ParticipantDashboard user={user} view={view} setView={setView} />
      )}
    </Shell>
  );
}

function Splash() {
  return (
    <main className="splash">
      <div className="brand-mark">КС</div>
      <p>Загружаем Квиз-студию</p>
    </main>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('organizer');
  const [form, setForm] = useState({
    name: 'Мария Орлова',
    email: 'org@quiz.local',
    password: 'password123',
  });
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const payload = mode === 'register' ? { ...form, role } : { email: form.email, password: form.password };
      const data = await api(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setToken(data.token);
      onAuth(data.user);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function fillDemo(nextRole) {
    setRole(nextRole);
    setForm({
      name: nextRole === 'organizer' ? 'Мария Орлова' : 'Илья Смирнов',
      email: nextRole === 'organizer' ? 'org@quiz.local' : 'player@quiz.local',
      password: 'password123',
    });
  }

  return (
    <main className="auth-page">
      <section className="auth-copy">
        <div className="brand-row">
          <span className="brand-mark">КС</span>
          <span>Квиз-студия</span>
        </div>
        <h1>Рабочее место для live-квизов</h1>
        <p>
          Организатор собирает вопросы, запускает комнату и ведет игру. Участники входят по коду,
          отвечают только на текущий вопрос и видят итоговый лидерборд.
        </p>
        <div className="auth-preview">
          <div>
            <span>Комната 4821</span>
            <strong>Вопрос 3 из 8</strong>
          </div>
          <div>
            <span>Лидер</span>
            <strong>Аня, 420</strong>
          </div>
        </div>
      </section>

      <form className="auth-panel" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Вход
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            Регистрация
          </button>
        </div>

        {mode === 'register' && (
          <>
            <label>
              Имя
              <input value={form.name} onChange={(event) => update('name', event.target.value)} />
            </label>
            <div className="role-switch">
              <button type="button" className={role === 'organizer' ? 'active' : ''} onClick={() => setRole('organizer')}>
                Организатор
              </button>
              <button type="button" className={role === 'participant' ? 'active' : ''} onClick={() => setRole('participant')}>
                Участник
              </button>
            </div>
          </>
        )}

        <label>
          Email
          <input value={form.email} type="email" onChange={(event) => update('email', event.target.value)} />
        </label>
        <label>
          Пароль
          <input value={form.password} type="password" onChange={(event) => update('password', event.target.value)} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="primary-button" type="submit">
          {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          <ChevronRight size={18} />
        </button>

        <div className="demo-row">
          <button type="button" onClick={() => fillDemo('organizer')}>Демо организатор</button>
          <button type="button" onClick={() => fillDemo('participant')}>Демо участник</button>
        </div>
      </form>
    </main>
  );
}

function Shell({ user, view, setView, onLogout, children }) {
  const navItems = user.role === 'organizer' ? organizerNavigation : participantNavigation;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <span className="brand-mark">КС</span>
          <span>Квиз-студия</span>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="profile-card">
          <UserRound size={18} />
          <div>
            <strong>{user.name}</strong>
            <span>{user.role === 'organizer' ? 'Организатор' : 'Участник'}</span>
          </div>
        </div>
        <button className="ghost-button logout" onClick={onLogout}>
          <LogOut size={18} />
          Выйти
        </button>
      </aside>
      <section className="workspace">{children}</section>
    </div>
  );
}

function OrganizerDashboard({ user, view, setView }) {
  const [quizzes, setQuizzes] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [sessionState, setSessionState] = useState(null);
  const [message, setMessage] = useState('');

  const loadDashboard = useCallback(async ({ selectFirst = false } = {}) => {
    const data = await api('/api/dashboard');
    setQuizzes(data.items);
    setStats(data.stats);
    if (selectFirst && data.items[0]) {
      const details = await api(`/api/quizzes/${data.items[0].id}`);
      setSelectedQuiz(normalizeQuiz(details.quiz));
    }
  }, []);

  useEffect(() => {
    loadDashboard({ selectFirst: true }).catch((error) => setMessage(error.message));
  }, [loadDashboard]);

  useEffect(() => {
    if (!sessionState?.session?.room_code) return undefined;
    const socket = getSocket();
    socket.emit('room:watch', { roomCode: sessionState.session.room_code });
    socket.on('room:state', setSessionState);
    return () => socket.off('room:state', setSessionState);
  }, [sessionState?.session?.room_code]);

  async function createNewQuiz() {
    const data = await api('/api/quizzes', {
      method: 'POST',
      body: JSON.stringify(quickQuiz),
    });
    const normalized = normalizeQuiz({ ...data.quiz, questions: [blankQuestion()] });
    setSelectedQuiz(normalized);
    setQuizzes((current) => [data.quiz, ...current]);
  }

  async function selectQuiz(quiz) {
    const data = await api(`/api/quizzes/${quiz.id}`);
    setSelectedQuiz(normalizeQuiz(data.quiz));
  }

  async function saveQuiz(quiz) {
    setMessage('');
    try {
      const savedQuiz = await api(`/api/quizzes/${quiz.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: quiz.title,
          description: quiz.description,
          category: quiz.category,
          timeLimit: quiz.timeLimit,
          pointsPerQuestion: quiz.pointsPerQuestion,
          status: 'ready',
        }),
      });
      const savedQuestions = await api(`/api/quizzes/${quiz.id}/questions`, {
        method: 'PUT',
        body: JSON.stringify({ questions: quiz.questions }),
      });
      setSelectedQuiz(normalizeQuiz(savedQuestions.quiz));
      setMessage(`Квиз "${savedQuiz.quiz.title}" сохранен`);
      loadDashboard();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function startQuiz() {
    if (!selectedQuiz) return;
    await saveQuiz(selectedQuiz);
    const data = await api(`/api/quizzes/${selectedQuiz.id}/sessions`, { method: 'POST', body: JSON.stringify({}) });
    setSessionState(data.state);
    setView('live');
  }

  function showQuestion(index) {
    const socket = getSocket();
    socket.emit('quiz:show-question', { roomCode: sessionState.session.room_code, index }, (reply) => {
      if (!reply.ok) setMessage(reply.message);
    });
  }

  function finishQuiz() {
    const socket = getSocket();
    socket.emit('quiz:finish', { roomCode: sessionState.session.room_code }, (reply) => {
      if (!reply.ok) setMessage(reply.message);
    });
  }

  const content = {
    quizzes: (
      <QuizEditor
        quizzes={quizzes}
        selectedQuiz={selectedQuiz}
        onSelectQuiz={selectQuiz}
        onChange={setSelectedQuiz}
        onCreate={createNewQuiz}
        onSave={saveQuiz}
        onStart={startQuiz}
        message={message}
      />
    ),
    live: (
      <LiveRoom
        user={user}
        role="organizer"
        quiz={selectedQuiz}
        state={sessionState}
        onShowQuestion={showQuestion}
        onFinish={finishQuiz}
      />
    ),
    history: <HistoryView stats={stats} items={quizzes} role="organizer" />,
  };

  return content[view];
}

function QuizEditor({ quizzes, selectedQuiz, onSelectQuiz, onChange, onCreate, onSave, onStart, message }) {
  return (
    <>
      <Header
        title="Мои квизы"
        subtitle="Соберите вопросы, задайте правила и запустите комнату для участников."
        actions={
          <>
            <button className="secondary-button" onClick={onCreate}>
              <Plus size={17} />
              Создать квиз
            </button>
            <button className="primary-button" onClick={() => selectedQuiz && onStart()}>
              <Play size={17} />
              Запустить
            </button>
          </>
        }
      />
      <div className="editor-layout">
        <section className="quiz-list panel">
          {quizzes.map((quiz) => (
            <button
              key={quiz.id}
              className={selectedQuiz?.id === quiz.id ? 'quiz-row active' : 'quiz-row'}
              onClick={() => onSelectQuiz(quiz)}
            >
              <span>
                <strong>{quiz.title}</strong>
                <small>{quiz.category} · {quiz.question_count || quiz.questions?.length || 0} вопросов</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </section>

        {selectedQuiz ? (
          <section className="quiz-builder panel">
            <QuizBasics quiz={selectedQuiz} onChange={onChange} />
            <QuestionBuilder quiz={selectedQuiz} onChange={onChange} />
            <div className="builder-footer">
              <p>{message}</p>
              <button className="secondary-button" onClick={() => onSave(selectedQuiz)}>
                <Save size={17} />
                Сохранить
              </button>
            </div>
          </section>
        ) : (
          <EmptyState title="Квизов пока нет" action="Создать квиз" onAction={onCreate} />
        )}
      </div>
    </>
  );
}

function QuizBasics({ quiz, onChange }) {
  function update(field, value) {
    onChange({ ...quiz, [field]: value });
  }

  return (
    <div className="basics-grid">
      <label className="wide">
        Название
        <input value={quiz.title} onChange={(event) => update('title', event.target.value)} />
      </label>
      <label>
        Категория
        <input value={quiz.category} onChange={(event) => update('category', event.target.value)} />
      </label>
      <label>
        Таймер
        <input type="number" min="5" value={quiz.timeLimit} onChange={(event) => update('timeLimit', event.target.value)} />
      </label>
      <label>
        Баллы
        <input
          type="number"
          min="1"
          value={quiz.pointsPerQuestion}
          onChange={(event) => update('pointsPerQuestion', event.target.value)}
        />
      </label>
      <label className="wide">
        Описание
        <textarea value={quiz.description} onChange={(event) => update('description', event.target.value)} />
      </label>
    </div>
  );
}

function QuestionBuilder({ quiz, onChange }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = quiz.questions[activeIndex] || quiz.questions[0];

  function updateQuestion(nextQuestion) {
    const questions = quiz.questions.map((question, index) => (index === activeIndex ? nextQuestion : question));
    onChange({ ...quiz, questions });
  }

  function addQuestion() {
    onChange({ ...quiz, questions: [...quiz.questions, blankQuestion()] });
    setActiveIndex(quiz.questions.length);
  }

  if (!active) return null;

  return (
    <div className="question-layout">
      <div className="question-tabs">
        {quiz.questions.map((question, index) => (
          <button key={`${question.prompt}-${index}`} className={index === activeIndex ? 'active' : ''} onClick={() => setActiveIndex(index)}>
            {index + 1}
          </button>
        ))}
        <button onClick={addQuestion} title="Добавить вопрос">
          <Plus size={16} />
        </button>
      </div>

      <div className="question-card">
        <div className="question-toolbar">
          <div className="segmented compact">
            <button
              className={active.type === 'single' ? 'active' : ''}
              onClick={() => updateQuestion({ ...active, type: 'single' })}
            >
              Одиночный выбор
            </button>
            <button
              className={active.type === 'multiple' ? 'active' : ''}
              onClick={() => updateQuestion({ ...active, type: 'multiple' })}
            >
              Множественный выбор
            </button>
          </div>
          <span><ImageIcon size={16} /> Изображение опционально</span>
        </div>
        <label>
          Текст вопроса
          <textarea value={active.prompt} onChange={(event) => updateQuestion({ ...active, prompt: event.target.value })} />
        </label>
        <label>
          URL изображения
          <input value={active.imageUrl} onChange={(event) => updateQuestion({ ...active, imageUrl: event.target.value })} />
        </label>

        <div className="options-grid">
          {active.options.map((option, index) => (
            <label className="option-edit" key={`${option.label}-${index}`}>
              <input
                type={active.type === 'single' ? 'radio' : 'checkbox'}
                checked={option.isCorrect}
                onChange={(event) => {
                  const options = active.options.map((current, optionIndex) => ({
                    ...current,
                    isCorrect:
                      active.type === 'single'
                        ? optionIndex === index
                        : optionIndex === index
                          ? event.target.checked
                          : current.isCorrect,
                  }));
                  updateQuestion({ ...active, options });
                }}
              />
              <input
                value={option.label}
                onChange={(event) => {
                  const options = active.options.map((current, optionIndex) =>
                    optionIndex === index ? { ...current, label: event.target.value } : current,
                  );
                  updateQuestion({ ...active, options });
                }}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function LiveRoom({ role, quiz, state, onShowQuestion, onFinish }) {
  if (!state) {
    return (
      <>
        <Header title="Комната" subtitle="Запустите квиз из редактора, чтобы получить код комнаты." />
        <EmptyState title="Активной комнаты нет" action="Перейти к квизам" />
      </>
    );
  }

  const questionNumber = state.session.current_question_index + 1;

  return (
    <>
      <Header
        title={`Комната ${state.session.room_code}`}
        subtitle={`${state.quiz.title} · ${state.quiz.questionCount} вопросов`}
        actions={
          role === 'organizer' && (
            <>
              <button className="secondary-button" onClick={() => navigator.clipboard?.writeText(state.session.room_code)}>
                <Copy size={17} />
                Скопировать код
              </button>
              <button className="danger-button" onClick={onFinish}>
                Завершить
              </button>
            </>
          )
        }
      />
      <div className="live-grid">
        <section className="panel live-stage">
          <div className="status-line">
            <span className={`status-dot ${state.session.status}`} />
            {state.session.status === 'lobby' && 'Ожидание участников'}
            {state.session.status === 'question' && `Вопрос ${questionNumber} из ${state.quiz.questionCount}`}
            {state.session.status === 'finished' && 'Квиз завершен'}
          </div>

          {state.session.status === 'finished' ? (
            <FinalResults players={state.players} />
          ) : state.currentQuestion ? (
            <QuestionPreview question={state.currentQuestion} />
          ) : (
            <div className="join-code">
              <span>Код комнаты</span>
              <strong>{state.session.room_code}</strong>
            </div>
          )}

          {role === 'organizer' && state.session.status !== 'finished' && (
            <HostControls
              state={state}
              onShowQuestion={onShowQuestion}
              onFinish={onFinish}
            />
          )}
        </section>
        {state.session.status === 'finished' ? (
          <Leaderboard players={state.players} />
        ) : (
          <RoomParticipants players={state.players} />
        )}
      </div>
    </>
  );
}

function HostControls({ state, onShowQuestion, onFinish }) {
  const currentIndex = state.session.current_question_index;
  const hasStarted = state.session.status === 'question';
  const hasNext = currentIndex + 1 < state.quiz.questionCount;

  if (!hasStarted) {
    return (
      <div className="host-controls">
        <button className="primary-button" onClick={() => onShowQuestion(0)}>
          <Play size={17} />
          Начать квиз
        </button>
      </div>
    );
  }

  return (
    <div className="host-controls">
      {hasNext ? (
        <button className="primary-button" onClick={() => onShowQuestion(currentIndex + 1)}>
          Следующий вопрос
          <ChevronRight size={17} />
        </button>
      ) : (
        <button className="danger-button" onClick={onFinish}>
          Завершить и показать результаты
        </button>
      )}
    </div>
  );
}

function FinalResults({ players }) {
  const winner = players[0];

  return (
    <div className="final-results">
      <Trophy size={42} />
      <h2>Квиз завершен</h2>
      {winner ? (
        <p>Победитель: {winner.display_name}, {winner.score} баллов</p>
      ) : (
        <p>Участники не отправили ответы.</p>
      )}
    </div>
  );
}

function QuestionPreview({ question, onAnswer, selectedIds = [], disabled = false }) {
  function toggle(optionId) {
    if (question.type === 'single') onAnswer?.([optionId]);
    else {
      onAnswer?.(selectedIds.includes(optionId) ? selectedIds.filter((id) => id !== optionId) : [...selectedIds, optionId]);
    }
  }

  return (
    <div className="question-preview">
      {question.image_url && <img src={question.image_url} alt="" />}
      <h2>{question.prompt}</h2>
      <div className="answer-list">
        {question.options.map((option) => (
          <button
            key={option.id}
            className={selectedIds.includes(option.id) ? 'selected' : ''}
            disabled={disabled}
            onClick={() => toggle(option.id)}
          >
            <span>{selectedIds.includes(option.id) && <Check size={16} />}</span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Leaderboard({ players }) {
  return (
    <section className="panel leaderboard">
      <div className="panel-title">
        <Trophy size={18} />
        <strong>Лидерборд</strong>
      </div>
      {players.length === 0 ? (
        <p className="muted">Участники появятся после подключения.</p>
      ) : (
        players.map((player, index) => (
          <div className="leader-row" key={player.id}>
            <span>{index + 1}</span>
            <strong>{player.display_name}</strong>
            <em>{player.score}</em>
          </div>
        ))
      )}
    </section>
  );
}

function RoomParticipants({ players }) {
  return (
    <section className="panel leaderboard">
      <div className="panel-title">
        <UsersRound size={18} />
        <strong>Участники</strong>
      </div>
      {players.length === 0 ? (
        <p className="muted">Участники появятся после подключения.</p>
      ) : (
        players.map((player, index) => (
          <div className="leader-row participant-row" key={player.id}>
            <span>{index + 1}</span>
            <strong>{player.display_name}</strong>
          </div>
        ))
      )}
    </section>
  );
}

function ParticipantDashboard({ user, view, setView }) {
  const [roomCode, setRoomCode] = useState('4821');
  const [displayName, setDisplayName] = useState(user.name);
  const [player, setPlayer] = useState(null);
  const [state, setState] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [submittedQuestionId, setSubmittedQuestionId] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api('/api/dashboard').then((data) => {
      setHistory(data.items);
      setStats(data.stats);
    });
  }, []);

  useEffect(() => {
    if (!state?.session?.room_code) return undefined;
    const socket = getSocket();
    socket.on('room:state', (nextState) => {
      setState(nextState);
      if (nextState.currentQuestion?.id !== submittedQuestionId) {
        setSelectedIds([]);
        setSubmittedQuestionId(null);
      }
    });
    return () => socket.off('room:state');
  }, [state?.session?.room_code, submittedQuestionId]);

  async function joinRoom(event) {
    event.preventDefault();
    setMessage('');
    try {
      const data = await api(`/api/sessions/${roomCode}/join`, {
        method: 'POST',
        body: JSON.stringify({ displayName }),
      });
      setPlayer(data.player);
      setState(data.state);
      setView('live');
      getSocket().emit('room:join', { roomCode, displayName }, () => {});
    } catch (error) {
      setMessage(error.message);
    }
  }

  function submitAnswer() {
    if (!state?.currentQuestion || !player) return;
    getSocket().emit(
      'answer:submit',
      {
        roomCode: state.session.room_code,
        questionId: state.currentQuestion.id,
        playerId: player.id,
        selectedOptionIds: selectedIds,
      },
      (reply) => {
        if (reply.ok) {
          if (reply.state.currentQuestion?.id !== state.currentQuestion.id) {
            setSelectedIds([]);
            setSubmittedQuestionId(null);
          } else {
            setSubmittedQuestionId(state.currentQuestion.id);
          }
          setState(reply.state);
        } else {
          setMessage(reply.message);
        }
      },
    );
  }

  const liveView = (
    <>
      <Header title="Комната" subtitle="Подключитесь по коду или отвечайте на текущий вопрос." />
      {!state ? (
        <form className="join-panel panel" onSubmit={joinRoom}>
          <label>
            Код комнаты
            <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="4821" />
          </label>
          <label>
            Имя в игре
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          {message && <p className="form-error">{message}</p>}
          <button className="primary-button" type="submit">
            <DoorOpen size={17} />
            Подключиться
          </button>
        </form>
      ) : (
        <div className="live-grid">
          <section className="panel live-stage">
            <div className="status-line">
              <span className={`status-dot ${state.session.status}`} />
              {state.session.status === 'lobby' && 'Ждем первый вопрос'}
              {state.session.status === 'question' && 'Вопрос открыт'}
              {state.session.status === 'finished' && 'Квиз завершен'}
            </div>
            {state.session.status === 'finished' ? (
              <FinalResults players={state.players} />
            ) : state.currentQuestion ? (
              <>
                <QuestionPreview
                  question={state.currentQuestion}
                  selectedIds={selectedIds}
                  onAnswer={setSelectedIds}
                  disabled={submittedQuestionId === state.currentQuestion.id}
                />
                <button
                  className="primary-button answer-submit"
                  disabled={selectedIds.length === 0 || submittedQuestionId === state.currentQuestion.id}
                  onClick={submitAnswer}
                >
                  Отправить ответ
                </button>
              </>
            ) : (
              <div className="join-code">
                <span>Вы в комнате</span>
                <strong>{state.session.room_code}</strong>
              </div>
            )}
          </section>
          {state.session.status === 'finished' ? (
            <Leaderboard players={state.players} />
          ) : (
            <RoomParticipants players={state.players} />
          )}
        </div>
      )}
    </>
  );

  const content = {
    live: liveView,
    history: <HistoryView stats={stats} items={history} role="participant" />,
  };

  return content[view] ?? liveView;
}

function HistoryView({ stats, items, role }) {
  return (
    <>
      <Header title="История" subtitle="Сохраненные результаты и проведенные квизы." />
      <div className="stats-row">
        <Metric icon={BarChart3} label={role === 'organizer' ? 'Квизов' : 'Участий'} value={stats?.quizzes ?? stats?.sessions ?? 0} />
        <Metric icon={UsersRound} label="Сессий" value={stats?.sessions ?? 0} />
        <Metric icon={Trophy} label={role === 'organizer' ? 'Баллов начислено' : 'Лучший счет'} value={stats?.totalScore ?? stats?.bestScore ?? 0} />
      </div>
      <section className="panel history-table">
        {items.length === 0 ? (
          <p className="muted">История появится после первых запусков.</p>
        ) : (
          items.map((item, index) => (
            <div className="history-row" key={`${item.id || item.room_code}-${index}`}>
              <strong>{item.title}</strong>
              <span>{item.category || item.room_code}</span>
              <em>{item.status}</em>
            </div>
          ))
        )}
      </section>
    </>
  );
}

function Header({ title, subtitle, actions }) {
  return (
    <header className="workspace-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="metric panel">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ title, action, onAction }) {
  return (
    <section className="panel empty-state">
      <Settings2 size={28} />
      <h2>{title}</h2>
      {onAction && <button className="secondary-button" onClick={onAction}>{action}</button>}
    </section>
  );
}

function normalizeQuiz(quiz) {
  return {
    ...quiz,
    timeLimit: quiz.time_limit ?? quiz.timeLimit ?? 30,
    pointsPerQuestion: quiz.points_per_question ?? quiz.pointsPerQuestion ?? 100,
    questions: (quiz.questions?.length ? quiz.questions : [blankQuestion()]).map((question) => ({
      ...question,
      imageUrl: question.image_url ?? question.imageUrl ?? '',
      options: question.options.map((option) => ({
        ...option,
        isCorrect: Boolean(option.is_correct ?? option.isCorrect),
      })),
    })),
  };
}
