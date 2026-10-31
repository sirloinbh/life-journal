import { Pool } from 'pg';

export function createPool(connectionString: string | undefined) {
  const pool = new Pool({ connectionString });
  // An idle connection can drop when the DB restarts. Without a listener that ends the process;
  // the pool replaces the connection by itself, so logging is enough.
  pool.on('error', (error) => {
    console.error(JSON.stringify({ event: 'db_pool_error', message: error.message }));
  });
  return pool;
}
