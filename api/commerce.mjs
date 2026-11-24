import { openPostgres } from '../server/db.mjs';
import { commerce } from '../server/commerce.mjs';
import { supabase } from '../server/supabase.mjs';

export default { fetch: commerce({ db:openPostgres(), auth:supabase(), local:!process.env.VERCEL && process.env.NODE_ENV!=='production' }) };
