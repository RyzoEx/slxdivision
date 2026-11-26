import pg from 'pg';
import { readFile } from 'node:fs/promises';

export async function migrate(db) {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await db.transaction(client => client.exec(sql));
}
export const schemaQuery = sql => sql.replace(/\bslx_(?!private\b)[a-z_]+\b/g, name => 'slx_private.' + name);

export function databaseTarget(connectionString) {
  let url;
  try { url = new URL(connectionString); } catch {}
  if (!url || !['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('Set a valid PostgreSQL connection URL.');
  }
  const host = url.hostname.toLowerCase();
  const project = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(host)?.[1]
    ?? (host.endsWith('.pooler.supabase.com') ? /\.([a-z0-9]+)$/.exec(url.username)?.[1] : null);
  return project ? `supabase:${project}` : host.replace(/-pooler(?=\..*\.neon\.tech$)/, '');
}

export function previewDatabase(env = process.env) {
  const connectionString = env.SLX_PREVIEW_DATABASE_URL;
  if (!connectionString || (env.VERCEL && env.VERCEL_GIT_COMMIT_REF !== 'codex/backend-infrastructure')) return null;
  const target = databaseTarget(connectionString);
  if (env.SLX_DATABASE_URL && target === databaseTarget(env.SLX_DATABASE_URL)) {
    throw new Error('Preview must use a different PostgreSQL instance from production.');
  }
  if (!target.endsWith('.neon.tech')) throw new Error('Preview requires a dedicated Neon endpoint.');
  return openPostgres(connectionString, {verifyTLS:true});
}

export function openPostgres(connectionString = process.env.SLX_DATABASE_URL, {verifyTLS=false} = {}) {
  if (!connectionString) return null;
  const config = { connectionString, max: 3, idleTimeoutMillis: 5000, connectionTimeoutMillis: 5000 };
  const encodedCa = verifyTLS ? '' : process.env.SLX_DATABASE_CA_BASE64?.trim();
  if (encodedCa || verifyTLS) {
    const url = new URL(connectionString);
    // node-postgres otherwise lets URL SSL parameters replace the supplied CA.
    for (const option of ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey']) {
      url.searchParams.delete(option);
    }
    config.connectionString = url.toString();
    config.ssl = { rejectUnauthorized:true, ...(encodedCa ? {ca:Buffer.from(encodedCa,'base64').toString('utf8')} : {}) };
  }
  const pool = new pg.Pool(config);
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
