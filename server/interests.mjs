import { createHmac } from 'node:crypto';
import { emailAddress, hashToken, newId, requireThat, text, throttle, token } from './security.mjs';
import { catalog, audit } from './orders.mjs';
import { launchMail, launchMailReady } from './launch-mail.mjs';

export async function interest(db, data, ip) {
  requireThat(data.consent === true && (data.website === undefined || data.website === ''),
    400,'Consent is required to receive emails.');
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
  await db.query(`INSERT INTO slx_interests(id,email,product,size,color,unsubscribe_hash,delivery_key,status,consent_at,consent_version)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',now(),'2026-11-26')
    ON CONFLICT(email,product,size,color) DO NOTHING`,[newId(),email,product,size,color,hashToken(token()),newId()]);
}

export async function unsubscribe(db, value, erase = false) {
  requireThat(typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value),400,'Некоректне посилання.');
  await db.query(erase ? 'DELETE FROM slx_interests WHERE unsubscribe_hash=$1'
    : "UPDATE slx_interests SET status='unsubscribed' WHERE unsubscribe_hash=$1",[hashToken(value)]);
}

export async function notifyLaunch(db, actor, product, env, origin, fetcher = fetch) {
  requireThat(launchMailReady(env),503,'Надсилання ще не налаштовано.');
  const deliver = launchMail(env,fetcher);
  const item = (await catalog(db)).find(row => row.id === product && row.status === 'available');
  requireThat(item,409,'Річ має бути доступною перед сповіщенням.');
  const result = {sent:0, failed:0};
  const claims = (await db.query(`UPDATE slx_interests SET status='sending',sent_at=now()
    WHERE id IN (SELECT id FROM slx_interests WHERE product=$1 AND consent_at IS NOT NULL AND
      (status='pending' OR (status='sending' AND sent_at<now()-interval '10 minutes'))
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 8) RETURNING id,email,size,color,delivery_key`,[product])).rows;
  await Promise.all(claims.map(async row => {
    const value = createHmac('sha256',env.SLX_UNSUBSCRIBE_SECRET).update(row.delivery_key).digest('base64url');
    try {
      const claim = await db.query("UPDATE slx_interests SET unsubscribe_hash=$2 WHERE id=$1 AND status='sending' RETURNING id",[row.id,hashToken(value)]);
      if (!claim.rows.length) return;
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
