import { createHmac } from 'node:crypto';
import { emailAddress, hashToken, newId, requireThat, text, throttle, token } from './security.mjs';
import { catalog, audit } from './orders.mjs';
import { launchMail, launchMailReady } from './launch-mail.mjs';

export async function interest(db, data, ip) {
  const email = emailAddress(data.email);
  await throttle(db,`interest-ip:${ip}`,30,15);
  await throttle(db,`interest-email:${email}`,8,15);
  const product = text(data.product,65,true);
  const size = text(data.size,50);
  const color = text(data.color,50);
  if (product !== 'newsletter') {
    const item = (await catalog(db)).find(row => row.id === product && row.status === 'coming-soon');
    requireThat(item && (!size || item.sizes.includes(size)) && (!color || item.colors.includes(color)),400,'Перевірте річ, розмір і колір.');
  } else requireThat(!size && !color,400,'Некоректний запит.');
  await db.query(`INSERT INTO slx_interests(id,email,product,size,color,unsubscribe_hash,delivery_key,status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
    ON CONFLICT(email,product,size,color) DO UPDATE SET status='pending',sent_at=NULL,
      unsubscribe_hash=EXCLUDED.unsubscribe_hash,delivery_key=EXCLUDED.delivery_key
    WHERE slx_interests.status='unsubscribed'`,[newId(),email,product,size,color,hashToken(token()),newId()]);
}

export async function unsubscribe(db, value) {
  requireThat(typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value),400,'Некоректне посилання.');
  await db.query("UPDATE slx_interests SET status='unsubscribed' WHERE unsubscribe_hash=$1",[hashToken(value)]);
}

export async function notifyLaunch(db, actor, product, env, origin, fetcher = fetch) {
  requireThat(launchMailReady(env),503,'Надсилання ще не налаштовано.');
  const deliver = launchMail(env,fetcher);
  const item = (await catalog(db)).find(row => row.id === product && row.status === 'available');
  requireThat(item,409,'Річ має бути доступною перед сповіщенням.');
  const result = {sent:0, failed:0};
  const claims = (await db.query(`UPDATE slx_interests SET status='sending',sent_at=now()
    WHERE id IN (SELECT id FROM slx_interests WHERE product=$1 AND
      (status='pending' OR (status='sending' AND sent_at<now()-interval '10 minutes'))
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 8) RETURNING id,email,size,color,delivery_key`,[product])).rows;
  await Promise.all(claims.map(async row => {
    const value = createHmac('sha256',env.SLX_UNSUBSCRIBE_SECRET).update(row.delivery_key).digest('base64url');
    try {
      await db.query("UPDATE slx_interests SET unsubscribe_hash=$2 WHERE id=$1 AND status='sending'",[row.id,hashToken(value)]);
      await deliver({event:'product.available',id:row.delivery_key,email:row.email,product,size:row.size,color:row.color,
        url:`${origin}/product-${product}.html`,unsubscribe:`${origin}/account.html#unsubscribe=${value}`},item.name);
      await db.query("UPDATE slx_interests SET status='sent',sent_at=now() WHERE id=$1 AND status='sending'",[row.id]);
      result.sent++;
    } catch {
      await db.query("UPDATE slx_interests SET status='pending',sent_at=NULL WHERE id=$1 AND status='sending'",[row.id]);
      result.failed++;
    }
  }));
  await audit(db,actor,'interest.dispatch',product);
  return result;
}
