import { createHash, randomBytes, randomUUID } from 'node:crypto';
const maxBody = 32 * 1024;
const adminRoles = new Set(['owner', 'manager', 'operator']);

export const hashToken = text => createHash('sha256').update(text).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export const isAdmin = user => adminRoles.has(user?.role);
export const newId = randomUUID;
export class Failure extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireThat(condition, status, message) {
  if (!condition) throw new Failure(status, message);
}
export function emailAddress(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const [local,domain] = email.split('@');
  requireThat(email.length<=180 && local.length<=64 && /^[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*$/.test(local)
    && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain ?? '')
    && email === `${local}@${domain}`,400,'Вкажіть коректний email.');
  return email;
}
export function text(value, limit, required = false) {
  if (value === undefined && !required) return '';
  requireThat(typeof value === 'string' && value.trim().length <= limit && (!required || value.trim()), 400, 'Перевірте текстові поля.');
  return value.trim();
}
export function money(value, nullable = false) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  requireThat(Number.isSafeInteger(value) && value >= 0 && value <= 100000000, 400, 'Некоректна сума. Вкажіть її в копійках.');
  return value;
}
export function basisPoints(value) {
  requireThat(Number.isInteger(value) && value >= 0 && value <= 10000, 400, 'Відсоток має бути від 0 до 100.');
  return value;
}
export function authCookie(secure, value, age = 0) {
  const name = secure ? '__Host-slx_session' : 'slx_session';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`;
}
export function sessionToken(request, secure) {
  const name = secure ? '__Host-slx_session' : 'slx_session';
  return request.headers.get('cookie')?.split(/;\s*/).find(pair => pair.startsWith(name + '='))?.slice(name.length + 1) ?? '';
}
export async function currentUser(db, request, secure) {
  const session = sessionToken(request, secure);
  if (!/^[A-Za-z0-9_-]{43}$/.test(session)) return null;
  const { rows } = await db.query(`SELECT u.id,u.email,u.role FROM slx_sessions s JOIN slx_users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`, [hashToken(session)]);
  return rows[0] ?? null;
}
export async function createSession(db, user, secure) {
  const value = token();
  const age = isAdmin(user) ? 8 * 3600 : 7 * 86400;
  await db.query(`INSERT INTO slx_sessions VALUES ($1,$2,now()+($3::int * interval '1 second'))`, [hashToken(value), user.id, age]);
  return authCookie(secure, value, age);
}
export async function throttle(db, label, count, minutes) {
  const { rows } = await db.query(`INSERT INTO slx_rate VALUES ($1,1,now()+($2::int * interval '1 minute'))
    ON CONFLICT(key) DO UPDATE SET
    count=CASE WHEN slx_rate.until_at<now() THEN 1 ELSE slx_rate.count+1 END,
    until_at=CASE WHEN slx_rate.until_at<now() THEN EXCLUDED.until_at ELSE slx_rate.until_at END RETURNING count`,
  [hashToken(label), minutes]);
  requireThat(rows[0].count <= count, 429, 'Забагато спроб. Повторіть пізніше.');
}
export async function readJson(request, limit = maxBody) {
  requireThat(request.headers.get('content-type')?.split(';')[0] === 'application/json', 415, 'Потрібен JSON.');
  requireThat(Number(request.headers.get('content-length') ?? 0) <= limit && request.body, 413, 'Запит завеликий.');
  const reader = request.body.getReader();
  const parts = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new Failure(413, 'Запит завеликий.');
      }
      parts.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  let data;
  try { data = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch {}
  requireThat(data && typeof data === 'object' && !Array.isArray(data), 400, 'Некоректний JSON.');
  return data;
}
