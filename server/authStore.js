import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { nextId, now, save, store } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  role: z.enum(['organizer', 'participant']),
});

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

export function signUser(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export function authRouter(app) {
  app.post('/api/auth/register', (req, res) => {
    const input = registerSchema.parse(req.body);
    const exists = store.users.some((user) => user.email === input.email);

    if (exists) {
      res.status(409).json({ message: 'Пользователь с таким email уже существует' });
      return;
    }

    const user = {
      id: nextId('users'),
      name: input.name,
      email: input.email,
      password_hash: bcrypt.hashSync(input.password, 10),
      role: input.role,
      created_at: now(),
    };
    store.users.push(user);
    save();
    res.status(201).json({ token: signUser(user), user: publicUser(user) });
  });

  app.post('/api/auth/login', (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = store.users.find((item) => item.email === input.email);

    if (!user || !bcrypt.compareSync(input.password, user.password_hash)) {
      res.status(401).json({ message: 'Неверный email или пароль' });
      return;
    }

    res.json({ token: signUser(user), user: publicUser(user) });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ message: 'Нужна авторизация' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = store.users.find((item) => item.id === payload.id);
    if (!user) {
      res.status(401).json({ message: 'Пользователь не найден' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Сессия недействительна' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      res.status(403).json({ message: 'Недостаточно прав' });
      return;
    }
    next();
  };
}
