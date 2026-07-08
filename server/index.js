import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import { authRouter } from './authStore.js';
import { migrate } from './db.js';
import { apiRoutes, errorHandler } from './routesStore.js';
import { setupSockets } from './socketStore.js';

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 4000);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173';

migrate();

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));

authRouter(app);
apiRoutes(app);
app.use(errorHandler);

const io = new Server(server, {
  cors: { origin: clientOrigin, credentials: true },
});

setupSockets(io);

server.listen(port, () => {
  console.log(`Quiz Studio API listening on http://127.0.0.1:${port}`);
});
