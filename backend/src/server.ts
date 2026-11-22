import { createApp } from './app.js';
import { connectPool } from './pool.js';
import { listenHost, sharedAuth } from './standard/auth.js';

const pool = connectPool(process.env.DATABASE_URL);
const port = Number(process.env.PORT ?? 3104);
// The shared sign-in guards /api; without it the API listens on 127.0.0.1 only (project-standards#866, #898).
const auth = sharedAuth();
const host = listenHost(auth !== undefined);
const server = createApp(pool, {
  auth,
  toolsPublicKey: process.env.AI_TOOLS_PUBLIC_KEY,
}).listen(port, host, () => {
  // #141: one line that says where the API really listens and whether the sign-in guards it.
  const address = server.address();
  const bound = address && typeof address === 'object' ? address : { address: host, port };
  console.log(
    JSON.stringify({
      event: 'api_listening',
      host: bound.address,
      port: bound.port,
      signIn: auth !== undefined,
    }),
  );
});
process.on('SIGTERM', () =>
  server.close(() => {
    void pool.end();
  }),
);
