import { openPostgres, previewDatabase } from '../server/db.mjs';
import { commerce } from '../server/commerce.mjs';
import { supabase } from '../server/supabase.mjs';
import { previewAuth } from '../server/preview-auth.mjs';

const preview = process.env.VERCEL_ENV === 'preview';
const db = preview ? previewDatabase() : openPostgres();
export default { fetch: commerce({
  db,
  auth:preview ? previewAuth(db) : supabase(),
  local:!process.env.VERCEL && process.env.NODE_ENV!=='production',
}) };
