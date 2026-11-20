import { createApp } from './app.js';
import { connectPool } from './pool.js';
import { listenHost, sharedAuth } from './standard/auth.js';

const pool = connectPool(process.env.DATABASE_URL);
const port = Number(process.env.PORT ?? 3104);
// The shared sign-in guards /api; without it the API listens on 127.0.0.1 only (project-standards#866, #898).
const auth = sharedAuth();
const server = createApp(pool, {
  auth,
  toolsPublicKey: process.env.AI_TOOLS_PUBLIC_KEY,
}).listen(port, listenHost(auth !== undefined), () => console.log(`API http://localhost:${port}`));
process.on('SIGTERM', () =>
  server.close(() => {
    void pool.end();
  }),
);
