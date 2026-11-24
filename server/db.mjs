import pg from 'pg';
import { readFile } from 'node:fs/promises';

export async function migrate(db) {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await db.transaction(client => client.exec(sql));
}
export const schemaQuery = sql => sql.replace(/\bslx_(?!private\b)[a-z_]+\b/g, name => 'slx_private.' + name);

export function openPostgres(connectionString = process.env.SLX_DATABASE_URL) {
  if (!connectionString) return null;
  const pool = new pg.Pool({ connectionString, max: 3, idleTimeoutMillis: 5000, connectionTimeoutMillis: 5000 });
  pool.on('error', error => console.error('SLX database connection error:', error.code ?? error.name));
  return {
    query: (sql, values) => pool.query(schemaQuery(sql), values),
    close: () => pool.end(),
    async transaction(run) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await run({
          query: (sql, values) => client.query(schemaQuery(sql), values),
          exec: sql => client.query(sql),
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  };
}
