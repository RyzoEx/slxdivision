import { authCookie, createSession, emailAddress, hashToken, isAdmin, requireThat, sessionToken, staffRoles, throttle } from './security.mjs';
import { audit, uuid } from './orders.mjs';

function verified(identity, email) {
  requireThat(uuid(identity?.id) && identity?.email_confirmed_at && identity.email?.toLowerCase() === email,401,'Підтвердьте email.');
  return identity.id;
}

export async function login(db, auth, data, ip, secure) {
  const email = emailAddress(data.email);
  await throttle(db,`admin-ip:${ip}`,25,15);
  await throttle(db,`admin-email:${email}`,8,15);
  requireThat(typeof data.password === 'string' && data.password.length > 0 && data.password.length <= 128,400,'Перевірте пароль.');
  const user = (await db.query("SELECT id,email,role FROM slx_users WHERE email=$1 AND active AND role<>'customer'",[email])).rows[0];
  const identity = await auth.password(email,data.password);
  requireThat(user?.id === verified(identity,email) && isAdmin(user),403,'Адміністративний доступ недоступний.');
  const cookie = await createSession(db,user,secure);
  await audit(db,user,'admin.login',user.id);
  return cookie;
}
export async function requestOtp(db, auth, data, ip) {
  const email = emailAddress(data.email);
  await throttle(db,`otp-ip:${ip}`,20,15);
  await throttle(db,`otp-email:${email}`,4,15);
  const staff = (await db.query("SELECT 1 FROM slx_users WHERE email=$1 AND role<>'customer'",[email])).rows[0];
  if (!staff) await auth.otp(email);
}
export async function verifyOtp(db, auth, data, ip, secure) {
  const email = emailAddress(data.email);
  await throttle(db,`verify-ip:${ip}`,25,15);
  await throttle(db,`verify-email:${email}`,8,15);
  requireThat(typeof data.code === 'string' && /^\d{6,8}$/.test(data.code.trim()),400,'Введіть код з листа.');
  const id = verified(await auth.verify(email,data.code.trim()),email);
  const {rows} = await db.query(`INSERT INTO slx_users(id,email,role) VALUES ($1,$2,'customer')
    ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email WHERE slx_users.role='customer' AND slx_users.active
    RETURNING id,email,role`,[id,email]);
  requireThat(rows[0],403,'Вхід в обліковий запис недоступний.');
  return createSession(db,rows[0],secure);
}
export async function logout(db, request, secure) {
  const session = sessionToken(request,secure);
  if (session) await db.query('DELETE FROM slx_sessions WHERE token_hash=$1',[hashToken(session)]);
  return authCookie(secure,'');
}
export async function changeRole(db, actor, data) {
  requireThat(uuid(data.id) && data.id !== actor.id,400,'Власний доступ тут не змінюється.');
  requireThat(staffRoles.includes(data.role) && data.role!=='owner' && typeof data.active === 'boolean',400,'Некоректний рівень доступу.');
  return db.transaction(async tx => {
    const { rows } = await tx.query(`UPDATE slx_users SET role=$2,active=$3 WHERE id=$1
      AND role IN ('manager','operator','editor','analyst') RETURNING id,email,role,active`,[data.id,data.role,data.active]);
    requireThat(rows[0],404,'Працівника не знайдено.');
    await tx.query('DELETE FROM slx_sessions WHERE user_id=$1',[data.id]);
    await audit(tx,actor,'staff.update',data.id);
    return rows[0];
  });
}
