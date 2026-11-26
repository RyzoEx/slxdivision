import { openPostgres, migrate } from './db.mjs';
import { emailAddress } from './security.mjs';
import { uuid } from './orders.mjs';
import { supabaseConfig, supabaseServerHeaders } from './supabase.mjs';

const [action,id,email,role] = process.argv.slice(2);
const preview = action === 'migrate-preview';

function databaseTarget(connectionString) {
  let url;
  try { url = new URL(connectionString); } catch {}
  if (!url || !['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('Set a valid PostgreSQL connection URL.');
  }
  const host = url.hostname.toLowerCase();
  const project = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(host)?.[1]
    ?? (host.endsWith('.pooler.supabase.com') ? /\.([a-z0-9]+)$/.exec(url.username)?.[1] : null);
  return project ? `supabase:${project}` : host;
}

const productionUrl = process.env.SLX_DATABASE_URL;
const previewUrl = process.env.SLX_PREVIEW_DATABASE_URL;
if (preview) {
  if (!previewUrl || !productionUrl) {
    throw new Error('Set SLX_PREVIEW_DATABASE_URL and the existing SLX_DATABASE_URL locally to check isolation.');
  }
  if (databaseTarget(previewUrl) === databaseTarget(productionUrl)) {
    throw new Error('Preview must use a different PostgreSQL instance from production.');
  }
}
const db = openPostgres(preview ? previewUrl : productionUrl);
if (!db) throw new Error('Set SLX_DATABASE_URL before running setup.');
try {
  if (action==='migrate' || preview) {
    await migrate(db);
    console.log(preview ? 'SLX Preview database schema ready.' : 'SLX private database schema ready.');
  } else if (action==='staff' && uuid(id) && ['owner','manager','operator'].includes(role)) {
    const expected = emailAddress(email);
    const { secret:key, address:host } = supabaseConfig();
    if (!key || !host) throw new Error('Supabase URL and server secret key are required for account verification.');
    const response = await fetch(new URL(`/auth/v1/admin/users/${id}`,host), {
      headers:supabaseServerHeaders(key),redirect:'error',signal:AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Unable to verify the Supabase user.');
    const identity = await response.json();
    if (identity.id!==id || identity.email?.toLowerCase()!==expected || !identity.email_confirmed_at) {
      throw new Error('Use the UID of a confirmed Supabase user with a matching email.');
    }
    await db.transaction(async tx => {
      await tx.query('INSERT INTO slx_users(id,email,role) VALUES ($1,$2,$3)',[id,expected,role]);
      await tx.query("INSERT INTO slx_audit(action,subject) VALUES ('staff.provision',$1)",[id]);
    });
    console.log('SLX staff account linked.');
  } else throw new Error('Usage: setup.mjs migrate | migrate-preview | staff <Supabase UID> <email> <owner|manager|operator>');
} finally { await db.close(); }
