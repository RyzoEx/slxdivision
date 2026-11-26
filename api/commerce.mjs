import { openPostgres } from '../server/db.mjs';
import { commerce } from '../server/commerce.mjs';
import { supabase } from '../server/supabase.mjs';

const preview = process.env.VERCEL_ENV === 'preview';
export default { fetch: commerce({
  db:openPostgres(preview ? process.env.SLX_PREVIEW_DATABASE_URL || null : process.env.SLX_DATABASE_URL || null),
  auth:supabase(preview ? {} : process.env),
  local:!process.env.VERCEL && process.env.NODE_ENV!=='production',
}) };
