import { Failure, requireThat } from './security.mjs';

export function supabaseConfig(env = process.env) {
  let address;
  try {
    const url = new URL(env.SLX_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL);
    if (url.protocol === 'https:' && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash) {
      address = url.origin;
    }
  } catch {}
  return {
    address,
    authKey: env.SLX_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SLX_SUPABASE_ANON_KEY,
    secret: env.SLX_SUPABASE_SECRET_KEY || env.SLX_SUPABASE_SERVICE_ROLE_KEY,
  };
}

export const supabaseServerHeaders = key => ({
  apikey: key,
  ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }),
});

export function supabase(env = process.env, fetcher = fetch) {
  const { address, authKey, secret } = supabaseConfig(env);
  const bucket = env.SLX_STORAGE_BUCKET;
  function endpoint(route) {
    requireThat(address, 503, 'Supabase ще не налаштовано.');
    return new URL(route, address);
  }
  async function auth(route, data) {
    requireThat(authKey, 503, 'Вхід ще не налаштовано.');
    const result = await fetcher(endpoint(`/auth/v1/${route}`), {
      method:'POST', headers:{ apikey:authKey, 'Content-Type':'application/json' },
      body: JSON.stringify(data), redirect:'error', signal:AbortSignal.timeout(8000),
    });
    if (!result.ok) throw new Failure(result.status === 429 ? 429 : 401, 'Не вдалося підтвердити вхід. Перевірте дані або повторіть пізніше.');
    return result.json();
  }
  function storageURL(key) {
    requireThat(secret && /^[a-z0-9-]+$/.test(bucket ?? ''), 503, 'Storage ще не налаштовано.');
    return endpoint(`/storage/v1/object/${bucket}/${key}`);
  }
  return {
    authReady: Boolean(address && authKey),
    storageReady: Boolean(address && secret && bucket),
    async password(email, password) {
      const result = await auth('token?grant_type=password', {email,password});
      return result.user;
    },
    otp: email => auth('otp', { email, create_user:true }),
    async verify(email, code) {
      const result = await auth('verify', { email, token:code, type:'email' });
      return result.user;
    },
    async upload(key, type, bytes) {
      const result = await fetcher(storageURL(key), {
        method:'POST', headers:{ ...supabaseServerHeaders(secret), 'Content-Type':type },
        body: bytes, redirect:'error', signal:AbortSignal.timeout(12000),
      });
      requireThat(result.ok, 502, 'Не вдалося зберегти зображення.');
    },
    download(key) {
      const url = storageURL(key);
      url.pathname = url.pathname.replace('/object/','/object/authenticated/');
      return fetcher(url, {
        headers:supabaseServerHeaders(secret), redirect:'error', signal:AbortSignal.timeout(8000),
      });
    },
  };
}
