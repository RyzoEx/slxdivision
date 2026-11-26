import { openPostgres, previewDatabase, migrate } from './db.mjs';
import { provisionPreviewStaff } from './preview-auth.mjs';
import { emailAddress, staffRoles } from './security.mjs';
import { uuid } from './orders.mjs';
import { supabaseConfig, supabaseServerHeaders } from './supabase.mjs';

const [action,id,email,role] = process.argv.slice(2);
const preview = ['migrate-preview','staff-preview'].includes(action);
if (preview && !process.env.SLX_DATABASE_URL) throw new Error('Set the existing SLX_DATABASE_URL locally to check isolation.');
const db = preview ? previewDatabase() : openPostgres();
if (!db) throw new Error(`Set ${preview ? 'SLX_PREVIEW_DATABASE_URL' : 'SLX_DATABASE_URL'} before running setup.`);
try {
  if (action==='staff-preview') {
    await provisionPreviewStaff(db,id,email,process.env.SLX_PREVIEW_STAFF_PASSWORD);
    console.log('SLX Preview staff account ready.');
  } else if (action==='migrate' || preview) {
    await migrate(db);
    console.log(preview ? 'SLX Preview database schema ready.' : 'SLX private database schema ready.');
  } else if (action==='staff' && uuid(id) && staffRoles.includes(role)) {
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
  } else throw new Error('Usage: setup.mjs migrate | migrate-preview | staff-preview <email> <owner|manager|operator> | staff <Supabase UID> <email> <owner|manager|operator>');
} finally { await db.close(); }
