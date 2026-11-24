import { openPostgres, migrate } from './db.mjs';
import { emailAddress } from './security.mjs';
import { uuid } from './orders.mjs';

const [action,id,email,role] = process.argv.slice(2);
const db = openPostgres();
if (!db) throw new Error('Set SLX_DATABASE_URL before running setup.');
try {
  if (action==='migrate') {
    await migrate(db);
    console.log('SLX private database schema ready.');
  } else if (action==='staff' && uuid(id) && ['owner','manager','operator'].includes(role)) {
    const expected = emailAddress(email);
    const key = process.env.SLX_SUPABASE_SERVICE_ROLE_KEY;
    const host = process.env.SLX_SUPABASE_URL;
    if (!key || !host?.startsWith('https://')) throw new Error('Supabase URL and service role key are required for account verification.');
    const response = await fetch(new URL(`/auth/v1/admin/users/${id}`,host), {
      headers:{apikey:key,Authorization:`Bearer ${key}`},redirect:'error',signal:AbortSignal.timeout(8000),
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
  } else throw new Error('Usage: setup.mjs migrate | staff <Supabase UID> <email> <owner|manager|operator>');
} finally { await db.close(); }
