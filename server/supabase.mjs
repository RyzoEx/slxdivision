import { Failure, requireThat } from './security.mjs';

export function supabase(env = process.env, fetcher = fetch) {
  const address = env.SLX_SUPABASE_URL;
  const authKey = env.SLX_SUPABASE_ANON_KEY;
  const secret = env.SLX_SUPABASE_SERVICE_ROLE_KEY;
  const bucket = env.SLX_STORAGE_BUCKET;
  function endpoint(route) {
    requireThat(address?.startsWith('https://'), 503, 'Supabase ще не налаштовано.');
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
        method:'POST', headers:{ apikey:secret, Authorization:`Bearer ${secret}`, 'Content-Type':type },
        body: bytes, redirect:'error', signal:AbortSignal.timeout(12000),
      });
      requireThat(result.ok, 502, 'Не вдалося зберегти зображення.');
    },
    download(key) {
      return fetcher(storageURL(key), {
        headers:{ apikey:secret, Authorization:`Bearer ${secret}` }, redirect:'error', signal:AbortSignal.timeout(8000),
      });
    },
  };
}
